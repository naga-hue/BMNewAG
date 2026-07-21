import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  Target, 
  X,
  HelpCircle,
  Clock,
  DollarSign
} from 'lucide-react';

export default function PsychologicalMomentumBar({
  placements = [],
  expenses = [],
  contracts = [],
  assetAssignments = [],
  leaveRequests = [],
  staff = [],
  onQuickAction,
  setActiveTab
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [customGoal, setCustomGoal] = useState(() => {
    try {
      return Number(localStorage.getItem('bm-custom-revenue-goal')) || 100000;
    } catch {
      return 100000;
    }
  });

  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [goalInput, setGoalInput] = useState(String(customGoal));

  // 1. LOSS AVERSION CALCULATIONS (Framing Risk & Waste)
  const lossMetrics = useMemo(() => {
    // Unallocated SaaS Seats waste
    let monthlySaaSLeak = 0;
    contracts.forEach(c => {
      if (c.quantityPurchased > 0) {
        const assignedCount = assetAssignments.filter(a => a.contractId === c.id).length;
        const unassigned = Math.max(0, c.quantityPurchased - assignedCount);
        const seatCost = c.costInterval === 'annual' ? (c.unitCost / 12) : (c.costInterval === 'one_time' ? 0 : c.unitCost);
        monthlySaaSLeak += unassigned * seatCost;
      }
    });

    // Unreconciled Expenses count & value
    const unreconciled = expenses.filter(e => !e.isReconciled);
    const unreconciledTotal = unreconciled.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Overdue debtor invoice payments (>30 days overdue)
    let overdueDebtTotal = 0;
    placements.forEach(p => {
      if (p.status !== 'dns' && (p.clientPaymentStatus === 'overdue' || p.paymentStatus === 'overdue')) {
        const gross = Number(p.grossBillAmount) || 0;
        const paid = Number(p.amountPaid) || 0;
        overdueDebtTotal += Math.max(0, gross - paid);
      }
    });

    return {
      monthlySaaSLeak,
      annualSaaSLeak: monthlySaaSLeak * 12,
      unreconciledCount: unreconciled.length,
      unreconciledTotal,
      overdueDebtTotal
    };
  }, [contracts, assetAssignments, expenses, placements]);

  // 2. GOAL GRADIENT & MOMENTUM METRICS (Sense of Progress)
  const momentumScore = useMemo(() => {
    let score = 50; // baseline

    // Reconciled expenses bonus
    if (expenses.length > 0) {
      const recRatio = expenses.filter(e => e.isReconciled).length / expenses.length;
      score += Math.round(recRatio * 20);
    } else {
      score += 15;
    }

    // License allocation bonus
    if (contracts.length > 0) {
      let totalPurchased = 0;
      let totalAssigned = 0;
      contracts.forEach(c => {
        totalPurchased += c.quantityPurchased || 0;
        totalAssigned += assetAssignments.filter(a => a.contractId === c.id).length;
      });
      const allocRatio = totalPurchased > 0 ? (totalAssigned / totalPurchased) : 1;
      score += Math.round(allocRatio * 15);
    } else {
      score += 15;
    }

    // Staff completeness bonus
    if (staff.length > 0) {
      const activeStaff = staff.filter(s => s.status !== 'exited');
      const completeStaff = activeStaff.filter(s => s.fullName && s.businessEmail && s.department);
      score += Math.round((completeStaff.length / (activeStaff.length || 1)) * 15);
    }

    return Math.min(98, Math.max(25, score));
  }, [expenses, contracts, assetAssignments, staff]);

  // Monthly revenue target calculation
  const currentMonthRevenue = useMemo(() => {
    let sum = 0;
    const now = new Date();
    placements.forEach(p => {
      if (p.status !== 'dns' && p.startDate) {
        const d = new Date(p.startDate);
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
          sum += Number(p.grossBillAmount || 0);
        }
      }
    });
    return sum;
  }, [placements]);

  const targetProgressPercent = Math.min(100, Math.round((currentMonthRevenue / (customGoal || 1)) * 100));

  const handleSaveGoal = (e) => {
    e.preventDefault();
    const val = Math.max(1000, Number(goalInput) || 100000);
    setCustomGoal(val);
    localStorage.setItem('bm-custom-revenue-goal', String(val));
    setShowGoalEditor(false);
  };

  if (isDismissed) return null;

  return (
    <div 
      style={{ 
        backgroundColor: 'var(--bg-card)', 
        border: '1px solid var(--border-color)', 
        borderRadius: '12px', 
        padding: '14px 18px', 
        marginBottom: '20px',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Gradient Accent */}
      <div 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          height: '3px', 
          background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)' 
        }} 
      />

      {/* Main Bar Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        
        {/* Left: Goal Gradient & Momentum Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 340px' }}>
          
          {/* Circular / Progress Ring */}
          <div style={{ position: 'relative', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="46" height="46" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--bg-secondary)"
                strokeWidth="3.5"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="url(#momentumGradient)"
                strokeWidth="3.5"
                strokeDasharray={`${momentumScore}, 100`}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="momentumGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <span style={{ position: 'absolute', fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {momentumScore}%
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                🎯 Operational Momentum Score
              </span>
              <span style={{ 
                fontSize: '9.5px', 
                fontWeight: 700, 
                backgroundColor: 'rgba(99, 102, 241, 0.12)', 
                color: 'var(--primary)', 
                padding: '2px 6px', 
                borderRadius: '10px' 
              }}>
                {momentumScore >= 80 ? 'Peak Efficiency' : momentumScore >= 60 ? 'Strong Progress' : 'Action Needed'}
              </span>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Monthly Target: <strong>£{currentMonthRevenue.toLocaleString()} / £{customGoal.toLocaleString()}</strong> ({targetProgressPercent}%)</span>
              <button
                type="button"
                onClick={() => setShowGoalEditor(!showGoalEditor)}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '10.5px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                title="Co-create your target (IKEA Effect)"
              >
                Custom Goal
              </button>
            </div>
          </div>
        </div>

        {/* Middle: Loss Aversion Warning Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {lossMetrics.monthlySaaSLeak > 0 && (
            <div 
              onClick={() => setActiveTab && setActiveTab('vendors')}
              style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.08)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', 
                padding: '6px 12px', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Loss Aversion: Action prevents recurring waste"
            >
              <AlertTriangle size={14} style={{ color: '#ef4444' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>
                  £{Math.round(lossMetrics.monthlySaaSLeak)}/mo Unallocated Waste
                </div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                  Save £{Math.round(lossMetrics.annualSaaSLeak).toLocaleString()}/yr by reassigning
                </div>
              </div>
            </div>
          )}

          {lossMetrics.overdueDebtTotal > 0 && (
            <div 
              onClick={() => setActiveTab && setActiveTab('credit_control')}
              style={{ 
                backgroundColor: 'rgba(245, 158, 11, 0.08)', 
                border: '1px solid rgba(245, 158, 11, 0.2)', 
                padding: '6px 12px', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
              title="Urgency Framing: Collect past due debt"
            >
              <Clock size={14} style={{ color: '#f59e0b' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>
                  £{Math.round(lossMetrics.overdueDebtTotal).toLocaleString()} Overdue Debt
                </div>
                <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                  Action recommended to prevent bad debt write-off
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right: Controls & Smart Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn-secondary"
            style={{ fontSize: '11px', padding: '6px 10px', height: '32px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Sparkles size={13} style={{ color: 'var(--primary)' }} />
            {isExpanded ? 'Hide Smart Actions' : '⚡ Smart Defaults'}
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            title="Dismiss Momentum Banner"
          >
            <X size={14} />
          </button>
        </div>

      </div>

      {/* Goal Customization Modal Input (IKEA Effect) */}
      {showGoalEditor && (
        <form 
          onSubmit={handleSaveGoal}
          style={{ 
            marginTop: '12px', 
            padding: '12px', 
            backgroundColor: 'var(--bg-secondary)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Set Monthly Revenue Target (£):
          </span>
          <input
            type="number"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            style={{ width: '120px', padding: '4px 8px', fontSize: '11.5px', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          />
          <button type="submit" className="btn-primary" style={{ fontSize: '10.5px', padding: '4px 10px', height: '28px' }}>
            Save Target
          </button>
          <button type="button" onClick={() => setShowGoalEditor(false)} className="btn-secondary" style={{ fontSize: '10.5px', padding: '4px 8px', height: '28px' }}>
            Cancel
          </button>
        </form>
      )}

      {/* Expanded Smart Defaults & Reciprocity Recommendations Drawer */}
      {isExpanded && (
        <div 
          style={{ 
            marginTop: '14px', 
            paddingTop: '14px', 
            borderTop: '1px solid var(--border-color)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* Smart Action 1: Reassign SaaS Waste */}
          <div 
            onClick={() => {
              if (setActiveTab) setActiveTab('vendors');
            }}
            style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px solid var(--border-color)', 
              padding: '10px 12px', 
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              <Zap size={13} style={{ color: 'var(--primary)' }} /> 1-Click Reallocate SaaS Seats
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
              Reassign unused software licenses to active staff to eliminate £{Math.round(lossMetrics.monthlySaaSLeak)}/mo waste instantly.
            </div>
          </div>

          {/* Smart Action 2: Reconcile Expenses */}
          <div 
            onClick={() => {
              if (setActiveTab) setActiveTab('expenses');
            }}
            style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px solid var(--border-color)', 
              padding: '10px 12px', 
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              <CheckCircle2 size={13} style={{ color: 'var(--success)' }} /> Auto-Reconcile Ledger Items
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
              {lossMetrics.unreconciledCount} unreconciled ledger items ready for instant matching.
            </div>
          </div>

          {/* Smart Action 3: Chase Debtors */}
          <div 
            onClick={() => {
              if (setActiveTab) setActiveTab('credit_control');
            }}
            style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              border: '1px solid var(--border-color)', 
              padding: '10px 12px', 
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              <TrendingUp size={13} style={{ color: '#f59e0b' }} /> Draft Credit Chaser Emails
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
              Generate automatic email chasers for past-due client accounts to accelerate cashflow.
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
