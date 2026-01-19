
import React from 'react';
import { ScoringResult, PracticeConfig } from '../types';

interface ReviewProps {
  results: ScoringResult[];
  config: PracticeConfig;
  onRestart: () => void;
}

const Review: React.FC<ReviewProps> = ({ results, config, onRestart }) => {
  const avgGoalHit = results.length > 0 
    ? Math.round(results.reduce((acc, r) => acc + r.stage_goal_hit, 0) / results.length) 
    : 0;

  // Aggregate dimension scores
  const dimAggregate: Record<string, number> = {
    '倾听与复述': 0,
    '澄清与提问': 0,
    '共情与态度': 0,
    '方案与承诺清晰': 0,
    '确认闭环': 0
  };
  
  if (results.length > 0) {
    results.forEach(r => {
      // Fix: Cast val to number as Object.entries value might be inferred as unknown
      Object.entries(r.dimension_scores).forEach(([key, val]) => {
        dimAggregate[key] = (dimAggregate[key] || 0) + (val as number);
      });
    });
    Object.keys(dimAggregate).forEach(k => dimAggregate[k] = Math.round((dimAggregate[k] / results.length) * 10) / 10);
  }

  const handleCopySummary = () => {
    const text = results.map(r => `[${r.stage}] 达成度: ${r.stage_goal_hit}%\n改进点: ${r.improvements.join(', ')}\n更优脚本: ${r.better_script}`).join('\n\n');
    navigator.clipboard.writeText(`训练摘要 - ${config.industry}\n\n${text}`);
    alert('摘要已复制到剪贴板');
  };

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-800">训练报告</h2>
        <p className="text-sm text-gray-500 mt-1">{config.industry} · {config.persona}客户</p>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 text-center space-y-2">
        <div className="inline-block relative">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-gray-100" />
            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 * (1 - avgGoalHit/100)} className="text-blue-600 transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-3xl font-black text-blue-600">{avgGoalHit}</span>
            <span className="text-[10px] text-gray-400 font-bold">综合达成率</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800">能力模型分析</h3>
        <div className="space-y-3">
          {Object.entries(dimAggregate).map(([name, score]) => (
            <div key={name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">{name}</span>
                <span className="font-bold text-gray-900">{score} / 5</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000" 
                  style={{ width: `${(score/5) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800">核心建议</h3>
        <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl">
          <p className="text-sm text-orange-800 leading-relaxed font-medium">
            针对“{config.persona}”类型的客户，建议在接下来的对练中，重点提升“{Object.entries(dimAggregate).sort((a,b) => a[1]-b[1])[0][0]}”环节。
          </p>
        </div>
      </div>

      <div className="flex space-x-3">
        <button 
          onClick={handleCopySummary}
          className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition"
        >
          复制摘要
        </button>
        <button 
          onClick={onRestart}
          className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg transform active:scale-95 transition"
        >
          再练一次
        </button>
      </div>
    </div>
  );
};

export default Review;
