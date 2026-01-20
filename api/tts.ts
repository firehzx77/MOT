// api/tts.ts
import { GoogleGenAI } from "@google/genai";

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function pcm16ToWavBuffer(pcm: Buffer, sampleRate = 24000, channels = 1) {
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);          // PCM fmt chunk size
  header.writeUInt16LE(1, 20);           // Audio format 1=PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
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
    const text = String(body.text || "").trim();
    if (!text) return res.status(400).json({ error: "Missing text" });

    // 你可以在前端提供下拉选择（Kore/Puck/...），中文也能读
    const voiceName = String(body.voiceName || "Kore");
    const style = String(body.style || "").trim(); // 例如：温和、专业、安抚、坚定、微笑语气
    const model = String(body.model || "gemini-2.5-flash-preview-tts");

    const prompt =
      style
        ? `请用【${style}】的语气，把下面内容用中文自然朗读出来（不要解释）：\n${text}`
        : `请把下面内容用中文自然朗读出来（不要解释）：\n${text}`;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const dataB64 =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!dataB64) {
      return res.status(500).json({ error: "No audio returned from model" });
    }

    // Gemini TTS 返回的是 base64 PCM；我们在后端封装成 wav，前端直接播放最省事
    const pcm = Buffer.from(dataB64, "base64");
    const wav = pcm16ToWavBuffer(pcm, 24000, 1);

    return res.status(200).json({
      mimeType: "audio/wav",
      audioBase64: wav.toString("base64"),
      sampleRate: 24000,
      channels: 1,
      voiceName,
      model,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "TTS failed",
      detail: err?.message || String(err),
    });
  }
}
