/**
 * Currency formatting utility for UAE Dirhams
 *
 * The official UAE Dirham symbol is a bold "D" with two horizontal lines.
 * For UI display, use the CurrencyDisplay component which renders the SVG symbol.
 *
 * This utility provides text-based formatting for non-UI contexts
 * (exports, console, data processing, etc.)
 */

// Currency code for API/data purposes
export const CURRENCY_CODE = 'AED';

// Text fallback for non-UI contexts (use CurrencyDisplay component for UI)
export const CURRENCY_TEXT = 'Dhs';

/**
 * Format a number as currency (text format)
 * NOTE: For UI display, prefer using <CurrencyDisplay amount={value} /> component
 *
 * @param amount - The amount to format (can be number, string, null, or undefined)
 * @param options - Optional formatting options
 * @returns Formatted currency string
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
  // Return just the number - symbol will be rendered as SVG component
  return showSymbol ? formatted : formatted;
};

/**
 * Format currency for compact display (e.g., 1.2K, 5M)
 * NOTE: For UI display, prefer using <CurrencyDisplay amount={value} compact /> component
 *
 * @param amount - The amount to format
 * @returns Compact formatted string (without symbol - add CurrencyDisplay for symbol)
 */
export const formatCurrencyCompact = (amount: number | string | undefined | null): string => {
  const num = Number(amount || 0);
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return formatCurrency(num, { showSymbol: false });
};

/**
 * Format number only (no symbol)
 * @param amount - The amount to format
 * @param decimals - Number of decimal places
 * @returns Formatted number string
 */
export const formatNumber = (
  amount: number | string | undefined | null,
  decimals = 2
): string => {
  const num = Number(amount || 0);
  return num.toLocaleString('en-AE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export default formatCurrency;
