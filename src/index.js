// src/index.js
import "dotenv/config";
import express from "express";
import { createSlackApp } from "./slackbot/bot.js";
import vocRoutes from "./voc/routes.js";

const PORT = process.env.PORT ?? 3000;

async function main() {
  // ── Express 서버 (VOC 수신용) ──
  const expressApp = express();
  expressApp.use(express.json());
  expressApp.use("/api", vocRoutes);

  expressApp.listen(PORT, () => {
    console.log(`✅ VOC 서버 실행 중: http://localhost:${PORT}`);
    console.log(`   VOC 엔드포인트: POST /api/voc`);
  });

  // ── 슬랙 앱 (Socket Mode) ──
  const slackApp = createSlackApp();
  await slackApp.start();
  console.log("✅ 풀리오 슬랙봇 실행 중 (Socket Mode)");
  console.log("   @풀리오봇 으로 멘션하면 응답합니다");
}

main().catch((err) => {
  console.error("시작 오류:", err);
  process.exit(1);
});
