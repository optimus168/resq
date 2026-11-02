import React, { useEffect, useState, useId } from 'react';

/**
 * Classic RESQ.AI · BhuRaksha Mountain Vector Logo with Animated Sun & Crescent Moon
 * Preserves the signature lime-green (#BDFF42) badge and dark (#06150C)
 * twin-peak silhouette, enhanced with crisp ridge detail and a sky element
 * that alternates between a rising Sun and a glowing Crescent Moon + stars,
 * and syncs immediately when Light / Dark mode is toggled.
 */
export function MountainMark({
  size = 30,
  className = '',
  modeOverride,
}: {
  size?: number;
  className?: string;
  modeOverride?: 'sun' | 'moon';
}) {
  const maskId = useId().replace(/:/g, '');
  // Automatically cycle between 'sun' and 'moon' so both appear in the header logo,
  // while immediately syncing when the Sun/Moon toggle button in the header is clicked.
  const [celestial, setCelestial] = useState<'sun' | 'moon'>('sun');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.remove('light');

    const handleThemeEvent = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom?.detail && typeof custom.detail.isLight === 'boolean') {
        setCelestial(custom.detail.isLight ? 'sun' : 'moon');
      } else {
        setCelestial((prev) => (prev === 'sun' ? 'moon' : 'sun'));
      }
    };

    window.addEventListener('bhuraksha-theme-change', handleThemeEvent);
    return () => {
      window.removeEventListener('bhuraksha-theme-change', handleThemeEvent);
    };
  }, []);

  // Gentle periodic alternation between Sun and Moon every 6 seconds
  useEffect(() => {
    if (modeOverride) return;
    const interval = setInterval(() => {
      setCelestial((prev) => (prev === 'sun' ? 'moon' : 'sun'));
    }, 6000);
    return () => clearInterval(interval);
  }, [modeOverride]);

  const activeCelestial = modeOverride || celestial;
  const showSun = activeCelestial === 'sun';

  return (
    <div
      className={`rounded-lg bg-gradient-to-br from-[#BDFF42] to-[#8FE016] grid place-items-center shadow-md shadow-lime-500/25 group-hover:scale-105 group-hover:shadow-lime-400/40 transition-all duration-200 shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      title={showSun ? 'BhuRaksha · Solar Day Watch' : 'BhuRaksha · Lunar Night Sentinel'}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.74)}
        height={Math.round(size * 0.74)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Crisp boolean mask for the Crescent Moon */}
          <mask id={`crescent-${maskId}`}>
            <rect x="0" y="0" width="24" height="24" fill="black" />
            <circle cx="17.4" cy="5.5" r="2.45" fill="white" />
            <circle cx="18.55" cy="4.65" r="2.0" fill="black" />
          </mask>
        </defs>

        {/* === SUN GROUP (Active in Light Mode & Day Cycle) === */}
        <g
          style={{
            opacity: showSun ? 1 : 0,
            transform: showSun ? 'translateY(0px) scale(1)' : 'translateY(2px) scale(0.75)',
            transformOrigin: '17.5px 5.5px',
            transition: 'opacity 600ms ease, transform 600ms ease',
          }}
        >
          {/* Expanding solar pulse ring */}
          <circle cx="17.5" cy="5.5" r="2.2" stroke="#06150C" strokeWidth="0.9" fill="none">
            <animate
              attributeName="cx"
              values="16.6;18.2;16.6"
              dur="4.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="6.5;4.5;6.5"
              dur="4.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="2.1;4.1"
              dur="2.25s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.55;0"
              dur="2.25s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Primary Moving Sun Disk */}
          <circle cx="17.5" cy="5.5" r="2.2" fill="#06150C">
            <animate
              attributeName="cx"
              values="16.6;18.2;16.6"
              dur="4.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values="6.5;4.5;6.5"
              dur="4.5s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* === CRESCENT MOON + STARS GROUP (Active in Dark Mode & Night Cycle) === */}
        <g
          style={{
            opacity: showSun ? 0 : 1,
            transform: showSun ? 'translateY(2px) scale(0.75)' : 'translateY(0px) scale(1)',
            transformOrigin: '17.4px 5.5px',
            transition: 'opacity 600ms ease, transform 600ms ease',
          }}
        >
          {/* Gentle floating motion for Crescent Moon & Lunar Halo */}
          <g>
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-0.6,0.5; 0.6,-0.5; -0.6,0.5"
              dur="4.8s"
              repeatCount="indefinite"
            />
            {/* Subtle lunar aura ring */}
            <circle cx="17.4" cy="5.5" r="2.5" stroke="#06150C" strokeWidth="0.7" fill="none">
              <animate
                attributeName="r"
                values="2.3;3.8"
                dur="2.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.45;0"
                dur="2.8s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Crisp Vector Crescent Moon */}
            <circle
              cx="17.4"
              cy="5.5"
              r="2.45"
              fill="#06150C"
              mask={`url(#crescent-${maskId})`}
            />
          </g>

          {/* Twinkling Star 1 (upper left of moon) */}
          <circle cx="13.2" cy="4.3" r="0.65" fill="#06150C">
            <animate
              attributeName="opacity"
              values="0.25;1;0.25"
              dur="2.1s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="0.45;0.75;0.45"
              dur="2.1s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Twinkling Star 2 (right of moon) */}
          <circle cx="20.8" cy="7.1" r="0.55" fill="#06150C">
            <animate
              attributeName="opacity"
              values="0.9;0.2;0.9"
              dur="2.6s"
              repeatCount="indefinite"
            />
          </circle>
        </g>

        {/* Signature Twin-Peak Mountain Vector Silhouette */}
        <path
          d="M1.8 20 L8.8 7.6 L13.1 14.2 L16.2 9.6 L22.2 20 Z"
          fill="#06150C"
        />

        {/* Crisp Snow-Cap & Ridge Vector Cutouts */}
        <path
          d="M7.1 11.1 L8.8 12.4 L10.5 11.1"
          stroke="#BDFF42"
          strokeWidth="1.05"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.8 12.1 L16.2 13.1 L17.6 12.1"
          stroke="#BDFF42"
          strokeWidth="0.95"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/**
 * Universal RESQ.AI · BhuRaksha Mountain Logo
 */
export default function BrandMountainLogo({
  size = 30,
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
      className={`flex items-center gap-2 select-none group ${onClick ? 'cursor-pointer' : ''} ${className}`}
      data-testid="brand-logo"
    >
      <MountainMark size={small ? 28 : size} />
      {showText && (
        <div className="leading-none min-w-0 shrink-0 whitespace-nowrap">
          <div className="font-display text-[13px] xl:text-[15px] font-bold text-white tracking-wide whitespace-nowrap">
            RESQ.AI{' '}
            <span className={`text-[#BDFF42] ${small ? 'inline lg:hidden xl:inline' : 'inline'}`}>
              · BHURAKSHA
            </span>
          </div>
          {!small && (
            <div className="font-data text-[9px] text-[#5E8B67] tracking-[0.2em] uppercase mt-0.5 hidden sm:block whitespace-nowrap">
              NER-OPERATIONAL · AGENTIC LANDSLIDE OPS
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { BrandMountainLogo };
