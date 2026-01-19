
import React, { useState, useCallback } from 'react';
import Home from './components/Home';
import Room from './components/Room';
import Review from './components/Review';
import { PracticeConfig, MOTStage, ScoringResult } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'room' | 'review'>('home');
  const [config, setConfig] = useState<PracticeConfig>({
    industry: '零售',
    persona: '挑剔',
    stage: MOTStage.EXPLORE,
    voiceName: 'Kore',
    showTranscription: false
  });
  const [sessionResults, setSessionResults] = useState<ScoringResult[]>([]);

  const handleStart = (newConfig: PracticeConfig) => {
    setConfig(newConfig);
    setSessionResults([]);
    setView('room');
  };

  const handleFinish = (results: ScoringResult[]) => {
    setSessionResults(results);
    setView('review');
  };

  const handleRestart = () => {
    setView('home');
  };

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-white shadow-xl relative overflow-hidden flex flex-col">
      <header className="bg-blue-600 text-white py-4 px-6 text-center shadow-md z-10">
        <h1 className="text-xl font-bold tracking-tight">MOT关键时刻｜对练</h1>
        <p className="text-xs opacity-80 mt-1">AI 驱动的服务力闭环训练</p>
      </header>

      <main className="flex-1 overflow-y-auto relative bg-gray-50">
        {view === 'home' && <Home onStart={handleStart} initialConfig={config} />}
        {view === 'room' && <Room config={config} onFinish={handleFinish} onBack={() => setView('home')} />}
        {view === 'review' && <Review results={sessionResults} config={config} onRestart={handleRestart} />}
      </main>
      
      <footer className="py-3 bg-white border-t border-gray-100 text-center text-xs text-gray-400">
        © 2024 MOT AI Training Support
      </footer>
    </div>
  );
};

export default App;
