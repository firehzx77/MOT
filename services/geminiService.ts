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

// ✅ 允许：前端在 GH Pages，后端在 Vercel（跨域）
//   - 本地 / 同域部署：VITE_API_BASE_URL 留空即可
//   - GH Pages：VITE_API_BASE_URL = "https://你的vercel域名"
const API_BASE =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env &&
    (import.meta as any).env.VITE_API_BASE_URL) ||
  "";

function toUrl(path: string) {
  if (!path) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!API_BASE) return path; // 同域
  // 组合成 https://xxx.vercel.app + /api/...
  return `${API_BASE.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

async function postJSON<T>(url: string, body: any): Promise<T> {
  const finalUrl = toUrl(url);
  const r = await fetch(finalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`POST ${finalUrl} failed: ${r.status} ${text}`);
  }
  return (await r.json()) as T;
}

/**
 * ✅ 评分结果归一化：兼容不同后端 schema
 *  - 如果后端已经是 ScoringResult（含 dimension_scores 等）→ 直接返回
 *  - 如果后端是 {overallScore, dimensionScores, keyMoments, ...} → 映射成旧结构
 */
function normalizeScore(raw: any, stage: MOTStage): ScoringResult {
  if (!raw || typeof raw !== "object") return raw as ScoringResult;

  // 1) 如果已经是“旧结构”（你 UI 很可能用这个）
  if (raw.dimension_scores && raw.highlights && raw.improvements) {
    return raw as ScoringResult;
  }

  // 2) 如果是“新结构”（overallScore / dimensionScores / keyMoments / top3Fixes / nextPractice）
  const hasNewShape =
    typeof raw.overallScore === "number" &&
    raw.dimensionScores &&
    typeof raw.dimensionScores === "object";

  if (!hasNewShape) {
    // 不确定结构，原样返回（至少不阻塞）
    return raw as ScoringResult;
  }

  const ds = raw.dimensionScores || {};
  const toNum = (v: any, d = 0) => (typeof v === "number" ? v : d);

  // dimensionScores (0-5) -> 旧结构的 5 项
  const explore = toNum(ds.explore);
  const suggest = toNum(ds.suggest);
  const act = toNum(ds.act);
  const confirm = toNum(ds.confirm);
  const empathy = toNum(ds.empathy);
  const clarity = toNum(ds.clarity);

  const highlights: string[] = [];
  const improvements: string[] = [];

  if (Array.isArray(raw.keyMoments)) {
    for (const km of raw.keyMoments.slice(0, 6)) {
      if (km?.whatWentWell) highlights.push(String(km.whatWentWell));
      if (km?.improve) improvements.push(String(km.improve));
    }
  }

  if (Array.isArray(raw.top3Fixes)) {
    for (const x of raw.top3Fixes) improvements.push(String(x));
  }

  const betterScript =
    (raw.keyMoments?.[0]?.coachResponseIdeal && String(raw.keyMoments[0].coachResponseIdeal)) ||
    (Array.isArray(raw.nextPractice?.microScript) ? raw.nextPractice.microScript.join(" / ") : "") ||
    "";

  const nextMove =
    (raw.nextPractice?.nextUserPrompt && String(raw.nextPractice.nextUserPrompt)) ||
    (raw.nextPractice?.focus && `下一轮聚焦：${String(raw.nextPractice.focus)}`) ||
    "";

  const riskAlert =
    (raw.summary && String(raw.summary)) || "";

  // 旧结构 stage_goal_hit（0~1 或 0~100？你原项目不确定）
  // 这里给一个“0~1”的命中率（overallScore/100）
  const stageGoalHit = Math.max(0, Math.min(1, toNum(raw.overallScore) / 100));

  const mapped: any = {
    stage: String(stage),
    stage_goal_hit: stageGoalHit,
    dimension_scores: {
      "倾听与复述": Math.round(((explore + empathy) / 2) * 10) / 10,
      "澄清与提问": Math.round(explore * 10) / 10,
      "共情与态度": Math.round(empathy * 10) / 10,
      "方案与承诺清晰": Math.round(((suggest + act + clarity) / 3) * 10) / 10,
      "确认闭环": Math.round(confirm * 10) / 10,
    },
    highlights: highlights.length ? highlights.slice(0, 5) : ["能维持对话推进，具备基本服务态度。"],
    improvements: improvements.length ? improvements.slice(0, 5) : ["加强探索提问与确认闭环。"],
    better_script: betterScript || "我理解您的感受。为了更快解决，我想确认两点：…（开放式问题）",
    next_move: nextMove || "请用 1 句共情 + 2 个开放式问题，先把客户真实需求问出来。",
    risk_alert: riskAlert || undefined,
  };

  return mapped as ScoringResult;
}

export class GeminiService {
  /**
   * ✅ TTS：走后端 /api/tts
   * 注意：当前返回的是 WAV(base64)。如果你在前端用 WebAudio 的 PCM 播放函数，
   * 需要改成 Blob(audio/wav) 播放；或让后端改回 PCM（看你产品形态）。
   */
  async getTTSAudio(text: string, voiceName: string): Promise<string> {
    const data = await postJSON<TTSResp>("/api/tts", {
      text,
      voiceName,
      // style: "温和/专业/安抚/坚定"
      // model: "gemini-2.5-flash-preview-tts"
    });
    return data.audioBase64; // wav base64
  }

  /**
   * ✅ 评分：走后端 /api/review，并做结构兼容
   */
  async scoreRound(
    stage: MOTStage,
    userTranscript: string,
    customerText: string,
    practiceConfig: PracticeConfig
  ): Promise<ScoringResult> {
    const transcript = `用户（服务者）："${userTranscript}"\n客户回应："${customerText}"`;
    const scenario = `${practiceConfig.industry}｜${practiceConfig.persona}｜${stage}`;

    const raw = await postJSON<any>("/api/review", {
      scenario,
      transcript,
      // model: "gemini-2.5-flash"
    });

    return normalizeScore(raw, stage);
  }

  /**
   * ✅ Live：先从 /api/live-token 拿 ephemeral token，再用 token 连接 Live
   * 官方说明 ephemeral token 目前仅兼容 Live，且需 v1alpha。
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
      // 下面这些字段：如果你后端 live-token.ts 做了“锁配置”，可以一起传过去
      // systemInstruction,
      // voiceName: "Zephyr",
      // responseModalities: ["AUDIO"],
    });

    // 2) 用 ephemeral token 作为 apiKey 创建客户端
    // ✅ 显式指定 v1alpha（ephemeral token only for Live & v1alpha）
    const ai = new GoogleGenAI({
      apiKey: tokenResp.token,
      httpOptions: { apiVersion: "v1alpha" },
    });

    // 3) 连接 Live（音频对练 + 双向转写）
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
