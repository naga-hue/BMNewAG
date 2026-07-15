import { FACTORING_PAYOUT_RATIO } from './shared';

/**
 * Parse a date string in various formats (DD/MM/YYYY, YYYY-MM-DD, D/M/YY) into YYYY-MM-DD
 */
export function parseFlexibleDate(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') return '';
  const clean = dateStr.trim();

  // Try splitting by slash or dash
  const parts = clean.split(/[/-]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    // Check if the first part is a 4-digit year (e.g. YYYY-MM-DD or YYYY-DD-MM)
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      const p2 = parseInt(parts[2], 10);
      if (p1 > 12) {
        // It's YYYY-DD-MM (e.g. 2026-13-07)
        month = p2;
        day = p1;
      } else {
        // Standard YYYY-MM-DD
        month = p1;
        day = p2;
      }
    } else {
      // Standard D/M/YY or M/D/YY (default UK D/M/YY)
      if (year < 100) {
        year = 2000 + year; // Convert 26 to 2026
      }
      // Swap if month is > 12 (e.g. 13/07/26)
      if (month > 12) {
        const tmp = month;
        month = day;
        day = tmp;
      }
    }

    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const formattedMonth = String(month).padStart(2, '0');
      const formattedDay = String(day).padStart(2, '0');
      return `${year}-${formattedMonth}-${formattedDay}`;
    }
  }

  // Fallback to native parsing
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      let yr = d.getFullYear();
      if (yr < 1970 && yr > 1900) {
        yr = yr + 100;
      }
      return `${yr}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  } catch {}

  return '';
}

/**
 * Calculates due date based on raised date and payment term days.
 */
export function calculateDueDate(raisedDate: string, days: number): string {
  if (!raisedDate) return '';
  try {
    const parts = raisedDate.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + Number(days));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayVal = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayVal}`;
    }
  } catch {}
  return raisedDate;
}

/**
 * Calculates the Simplicity Factoring breakdown (2.96% factoring fee, 20% VAT on factored).
 */
export function calculateSimplicityBreakdown(gross: number) {
  const factoredGross = Math.round(gross * FACTORING_PAYOUT_RATIO * 100) / 100;
  const vatAmount = Math.round(factoredGross * 0.20 * 100) / 100;
  const expectedPayout = factoredGross + vatAmount;
  return {
    factoredGross,
    vatAmount,
    expectedPayout
  };
}

/**
 * Robust RFC 4180-compliant pure CSV parser.
 * Correctly handles newlines within quoted fields, escaped double quotes, and empty fields.
 */
export function parseCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        // Escaped double quote inside quotes -> append a single quote
        cell += '"';
        i++; // Skip the next quote
      } else {
        // Toggle the quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && next === '\n') {
        i++; // Consume CRLF line ending fully
      }
      row.push(cell.trim());
      result.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  // Handle final leftover row and cell
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    result.push(row);
  }

  // Filter out completely blank lines
  return result.filter(r => r.length > 0 && r.some(c => c !== ''));
}
