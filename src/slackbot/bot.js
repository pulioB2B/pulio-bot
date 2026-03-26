// src/slackbot/bot.js
import { App } from "@slack/bolt";
import { chatWithClaude, analyzeWithFile } from "../shared/claude.js";
import { parseSlackFile, fetchGoogleSheet } from "../shared/file-parser.js";

export function createSlackApp() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true, // Socket Mode — 별도 public URL 불필요
    appToken: process.env.SLACK_APP_TOKEN,
  });

  // ─── 멘션 핸들러 (@풀리오봇 ...) ───────────────────────────────────────
  app.event("app_mention", async ({ event, client, say }) => {
    try {
      // 타이핑 중 표시
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
              text: `⚠️ 시트를 불러오지 못했어요: ${e.message}\n비공개 시트라면 CSV로 내보내서 첨부해주세요.`,
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

      // ── 일반 대화 (스레드 히스토리 유지) ──
      const history = await buildThreadHistory(client, event);
      const answer = await chatWithClaude(history);
      await say({ text: answer, thread_ts: event.ts });

      // 타이핑 이모지 제거
      await client.reactions.remove({
        channel: event.channel,
        timestamp: event.ts,
        name: "thinking_face",
      });
    } catch (err) {
      console.error("슬랙봇 오류:", err);
      await say({
        text: `❌ 오류가 발생했어요: ${err.message}`,
        thread_ts: event.ts,
      });
    }
  });

  return app;
}

// ── 스레드 대화 히스토리 → Claude messages 형식으로 변환 ──
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
    // 스레드 없는 첫 멘션
    const cleanText = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
    messages.push({ role: "user", content: cleanText });
  }

  return messages;
}
