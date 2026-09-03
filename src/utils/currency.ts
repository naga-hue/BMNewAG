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
export function toGBP(amount: any, cur: string = 'GBP', customRate?: number): number {
  if (amount === undefined || amount === null || amount === '') return 0;
  
  // Clean string representations if necessary
  let numericAmt = 0;
  if (typeof amount === 'string') {
    numericAmt = parseFloat(amount.replace(/[^0-9.-]/g, '')) || 0;
  } else {
    numericAmt = Number(amount) || 0;
  }

  if (customRate && customRate > 0) {
    return numericAmt * customRate;
  }

  const cleanCur = String(cur || 'GBP').toUpperCase().trim();
  const rate = FX_RATES[cleanCur] || 1.0;
  return numericAmt * rate;
}

/**
 * In-memory and session cache for historical FX rates by currency and date.
 */
const historicalFxCache: Record<string, number> = {};

/**
 * Fetches the historical exchange rate for a given currency and transaction date (base GBP).
 * If AED is requested, uses the official fixed peg to USD (3.6725) combined with European Central Bank (ECB) rates.
 */
export async function getHistoricalFxRate(currency: string, dateStr: string): Promise<number> {
  const cur = (currency || 'GBP').toUpperCase().trim();
  if (cur === 'GBP') return 1.0;

  // Extract clean YYYY-MM-DD
  let normalizedDate = dateStr ? dateStr.trim().substring(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      normalizedDate = parsed.toISOString().substring(0, 10);
    } else {
      return FX_RATES[cur] || (cur === 'AED' ? 0.21 : 1.0);
    }
  }

  // Prevent querying future dates
  const today = new Date().toISOString().substring(0, 10);
  if (normalizedDate > today) {
    normalizedDate = today;
  }

  const cacheKey = `fx_${cur}_${normalizedDate}`;
  if (historicalFxCache[cacheKey]) {
    return historicalFxCache[cacheKey];
  }

  try {
    const sessionVal = sessionStorage.getItem(cacheKey);
    if (sessionVal) {
      const parsedRate = parseFloat(sessionVal);
      if (!isNaN(parsedRate) && parsedRate > 0) {
        historicalFxCache[cacheKey] = parsedRate;
        return parsedRate;
      }
    }
  } catch {}

  // 1. Primary: European Central Bank via Frankfurter API
  try {
    if (cur === 'AED') {
      // AED is pegged to USD at 3.6725 AED = 1 USD
      const res = await fetch(`https://api.frankfurter.dev/v1/${normalizedDate}?base=USD&symbols=GBP`);
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.GBP) {
          const rate = Number(data.rates.GBP) / 3.6725;
          historicalFxCache[cacheKey] = rate;
          try { sessionStorage.setItem(cacheKey, String(rate)); } catch {}
          return rate;
        }
      }
    } else {
      const res = await fetch(`https://api.frankfurter.dev/v1/${normalizedDate}?base=${cur}&symbols=GBP`);
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.GBP) {
          const rate = Number(data.rates.GBP);
          historicalFxCache[cacheKey] = rate;
          try { sessionStorage.setItem(cacheKey, String(rate)); } catch {}
          return rate;
        }
      }
    }
  } catch (err) {
    console.warn(`Frankfurter historical rate lookup failed for ${cur} on ${normalizedDate}:`, err);
  }

  // 2. Secondary fallback: Fawaz Ahmed Currency API on jsDelivr CDN
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${normalizedDate}/v1/currencies/${cur.toLowerCase()}.json`);
    if (res.ok) {
      const data = await res.json();
      const rate = data?.[cur.toLowerCase()]?.gbp;
      if (rate && !isNaN(Number(rate))) {
        const numRate = Number(rate);
        historicalFxCache[cacheKey] = numRate;
        try { sessionStorage.setItem(cacheKey, String(numRate)); } catch {}
        return numRate;
      }
    }
  } catch (err) {
    console.warn(`Fawaz CDN historical fallback failed for ${cur} on ${normalizedDate}:`, err);
  }

  // 3. Ultimate fallback: In-memory live or baseline FX rate
  const fallback = FX_RATES[cur] || (cur === 'AED' ? 0.21 : 1.0);
  historicalFxCache[cacheKey] = fallback;
  return fallback;
}

/**
 * Formats a numeric value as a GBP currency string.
 */
export function formatGBP(val: any): string {
  const numericVal = typeof val === 'string' ? parseFloat(val) || 0 : Number(val) || 0;
  return '£' + Math.round(numericVal).toLocaleString();
}
