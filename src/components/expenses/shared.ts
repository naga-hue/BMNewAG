export interface Currency {
  code: string;
  symbol: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'AED', symbol: 'AED ' },
  { code: 'INR', symbol: '₹' },
  { code: 'ZAR', symbol: 'R' }
];

export const symbolMap: Record<string, string> = {
  GBP: '£',
  USD: '$',
  AED: 'AED ',
  INR: '₹',
  ZAR: 'R'
};

export const DEPARTMENTS = ["Sales", "Technology", "Recruitment", "HR", "Finance", "Legal", "Marketing", "Corporate"];

export const getDaysWorkedInMonth = (startDateStr: string | undefined | null, exitDateStr: string | undefined | null, monthKey: string): number => {
  const [y, m] = monthKey.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 0));
  
  const parseUTC = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length < 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return new Date(Date.UTC(year, month - 1, day));
  };

  let employeeStart = parseUTC(startDateStr);
  let employeeExit = parseUTC(exitDateStr);

  if (!employeeStart) {
    employeeStart = new Date(Date.UTC(2000, 0, 1));
  }

  if (employeeStart > monthEnd) {
    return 0;
  }

  if (employeeExit && employeeExit < monthStart) {
    return 0;
  }

  const actualStart = employeeStart > monthStart ? employeeStart : monthStart;
  const actualExit = (employeeExit && employeeExit < monthEnd)
    ? employeeExit
    : monthEnd;

  const diffTime = actualExit.getTime() - actualStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return diffDays > 0 ? diffDays : 0;
};

export function parseAndStandardizeDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const cleanStr = dateStr.trim();
  
  // 1. If it's already standard YYYY-MM-DD, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    return cleanStr;
  }

  // 2. Parse using parts split by slash, hyphen, space
  const parts = cleanStr.split(/[-/ ]+/);
  if (parts.length === 3) {
    let day = '';
    let monthStr = '';
    let year = '';

    // Check if first part is a 4-digit year (e.g. YYYY-MM-DD with slashes or spaces)
    if (parts[0].length === 4) {
      year = parts[0];
      monthStr = parts[1];
      day = parts[2];
    } else {
      // UK formats: DD-MM-YYYY, DD/MM/YYYY, DD-MMM-YY, etc.
      day = parts[0];
      monthStr = parts[1];
      year = parts[2];
    }

    // Standardize year
    if (year.length === 2) {
      year = `20${year}`;
    }

    // Standardize month (handle names like "Jan", "Feb", "July", etc.)
    let monthNum = parseInt(monthStr, 10);
    if (isNaN(monthNum)) {
      const monthsMap: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        january: '01', february: '02', march: '03', april: '04', june: '06',
        july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
      };
      const key = monthStr.toLowerCase();
      if (monthsMap[key]) {
        monthStr = monthsMap[key];
      } else {
        // Fallback to current month if we can't parse it
        monthStr = String(new Date().getMonth() + 1).padStart(2, '0');
      }
    } else {
      monthStr = String(monthNum).padStart(2, '0');
    }

    day = String(parseInt(day, 10) || 1).padStart(2, '0');

    return `${year}-${monthStr}-${day}`;
  }

  // 3. Fallback to native JS Date parsing (caution: standard JS parses MM/DD/YYYY first)
  try {
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().substring(0, 10);
    }
  } catch {}

  return cleanStr;
}

