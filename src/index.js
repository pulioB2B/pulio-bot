// src/index.js — HTTP 방식으로 변경 (Render 배포용)
import "dotenv/config";
import express from "express";
import { createExpressReceiver, createSlackApp } from "./slackbot/bot-http.js";
import vocRoutes from "./voc/routes.js";

const PORT = process.env.PORT ?? 3000;

async function main() {
  // 1) Slack ExpressReceiver 생성 (내부적으로 Express 라우터 포함)
  const receiver = createExpressReceiver();

  // 2) Slack 앱 초기화
  createSlackApp(receiver);

  // 3) receiver의 Express 앱에 VOC 라우터 추가
  receiver.app.use(express.json());
  receiver.app.use("/api", vocRoutes);

  // 4) 헬스체크 (Render가 서버 살아있는지 확인용)
  receiver.app.get("/", (_, res) => res.send("풀리오봇 running ✅"));

  // 5) 서버 시작
  await receiver.start(PORT);
  console.log(`✅ 풀리오봇 HTTP 서버 실행 중: port ${PORT}`);
  console.log(
    `   Slack Events URL: https://your-render-url.onrender.com/slack/events`,
  );
}

main().catch((err) => {
  console.error("시작 오류:", err);
  process.exit(1);
});
