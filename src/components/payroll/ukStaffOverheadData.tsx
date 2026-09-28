import React, { useState } from 'react';

export interface UkStaffOverheadItem {
  staffId: string;
  employeeName: string;
  month: string; // YYYY-MM
  regularHours: number;
  bonus: number;
  gross: number;
  royalLondon: number;
  employerNi: number;
  employerContrib: number;
  total: number;
}

export const UK_STAFF_IDS = {
  ALEX_MOORE: 'staff-1782810939333-53-694',
  DANNY_COLEMAN: 'staff-1782810939333-52-647',
  EMMETT_GRIFFIN: 'staff-1782810939333-50-8',
  WILLIAM_CHAMPKEN: 'staff-1782810939333-54-893',
};

// Data extracted directly from "Humres Employee Overhead - Jan-Sep 2026.xlsx"
export const UK_STAFF_OVERHEAD_DATA: Record<string, UkStaffOverheadItem> = {
  // Alex Moore
  [`${UK_STAFF_IDS.ALEX_MOORE}_2026-01`]: {
    staffId: UK_STAFF_IDS.ALEX_MOORE, employeeName: 'Alex Moore', month: '2026-01',
    regularHours: 2500, bonus: 0, gross: 2500, royalLondon: 59.40, employerNi: 312.45, employerContrib: 371.85, total: 2871.85
  },
  [`${UK_STAFF_IDS.ALEX_MOORE}_2026-02`]: {
    staffId: UK_STAFF_IDS.ALEX_MOORE, employeeName: 'Alex Moore', month: '2026-02',
    regularHours: 2500, bonus: 698, gross: 3198, royalLondon: 80.34, employerNi: 417.15, employerContrib: 497.49, total: 3695.49
  },
  [`${UK_STAFF_IDS.ALEX_MOORE}_2026-03`]: {
    staffId: UK_STAFF_IDS.ALEX_MOORE, employeeName: 'Alex Moore', month: '2026-03',
    regularHours: 2500, bonus: 813, gross: 3313, royalLondon: 83.79, employerNi: 434.40, employerContrib: 518.19, total: 3831.19
  },
  [`${UK_STAFF_IDS.ALEX_MOORE}_2026-04`]: {
    staffId: UK_STAFF_IDS.ALEX_MOORE, employeeName: 'Alex Moore', month: '2026-04',
    regularHours: 2500, bonus: 1015, gross: 3515, royalLondon: 89.85, employerNi: 464.70, employerContrib: 554.55, total: 4069.55
  },
  [`${UK_STAFF_IDS.ALEX_MOORE}_2026-05`]: {
    staffId: UK_STAFF_IDS.ALEX_MOORE, employeeName: 'Alex Moore', month: '2026-05',
    regularHours: 2500, bonus: 3429, gross: 5929, royalLondon: 110.07, employerNi: 826.80, employerContrib: 936.87, total: 6865.87
  },
  [`${UK_STAFF_IDS.ALEX_MOORE}_2026-06`]: {
    staffId: UK_STAFF_IDS.ALEX_MOORE, employeeName: 'Alex Moore', month: '2026-06',
    regularHours: 2500, bonus: 5163, gross: 7663, royalLondon: 110.07, employerNi: 1086.90, employerContrib: 1196.97, total: 8859.97
  },
  [`${UK_STAFF_IDS.ALEX_MOORE}_2026-07`]: {
    staffId: UK_STAFF_IDS.ALEX_MOORE, employeeName: 'Alex Moore', month: '2026-07',
    regularHours: 2500, bonus: 1251.62, gross: 3751.62, royalLondon: 96.95, employerNi: 500.19, employerContrib: 597.14, total: 4348.76
  },
  [`${UK_STAFF_IDS.ALEX_MOORE}_2026-08`]: {
    staffId: UK_STAFF_IDS.ALEX_MOORE, employeeName: 'Alex Moore', month: '2026-08',
    regularHours: 2500, bonus: 2696.50, gross: 5196.50, royalLondon: 110.07, employerNi: 716.92, employerContrib: 826.99, total: 6023.49
  },
  [`${UK_STAFF_IDS.ALEX_MOORE}_2026-09`]: {
    staffId: UK_STAFF_IDS.ALEX_MOORE, employeeName: 'Alex Moore', month: '2026-09',
    regularHours: 2500, bonus: 5830, gross: 8330, royalLondon: 110.07, employerNi: 1186.95, employerContrib: 1297.02, total: 9627.02
  },

  // Danny Coleman
  [`${UK_STAFF_IDS.DANNY_COLEMAN}_2026-01`]: {
    staffId: UK_STAFF_IDS.DANNY_COLEMAN, employeeName: 'Danny Coleman', month: '2026-01',
    regularHours: 2708.33, bonus: 3438, gross: 6146.33, royalLondon: 110.07, employerNi: 859.40, employerContrib: 969.47, total: 7115.80
  },
  [`${UK_STAFF_IDS.DANNY_COLEMAN}_2026-02`]: {
    staffId: UK_STAFF_IDS.DANNY_COLEMAN, employeeName: 'Danny Coleman', month: '2026-02',
    regularHours: 2708.33, bonus: 0, gross: 2708.33, royalLondon: 65.65, employerNi: 343.70, employerContrib: 409.35, total: 3117.68
  },
  [`${UK_STAFF_IDS.DANNY_COLEMAN}_2026-03`]: {
    staffId: UK_STAFF_IDS.DANNY_COLEMAN, employeeName: 'Danny Coleman', month: '2026-03',
    regularHours: 2708.33, bonus: 0, gross: 2708.33, royalLondon: 65.65, employerNi: 343.70, employerContrib: 409.35, total: 3117.68
  },
  [`${UK_STAFF_IDS.DANNY_COLEMAN}_2026-04`]: {
    staffId: UK_STAFF_IDS.DANNY_COLEMAN, employeeName: 'Danny Coleman', month: '2026-04',
    regularHours: 2708.33, bonus: 1000, gross: 3708.33, royalLondon: 95.65, employerNi: 493.70, employerContrib: 589.35, total: 4297.68
  },
  [`${UK_STAFF_IDS.DANNY_COLEMAN}_2026-05`]: {
    staffId: UK_STAFF_IDS.DANNY_COLEMAN, employeeName: 'Danny Coleman', month: '2026-05',
    regularHours: 2708.33, bonus: 150, gross: 2858.33, royalLondon: 70.15, employerNi: 366.20, employerContrib: 436.35, total: 3294.68
  },
  [`${UK_STAFF_IDS.DANNY_COLEMAN}_2026-06`]: {
    staffId: UK_STAFF_IDS.DANNY_COLEMAN, employeeName: 'Danny Coleman', month: '2026-06',
    regularHours: 2708.33, bonus: 609, gross: 3317.33, royalLondon: 83.92, employerNi: 435.05, employerContrib: 518.97, total: 3836.30
  },
  [`${UK_STAFF_IDS.DANNY_COLEMAN}_2026-07`]: {
    staffId: UK_STAFF_IDS.DANNY_COLEMAN, employeeName: 'Danny Coleman', month: '2026-07',
    regularHours: 2708.33, bonus: 0, gross: 2708.33, royalLondon: 65.65, employerNi: 343.70, employerContrib: 409.35, total: 3117.68
  },
  [`${UK_STAFF_IDS.DANNY_COLEMAN}_2026-08`]: {
    staffId: UK_STAFF_IDS.DANNY_COLEMAN, employeeName: 'Danny Coleman', month: '2026-08',
    regularHours: 2708.33, bonus: 2800, gross: 5508.33, royalLondon: 110.07, employerNi: 763.70, employerContrib: 873.77, total: 6382.10
  },
  [`${UK_STAFF_IDS.DANNY_COLEMAN}_2026-09`]: {
    staffId: UK_STAFF_IDS.DANNY_COLEMAN, employeeName: 'Danny Coleman', month: '2026-09',
    regularHours: 2708.33, bonus: 1337.50, gross: 4045.83, royalLondon: 105.78, employerNi: 544.32, employerContrib: 650.10, total: 4695.93
  },

  // Emmett Griffin
  [`${UK_STAFF_IDS.EMMETT_GRIFFIN}_2026-01`]: {
    staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, employeeName: 'Emmett Griffin', month: '2026-01',
    regularHours: 3791.67, bonus: 48, gross: 3839.67, royalLondon: 99.60, employerNi: 513.40, employerContrib: 613.00, total: 4452.67
  },
  [`${UK_STAFF_IDS.EMMETT_GRIFFIN}_2026-02`]: {
    staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, employeeName: 'Emmett Griffin', month: '2026-02',
    regularHours: 3791.67, bonus: 1582, gross: 5373.67, royalLondon: 110.07, employerNi: 743.50, employerContrib: 853.57, total: 6227.24
  },
  [`${UK_STAFF_IDS.EMMETT_GRIFFIN}_2026-03`]: {
    staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, employeeName: 'Emmett Griffin', month: '2026-03',
    regularHours: 3791.67, bonus: 4145, gross: 7936.67, royalLondon: 110.07, employerNi: 1127.95, employerContrib: 1238.02, total: 9174.69
  },
  [`${UK_STAFF_IDS.EMMETT_GRIFFIN}_2026-04`]: {
    staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, employeeName: 'Emmett Griffin', month: '2026-04',
    regularHours: 3791.67, bonus: 4558, gross: 8349.67, royalLondon: 110.07, employerNi: 1189.90, employerContrib: 1299.97, total: 9649.64
  },
  [`${UK_STAFF_IDS.EMMETT_GRIFFIN}_2026-05`]: {
    staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, employeeName: 'Emmett Griffin', month: '2026-05',
    regularHours: 3791.67, bonus: 4982, gross: 8773.67, royalLondon: 110.07, employerNi: 1253.50, employerContrib: 1363.57, total: 10137.24
  },
  [`${UK_STAFF_IDS.EMMETT_GRIFFIN}_2026-06`]: {
    staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, employeeName: 'Emmett Griffin', month: '2026-06',
    regularHours: 3791.67, bonus: 1756, gross: 5547.67, royalLondon: 110.07, employerNi: 769.60, employerContrib: 879.67, total: 6427.34
  },
  [`${UK_STAFF_IDS.EMMETT_GRIFFIN}_2026-07`]: {
    staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, employeeName: 'Emmett Griffin', month: '2026-07',
    regularHours: 3791.67, bonus: 2389.43, gross: 6181.10, royalLondon: 110.70, employerNi: 864.61, employerContrib: 975.31, total: 7156.41
  },
  [`${UK_STAFF_IDS.EMMETT_GRIFFIN}_2026-08`]: {
    staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, employeeName: 'Emmett Griffin', month: '2026-08',
    regularHours: 3791.67, bonus: 8119.65, gross: 11911.32, royalLondon: 110.07, employerNi: 1724.15, employerContrib: 1834.22, total: 13745.54
  },
  [`${UK_STAFF_IDS.EMMETT_GRIFFIN}_2026-09`]: {
    staffId: UK_STAFF_IDS.EMMETT_GRIFFIN, employeeName: 'Emmett Griffin', month: '2026-09',
    regularHours: 3791.67, bonus: 2245.32, gross: 6036.99, royalLondon: 110.07, employerNi: 843.00, employerContrib: 953.07, total: 6990.06
  },

  // William Champken
  [`${UK_STAFF_IDS.WILLIAM_CHAMPKEN}_2026-01`]: {
    staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, employeeName: 'William Champken', month: '2026-01',
    regularHours: 4166.67, bonus: 0, gross: 4166.67, royalLondon: 109.41, employerNi: 562.45, employerContrib: 671.86, total: 4838.53
  },
  [`${UK_STAFF_IDS.WILLIAM_CHAMPKEN}_2026-02`]: {
    staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, employeeName: 'William Champken', month: '2026-02',
    regularHours: 4166.67, bonus: 0, gross: 4166.67, royalLondon: 109.41, employerNi: 562.45, employerContrib: 671.86, total: 4838.53
  },
  [`${UK_STAFF_IDS.WILLIAM_CHAMPKEN}_2026-03`]: {
    staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, employeeName: 'William Champken', month: '2026-03',
    regularHours: 4166.67, bonus: 0, gross: 4166.67, royalLondon: 109.41, employerNi: 562.45, employerContrib: 671.86, total: 4838.53
  },
  [`${UK_STAFF_IDS.WILLIAM_CHAMPKEN}_2026-04`]: {
    staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, employeeName: 'William Champken', month: '2026-04',
    regularHours: 4166.67, bonus: 617, gross: 4783.67, royalLondon: 110.07, employerNi: 655.00, employerContrib: 765.07, total: 5548.74
  },
  [`${UK_STAFF_IDS.WILLIAM_CHAMPKEN}_2026-05`]: {
    staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, employeeName: 'William Champken', month: '2026-05',
    regularHours: 4375.00, bonus: 0, gross: 4375.00, royalLondon: 110.07, employerNi: 502.54, employerContrib: 612.61, total: 4987.61
  },
  [`${UK_STAFF_IDS.WILLIAM_CHAMPKEN}_2026-06`]: {
    staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, employeeName: 'William Champken', month: '2026-06',
    regularHours: 4375.00, bonus: 0, gross: 4375.00, royalLondon: 110.07, employerNi: 593.70, employerContrib: 703.77, total: 5078.77
  },
  [`${UK_STAFF_IDS.WILLIAM_CHAMPKEN}_2026-07`]: {
    staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, employeeName: 'William Champken', month: '2026-07',
    regularHours: 4375.00, bonus: 0, gross: 4375.00, royalLondon: 110.70, employerNi: 593.70, employerContrib: 704.40, total: 5079.40
  },
  [`${UK_STAFF_IDS.WILLIAM_CHAMPKEN}_2026-08`]: {
    staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, employeeName: 'William Champken', month: '2026-08',
    regularHours: 4375.00, bonus: 0, gross: 4375.00, royalLondon: 110.07, employerNi: 593.70, employerContrib: 703.77, total: 5078.77
  },
  [`${UK_STAFF_IDS.WILLIAM_CHAMPKEN}_2026-09`]: {
    staffId: UK_STAFF_IDS.WILLIAM_CHAMPKEN, employeeName: 'William Champken', month: '2026-09',
    regularHours: 4375.00, bonus: 0, gross: 4375.00, royalLondon: 110.07, employerNi: 593.70, employerContrib: 703.77, total: 5078.77
  }
};

