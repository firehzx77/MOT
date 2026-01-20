import React, { useMemo, useState } from 'react';
import { ChatMessage } from '../types';
import { base64ToBlobUrl, revokeBlobUrl } from '../utils/audio';

interface VoiceMessageProps {
  message: ChatMessage;
  showText?: boolean;
}

/**
 * 兼容两类消息：
 * 1) 纯文本（你现在已有）
 * 2) 可播放的语音条：message 上如果带 audioBase64 + mimeType（例如 audio/wav）
 *
 * 注意：ChatMessage 类型里可能没有 audioBase64/mimeType 字段；
 * 这里用 (message as any) 读取，保证不影响你现有类型定义。
 */
const VoiceMessage: React.FC<VoiceMessageProps> = ({ message, showText }) => {
  const isModel = message.role === 'model';

  // 可选音频字段（不破坏现有类型）
  const audioBase64 = (message as any).audioBase64 as string | undefined;
  const mimeType = ((message as any).mimeType as string | undefined) || 'audio/wav';

  const [isPlaying, setIsPlaying] = useState(false);

  const audioUrl = useMemo(() => {
    if (!audioBase64) return null;
    try {
      return base64ToBlobUrl(audioBase64, mimeType);
    } catch {
      return null;
    }
  }, [audioBase64, mimeType]);

  const play = async () => {
    if (!audioUrl) return;
    try {
      setIsPlaying(true);
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  };

  // 组件卸载时释放 URL（避免内存泄漏）
  React.useEffect(() => {
    return () => {
      if (audioUrl) revokeBlobUrl(audioUrl);
    };
  }, [audioUrl]);

  return (
    <div className={`flex ${isModel ? 'justify-start' : 'justify-end'} animate-slide-in`}>
      <div className={`flex items-start max-w-[85%] ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0 ${isModel ? 'bg-orange-400 mr-2' : 'bg-blue-500 ml-2'}`}>
          {isModel ? '客' : '我'}
        </div>

        {/* Bubble */}
        <div className="flex flex-col space-y-1">
          {isModel ? (
            <div className="bg-white border border-gray-100 text-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm leading-relaxed">
              {message.text || (
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-150"></div>
                </div>
              )}

              {/* 可选：模型消息如果带音频（例如你未来改为“模型输出文本 + 后端 TTS”） */}
              {audioUrl && (
                <div className="mt-2 flex items-center">
                  <button
                    onClick={play}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                      isPlaying ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                    title="播放语音"
                  >
                    {isPlaying ? '播放中…' : '▶ 播放语音'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-none shadow-sm text-sm">
              {showText ? message.text : '🎤 语音消息'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceMessage;
