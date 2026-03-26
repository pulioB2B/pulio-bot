// src/voc/analyzer.js
import Anthropic from "@anthropic-ai/sdk";
import { VOC_ANALYSIS_PROMPT } from "../../config/pullyo-context.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * VOC 데이터를 Claude로 분석하고 슬랙 메시지 반환
 */
export async function analyzeVOC(vocData) {
  const { name, email, product, category, message, rating } = vocData;

  const userContent = `
고객 VOC가 접수되었습니다. 분석해주세요.

- 고객명: ${name ?? "익명"}
- 이메일: ${email ?? "미제공"}
- 관련 제품: ${product ?? "미지정"}
- 문의 유형: ${category ?? "미분류"}
- 평점: ${rating ? `${rating}점` : "미제공"}
- 내용:
"${message}"
`.trim();

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: VOC_ANALYSIS_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  return response.content[0].text;
}

/**
 * 슬랙 Block Kit 형식의 VOC 알림 메시지 생성
 */
export function buildSlackVOCMessage(vocData, analysis) {
  const { name, email, product, message, rating } = vocData;

  const priorityEmoji = analysis.includes("높음")
    ? "🔴"
    : analysis.includes("중간")
      ? "🟡"
      : "🟢";
  const ratingStr = rating ? `⭐ ${rating}점` : "";

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${priorityEmoji} 새 VOC 접수`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*고객*\n${name ?? "익명"} (${email ?? "-"})`,
          },
          {
            type: "mrkdwn",
            text: `*제품*\n${product ?? "미지정"} ${ratingStr}`,
          },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*고객 메시지*\n> ${message}` },
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*🤖 Claude 분석*\n${analysis}` },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `접수 시각: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`,
          },
        ],
      },
    ],
  };
}
