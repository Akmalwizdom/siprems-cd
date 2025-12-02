// Currency Configuration - IDR (Indonesian Rupiah)
// Exchange rate: 1 USD = 16,616 IDR
let USD_TO_IDR_RATE = 16616;

/**
 * Format number to Indonesian Rupiah currency format
 * @param amount - The amount to format
 * @param showDecimal - Whether to show decimal places (default: false)
 * @returns Formatted string like "Rp 1.000.000" or "Rp 1.000.000,00"
 */
export function formatIDR(amount: number, showDecimal: boolean = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Rp 0';
  }

  const options: Intl.NumberFormatOptions = {
    style: 'decimal',
    minimumFractionDigits: showDecimal ? 2 : 0,
    maximumFractionDigits: showDecimal ? 2 : 0,
  };

  const formatted = new Intl.NumberFormat('id-ID', options).format(amount);
  return `Rp ${formatted}`;
}

/**
 * Format number to compact Indonesian Rupiah (e.g., Rp 1,5jt)
 * @param amount - The amount to format
 * @returns Compact formatted string
 */
export function formatIDRCompact(amount: number): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Rp 0';
  }

  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1).replace('.', ',')}M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1).replace('.', ',')}jt`;
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(1).replace('.', ',')}rb`;
  }
  return formatIDR(amount);
}

/**
 * Convert USD to IDR
 * @param usdAmount - Amount in USD
 * @returns Amount in IDR
 */
export function convertUSDtoIDR(usdAmount: number): number {
  if (usdAmount === null || usdAmount === undefined || isNaN(usdAmount)) {
    return 0;
  }
  return Math.round(usdAmount * USD_TO_IDR_RATE);
}

/**
 * Format USD amount as IDR (auto-converts and formats)
 * @param usdAmount - Amount in USD
 * @param showDecimal - Whether to show decimal places
 * @returns Formatted IDR string
 */
export function formatUSDasIDR(usdAmount: number, showDecimal: boolean = false): string {
  const idrAmount = convertUSDtoIDR(usdAmount);
  return formatIDR(idrAmount, showDecimal);
}

/**
 * Get current USD to IDR exchange rate
 * @returns Current exchange rate
 */
export function getExchangeRate(): number {
  return USD_TO_IDR_RATE;
}

/**
 * Update USD to IDR exchange rate
 * @param newRate - New exchange rate
 */
export function setExchangeRate(newRate: number): void {
  if (newRate > 0) {
    USD_TO_IDR_RATE = newRate;
  }
}

/**
 * Fetch latest exchange rate from API (optional - can be called on app init)
 * Falls back to default rate if API fails
 */
export async function fetchLatestExchangeRate(): Promise<number> {
  try {
    // Using a free exchange rate API
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (response.ok) {
      const data = await response.json();
      if (data.rates?.IDR) {
        USD_TO_IDR_RATE = Math.round(data.rates.IDR);
        console.log(`Exchange rate updated: 1 USD = ${USD_TO_IDR_RATE} IDR`);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch exchange rate, using default:', USD_TO_IDR_RATE);
  }
  return USD_TO_IDR_RATE;
}

/**
 * Parse IDR formatted string back to number
 * @param idrString - String like "Rp 1.000.000"
 * @returns Number value
 */
export function parseIDR(idrString: string): number {
  if (!idrString) return 0;
  // Remove "Rp", spaces, and replace Indonesian decimal/thousand separators
  const cleaned = idrString
    .replace(/Rp\s*/gi, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .trim();
  return parseFloat(cleaned) || 0;
}

// Export default rate constant
export const DEFAULT_USD_TO_IDR_RATE = 16616;
