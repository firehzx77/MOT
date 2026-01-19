
export enum MOTStage {
  EXPLORE = '探索',
  PROPOSE = '提议',
  ACT = '行动',
  CONFIRM = '确认',
  FULL = '完整流程'
}

export type Industry = '餐饮' | '零售' | '酒店' | '客服' | '售后';
export type Persona = '温和' | '挑剔' | '愤怒' | '犹豫' | '理性';

export interface PracticeConfig {
  industry: Industry;
  persona: Persona;
  stage: MOTStage;
  voiceName: string;
  showTranscription: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  audioBlob?: Blob;
  duration?: number;
  timestamp: number;
}

export interface DimensionScores {
  '倾听与复述': number;
  // Fixed typo: changed '澄清与提提问' to '澄清与提问'
  '澄清与提问': number;
  '共情与态度': number;
  '方案与承诺清晰': number;
  '确认闭环': number;
}

export interface ScoringResult {
  stage: string;
  stage_goal_hit: number;
  dimension_scores: DimensionScores;
  highlights: string[];
  improvements: string[];
  better_script: string;
  next_move: string;
  risk_alert: string;
}

export interface PlaybookEntry {
  definition: string;
  recommendations: string[];
  pitfalls: string[];
}
