
import React from 'react';
import { ChatMessage } from '../types';

interface VoiceMessageProps {
  message: ChatMessage;
  showText?: boolean;
}

const VoiceMessage: React.FC<VoiceMessageProps> = ({ message, showText }) => {
  const isModel = message.role === 'model';

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
              {message.text || <div className="flex space-x-1"><div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-75"></div><div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-150"></div></div>}
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
