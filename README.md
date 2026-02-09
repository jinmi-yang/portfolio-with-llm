# Ask Gemini - AI Chat

EaseMate 스타일의 Gemini AI 채팅 웹페이지입니다.  
API 키는 서버에만 저장되어 방문자에게 절대 노출되지 않습니다.

## 🏗 구조

```
ask-gemini/
├── server.js          ← Node.js 프록시 서버 (API 키 보관)
├── public/
│   └── index.html     ← 프론트엔드 (방문자가 보는 화면)
├── .env.example       ← 환경변수 템플릿
├── package.json
└── README.md
```

## 🚀 로컬 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 열고 GEMINI_API_KEY에 실제 키를 입력

# 3. 서버 실행
npm start
# → http://localhost:3000 에서 확인
```

## 🌐 배포 방법

### Render / Railway / Fly.io 등
1. GitHub에 코드를 push
2. 해당 플랫폼에서 프로젝트 연결
3. 환경변수에 `GEMINI_API_KEY` 설정
4. Start command: `npm start`

### Vercel (Serverless)
`server.js`를 `api/chat.js`로 변환하여 Vercel serverless function으로 배포 가능

## 🔒 보안 설계

| 보안 항목 | 적용 방식 |
|-----------|-----------|
| API 키 보호 | 서버 환경변수에만 저장, 클라이언트 코드에 미포함 |
| Rate Limiting | IP당 분당 20회 제한 |
| CORS | 허용된 도메인만 접근 가능 |
| 입력 검증 | 메시지 형식 및 role 검증 |
| 요청 크기 제한 | 1MB 제한 |

## 📝 API 키 발급

[Google AI Studio](https://aistudio.google.com/apikey)에서 무료로 발급 가능합니다.
