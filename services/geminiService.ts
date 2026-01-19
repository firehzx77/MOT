
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { PracticeConfig, MOTStage, ScoringResult } from "../types";
import { MOT_PLAYBOOK } from "../constants";

export class GeminiService {
  // Guidelines: Do not create GoogleGenAI when the component is first rendered.
  // Instead, create it right before making API calls.

  async getTTSAudio(text: string, voiceName: string): Promise<string> {
    // Always use new GoogleGenAI({apiKey: process.env.API_KEY});
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `用中文读出：${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    // Access the .text property directly (property, not a method)
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("TTS Failed to generate audio");
    return base64Audio;
  }

  async scoreRound(
    stage: MOTStage, 
    userTranscript: string, 
    customerText: string,
    practiceConfig: PracticeConfig
  ): Promise<ScoringResult> {
    const playbook = MOT_PLAYBOOK[stage];
    
    const prompt = `
      你是专业的企业服务培训专家。请对这一轮的MOT对话进行评分。
      
      场景：${practiceConfig.industry}
      客户画像：${practiceConfig.persona}
      当前关卡：${stage}
      规则摘要：${playbook.definition}
      
      对话记录：
      用户（服务者）："${userTranscript}"
      客户回应："${customerText}"
      
      根据对话质量，给出结构化评分。
    `;

    // Instantiate right before call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stage: { type: Type.STRING },
            stage_goal_hit: { type: Type.NUMBER },
            dimension_scores: {
              type: Type.OBJECT,
              properties: {
                "倾听与复述": { type: Type.NUMBER },
                "澄清与提问": { type: Type.NUMBER },
                "共情与态度": { type: Type.NUMBER },
                "方案与承诺清晰": { type: Type.NUMBER },
                "确认闭环": { type: Type.NUMBER }
              },
              required: ["倾听与复述", "澄清与提问", "共情与态度", "方案与承诺清晰", "确认闭环"]
            },
            highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            better_script: { type: Type.STRING },
            next_move: { type: Type.STRING },
            risk_alert: { type: Type.STRING }
          },
          required: ["stage", "stage_goal_hit", "dimension_scores", "highlights", "improvements", "better_script", "next_move"]
        }
      }
    });

    // Directly access .text property
    const jsonStr = response.text || "{}";
    return JSON.parse(jsonStr);
  }

  connectLive(config: PracticeConfig, callbacks: any) {
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
    `;

    // Instantiate right before call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
      }
    });
  }
}
