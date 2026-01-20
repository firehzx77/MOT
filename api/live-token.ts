// api/live-token.ts
import { GoogleGenAI } from "@google/genai";

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

export default async function handler(req: any, res: any) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    // 你也可以不显式传 apiKey，让 SDK 自动从 GEMINI_API_KEY/GOOGLE_API_KEY 读取
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY/GOOGLE_API_KEY" });

    // Ephemeral Token 用于 Live：目前要求 v1alpha
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });

    const body = req.body || {};
    const model = body.model || "gemini-2.5-flash-native-audio-preview-12-2025";
    const temperature = typeof body.temperature === "number" ? body.temperature : 0.7;

    // 默认：1 分钟内可新建会话；30 分钟内可持续对话（可按需调小）
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        // 关键：把 Live 的配置锁在服务端（更安全）
        // JS SDK 字段名为 bidiGenerateContentSetup
        bidiGenerateContentSetup: {
          model,
          config: {
            sessionResumption: {},          // 允许断线续连
            temperature,
            responseModalities: ["AUDIO"],  // 语音对练
          },
        },
      },
    });

    // 前端拿 token.name 当 apiKey 使用
    return res.status(200).json({
      token: token.name,
      expireTime,
      newSessionExpireTime,
      model,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to create ephemeral token",
      detail: err?.message || String(err),
    });
  }
}
