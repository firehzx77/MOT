import React, { useState, useRef, useEffect } from 'react';
import { PracticeConfig, ChatMessage, MOTStage, ScoringResult } from '../types';
import { GeminiService } from '../services/geminiService';
import { decode, decodeAudioData, createPcmBlob } from '../utils/audio';
import VoiceMessage from './VoiceMessage';
import CoachPanel from './CoachPanel';

const gemini = new GeminiService();

interface RoomProps {
  config: PracticeConfig;
  onFinish: (results: ScoringResult[]) => void;
  onBack: () => void;
}

const Room: React.FC<RoomProps> = ({ config, onFinish, onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentScore, setCurrentScore] = useState<ScoringResult | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoringResult[]>([]);
  const [showCoach, setShowCoach] = useState(false);

  // 播放端：用于拼接播放 Live 输出的音频 chunk
  const nextStartTimeRef = useRef<number>(0);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Live session / 麦克风流
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 录音端 AudioContext（避免泄漏）
  const recCtxRef = useRef<AudioContext | null>(null);
  const recSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 用于流式更新当前回合内容
  const currentModelMsgIdRef = useRef<string | null>(null);
  const currentUserMsgIdRef = useRef<string | null>(null);
  const fullModelTextRef = useRef('');
  const fullUserTextRef = useRef('');

  const scrollToEnd = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToEnd, [messages]);

  // 初始化播放 AudioContext（24k）
  useEffect(() => {
    audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    return () => {
      try { audioContextOutRef.current?.close(); } catch {}
      audioContextOutRef.current = null;
    };
  }, []);

  const stopAllAudio = () => {
    activeSourcesRef.current.forEach(source => { try { source.stop(); } catch {} });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const cleanupRecordingChain = async () => {
    // 停止麦克风流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    // 断开/关闭录音 AudioContext
    try { recProcessorRef.current?.disconnect(); } catch {}
    try { recSourceRef.current?.disconnect(); } catch {}
    recProcessorRef.current = null;
    recSourceRef.current = null;

    if (recCtxRef.current) {
      try { await recCtxRef.current.close(); } catch {}
      recCtxRef.current = null;
    }
  };

  const playAudioChunk = async (base64: string) => {
    if (!audioContextOutRef.current) return;
    const ctx = audioContextOutRef.current;

    try {
      // Live audio 通常是 24k mono PCM chunk（你 utils/audio 的 decodeAudioData 负责把 PCM -> AudioBuffer）
      const audioBuffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      activeSourcesRef.current.add(source);
      source.onended = () => activeSourcesRef.current.delete(source);
    } catch (e) {
      console.error("音频播放失败", e);
    }
  };

  // 初始化 Live Session（跟随 config 变化重建）
  useEffect(() => {
    let isActive = true;

    const initSession = async () => {
      try {
        // 如果切换 config，先清理上一轮残留
        stopAllAudio();
        await cleanupRecordingChain();

        const callbacks = {
          onopen: () => {
            if (!isActive) return;
            console.log('Live Session 开启');
          },

          onmessage: async (message: any) => {
            if (!isActive) return;

            // 收到任何有效内容（音频、转写或回合结束信号），立即停止 Loading
            if (message.serverContent) {
              const hasContent =
                message.serverContent.modelTurn?.parts?.some((p: any) => p.inlineData) ||
                message.serverContent.outputTranscription ||
                message.serverContent.turnComplete;

              if (hasContent) setIsProcessing(false);
            }

            // 1) 播放模型音频
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              playAudioChunk(audioData);
            }

            // 2) 用户转写（流式）
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text || '';
              if (text) {
                fullUserTextRef.current += text;
                if (currentUserMsgIdRef.current) {
                  setMessages(prev => prev.map(m =>
                    m.id === currentUserMsgIdRef.current ? { ...m, text: fullUserTextRef.current } : m
                  ));
                }
              }
            }

            // 3) 模型转写（流式）
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text || '';
              if (text) {
                fullModelTextRef.current += text;

                if (!currentModelMsgIdRef.current) {
                  const newId = 'model-' + Date.now();
                  currentModelMsgIdRef.current = newId;
                  setMessages(prev => [...prev, {
                    id: newId,
                    role: 'model',
                    text: fullModelTextRef.current,
                    timestamp: Date.now()
                  }]);
                } else {
                  setMessages(prev => prev.map(m =>
                    m.id === currentModelMsgIdRef.current ? { ...m, text: fullModelTextRef.current } : m
                  ));
                }
              }
            }

            // 4) 打断：立即停音
            if (message.serverContent?.interrupted) {
              stopAllAudio();
            }

            // 5) 回合结束：触发评分
            if (message.serverContent?.turnComplete) {
              const modelFinal = fullModelTextRef.current.trim();
              const userFinal = fullUserTextRef.current.trim();

              if (modelFinal && userFinal) {
                try {
                  const score = await gemini.scoreRound(config.stage, userFinal, modelFinal, config);
                  if (!isActive) return;
                  setCurrentScore(score);
                  setScoreHistory(prev => [...prev, score]);
                } catch (e) {
                  console.error("评分失败", e);
                }
              }

              // 重置回合追踪器
              currentModelMsgIdRef.current = null;
              currentUserMsgIdRef.current = null;
              fullModelTextRef.current = '';
              fullUserTextRef.current = '';
              setIsProcessing(false);
            }
          },

          onerror: (e: any) => {
            if (!isActive) return;
            console.error('Session 错误', e);
            setIsProcessing(false);
          },

          onclose: () => {
            if (!isActive) return;
            console.log('Session 关闭');
            setIsProcessing(false);
          }
        };

        // ✅ 这里保持 await（你的 connectLive 现在应该是 async）
        sessionRef.current = await gemini.connectLive(config, callbacks);
      } catch (err) {
        console.error("Session 初始化失败", err);
        setIsProcessing(false);
      }
    };

    initSession();

    return () => {
      isActive = false;
      try { sessionRef.current?.close(); } catch {}
      sessionRef.current = null;
      stopAllAudio();
      cleanupRecordingChain();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const startRecording = async () => {
    stopAllAudio();
    if (!sessionRef.current) return;

    try {
      // 防止重复创建链路
      await cleanupRecordingChain();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      recCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      recSourceRef.current = source;

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      recProcessorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        sessionRef.current?.sendRealtimeInput({
          media: { data: createPcmBlob(inputData), mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setIsRecording(true);
      setIsProcessing(false);

      const uId = 'user-' + Date.now();
      currentUserMsgIdRef.current = uId;
      fullUserTextRef.current = '';
      setMessages(prev => [...prev, {
        id: uId,
        role: 'user',
        text: '正在识别语音...',
        timestamp: Date.now()
      }]);

    } catch (err) {
      console.error(err);
      alert("麦克风无法启动，请检查权限。");
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    // 停止录音链路资源（很关键）
    await cleanupRecordingChain();

    // 只有在停止录音且未收到反馈前显示 Loading
    setIsProcessing(true);

    // 告诉 Live：本轮结束
    sessionRef.current?.sendRealtimeInput({
      media: { data: '', mimeType: 'audio/pcm;rate=16000' },
      end_of_turn: true
    });

    // 如果没有任何文字转写，更新占位符
    if (!fullUserTextRef.current && currentUserMsgIdRef.current) {
      setMessages(prev => prev.map(m =>
        m.id === currentUserMsgIdRef.current ? { ...m, text: '语音已发送' } : m
      ));
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 关卡指示器 */}
      <div className="bg-white px-4 py-2 border-b flex justify-between items-center text-xs text-gray-500 sticky top-0 z-10 shadow-sm">
        <div className="flex space-x-2 items-center overflow-x-auto">
          {[MOTStage.EXPLORE, MOTStage.PROPOSE, MOTStage.ACT, MOTStage.CONFIRM].map((s, idx) => (
            <div key={s} className="flex items-center">
              <span className={`px-2 py-1 rounded-full whitespace-nowrap transition-colors ${config.stage === s ? 'bg-blue-600 text-white font-bold' : 'bg-gray-100'}`}>
                {s}
              </span>
              {idx < 3 && <span className="mx-1 text-gray-300">→</span>}
            </div>
          ))}
        </div>
        <button
          onClick={onBack}
          className="text-blue-600 font-medium px-2 py-1 hover:bg-blue-50 rounded transition-colors"
        >
          退出
        </button>
      </div>

      {/* 聊天区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="text-center mt-20 text-gray-400 space-y-2">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium">按住下方按钮开始对话</p>
            <p className="text-xs">当前角色：{config.persona}客户</p>
          </div>
        )}

        {messages.map(msg => (
          <VoiceMessage key={msg.id} message={msg} showText={true} />
        ))}

        {isProcessing && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 flex items-center space-x-2 shadow-md">
              <div className="flex space-x-1">
                <span className="wave-bar" style={{ animationDelay: '0s' }}></span>
                <span className="wave-bar" style={{ animationDelay: '0.2s' }}></span>
                <span className="wave-bar" style={{ animationDelay: '0.4s' }}></span>
              </div>
              <span className="text-xs text-gray-500 font-medium ml-1">客户正在回应...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* 控制区域 */}
      <div className="p-4 bg-white border-t space-y-4 shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between space-x-4">
          <button
            onClick={() => setShowCoach(!showCoach)}
            disabled={!currentScore}
            className={`p-3 rounded-full border transition-all shadow-sm ${
              showCoach
                ? 'bg-blue-600 border-blue-600 text-white'
                : currentScore
                  ? 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'
                  : 'bg-white border-gray-200 text-gray-300 grayscale cursor-not-allowed'
            }`}
            title="查看教练反馈"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.364-6.364l-.707-.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M12 7a5 5 0 015 5 5 5 0 01-5 5 5 5 0 01-5-5 5 5 0 015-5z" />
            </svg>
          </button>

          <div className="relative flex-1">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={isProcessing}
              className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center space-x-3 transition-all shadow-lg active:scale-95 ${
                isRecording
                  ? 'bg-red-500 text-white ring-4 ring-red-100'
                  : isProcessing
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isRecording ? (
                <>
                  <div className="flex space-x-1 items-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping delay-75"></div>
                  </div>
                  <span>正在聆听...</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                  </svg>
                  <span>按住说话</span>
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => onFinish(scoreHistory)}
            className="p-3 rounded-full border bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
            title="结束并查看报告"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {showCoach && currentScore && <CoachPanel score={currentScore} onClose={() => setShowCoach(false)} />}
    </div>
  );
};

export default Room;
