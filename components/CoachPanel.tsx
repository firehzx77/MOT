
import React from 'react';
import { ScoringResult } from '../types';

interface CoachPanelProps {
  score: ScoringResult;
  onClose: () => void;
}

const CoachPanel: React.FC<CoachPanelProps> = ({ score, onClose }) => {
  return (
    <div className="absolute inset-x-0 bottom-[90px] mx-4 p-4 bg-white rounded-2xl shadow-2xl border-2 border-blue-100 animate-slide-up z-20 max-h-[60%] overflow-y-auto">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center">
          <span className="w-2 h-6 bg-blue-600 rounded-full mr-2"></span>
          AI 教练实时反馈
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span>本关目标达成</span>
              <span className="font-bold text-blue-600">{score.stage_goal_hit}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${score.stage_goal_hit}%` }}></div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-xl">
          <p className="text-xs text-blue-600 font-bold mb-1 uppercase tracking-wider">更优说法推荐</p>
          <p className="text-sm text-blue-900 leading-relaxed italic">“{score.better_script}”</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="p-3 bg-green-50 rounded-xl border border-green-100">
            <p className="text-xs text-green-700 font-bold mb-1">本轮闪光点</p>
            <ul className="text-xs text-green-800 space-y-1">
              {score.highlights.map((h, i) => <li key={i}>• {h}</li>)}
            </ul>
          </div>
          <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
            <p className="text-xs text-orange-700 font-bold mb-1">改进建议</p>
            <ul className="text-xs text-orange-800 space-y-1">
              {score.improvements.map((im, i) => <li key={i}>• {im}</li>)}
            </ul>
          </div>
        </div>

        {score.risk_alert && (
          <div className="p-3 bg-red-50 rounded-xl border border-red-100 animate-pulse">
            <p className="text-xs text-red-600 font-bold mb-1">风险提示</p>
            <p className="text-xs text-red-800">{score.risk_alert}</p>
          </div>
        )}

        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs text-gray-500 font-bold mb-1">下一轮动作参考</p>
          <p className="text-sm font-medium">{score.next_move}</p>
        </div>
      </div>
    </div>
  );
};

export default CoachPanel;
