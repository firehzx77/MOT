// api/review.ts
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
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY/GOOGLE_API_KEY" });

    const ai = new GoogleGenAI({ apiKey });

    const body = req.body || {};
    const scenario = String(body.scenario || "通用服务场景");
    const transcript = String(body.transcript || "").trim();
    if (!transcript) return res.status(400).json({ error: "Missing transcript" });

    const model = String(body.model || "gemini-2.5-flash");

    // 结构化输出 schema（让前端不用“猜”模型输出）
    const reviewSchema = {
      type: "object",
      properties: {
        overallScore: { type: "integer", minimum: 0, maximum: 100 },
        dimensionScores: {
          type: "object",
          properties: {
            explore: { type: "integer", minimum: 0, maximum: 5 },   // 探索
            suggest: { type: "integer", minimum: 0, maximum: 5 },   // 提议
            act: { type: "integer", minimum: 0, maximum: 5 },       // 行动
            confirm: { type: "integer", minimum: 0, maximum: 5 },   // 确认
            empathy: { type: "integer", minimum: 0, maximum: 5 },
            clarity: { type: "integer", minimum: 0, maximum: 5 },
          },
          required: ["explore", "suggest", "act", "confirm", "empathy", "clarity"],
        },
        keyMoments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              step: { type: "string", enum: ["探索", "提议", "行动", "确认", "其他"] },
              userSaid: { type: "string" },
              coachResponseIdeal: { type: "string" },
              whatWentWell: { type: "string" },
              improve: { type: "string" },
            },
            required: ["step", "userSaid", "coachResponseIdeal", "whatWentWell", "improve"],
          },
          maxItems: 6,
        },
        top3Fixes: {
          type: "array",
          items: { type: "string" },
          maxItems: 3,
        },
        nextPractice: {
          type: "object",
          properties: {
            focus: { type: "string" },
            microScript: {
              type: "array",
              items: { type: "string" },
              maxItems: 6,
            },
            nextUserPrompt: { type: "string" },
          },
          required: ["focus", "microScript", "nextUserPrompt"],
        },
        summary: { type: "string" },
      },
      required: ["overallScore", "dimensionScores", "keyMoments", "top3Fixes", "nextPractice", "summary"],
    };

    const prompt = `
你是一名“客户体验/MOT关键时刻”教练。请用中文对以下对话做复盘评分，输出必须严格符合给定JSON Schema。

评分框架（务必使用）：
- 四阶段：探索(了解需求/想法，建立信任)、提议(互惠/双赢承诺与行动计划)、行动(履行承诺，5个C：Customer/Contingency/Communication/Co-ordinate/Complete)、确认(确认达到或超过期望，客户认知是唯一标准)。
- 倾听要点（用于探索加权）：非语言、问开放式问题(如何/什么/为什么)、不打岔善用沉默、记笔记并利用、用“您说的是…”确认、回应观感、站在同一立场。
- 输出：给出总体分(0-100) + 各维度0-5分 + 最关键的≤6个“关键时刻点评” + Top3改进点 + 下一轮训练焦点与微话术。

场景：${scenario}
对话文本（按时间顺序，可能包含“客户/我/系统”等标识）：
${transcript}

注意：
- microScript 要给“可直接照读”的短句，偏口语、服务场景适配。
- coachResponseIdeal 要给更好的“中文一句话/两句话回应”，不要长篇说教。
`.trim();

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseJsonSchema: reviewSchema,
      },
    });

    let json: any = null;
    try {
      json = JSON.parse(response.text);
    } catch {
      return res.status(500).json({
        error: "Model returned non-JSON output",
        raw: response.text,
      });
    }

    return res.status(200).json(json);
  } catch (err: any) {
    return res.status(500).json({
      error: "Review failed",
      detail: err?.message || String(err),
    });
  }
}
