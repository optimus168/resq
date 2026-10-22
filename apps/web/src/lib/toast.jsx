import React, { useState, useEffect } from 'react';

let listeners = [];
let toastId = 0;

export const toast = {
  success: (msg) => emitToast(msg, 'success'),
  error: (msg) => emitToast(msg, 'error'),
  info: (msg) => emitToast(msg, 'info'),
  warning: (msg) => emitToast(msg, 'warning')
};

function emitToast(message, type) {
  const id = ++toastId;
  const item = { id, message, type, time: Date.now() };
  listeners.forEach(fn => fn(item));
}

export function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleNew = (t) => {
      setToasts(prev => [...prev.slice(-4), t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, 3500);
    };
    listeners.push(handleNew);
    return () => {
      listeners = listeners.filter(fn => fn !== handleNew);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map(t => {
        let border = 'border-[#249344]';
        let bg = 'bg-[#06150C]/95';
        let text = 'text-white';
        let icon = '✓';

        if (t.type === 'error') {
          border = 'border-[#EF4444]';
          text = 'text-[#EF4444]';
          icon = '✕';
        } else if (t.type === 'warning') {
          border = 'border-[#FFA31A]';
          text = 'text-[#FFA31A]';
          icon = '⚠';
        } else if (t.type === 'success') {
          border = 'border-[#BDFF42]';
          text = 'text-[#BDFF42]';
          icon = '✓';
        }

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border ${border} ${bg} shadow-2xl text-xs font-mono backdrop-blur-md animate-fade-in`}
          >
            <span className={`font-bold ${text}`}>{icon}</span>
            <div className="flex-1 text-[#d6f5dc] text-[11px] leading-snug">
              {t.message}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-[#5E8B67] hover:text-white text-xs ml-1"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default toast;
