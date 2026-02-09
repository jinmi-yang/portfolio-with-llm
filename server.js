// server.js — Gemini API Proxy Server
// API 키는 환경변수 또는 .env 파일에 저장되어 클라이언트에 절대 노출되지 않습니다.

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── 환경변수에서 API 키 로드 ───
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log('API KEY loaded:', GEMINI_API_KEY ? '✅ Yes' : '❌ No');
if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
  console.error('   .env 파일에 GEMINI_API_KEY=your_key_here 를 추가하세요.');
  process.exit(1);
}

// ─── 지식 문서 로드 ───
const KNOWLEDGE_PATH = path.join(__dirname, 'knowledge.md');
let knowledgeDoc = '';
try {
  knowledgeDoc = fs.readFileSync(KNOWLEDGE_PATH, 'utf-8');
  console.log('📄 지식 문서 로드 완료 (' + knowledgeDoc.length + '자)');
} catch (e) {
  console.warn('⚠️ knowledge.md 파일이 없습니다. 일반 챗봇으로 작동합니다.');
}

// ─── 미들웨어 ───
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// CORS: 허용할 도메인을 설정하세요
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: origin not allowed'));
    }
  }
}));

// ─── Rate Limiting (IP당 분당 20회) ───
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: '요청이 너무 많습니다. 1분 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/chat', limiter);

// ─── Gemini 프록시 엔드포인트 ───
app.post('/api/chat', async (req, res) => {
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

    // 시스템 프롬프트 + 문서를 첫 번째 메시지로 주입
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
      console.error('Gemini API error:', data?.error?.message);
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini API 오류가 발생했습니다.'
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ reply });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});