// src/shared/claude.js
import Anthropic from "@anthropic-ai/sdk";
import { PULLYO_SYSTEM_PROMPT } from "../../config/pullyo-context.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * 일반 대화 (슬랙봇용) — 스레드 히스토리 유지
 */
export async function chatWithClaude(
  messages,
  systemPrompt = PULLYO_SYSTEM_PROMPT,
) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
      },
    ],
    messages,
  });

  // web_search 사용 시 여러 content block 중 텍스트만 추출
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/**
 * 파일 내용 포함 분석
 */
export async function analyzeWithFile(
  userMessage,
  fileContent,
  fileType = "text",
) {
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `다음은 첨부된 파일 내용입니다 (형식: ${fileType}):\n\n${fileContent}\n\n---\n\n${userMessage}`,
        },
      ],
    },
  ];
  return chatWithClaude(messages);
}
