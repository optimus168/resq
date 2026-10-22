import React from 'react';

/**
 * Clean Mountain Mark Icon (Himalayan Twin Peaks with Sun / Beacon)
 */
export function MountainMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-lg bg-[#BDFF42] flex items-center justify-center shadow-md shadow-lime-500/25 shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        fill="#06150C"
      >
        <path d="M2 20 L9 8 L13 14 L16 10 L22 20 Z" />
        <circle cx="17.5" cy="5.5" r="2.2" />
      </svg>
    </div>
  );
}

/**
 * Universal RESQ.AI · BhuRaksha Mountain Logo
 */
export default function BrandMountainLogo({
  size = 28,
  small = false,
  showText = true,
  onClick,
  className = '',
}: {
  size?: number;
  small?: boolean;
  showText?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 select-none group ${onClick ? 'cursor-pointer' : ''} ${className}`}
      data-testid="brand-logo"
    >
      <MountainMark size={size} className="group-hover:scale-105 transition-transform" />
      {showText && (
        <div className="leading-none min-w-0">
          <div className="font-display text-[14px] sm:text-[15px] font-bold text-white tracking-wide truncate">
            RESQ.AI <span className="text-[#BDFF42]">· BHURAKSHA</span>
          </div>
          {!small && (
            <div className="font-data text-[9px] text-[#5E8B67] tracking-[0.2em] uppercase mt-0.5 hidden sm:block">
              NER-OPERATIONAL · AGENTIC LANDSLIDE OPS
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { BrandMountainLogo };
