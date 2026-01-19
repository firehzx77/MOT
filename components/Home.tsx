
import React, { useState } from 'react';
import { PracticeConfig, MOTStage, Industry, Persona } from '../types';
import { INDUSTRIES, PERSONAS, VOICE_NAMES } from '../constants';

interface HomeProps {
  onStart: (config: PracticeConfig) => void;
  initialConfig: PracticeConfig;
}

const Home: React.FC<HomeProps> = ({ onStart, initialConfig }) => {
  const [config, setConfig] = useState<PracticeConfig>(initialConfig);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-4">
        <h3 className="text-blue-800 font-semibold mb-2">训练说明</h3>
        <p className="text-sm text-blue-600 leading-relaxed">
          选择一个行业场景与关卡，系统将模拟一名客户。你需要通过语音与他交流，完成对应的MOT目标。训练结束后将生成专业评估。
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">行业场景</label>
          <div className="grid grid-cols-3 gap-2">
            {INDUSTRIES.map(ind => (
              <button
                key={ind}
                onClick={() => setConfig({ ...config, industry: ind as Industry })}
                className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                  config.industry === ind ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">客户画像</label>
          <div className="grid grid-cols-3 gap-2">
            {PERSONAS.map(p => (
              <button
                key={p}
                onClick={() => setConfig({ ...config, persona: p as Persona })}
                className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                  config.persona === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">训练关卡</label>
          <select
            value={config.stage}
            onChange={(e) => setConfig({ ...config, stage: e.target.value as MOTStage })}
            className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {Object.values(MOTStage).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
          <div>
            <span className="text-sm font-medium">展示文字转写</span>
            <p className="text-xs text-gray-400">开启后可见实时对话文字</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, showTranscription: !config.showTranscription })}
            className={`w-12 h-6 rounded-full transition-colors relative ${config.showTranscription ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${config.showTranscription ? 'translate-x-6' : ''}`} />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">客户音色 (TTS)</label>
          <select
            value={config.voiceName}
            onChange={(e) => setConfig({ ...config, voiceName: e.target.value })}
            className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {VOICE_NAMES.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={() => onStart(config)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg transform transition active:scale-95"
      >
        进入对练
      </button>
    </div>
  );
};

export default Home;
