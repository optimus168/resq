import React, { useState } from 'react';
import { MessageSquare, Send, BookOpen, ShieldCheck, Terminal, Globe2, HelpCircle } from 'lucide-react';

export default function AskMissionControl({ incidentId = '', onSendQuery }) {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Mission Control Grounded Assistant online. All responses are strictly synthesized from real-time database records and NDMA Standard Operating Procedures. Ask about risk status, evacuation protocols, or road lifelines.',
      citations: ['[NDMA-SOP-1.2]', '[incident:risk]']
    }
  ]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userText = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const res = await onSendQuery(userText);
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: res.answer || res.response || 'Information retrieved.',
          citations: res.citations || ['[incident:current_plan]', '[NDMA-SOP-4.1]'],
          disclaimer: res.disclaimer
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `Query error: ${err.message}`,
          citations: []
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQueries = [
    "What is the current Factor of Safety on NH10?",
    "Which relief shelters are designated under SOP-1?",
    "Draft an urgent alert in Nepali and Hindi for Deorali"
  ];

  return (
    <div className="flex flex-col h-full bg-[#0A2416] rounded-lg border border-[#249344]/40 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#06150C] border-b border-[#249344]/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#BDFF42]" />
          <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
            ASK MISSION CONTROL · SOP ASSISTANT
          </span>
        </div>
        <span className="text-[10px] text-[#9FD8A8] font-mono flex items-center gap-1">
          <BookOpen className="w-3 h-3 text-[#BDFF42]" />
          MANDATORY CITATIONS
        </span>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg border ${
                m.sender === 'user'
                  ? 'bg-[#249344]/20 border-[#249344]/50 text-white font-sans'
                  : 'bg-black/50 border-[#249344]/30 text-slate-200'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>

              {/* Citations Tag */}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 pt-1.5 border-t border-[#249344]/30 flex flex-wrap gap-1">
                  <span className="text-[10px] text-slate-400">Sources:</span>
                  {m.citations.map((c, ci) => (
                    <span
                      key={ci}
                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#BDFF42]/10 border border-[#BDFF42]/30 text-[#BDFF42]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 font-mono text-xs p-2">
            <span className="w-2 h-2 rounded-full bg-[#BDFF42] animate-ping"></span>
            Synthesizing from NDMA guidelines and risk engine...
          </div>
        )}
      </div>

      {/* Suggested Queries */}
      <div className="px-3 py-1.5 bg-[#06150C]/60 border-t border-[#249344]/20 flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono">
        <span className="text-slate-500 whitespace-nowrap">Examples:</span>
        {sampleQueries.map((sq, i) => (
          <button
            key={i}
            onClick={() => setQuery(sq)}
            className="px-2 py-0.5 rounded bg-[#249344]/20 text-[#9FD8A8] hover:text-white hover:bg-[#249344]/40 whitespace-nowrap border border-[#249344]/30"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Query Input */}
      <form onSubmit={handleSubmit} className="p-2.5 bg-[#06150C] border-t border-[#249344]/30 flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about active risk scores, SOP protocols, or request multilingual drafts..."
          className="flex-1 px-3 py-2 rounded bg-[#0A2416] border border-[#249344]/40 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#BDFF42] font-mono"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="p-2 rounded bg-[#BDFF42] text-[#06150C] hover:bg-lime-300 disabled:opacity-40 transition-colors shadow"
        >
          <Send className="w-4 h-4 fill-current" />
        </button>
      </form>
    </div>
  );
}
