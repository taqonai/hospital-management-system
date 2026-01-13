import React from 'react';
import DirhamSymbol from './DirhamSymbol';

interface CurrencyDisplayProps {
  amount: number | string | undefined | null;
  className?: string;
  decimals?: number;
  showSymbol?: boolean;
  symbolClassName?: string;
  compact?: boolean;
}

/**
 * CurrencyDisplay Component
 * Displays amount with official UAE Dirham symbol
 *
 * Usage:
 * <CurrencyDisplay amount={150} />           // Renders: [symbol]150.00
 * <CurrencyDisplay amount={1500000} compact /> // Renders: [symbol]1.5M
 */
const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  className = '',
  decimals = 2,
  showSymbol = true,
  symbolClassName = '',
  compact = false
}) => {
  const num = Number(amount || 0);

  // Format the number
  let formattedAmount: string;
  let suffix = '';

  if (compact) {
    if (num >= 1000000) {
      formattedAmount = (num / 1000000).toFixed(1);
      suffix = 'M';
    } else if (num >= 1000) {
      formattedAmount = (num / 1000).toFixed(1);
      suffix = 'K';
    } else {
      formattedAmount = num.toLocaleString('en-AE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }
  } else {
    formattedAmount = num.toLocaleString('en-AE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return (
    <span className={`inline-flex items-baseline gap-0.5 ${className}`}>
      {showSymbol && (
        <DirhamSymbol
          className={`flex-shrink-0 ${symbolClassName}`}
          size="0.85em"
        />
      )}
      <span>
        {formattedAmount}
        {suffix}
      </span>
    </span>
  );
};

export default CurrencyDisplay;
