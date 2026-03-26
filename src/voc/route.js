// src/voc/routes.js
import express from "express";
import { WebClient } from "@slack/web-api";
import { analyzeVOC, buildSlackVOCMessage } from "./analyzer.js";

const router = express.Router();
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// VOC가 게시될 슬랙 채널 (환경변수로 관리)
const VOC_CHANNEL = process.env.VOC_SLACK_CHANNEL ?? "#voc-접수";

/**
 * POST /api/voc
 * 자사몰 폼 → 백엔드 서버가 이 엔드포인트로 전송
 *
 * Body:
 * {
 *   name: string,
 *   email: string,
 *   product: string,      // 제품명
 *   category: string,     // 문의 유형
 *   message: string,      // VOC 본문
 *   rating: number,       // 평점 (선택)
 *   secret: string        // VOC_SECRET 인증
 * }
 */
router.post("/voc", async (req, res) => {
  // 간단한 시크릿 인증 (프로덕션에서는 HMAC으로 교체 권장)
  if (req.body.secret !== process.env.VOC_SECRET) {
    return res.status(401).json({ error: "인증 실패" });
  }

  const vocData = req.body;

  // 1) 빠르게 응답 (분석은 비동기로)
  res.json({ ok: true, message: "VOC 접수 완료" });

  // 2) Claude 분석
  try {
    console.log(`[VOC] 새 접수: ${vocData.name} - ${vocData.category}`);
    const analysis = await analyzeVOC(vocData);
    const slackMessage = buildSlackVOCMessage(vocData, analysis);

    // 3) 슬랙 채널에 게시
    await slack.chat.postMessage({
      channel: VOC_CHANNEL,
      text: `새 VOC 접수: ${vocData.name}`,
      ...slackMessage,
    });

    console.log("[VOC] 슬랙 게시 완료");
  } catch (err) {
    console.error("[VOC] 처리 오류:", err);
    // 오류 발생 시 슬랙에 실패 알림
    await slack.chat
      .postMessage({
        channel: VOC_CHANNEL,
        text: `⚠️ VOC 분석 오류\n고객: ${vocData.name}\n오류: ${err.message}\n\n원본 메시지: ${vocData.message}`,
      })
      .catch(() => {});
  }
});

/**
 * GET /api/voc/health
 * 자사몰에서 연결 확인용
 */
router.get("/voc/health", (_, res) => res.json({ ok: true }));

export default router;
