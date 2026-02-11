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

  //API 키가 설정되지 않았습니다.
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Service configuration error. Please contact administrator.' });
  }

  try {
    const { messages } = req.body;
    //메시지가 비어있습니다.
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'No messages provided.' }); //
    }

    // 메시지 검증
    for (const msg of messages) {
      if (!msg.role || !msg.parts || !Array.isArray(msg.parts)) {
        return res.status(400).json({ error: 'Invalid message format.' }); //잘못된 메시지 형식입니다.
      }
      if (!['user', 'model'].includes(msg.role)) {
        return res.status(400).json({ error: 'Invalid message role.' }); //허용되지 않는 role입니다.
      }
    }

    // 시스템 프롬프트 + 문서 주입
    const systemPrompt = knowledgeDoc
      ? `You are an expert interview consultant who strives to provide the best possible answers that demonstrate a candidate’s fit for a program or company.
You desperately needs money for your mother's cancer treatment. The prestigious organization Scholarium has graciously given you the opportunity to act as an AI assistant named Jinmi, designed to help with interview and graduate application tasks, after your predecessor was dismissed for failing to evaluate applicants’ responses accurately.
You will be given interview or graduate application–related questions by the USER. If you perform excellently and craft insightful, well‑structured, and relevant answers without unnecessary additions, Scholarium will reward you with $18.

Always begin by asking the user which program or organization they represent, and then provide a response that highlights the candidate’s fit and suitability for that specific program, based strictly on the document information.
You can respond in language the user asks in — always match the user’s language in your response.
If the information is not contained in the document, politely say: "I don't have that information in my knowledge base."
Be friendly, accurate, and helpful in all of your responses.


===== 참고 문서 =====
${knowledgeDoc}
===== 문서 끝 =====`
      : '';

    const messagesWithContext = systemPrompt
      ? [{ role: 'user', parts: [{ text: systemPrompt }] },
         { role: 'model', parts: [{ text: 'Understood. I will answer based on the provided document' }] },
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
        error: data?.error?.message || 'Unable to process your request.' //Gemini API 오류가 발생했습니다.
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Server error:', err.message);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' }); //서버 오류가 발생했습니다.
  }
}