/**
 * Lookup overhead breakdown by staffId OR employee name, and month (YYYY-MM).
 */
export function getUkStaffOverhead(staffIdOrName?: string | null, month?: string | null): UkStaffOverheadItem | null {
  if (!staffIdOrName || !month) return null;
  const targetMonth = month.substring(0, 7);

  // Direct staffId match
  const directKey = `${staffIdOrName}_${targetMonth}`;
  if (UK_STAFF_OVERHEAD_DATA[directKey]) {
    return UK_STAFF_OVERHEAD_DATA[directKey];
  }

  // Name or query match
  const q = staffIdOrName.toLowerCase();
  let matchedStaffId: string | null = null;
  if (q.includes('alex') || q.includes('moore')) {
    matchedStaffId = UK_STAFF_IDS.ALEX_MOORE;
  } else if (q.includes('danny') || q.includes('coleman')) {
    matchedStaffId = UK_STAFF_IDS.DANNY_COLEMAN;
  } else if (q.includes('emmett') || q.includes('emmet') || q.includes('griffin')) {
    matchedStaffId = UK_STAFF_IDS.EMMETT_GRIFFIN;
  } else if (q.includes('will') || q.includes('champken')) {
    matchedStaffId = UK_STAFF_IDS.WILLIAM_CHAMPKEN;
  }

  if (matchedStaffId) {
    const key = `${matchedStaffId}_${targetMonth}`;
    return UK_STAFF_OVERHEAD_DATA[key] || null;
  }

  return null;
}

