/**
 * Currency conversion and formatting utilities.
 * All base calculations across the platform are normalized to Great Britain Pounds (GBP / £).
 */

export const FX_RATES = {
  GBP: 1.0,
  USD: 0.79,
  AED: 0.21,
  INR: 0.0094,
  ZAR: 0.043
};

/**
 * Converts a currency value to GBP.
 * Forces clean numeric conversion to prevent string concatenation bugs.
 */
export function toGBP(amount, cur = 'GBP') {
  if (amount === undefined || amount === null || amount === '') return 0;
  const cleanCur = String(cur || 'GBP').toUpperCase().trim();
  const rate = FX_RATES[cleanCur] || 1.0;
  
  // Clean string representations if necessary
  let numericAmt = 0;
  if (typeof amount === 'string') {
    numericAmt = parseFloat(amount.replace(/[^0-9.-]/g, '')) || 0;
  } else {
    numericAmt = Number(amount) || 0;
  }
  
  return numericAmt * rate;
}

/**
 * Formats a numeric value as a GBP currency string.
 */
export function formatGBP(val) {
  const numericVal = typeof val === 'string' ? parseFloat(val) || 0 : Number(val) || 0;
  return '£' + Math.round(numericVal).toLocaleString();
}
