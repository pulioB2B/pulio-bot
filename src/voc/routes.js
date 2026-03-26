// src/voc/routes.js
import express from "express";
import { WebClient } from "@slack/web-api";
import { analyzeVOC, buildSlackVOCMessage } from "./analyzer.js";

const router = express.Router();
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

const VOC_CHANNEL = process.env.VOC_SLACK_CHANNEL ?? "#voc-접수";

// ── CORS 설정 ──────────────────────────────────────────────────────────────
// 자사몰 도메인을 환경변수로 관리 (여러 개면 쉼표로 구분)
// 예) VOC_ALLOWED_ORIGINS=https://pullyo.co.kr,https://www.pullyo.co.kr
const ALLOWED_ORIGINS = process.env.VOC_ALLOWED_ORIGINS
  ? process.env.VOC_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["*"]; // 미설정 시 전체 허용 (개발용)

function setCORS(req, res) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// OPTIONS preflight 요청 처리 (브라우저가 POST 전에 먼저 보내는 요청)
router.options("/voc", (req, res) => {
  setCORS(req, res);
  res.sendStatus(204);
});

// ── POST /api/voc ──────────────────────────────────────────────────────────
router.post("/voc", async (req, res) => {
  setCORS(req, res);

  if (req.body.secret !== process.env.VOC_SECRET) {
    return res.status(401).json({ error: "인증 실패" });
  }

  const vocData = req.body;

  res.json({ ok: true, message: "VOC 접수 완료" });

  try {
    console.log(`[VOC] 새 접수: ${vocData.name} - ${vocData.category}`);
    const analysis = await analyzeVOC(vocData);
    const slackMessage = buildSlackVOCMessage(vocData, analysis);

    await slack.chat.postMessage({
      channel: VOC_CHANNEL,
      text: `새 VOC 접수: ${vocData.name}`,
      ...slackMessage,
    });

    console.log("[VOC] 슬랙 게시 완료");
  } catch (err) {
    console.error("[VOC] 처리 오류:", err);
    await slack.chat
      .postMessage({
        channel: VOC_CHANNEL,
        text: `⚠️ VOC 분석 오류\n고객: ${vocData.name}\n오류: ${err.message}\n\n원본 메시지: ${vocData.message}`,
      })
      .catch(() => {});
  }
});

// ── GET /api/voc/health ───────────────────────────────────────────────────
router.get("/voc/health", (req, res) => {
  setCORS(req, res);
  res.json({ ok: true });
});

export default router;
