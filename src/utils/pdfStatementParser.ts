import * as pdfjsLib from 'pdfjs-dist';

// Robust worker configuration: use ES module Worker via URL, with fallback
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    if ('Worker' in window) {
      pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
        new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
        { type: 'module' }
      );
    } else {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
  } catch (err) {
    console.warn('Worker initialization fallback:', err);
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    } catch {
      // In-process fallback
    }
  }
}

export interface ExtractedStatement {
  headers: string[];
  rows: string[][];
  detectedBank?: string;
  detectedCurrency?: string;
}

interface TextItemWithPos {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextLine {
  y: number;
  items: TextItemWithPos[];
  fullText: string;
}

// Regex helpers
export const DATE_REGEX = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(?:\d{2,4})?)\b/i;
export const AMOUNT_TOKEN_REGEX = /^[-–—−]?[$£€R]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))\s*(?:CR|DR)?$/i;

/**
 * Extracts structured tabular statement rows from a PDF file.
 */
export async function extractBankStatementFromPdf(file: File): Promise<ExtractedStatement> {
  const arrayBuffer = await file.arrayBuffer();
  
  let pdfDoc;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    });
    pdfDoc = await loadingTask.promise;
  } catch (loadErr: any) {
    console.error("PDF load error:", loadErr);
    throw new Error(`Could not read PDF: ${loadErr.message || 'Invalid or protected PDF'}`);
  }

  const numPages = pdfDoc.numPages;
  const allLines: TextLine[] = [];
  let totalChars = 0;
  let detectedBank = '';
  let detectedCurrency = '';

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Map items with coordinates
    const items: TextItemWithPos[] = [];
    for (const item of textContent.items) {
      if ('str' in item && (item as any).str.trim()) {
        const str = (item as any).str.trim();
        totalChars += str.length;
        const x = (item as any).transform[4];
        const y = (item as any).transform[5];
        items.push({
          text: str,
          x,
          y,
          width: (item as any).width || 0,
          height: (item as any).height || 0
        });
      }
    }

    // Cluster items into lines by Y coordinate (tolerance ~5.0px for varying font baselines)
    const lineBuckets: { y: number; items: TextItemWithPos[] }[] = [];
    items.forEach(item => {
      let bucket = lineBuckets.find(b => Math.abs(b.y - item.y) <= 5.0);
      if (!bucket) {
        bucket = { y: item.y, items: [] };
        lineBuckets.push(bucket);
      }
      bucket.items.push(item);
    });

    // Sort buckets top-to-bottom (Y descending in PDF coordinates)
    lineBuckets.sort((a, b) => b.y - a.y);

    // Sort items within each line left-to-right (X ascending)
    lineBuckets.forEach(b => {
      b.items.sort((i1, i2) => i1.x - i2.x);
      const fullText = b.items.map(i => i.text.trim()).join(' ');
      allLines.push({
        y: b.y,
        items: b.items,
        fullText
      });

      // Quick detection for bank & currency
      const lower = fullText.toLowerCase();
      if (!detectedBank) {
        if (lower.includes('hsbc')) detectedBank = 'HSBC';
        else if (lower.includes('wise') || lower.includes('transferwise')) detectedBank = 'Wise';
        else if (lower.includes('barclays')) detectedBank = 'Barclays';
        else if (lower.includes('lloyds')) detectedBank = 'Lloyds';
        else if (lower.includes('natwest')) detectedBank = 'NatWest';
        else if (lower.includes('revolut')) detectedBank = 'Revolut';
      }
      if (!detectedCurrency) {
        if (fullText.includes('£') || lower.includes('gbp')) detectedCurrency = 'GBP';
        else if (fullText.includes('$') || lower.includes('usd')) detectedCurrency = 'USD';
        else if (fullText.includes('€') || lower.includes('eur')) detectedCurrency = 'EUR';
        else if (lower.includes('zar') || fullText.includes('R ')) detectedCurrency = 'ZAR';
        else if (lower.includes('aed')) detectedCurrency = 'AED';
      }
    });
  }

  // Check if PDF has no selectable text (scanned image)
  if (totalChars < 25 || allLines.length === 0) {
    throw new Error(
      "This PDF appears to be a scanned document or image without selectable text. " +
      "Please download a digital PDF statement or CSV/Excel export directly from your online banking portal."
    );
  }

  // Parse transaction table rows
  return parseTransactionLines(allLines, detectedBank, detectedCurrency);
}

/**
 * Parses reconstructed text lines into structured headers and column values.
 */
