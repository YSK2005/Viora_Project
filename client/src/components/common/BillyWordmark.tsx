import React from 'react';

interface BillyWordmarkProps {
  className?: string;
}

export const BillyWordmark: React.FC<BillyWordmarkProps> = ({ className = 'h-8 w-auto' }) => {
  return (
    <svg
      viewBox="0 0 120 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="billy"
    >
      {/* Sparkle 1: Top Left Gold */}
      <path
        d="M 5 6 Q 5 8.5 2.5 8.5 Q 5 8.5 5 11 Q 5 8.5 7.5 8.5 Q 5 8.5 5 6 Z"
        fill="#FBBF24"
      />
      {/* Sparkle 2: Bottom Left Gold */}
      <path
        d="M 4 29 Q 4 31 2 31 Q 4 31 4 33 Q 4 31 6 31 Q 4 31 4 29 Z"
        fill="#F59E0B"
      />

      {/* Letter 'b' */}
      {/* Ascender */}
      <rect x="10" y="6" width="5.5" height="26" rx="2.75" fill="#FFFFFF" />
      {/* Bowl */}
      <path
        d="M 12.5 17.5 C 14.5 15 17.5 14 21.5 14 C 27 14 31.5 18 31.5 23.5 C 31.5 29 27 33 21.5 33 C 17.5 33 14.5 32 12.5 29.5"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Letter 'i' */}
      {/* Stem */}
      <rect x="38" y="15" width="5.5" height="17" rx="2.75" fill="#FFFFFF" />
      
      {/* Golden Cat Paw Dot above 'i' */}
      {/* Main Palm Pad */}
      <ellipse cx="40.75" cy="10.5" rx="3.4" ry="2.7" fill="#FBBF24" />
      {/* Dollar sign on pad */}
      <text
        x="40.75"
        y="12"
        fontSize="3.8"
        fontWeight="900"
        textAnchor="middle"
        fill="#78350F"
        fontFamily="sans-serif"
      >
        $
      </text>
      {/* 4 Toe Pads */}
      <circle cx="37" cy="7.2" r="1.0" fill="#FBBF24" />
      <circle cx="39.3" cy="5.9" r="1.05" fill="#FBBF24" />
      <circle cx="42.2" cy="5.9" r="1.05" fill="#FBBF24" />
      <circle cx="44.5" cy="7.2" r="1.0" fill="#FBBF24" />

      {/* Letter 'l' (first) */}
      <rect x="50" y="6" width="5.5" height="26" rx="2.75" fill="#FFFFFF" />

      {/* Letter 'l' (second) */}
      <rect x="62" y="6" width="5.5" height="26" rx="2.75" fill="#FFFFFF" />

      {/* Letter 'y' */}
      {/* Left branch */}
      <path
        d="M 72.5 15 L 78 24.5"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Right branch */}
      <path
        d="M 85.5 15 L 78 24.5"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Golden checkmark swoop on 'y' */}
      <path
        d="M 78 24.5 L 81 29 C 81.8 30.5 83.2 30.8 84.5 29.8 L 98 17"
        stroke="#F59E0B"
        strokeWidth="4.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Origami Paper Plane (Purple) */}
      <g transform="translate(98, 6)">
        {/* Main wing */}
        <polygon points="2,12 12,2 0,6" fill="#7C3AED" />
        {/* Top fold */}
        <polygon points="12,2 4,10 6,8" fill="#A78BFA" />
        {/* Shadow fold */}
        <polygon points="0,6 4,10 2,12" fill="#6D28D9" />
      </g>

      {/* Sparkle 3: Top Right Gold near plane */}
      <path
        d="M 96 8 Q 96 10 94 10 Q 96 10 96 12 Q 96 10 98 10 Q 96 10 96 8 Z"
        fill="#FBBF24"
      />

      {/* Sparkle 4: Purple star below plane */}
      <path
        d="M 97 22 Q 97 23.5 95.5 23.5 Q 97 23.5 97 25 Q 97 23.5 98.5 23.5 Q 97 23.5 97 22 Z"
        fill="#C084FC"
      />
    </svg>
  );
};
