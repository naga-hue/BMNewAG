/**
 * Currency conversion and formatting utilities.
 * All base calculations across the platform are normalized to Great Britain Pounds (GBP / £).
 */

export const DEFAULT_FX_RATES: Record<string, number> = {
  GBP: 1.0,
  USD: 0.79,
  AED: 0.21,
  INR: 0.0094,
  ZAR: 0.043
};

// Load initial rates from localStorage or use defaults
const getInitialRates = (): Record<string, number> => {
  try {
    const cached = localStorage.getItem('humres_fx_rates');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object' && parsed.GBP === 1.0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading cached FX rates:', e);
  }
  return { ...DEFAULT_FX_RATES };
};

export const FX_RATES: Record<string, number> = getInitialRates();

/**
 * Fetches latest exchange rates from open.er-api.com and updates the in-memory FX_RATES.
 * Rates are base GBP (£). If a rate is missing or API fails, fallbacks to default rates.
 */
export async function fetchLiveFxRates(): Promise<boolean> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/GBP');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    if (data && data.result === 'success' && data.rates) {
      const rates = data.rates;
      
      // open.er-api.com rates are foreign currency per 1 GBP (e.g. USD: 1.338708)
      // We convert them to GBP per 1 foreign currency unit (1 / rate)
      const updatedRates = {
        GBP: 1.0,
        USD: rates.USD ? 1 / rates.USD : DEFAULT_FX_RATES.USD,
        AED: rates.AED ? 1 / rates.AED : DEFAULT_FX_RATES.AED,
        INR: rates.INR ? 1 / rates.INR : DEFAULT_FX_RATES.INR,
        ZAR: rates.ZAR ? 1 / rates.ZAR : DEFAULT_FX_RATES.ZAR
      };

      // Mutate the constant object reference to update rates in-place
      Object.assign(FX_RATES, updatedRates);

      // Cache rates in localStorage
      localStorage.setItem('humres_fx_rates', JSON.stringify(FX_RATES));
      console.log('Successfully updated and cached dynamic FX rates:', FX_RATES);
      return true;
    }
  } catch (err) {
    console.warn('Could not fetch live FX rates. Using default/cached rates.', err);
  }
  return false;
}

/**
 * Converts a currency value to GBP.
 * Forces clean numeric conversion to prevent string concatenation bugs.
 */
export function toGBP(amount: any, cur: string = 'GBP'): number {
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
export function formatGBP(val: any): string {
  const numericVal = typeof val === 'string' ? parseFloat(val) || 0 : Number(val) || 0;
  return '£' + Math.round(numericVal).toLocaleString();
}