export function parseTransactionLines(
  lines: TextLine[],
  detectedBank: string = '',
  detectedCurrency: string = ''
): ExtractedStatement {
  const standardHeaders = ['Date', 'Description', 'Amount', 'Reference', 'Balance'];
  const extractedRows: string[][] = [];

  let currentTx: {
    date: string;
    description: string;
    amount: string;
    reference: string;
    balance: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.fullText.trim();
    if (!text) continue;

    // Check if line contains a table header row (e.g. "Date Description Amount")
    const isHeaderLine = /date/i.test(text) && (/amount/i.test(text) || /paid out/i.test(text) || /debit/i.test(text) || /description/i.test(text) || /details/i.test(text));
    if (isHeaderLine) {
      continue;
    }

    // Ignore page headers/footers
    const isFooterOrHeader = /page \d+ of \d+|statement number|sort code|balance carried forward|opening balance|closing balance|iban|bic/i.test(text);

    // Check if this line contains a date and at least one money amount
    const dateMatch = text.match(DATE_REGEX);
    const amountTokens: { token: string; clean: string; index: number }[] = [];
    const words = text.split(/\s+/);

    words.forEach((w, idx) => {
      if (isAmountToken(w)) {
        amountTokens.push({ token: w, clean: cleanAmountString(w), index: idx });
      }
    });

    const hasDate = !!dateMatch;
    const hasAmount = amountTokens.length > 0;

    if (hasDate && hasAmount) {
      // Commit previous transaction if valid
      if (currentTx && currentTx.date && currentTx.amount) {
        extractedRows.push([
          currentTx.date,
          currentTx.description.trim(),
          currentTx.amount,
          currentTx.reference.trim(),
          currentTx.balance
        ]);
      }

      const rawDate = dateMatch[0].trim();
      let amountStr = '';
      let balanceStr = '';

      if (amountTokens.length >= 2) {
        // Last amount is Balance, second last is Transaction Amount
        balanceStr = amountTokens[amountTokens.length - 1].clean;
        amountStr = amountTokens[amountTokens.length - 2].clean;
      } else {
        amountStr = amountTokens[0].clean;
      }

      // Remaining words make up the description and reference
      const amountIndices = new Set(amountTokens.map(a => a.index));
      const remainingWords = words.filter((w, idx) => {
        if (amountIndices.has(idx)) return false;
        if (w.includes(rawDate) || rawDate.includes(w)) return false;
        return true;
      });

      const desc = remainingWords.join(' ').trim();

      currentTx = {
        date: rawDate,
        description: desc,
        amount: amountStr,
        reference: '',
        balance: balanceStr
      };
    } else if (currentTx && !isFooterOrHeader) {
      // Continuation line for multi-line description or reference
      // Check if this continuation line has the amount if currentTx was missing one
      if (!currentTx.amount && hasAmount) {
        currentTx.amount = amountTokens[0].clean;
        const remainingWords = words.filter((_, idx) => idx !== amountTokens[0].index);
        currentTx.description += ' ' + remainingWords.join(' ');
      } else {
        currentTx.description += ' ' + text;
      }
    }
  }

  // Push final transaction
  if (currentTx && currentTx.date && currentTx.amount) {
    extractedRows.push([
      currentTx.date,
      currentTx.description.trim(),
      currentTx.amount,
      currentTx.reference.trim(),
      currentTx.balance
    ]);
  }

  return {
    headers: standardHeaders,
    rows: extractedRows,
    detectedBank: detectedBank || undefined,
    detectedCurrency: detectedCurrency || undefined
  };
}

export function isAmountToken(str: string): boolean {
  if (!str) return false;
  const clean = str.trim();
  return AMOUNT_TOKEN_REGEX.test(clean);
}

export function cleanAmountString(str: string): string {
  if (!str) return '';
  const isNegative = str.includes('-') || str.includes('–') || str.toUpperCase().includes('DR');
  let numStr = str.replace(/[^0-9.]/g, '');
  if (!numStr) return '';
  return isNegative ? `-${numStr}` : numStr;
}

/**
 * Checks whether a transaction payee / narrative represents an Internal Contra Transfer.
 * e.g. HSBC -> Wise, Wise account-to-account, or transfers matching internal accounts.
 */
export function isInternalContraTransfer(
  payee: string,
  reference: string = '',
  knownBankAccounts: { bankName?: string; accountName?: string; accountNumber?: string }[] = []
): boolean {
  const combined = `${payee} ${reference}`.toLowerCase();
  
  // 1. Direct keywords for Wise / Treasury transfers
  const contraKeywords = [
    'wise payments',
    'transferwise',
    'wise ltd',
    'wise direct',
    'wise gbp',
    'wise zar',
    'wise usd',
    'wise eur',
    'internal transfer',
    'treasury transfer',
    'contra transfer',
    'account transfer',
    'sweep transfer',
    'inter-account',
    'transfer to wise',
    'transfer from wise',
    'deposit from wise',
    'deposit to wise'
  ];

  if (contraKeywords.some(kw => combined.includes(kw))) {
    return true;
  }

  // 2. Check if text matches another known bank account in the company/group
  for (const acc of knownBankAccounts) {
    if (acc.accountNumber && acc.accountNumber.length >= 4) {
      if (combined.includes(acc.accountNumber.toLowerCase())) {
        return true;
      }
    }
    if (acc.accountName && acc.accountName.length >= 4) {
      const cleanAcc = acc.accountName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanCombined = combined.replace(/[^a-z0-9]/g, '');
      if (cleanCombined.includes(cleanAcc)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks whether a transaction payee / narrative matches another company in the group (Intercompany).
 */
export function isIntercompanyTransfer(
  payee: string,
  reference: string = '',
  currentCompanyId: string,
  allCompanies: { id: string; name: string; aliases?: string[] }[]
): { isIntercompany: boolean; targetCompanyId?: string; targetCompanyName?: string } {
  const combined = `${payee} ${reference}`.toLowerCase();
  const cleanCombined = combined.replace(/[^a-z0-9]/g, '');

  for (const comp of allCompanies) {
    if (comp.id === currentCompanyId) continue; // Skip self

    const cleanCompName = (comp.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanCompName.length >= 4 && cleanCombined.includes(cleanCompName)) {
      return { isIntercompany: true, targetCompanyId: comp.id, targetCompanyName: comp.name };
    }

    if (comp.aliases && Array.isArray(comp.aliases)) {
      for (const alias of comp.aliases) {
        const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanAlias.length >= 3 && cleanCombined.includes(cleanAlias)) {
          return { isIntercompany: true, targetCompanyId: comp.id, targetCompanyName: comp.name };
        }
      }
    }
  }

  return { isIntercompany: false };
}
