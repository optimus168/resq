import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack } from 'lucide-react';

export function useFramePlayer(count) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setIdx(count ? count - 1 : 0);
    setPlaying(false);
  }, [count]);

  useEffect(() => {
    if (!playing || !count) return;
    const t = setInterval(() => {
      setIdx(i => {
        if (i >= count - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 400);
    return () => clearInterval(t);
  }, [playing, count]);

  const play = () => {
    if (idx >= count - 1) setIdx(0);
    setPlaying(true);
  };

  return {
    idx,
    setIdx,
    playing,
    play,
    pause: () => setPlaying(false)
  };
}

export default function SimTimeline({ timeline = [], player, compact = false }) {
  const n = timeline.length;
  const row = timeline[player?.idx] || {};

  return (
    <div className="w-full" data-testid="sim-timeline">
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={() => (player?.playing ? player.pause() : player?.play())}
          className="btn-lime px-2 py-0.5 rounded text-xs flex items-center gap-1"
          data-testid="timeline-play-btn"
        >
          {player?.playing ? <Pause size={11} /> : <Play size={11} />}
          <span>{player?.playing ? 'Pause' : 'Play'}</span>
        </button>

        <button
          onClick={() => player?.setIdx(0)}
          className="btn-ghost p-1 rounded text-xs text-[#9FD8A8]"
          title="Reset"
        >
          <SkipBack size={11} />
        </button>

        <span className="font-data text-xs text-white font-bold min-w-[55px]">
          T+{row.hour ?? player?.idx ?? 0}h
        </span>

        <input
          type="range"
          min={0}
          max={Math.max(0, n - 1)}
          value={player?.idx || 0}
          onChange={e => player?.setIdx(parseInt(e.target.value, 10))}
          className="flex-1 accent-[#BDFF42] h-1.5 bg-[#06150C] rounded cursor-pointer"
          data-testid="timeline-scrubber"
        />

        <div className="font-data text-[11px] text-[#9FD8A8] flex items-center gap-3">
          <span>rain: <b className="text-white">{row.rain_mm ?? 0} mm/h</b></span>
          <span>cum: <b className="text-white">{row.cum_rain_mm ?? 0} mm</b></span>
          <span>sat: <b className="text-white">{((row.mean_saturation ?? 0.45) * 100).toFixed(0)}%</b></span>
          <span>failed: <b className="text-[#EF4444]">{row.failed_cells ?? 0}</b></span>
        </div>
      </div>
    </div>
  );
}