/**
 * Plain-text tooltip string for native title="..." attributes
 */
export function formatOverheadTitle(item: UkStaffOverheadItem, titlePrefix = ''): string {
  const monthLabel = new Date(item.month + '-02').toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const hasBonus = item.bonus > 0;

  return `${titlePrefix ? titlePrefix + '\n' : ''}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${item.employeeName} (${monthLabel})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💼 Regular Hours:   £${item.regularHours.toLocaleString(undefined, { minimumFractionDigits: 2 })}
${hasBonus ? `🎁 Bonus:           £${item.bonus.toLocaleString(undefined, { minimumFractionDigits: 2 })} ★\n` : 'Bonus:            £0.00\n'}📊 Gross Pay:       £${item.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}
🏛️ Royal London:    £${item.royalLondon.toLocaleString(undefined, { minimumFractionDigits: 2 })}
🛡️ Employer NI:     £${item.employerNi.toLocaleString(undefined, { minimumFractionDigits: 2 })}
🏢 Total Contrib.:  £${item.employerContrib.toLocaleString(undefined, { minimumFractionDigits: 2 })}
─────────────────────────────
🌟 Cost to Company: £${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Reusable Rich Hover Popover Card
 */
export function OverheadHoverCard({ item, position = 'top' }: { item: UkStaffOverheadItem; position?: 'top' | 'bottom' }) {
  const monthLabel = new Date(item.month + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const hasBonus = item.bonus > 0;

  return (
    <div
      style={{
        position: 'absolute',
        [position === 'top' ? 'bottom' : 'top']: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: position === 'top' ? '8px' : undefined,
        marginTop: position === 'bottom' ? '8px' : undefined,
        zIndex: 9999,
        width: '260px',
        backgroundColor: '#0f172a', // Slate 900
        color: '#f8fafc',
        borderRadius: '8px',
        padding: '12px 14px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        fontSize: '11px',
        lineHeight: 1.4,
        textAlign: 'left',
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', paddingBottom: '6px', marginBottom: '8px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', color: '#ffffff' }}>{item.employeeName}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>{monthLabel} Overhead Breakdown</div>
        </div>
        {hasBonus && (
          <span style={{ 
            backgroundColor: 'rgba(16, 185, 129, 0.2)', 
            color: '#34d399', 
            border: '1px solid rgba(52, 211, 153, 0.3)', 
            fontSize: '9px', 
            fontWeight: 700, 
            padding: '2px 6px', 
            borderRadius: '4px' 
          }}>
            Bonus Month
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px', marginBottom: '8px' }}>
        <span style={{ color: '#cbd5e1' }}>💼 Regular Hours:</span>
        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>£{item.regularHours.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>

        <span style={{ color: hasBonus ? '#34d399' : '#94a3b8', fontWeight: hasBonus ? 700 : 400 }}>
          {hasBonus ? '🎁 Bonus:' : 'Bonus:'}
        </span>
        <span style={{ 
          fontWeight: 700, 
          fontFamily: 'monospace', 
          color: hasBonus ? '#34d399' : '#94a3b8',
          backgroundColor: hasBonus ? 'rgba(52, 211, 153, 0.1)' : undefined,
          padding: hasBonus ? '0 4px' : undefined,
          borderRadius: '3px'
        }}>
          £{item.bonus.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>

        <span style={{ color: '#cbd5e1', fontWeight: 600 }}>📊 Gross Earnings:</span>
        <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>£{item.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>

        <span style={{ color: '#94a3b8' }}>🏛️ Royal London Pension:</span>
        <span style={{ fontFamily: 'monospace' }}>£{item.royalLondon.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>

        <span style={{ color: '#94a3b8' }}>🛡️ Employer NI:</span>
        <span style={{ fontFamily: 'monospace' }}>£{item.employerNi.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>

        <span style={{ color: '#94a3b8' }}>🏢 Total Employer Contrib.:</span>
        <span style={{ fontFamily: 'monospace' }}>£{item.employerContrib.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        borderTop: '1px solid rgba(255, 255, 255, 0.15)', 
        paddingTop: '6px', 
        fontWeight: 700,
        color: '#38bdf8' 
      }}>
        <span>Total Cost to Company:</span>
        <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>
          £{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

/**
 * Container component that attaches mouse enter / leave and renders the popover
 */
export function WithOverheadTooltip({
  item,
  children,
  position = 'top'
}: {
  item: UkStaffOverheadItem | null;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}) {
  const [isHovered, setIsHovered] = useState(false);

  if (!item) return <>{children}</>;

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isHovered && <OverheadHoverCard item={item} position={position} />}
    </div>
  );
}
