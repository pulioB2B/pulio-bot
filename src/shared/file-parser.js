// src/shared/file-parser.js
import axios from "axios";
import * as XLSX from "xlsx";

/**
 * 슬랙에서 파일 URL을 받아 내용을 텍스트로 변환
 */
export async function parseSlackFile(fileUrl, fileType, botToken) {
  // 슬랙 파일 다운로드 (인증 필요)
  const response = await axios.get(fileUrl, {
    headers: { Authorization: `Bearer ${botToken}` },
    responseType: "arraybuffer",
  });

  const buffer = Buffer.from(response.data);
  const mimeType = fileType?.toLowerCase() ?? "";

  // PDF
  if (mimeType.includes("pdf")) {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return { text: data.text, type: "PDF" };
  }

  // Excel / CSV
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("xlsx") ||
    mimeType.includes("csv")
  ) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    let text = "";
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      text += `[시트: ${sheetName}]\n`;
      text += XLSX.utils.sheet_to_csv(sheet);
      text += "\n\n";
    });
    return { text, type: "Excel/CSV" };
  }

  // 일반 텍스트 / Markdown / 코드
  if (mimeType.includes("text") || mimeType.includes("plain")) {
    return { text: buffer.toString("utf-8"), type: "텍스트" };
  }

  // PPT (텍스트 추출 제한적 — 파일명과 함께 안내)
  if (mimeType.includes("presentation") || mimeType.includes("pptx")) {
    return {
      text: "[PPT 파일 — 텍스트 추출이 제한적입니다. 주요 내용을 직접 붙여넣어 주시면 더 정확히 분석할 수 있습니다.]",
      type: "PPT",
    };
  }

  return { text: "[지원하지 않는 파일 형식입니다]", type: "알 수 없음" };
}

/**
 * Google Sheets 링크에서 데이터 추출 (공개 시트 기준)
 * 비공개 시트는 Google Sheets API 별도 연동 필요
 */
export async function fetchGoogleSheet(url) {
  // 공개 시트 CSV export URL로 변환
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("구글 시트 URL 형식이 올바르지 않습니다");

  const sheetId = match[1];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  const response = await axios.get(csvUrl);
  return { text: response.data, type: "Google Sheets" };
}
