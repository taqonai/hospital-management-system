/**
 * Currency formatting utility for UAE Dirhams (AED)
 * Symbol: Dhs (Dirham symbol)
 */

export const CURRENCY_SYMBOL = 'Dhs';
export const CURRENCY_CODE = 'AED';

/**
 * Format a number as UAE Dirhams
 * @param amount - The amount to format (can be number, string, null, or undefined)
 * @param options - Optional formatting options
 * @returns Formatted currency string with AED symbol
 */
export const formatCurrency = (
  amount: number | string | undefined | null,
  options?: {
    showSymbol?: boolean;
    decimals?: number;
  }
): string => {
  const { showSymbol = true, decimals = 2 } = options || {};
  const num = Number(amount || 0);
  const formatted = num.toLocaleString('en-AE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return showSymbol ? `${CURRENCY_SYMBOL} ${formatted}` : formatted;
};

/**
 * Format currency for compact display (e.g., 1.2K, 5M)
 * @param amount - The amount to format
 * @returns Compact formatted currency string
 */
export const formatCurrencyCompact = (amount: number | string | undefined | null): string => {
  const num = Number(amount || 0);
  if (num >= 1000000) {
    return `${CURRENCY_SYMBOL} ${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${CURRENCY_SYMBOL} ${(num / 1000).toFixed(1)}K`;
  }
  return formatCurrency(num);
};

export default formatCurrency;
