// api/chat.js — Vercel Serverless Function (Gemini API Proxy)
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── 지식 문서 로드 ───
let knowledgeDoc = '';
try {
  knowledgeDoc = readFileSync(join(process.cwd(), 'knowledge.md'), 'utf-8');
} catch (e) {
  // knowledge.md 없으면 일반 챗봇으로 작동
}

export default async function handler(req, res) {
  // POST만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '메시지가 비어있습니다.' });
    }

    // 메시지 검증
    for (const msg of messages) {
      if (!msg.role || !msg.parts || !Array.isArray(msg.parts)) {
        return res.status(400).json({ error: '잘못된 메시지 형식입니다.' });
      }
      if (!['user', 'model'].includes(msg.role)) {
        return res.status(400).json({ error: '허용되지 않는 role입니다.' });
      }
    }

    // 시스템 프롬프트 + 문서 주입
    const systemPrompt = knowledgeDoc
      ? `당신은 아래 문서의 정보만을 기반으로 답변하는 AI 어시스턴트입니다.
문서에 없는 내용은 "해당 정보는 제가 가진 자료에 없습니다"라고 답하세요.
친절하고 정확하게 한국어로 답변하세요.

===== 참고 문서 =====
${knowledgeDoc}
===== 문서 끝 =====`
      : '';

    const messagesWithContext = systemPrompt
      ? [{ role: 'user', parts: [{ text: systemPrompt }] },
         { role: 'model', parts: [{ text: '네, 해당 문서를 기반으로 답변하겠습니다.' }] },
         ...messages]
      : messages;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messagesWithContext,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini API 오류가 발생했습니다.'
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
