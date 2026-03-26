// src/slackbot/bot.js  ← 이 파일 내용으로 기존 bot.js를 교체하세요
// Socket Mode → HTTP 방식으로 변경 (Render 배포용)

import pkg from "@slack/bolt";
const { App, ExpressReceiver } = pkg;
import { chatWithClaude, analyzeWithFile } from "../shared/claude.js";
import { parseSlackFile, fetchGoogleSheet } from "../shared/file-parser.js";

// ExpressReceiver를 만들어서 기존 Express 앱과 통합
export function createExpressReceiver() {
  return new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    endpoints: "/slack/events", // Slack이 이 URL로 이벤트를 보냄
  });
}

export function createSlackApp(receiver) {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    receiver, // Socket Mode 대신 HTTP receiver 사용
  });

  app.event("app_mention", async ({ event, client, say }) => {
    try {
      await client.reactions.add({
        channel: event.channel,
        timestamp: event.ts,
        name: "thinking_face",
      });

      const userText = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();

      // ── 구글 시트 링크 감지 ──
      if (userText.includes("docs.google.com/spreadsheets")) {
        const urlMatch = userText.match(
          /https:\/\/docs\.google\.com\/spreadsheets\/[^\s>]+/,
        );
        if (urlMatch) {
          await say({
            text: "📊 구글 시트 불러오는 중...",
            thread_ts: event.ts,
          });
          try {
            const { text, type } = await fetchGoogleSheet(urlMatch[0]);
            const question =
              userText.replace(urlMatch[0], "").trim() ||
              "이 데이터를 분석해주세요.";
            const answer = await analyzeWithFile(question, text, type);
            await say({ text: answer, thread_ts: event.ts });
          } catch (e) {
            await say({
              text: `⚠️ 시트를 불러오지 못했어요: ${e.message}`,
              thread_ts: event.ts,
            });
          }
          return;
        }
      }

      // ── 첨부 파일 감지 ──
      if (event.files && event.files.length > 0) {
        await say({ text: "📎 파일 분석 중...", thread_ts: event.ts });
        const file = event.files[0];
        const { text: fileText, type } = await parseSlackFile(
          file.url_private_download,
          file.mimetype,
          process.env.SLACK_BOT_TOKEN,
        );
        const question = userText || "이 파일을 분석해주세요.";
        const answer = await analyzeWithFile(question, fileText, type);
        await say({ text: answer, thread_ts: event.ts });
        return;
      }

      // ── 일반 대화 ──
      const history = await buildThreadHistory(client, event);
      const answer = await chatWithClaude(history);
      await say({ text: answer, thread_ts: event.ts });

      await client.reactions.remove({
        channel: event.channel,
        timestamp: event.ts,
        name: "thinking_face",
      });
    } catch (err) {
      console.error("슬랙봇 오류:", err);
      await say({ text: `❌ 오류: ${err.message}`, thread_ts: event.ts });
    }
  });

  return app;
}

async function buildThreadHistory(client, event) {
  const messages = [];
  if (event.thread_ts) {
    const result = await client.conversations.replies({
      channel: event.channel,
      ts: event.thread_ts,
      limit: 20,
    });
    for (const msg of result.messages ?? []) {
      const isBotMessage = msg.bot_id != null;
      const cleanText = (msg.text ?? "").replace(/<@[A-Z0-9]+>/g, "").trim();
      if (!cleanText) continue;
      messages.push({
        role: isBotMessage ? "assistant" : "user",
        content: cleanText,
      });
    }
  } else {
    const cleanText = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
    messages.push({ role: "user", content: cleanText });
  }
  return messages;
}
