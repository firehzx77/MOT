import { GoogleGenAI, Modality } from "@google/genai";
import { PracticeConfig, MOTStage, ScoringResult } from "../types";
import { MOT_PLAYBOOK } from "../constants";

type LiveTokenResp = {
  token: string;
  expireTime: string;
  newSessionExpireTime: string;
  model: string;
};

type TTSResp = {
  mimeType: string;      // "audio/wav"
  audioBase64: string;   // wav base64（后端已封装 wav header）
  sampleRate: number;
  channels: number;
  voiceName: string;
  model: string;
};

async function postJSON<T>(url: string, body: any): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`POST ${url} failed: ${r.status} ${text}`);
  }
  return (await r.json()) as T;
}

export class GeminiService {
  /**
   * ✅ TTS 改为走后端：/api/tts
   * 后端会用 GEMINI_API_KEY 调 Gemini TTS，并返回 wav(base64)
   */
  async getTTSAudio(text: string, voiceName: string): Promise<string> {
    const data = await postJSON<TTSResp>("/api/tts", {
      text,
      voiceName,
      // style: "温和/专业/安抚/坚定" 你也可以传
      // model: "gemini-2.5-flash-preview-tts"
    });
    return data.audioBase64; // wav base64
  }

  /**
   * ✅ 评分改为走后端：/api/review
   * 后端会用 structured JSON schema 输出稳定结构
   */
  async scoreRound(
    stage: MOTStage,
    userTranscript: string,
    customerText: string,
    practiceConfig: PracticeConfig
  ): Promise<ScoringResult> {
    // 你现在的 ScoringResult 结构如果和后端不完全一致，可在这里做一次映射
    const transcript = `用户（服务者）："${userTranscript}"\n客户回应："${customerText}"`;
    const scenario = `${practiceConfig.industry}｜${practiceConfig.persona}｜${stage}`;

    const result = await postJSON<ScoringResult>("/api/review", {
      scenario,
      transcript,
      // model: "gemini-2.5-flash"
    });

    return result;
  }

  /**
   * ✅ Live 连接：先向后端拿 ephemeral token（/api/live-token），再用 token 作为 apiKey 去连 Live
   * 这里必须 async
   */
  async connectLive(config: PracticeConfig, callbacks: any) {
    const playbook = MOT_PLAYBOOK[config.stage];

    const systemInstruction = `
你扮演一名在“${config.industry}”场景下的客户。你的画像是“${config.persona}”。
现在正在进行MOT（关键时刻）实战对练。
当前阶段目标：${config.stage} - ${playbook.definition}

你的任务：
1. 用简体中文对话，高度口语化，像一个真实的客户。
2. 针对学员（用户）的发言做出自然回应。
3. 考验学员是否能完成当前MOT阶段的目标。
4. 每次回复尽量保持在1-2句话，精简有力。
5. 不要输出任何评分，不要输出JSON。
6. 如果学员表现得不专业，你可以表达不满或犹豫，制造真实挑战。
`.trim();

    // 1) 向后端拿 token（不暴露长期 key）
    const tokenResp = await postJSON<LiveTokenResp>("/api/live-token", {
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      temperature: 0.7,
    });

    // 2) 用 ephemeral token 作为 apiKey 创建客户端
    const ai = new GoogleGenAI({ apiKey: tokenResp.token });

    // 3) 连接 Live（这里继续用你原本的音频模式）
    return ai.live.connect({
      model: tokenResp.model,
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
      },
    });
  }
}
