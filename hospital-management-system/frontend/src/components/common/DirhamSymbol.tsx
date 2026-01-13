import React from 'react';

interface DirhamSymbolProps {
  className?: string;
  size?: number | string;
  color?: string;
}

/**
 * Official UAE Dirham Currency Symbol
 * Design: Bold "D" with two horizontal lines through it
 * Based on Central Bank of UAE guidelines (March 2025)
 *
 * The symbol features:
 * - A bold capital "D" as the base
 * - Two horizontal lines with slightly curved ends (inspired by UAE flag)
 * - Design influenced by Arabic calligraphy (Thuluth and Diwani scripts)
 */
const DirhamSymbol: React.FC<DirhamSymbolProps> = ({
  className = '',
  size = '1em',
  color = 'currentColor'
}) => {
  const sizeValue = typeof size === 'number' ? `${size}px` : size;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={sizeValue}
      height={sizeValue}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'baseline' }}
      aria-label="UAE Dirham symbol"
      role="img"
    >
      {/* Bold "D" letter */}
      <path
        d="M6 3h6c4.97 0 9 4.03 9 9s-4.03 9-9 9H6V3z"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Vertical stem of D */}
      <line
        x1="6"
        y1="3"
        x2="6"
        y2="21"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Upper horizontal line with curved ends */}
      <path
        d="M2 8.5 C3 8 4 8 5 8.5 L19 8.5 C20 8 21 8 22 8.5"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Lower horizontal line with curved ends */}
      <path
        d="M2 15.5 C3 15 4 15 5 15.5 L19 15.5 C20 15 21 15 22 15.5"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default DirhamSymbol;
