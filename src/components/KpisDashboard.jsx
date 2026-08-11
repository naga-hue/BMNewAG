import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, query, where, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { useBoundStore } from '../store/useBoundStore';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Clock, 
  User, 
  Users, 
  Search, 
  FileText, 
  Volume2, 
  Play, 
  Pause, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Briefcase,
  Sliders,
  ChevronRight,
  Filter,
  RefreshCw
} from 'lucide-react';

// Formats seconds to a readable string (e.g. 2h 15m or 4m 12s)
const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

const CRMContactLink = ({ phone, defaultName }) => {
  const [crmData, setCrmData] = useState(null);

  useEffect(() => {
    if (!phone) return;
    
    const clean = phone.replace(/[^0-9+]/g, '').trim();
    if (clean.length < 6) return;

    if (window._crmCache && window._crmCache[clean]) {
      setCrmData(window._crmCache[clean]);
      return;
    }

    if (window._crmPending && window._crmPending[clean]) {
      const interval = setInterval(() => {
        if (window._crmCache && window._crmCache[clean]) {
          setCrmData(window._crmCache[clean]);
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }

    if (!window._crmCache) window._crmCache = {};
    if (!window._crmPending) window._crmPending = {};

    window._crmPending[clean] = true;

    fetch(`/api/crm-lookup?phone=${encodeURIComponent(clean)}`)
      .then(r => r.json())
      .then(d => {
        window._crmPending[clean] = false;
        if (d && d.matched) {
          window._crmCache[clean] = d;
          setCrmData(d);
        } else {
          window._crmCache[clean] = { matched: false };
          setCrmData({ matched: false });
        }
      })
      .catch(() => {
        window._crmPending[clean] = false;
      });
  }, [phone]);

  if (crmData && crmData.matched) {
    const linkPath = crmData.type.toLowerCase();
    const linkUrl = `https://secure.recruitly.io/${linkPath}?id=${crmData.id}`;
    return (
      <a 
        href={linkUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        title={`${crmData.name} (${crmData.type})${crmData.company ? ` - ${crmData.company}` : ''}`}
        style={{ 
          color: '#E8611A',
          fontWeight: 600, 
          textDecoration: 'underline',
          cursor: 'pointer'
        }}
      >
        🔗 {crmData.name}
      </a>
    );
  }

  return <span>{defaultName}</span>;
};

// Formats raw Dialpad dispositions (e.g. "Candidate~NoAnswer") into pretty styled pills
const renderDispositionBadges = (dispositionStr) => {
  const disp = dispositionStr || '';
  if (!disp || disp.toLowerCase() === 'connected' || disp.toLowerCase() === 'undefined') {
    return (
      <span style={{
        padding: '3px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 700,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        color: 'var(--success)'
      }}>
        Connected
      </span>
    );
  }

  const items = disp.split(',').map(s => s.trim()).filter(Boolean);
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center' }}>
      {items.map((item, idx) => {
        const formatted = item.replace(/~/g, ' — ');
        let bgColor = 'rgba(245, 158, 11, 0.1)';
        let color = 'var(--warning)';
        const lower = item.toLowerCase();
        
        if (lower.includes('interview')) {
          bgColor = 'rgba(139, 92, 246, 0.15)';
          color = 'rgb(139, 92, 246)';
        } else if (lower.includes('vc') || lower.includes('video')) {
          bgColor = 'rgba(59, 130, 246, 0.15)';
          color = 'var(--primary)';
        } else if (lower.includes('pq') || lower.includes('qualify')) {
          bgColor = 'rgba(16, 185, 129, 0.15)';
          color = 'var(--success)';
        } else if (lower.includes('noanswer') || lower.includes('missed') || lower.includes('voicemail')) {
          bgColor = 'rgba(239, 68, 68, 0.1)';
          color = '#ef4444';
        }
        
        return (
          <span key={idx} style={{
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 700,
            backgroundColor: bgColor,
            color: color,
            whiteSpace: 'nowrap'
          }}>
            {formatted}
          </span>
        );
      })}
    </div>
  );
};

// Helper to render color-coded effectiveness & productivity badges
const renderPercentageBadge = (pct) => {
  if (pct === undefined || pct === null) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
  const num = Number(pct);
  let bgColor = 'rgba(239, 68, 68, 0.1)';
  let color = 'var(--danger)';
  if (num >= 80) {
    bgColor = 'rgba(16, 185, 129, 0.1)';
    color = 'var(--success)';
  } else if (num >= 50) {
    bgColor = 'rgba(245, 158, 11, 0.1)';
    color = 'var(--warning)';
  }
  return (
    <span style={{
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 700,
      backgroundColor: bgColor,
      color: color,
      display: 'inline-block'
    }}>
      {num}%
    </span>
  );
};

export default function KpisDashboard({ staff, companies, currentUser, onShowToast, placements = [] }) {
  // Helper to determine if a staff member is tracked in KPIs
  const isStaffDialpadTracked = (s) => {
    if (s.status === 'exited') return false; // Filter out exited employees
    if (s.dialpadTracked === false) return false;
    if (s.dialpadTracked === true) return true;
    const email = (s.businessEmail || s.personalEmail || '').toLowerCase();
    if (email.includes('@talent-h.com') || email.includes('@totaco.net')) {
      return false;
    }
    return true;
  };



  // Firestore data states
  const [kpiDocs, setKpiDocs] = useState([]);
  const [liveCalls, setLiveCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [hasRealCalls, setHasRealCalls] = useState(false);

  // Dashboard view states
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'performance' | 'calls' | 'mapping'

  // Call Logs time filtering states
  const [callsTimeRange, setCallsTimeRange] = useState('today'); // today, yesterday, this_week, this_month, custom
  const [callsCustomStartDate, setCallsCustomStartDate] = useState('');
  const [callsCustomEndDate, setCallsCustomEndDate] = useState('');

  // Call Logs search & pagination states
  const [callLogsSearch, setCallLogsSearch] = useState('');
  const [debouncedCallLogsSearch, setDebouncedCallLogsSearch] = useState('');
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCallLogsSearch(callLogsSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [callLogsSearch]);

  const [callLogsDirection, setCallLogsDirection] = useState('all'); // 'all' | 'inbound' | 'outbound'
  const [callLogsPage, setCallLogsPage] = useState(1);
  const callLogsPageSize = 10;
  
  // Call Logs sorting states
  const [callLogsSortField, setCallLogsSortField] = useState('date'); // 'date' | 'staffName' | 'direction' | 'targetName' | 'targetType' | 'duration' | 'disposition' | 'benchmark'
  const [callLogsSortDirection, setCallLogsSortDirection] = useState('desc'); // 'asc' | 'desc'

  // Overview tab sorting states
  const [overviewSortField, setOverviewSortField] = useState('calls'); // default sort by calls
  const [overviewSortAsc, setOverviewSortAsc] = useState(false); // default descending

  const [callLogsSubFilter, setCallLogsSubFilter] = useState('all'); // 'all' | 'connected' | 'client' | 'candidate' | 'over5m' | 'over10m' | 'callback' | 'alpha'

  const [drillDownModal, setDrillDownModal] = useState(null); // null | { staffName, category, dateText, calls: [], isLoading: true }

  // Qandle attendance & productivity states
  const [qandleDocs, setQandleDocs] = useState([]);
  const [isLoadingQandle, setIsLoadingQandle] = useState(false);
  const [qandleSearch, setQandleSearch] = useState('');
  const [debouncedQandleSearch, setDebouncedQandleSearch] = useState('');
  const [qandlePage, setQandlePage] = useState(1);
  const [qandleSortField, setQandleSortField] = useState('date');
  const [qandleSortDirection, setQandleSortDirection] = useState('desc');
  const [qandleTimeRange, setQandleTimeRange] = useState('today');
  const [qandleCustomStartDate, setQandleCustomStartDate] = useState('');
  const [qandleCustomEndDate, setQandleCustomEndDate] = useState('');
  const [qandleRefreshTrigger, setQandleRefreshTrigger] = useState(0);
  const [isSyncingQandle, setIsSyncingQandle] = useState(false);
  const [syncQandleError, setSyncQandleError] = useState('');
  const [syncQandleSuccess, setSyncQandleSuccess] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQandleSearch(qandleSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [qandleSearch]);

  // Performance Scorecard sorting states
  const [perfSortField, setPerfSortField] = useState('totalCalls'); // 'recruiter' | 'division' | 'totalCalls' | 'totalTalkTime' | 'callsOver5Min' | 'cvsSent' | 'interviews' | 'jobsTaken'
  const [perfSortDirection, setPerfSortDirection] = useState('desc'); // 'asc' | 'desc'

  // Multi-select KPI target assignment states
  const [selectedStaffIds, setSelectedStaffIds] = useState([]); // Array of staff IDs for bulk target setting

  const handleSyncQandle = async () => {
    setIsSyncingQandle(true);
    setSyncQandleError('');
    setSyncQandleSuccess('');
    try {
      const secret = 'qandle-talent-kpi-hub-key-2026';
      const res = await fetch(`/api/qandle/sync?secret=${secret}&bypassTimecheck=true`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncQandleSuccess(data.message || 'Sync completed successfully!');
        setQandleRefreshTrigger(prev => prev + 1);
        setTimeout(() => setSyncQandleSuccess(''), 5000);
      } else {
        setSyncQandleError(data.error || 'Failed to sync with Qandle API.');
        setTimeout(() => setSyncQandleError(''), 5000);
      }
    } catch (err) {
      setSyncQandleError(err.message || 'An error occurred during sync.');
      setTimeout(() => setSyncQandleError(''), 5000);
    } finally {
      setIsSyncingQandle(false);
    }
  };

  const handleSort = (field) => {
    if (callLogsSortField === field) {
      setCallLogsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setCallLogsSortField(field);
      setCallLogsSortDirection('desc');
    }
  };

  const renderSortIndicator = (field) => {
    if (callLogsSortField !== field) return null;
    return callLogsSortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const handlePerfSort = (field) => {
    if (perfSortField === field) {
      setPerfSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPerfSortField(field);
      setPerfSortDirection('desc');
    }
  };

  const renderPerfSortIndicator = (field) => {
    if (perfSortField !== field) return null;
    return perfSortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const handleQandleSort = (field) => {
    if (qandleSortField === field) {
      setQandleSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setQandleSortField(field);
      setQandleSortDirection('desc');
    }
  };

  const renderQandleSortIndicator = (field) => {
    if (qandleSortField !== field) return null;
    return qandleSortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  // Recruiter Mapping edit states
  const [mappingSearch, setMappingSearch] = useState('');
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingAliases, setEditingAliases] = useState('');
  const [editingQandleEmail, setEditingQandleEmail] = useState('');
  const [editingDialpadEmail, setEditingDialpadEmail] = useState('');
  const [editingRecruitlyEmail, setEditingRecruitlyEmail] = useState('');

  // KPI Targets edit states
  const [editingTargetsStaffId, setEditingTargetsStaffId] = useState(null);
  const [targetCalls, setTargetCalls] = useState(0);
  const [targetTalkTimeMin, setTargetTalkTimeMin] = useState(0);
  const [targetCvsSent, setTargetCvsSent] = useState(0);
  const [targetSpeculativeCvs, setTargetSpeculativeCvs] = useState(0);
  const [targetJobsTaken, setTargetJobsTaken] = useState(0);
  const [targetInterviews, setTargetInterviews] = useState(0);
  const [targetPlacements, setTargetPlacements] = useState(0);
  const [targetPlacementValue, setTargetPlacementValue] = useState(0);

  // Recruiter Comparison Bench states
  const [compareRecruiterA, setCompareRecruiterA] = useState('');
  const [compareRecruiterB, setCompareRecruiterB] = useState('');
  const [compareRecruiterC, setCompareRecruiterC] = useState('');

  const handleOpenTargetsEditor = (s) => {
    setEditingTargetsStaffId(s.id);
    const targets = s.kpiTargets || {};
    setTargetCalls(targets.calls || 40);
    setTargetTalkTimeMin(targets.talkTimeMin || 60);
    setTargetCvsSent(targets.cvsSent || 5);
    setTargetSpeculativeCvs(targets.speculativeCvs || 2);
    setTargetJobsTaken(targets.jobsTaken || 1);
    setTargetInterviews(targets.interviews || 2);
    setTargetPlacements(targets.placements || 4);
    setTargetPlacementValue(targets.placementValue || 15000);
  };

  const handleSaveTargets = async () => {
    try {
      if (editingTargetsStaffId === 'bulk') {
        if (selectedStaffIds.length === 0) return;
        
        for (const staffId of selectedStaffIds) {
          const staffMember = staff.find(s => s.id === staffId);
          if (!staffMember) continue;
          
          const updated = {
            ...staffMember,
            kpiTargets: {
              calls: Number(targetCalls || 0),
              talkTimeMin: Number(targetTalkTimeMin || 0),
              cvsSent: Number(targetCvsSent || 0),
              speculativeCvs: Number(targetSpeculativeCvs || 0),
              jobsTaken: Number(targetJobsTaken || 0),
              interviews: Number(targetInterviews || 0),
              placements: Number(targetPlacements || 0),
              placementValue: Number(targetPlacementValue || 0)
            }
          };
          await useBoundStore.getState().updateStaff(updated);
        }
        
        onShowToast?.(`KPI targets updated for ${selectedStaffIds.length} recruiters`, 'success');
        setSelectedStaffIds([]); // Clear selection
      } else {
        const staffMember = staff.find(s => s.id === editingTargetsStaffId);
        if (!staffMember) return;

        const updated = {
          ...staffMember,
          kpiTargets: {
            calls: Number(targetCalls || 0),
            talkTimeMin: Number(targetTalkTimeMin || 0),
            cvsSent: Number(targetCvsSent || 0),
            speculativeCvs: Number(targetSpeculativeCvs || 0),
            jobsTaken: Number(targetJobsTaken || 0),
            interviews: Number(targetInterviews || 0),
            placements: Number(targetPlacements || 0),
            placementValue: Number(targetPlacementValue || 0)
          }
        };

        await useBoundStore.getState().updateStaff(updated);
        onShowToast?.(`KPI targets updated for ${staffMember.fullName}`, 'success');
      }
      setEditingTargetsStaffId(null);
    } catch (e) {
      console.error('Error saving KPI targets:', e);
      onShowToast?.('Failed to save KPI targets', 'error');
    }
  };

  // Action to save recruiter matching aliases to Firestore via Zustand store
  const handleSaveAliases = async (staffId) => {
    try {
      const staffMember = staff.find(s => s.id === staffId);
      if (!staffMember) return;

      const updated = {
        ...staffMember,
        additionalEmails: editingAliases.trim(),
        qandleEmail: editingQandleEmail.trim().toLowerCase(),
        dialpadEmail: editingDialpadEmail.trim().toLowerCase(),
        recruitlyEmail: editingRecruitlyEmail.trim().toLowerCase()
      };

      await useBoundStore.getState().updateStaff(updated);
      onShowToast?.(`Integration mappings updated for ${staffMember.fullName}`, 'success');
      setEditingStaffId(null);
    } catch (e) {
      console.error('Error updating matching mappings:', e);
      onShowToast?.('Failed to update matching mappings', 'error');
    }
  };


  // 1. Time filter states
  const [timeRange, setTimeRange] = useState('this_month'); // today, this_week, this_month, ytd, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // 2. Filter states based on RBAC
  const userRole = currentUser?.permissions?.role || 'recruiter';
  const userDept = currentUser?.department || '';
  
  // Set default view depending on permissions
  const [selectedDept, setSelectedDept] = useState(
    userRole === 'admin' ? 'all' : (userRole === 'manager' ? userDept : userDept)
  );
  const [selectedStaffId, setSelectedStaffId] = useState(
    userRole === 'recruiter' ? currentUser.id : 'all'
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState('all');

  // Overview / Daily Activity tab date range states
  const [overviewTimeRange, setOverviewTimeRange] = useState('today');
  const [overviewCustomStartDate, setOverviewCustomStartDate] = useState('');
  const [overviewCustomEndDate, setOverviewCustomEndDate] = useState('');

  const handleDrillDown = (staffId, category, isPerformance = false) => {
    // 1. Copy active date filter to call logs date filter
    if (isPerformance) {
      setCallsTimeRange(timeRange);
      if (timeRange === 'custom') {
        setCallsCustomStartDate(customStartDate);
        setCallsCustomEndDate(customEndDate);
      }
    } else {
      setCallsTimeRange(overviewTimeRange === 'day_before' ? 'custom' : overviewTimeRange);
      if (overviewTimeRange === 'day_before') {
        const today = new Date();
        today.setDate(today.getDate() - 2);
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dayBeforeStr = `${year}-${month}-${day}`;
        setCallsCustomStartDate(dayBeforeStr);
        setCallsCustomEndDate(dayBeforeStr);
      } else if (overviewTimeRange === 'custom') {
        setCallsCustomStartDate(overviewCustomStartDate);
        setCallsCustomEndDate(overviewCustomEndDate);
      }
    }
    
    // 2. Select recruiter (only if not restricted to recruiter role)
    if (userRole !== 'recruiter') {
      setSelectedStaffId(staffId);
    }
    
    // 3. Clear text search query
    setCallLogsSearch('');
    
    // 4. Set category sub-filter
    setCallLogsSubFilter(category);
    
    // 5. Reset page count
    setCallLogsPage(1);
    
    // 6. Switch to Calls sub-tab
    setActiveSubTab('calls');
  };

  const handleCellClick = async (staffId, staffName, category, isPerformance = false) => {
    let start = '';
    let end = '';
    let dateText = '';
    
    if (isPerformance) {
      const today = new Date();
      const todayStr = today.toISOString().substring(0, 10);
      if (timeRange === 'today') {
        start = todayStr;
        end = todayStr;
        dateText = 'Today';
      } else if (timeRange === 'this_week') {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        start = monday.toISOString().substring(0, 10);
        end = todayStr;
        dateText = 'This Week';
      } else if (timeRange === 'this_month') {
        start = `${todayStr.substring(0, 7)}-01`;
        end = todayStr;
        dateText = 'This Month';
      } else {
        start = customStartDate || '2026-01-01';
        end = customEndDate || todayStr;
        dateText = `${start} to ${end}`;
      }
    } else {
      const today = new Date();
      const getLondonDateString = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const todayStr = getLondonDateString(today);
      
      if (overviewTimeRange === 'today') {
        start = todayStr;
        end = todayStr;
        dateText = 'Today';
      } else if (overviewTimeRange === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        start = getLondonDateString(yesterday);
        end = start;
        dateText = 'Yesterday';
      } else if (overviewTimeRange === 'day_before') {
        const dayBefore = new Date(today);
        dayBefore.setDate(dayBefore.getDate() - 2);
        start = getLondonDateString(dayBefore);
        end = start;
        dateText = 'Day Before Yesterday';
      } else if (overviewTimeRange === 'custom') {
        start = overviewCustomStartDate || todayStr;
        end = overviewCustomEndDate || todayStr;
        dateText = `${start} to ${end}`;
      }
    }

    setDrillDownModal({
      staffName,
      category,
      dateText,
      calls: [],
      isLoading: true
    });
    try {
      const q = query(
        collection(db, 'dialpad_calls'),
        where('dateStarted', '>=', start),
        where('dateStarted', '<=', end + 'T23:59:59.999Z')
      );
      
      const snap = await getDocs(q);
      const rawCalls = [];
      snap.forEach(d => {
        const callData = d.data();
        if (callData.handlerId === staffId) {
          rawCalls.push({ id: d.id, ...callData });
        }
      });

      const formatted = rawCalls.map(call => {
        let dateVal = '';
        let timeVal = '';
        if (call.dateStarted) {
          let dateObj = null;
          if (typeof call.dateStarted === 'string') {
            dateObj = new Date(call.dateStarted);
          } else if (typeof call.dateStarted === 'number') {
            const ms = call.dateStarted < 9999999999 ? call.dateStarted * 1000 : call.dateStarted;
            dateObj = new Date(ms);
          } else if (call.dateStarted.seconds) {
            dateObj = new Date(call.dateStarted.seconds * 1000);
          } else if (call.dateStarted instanceof Date) {
            dateObj = call.dateStarted;
          }

          if (dateObj && !isNaN(dateObj.getTime())) {
            try {
              const dTF = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Europe/London',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              });
              dateVal = dTF.format(dateObj);

              const tTF = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/London',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });
              timeVal = tTF.format(dateObj);
            } catch (errFormat) {
              const year = dateObj.getFullYear();
              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
              const day = String(dateObj.getDate()).padStart(2, '0');
              dateVal = `${year}-${month}-${day}`;
              
              const hours = String(dateObj.getHours()).padStart(2, '0');
              const minutes = String(dateObj.getMinutes()).padStart(2, '0');
              const seconds = String(dateObj.getSeconds()).padStart(2, '0');
              timeVal = `${hours}:${minutes}:${seconds}`;
            }
          }
        }

        const targetTypeVal = (call.target?.type || 'external').toLowerCase().trim() === 'user' 
          ? 'Candidate' 
          : 'Client';

        return {
          id: call.id || call.conversationId,
          staffId: call.handlerId,
          staffName: call.handlerName,
          department: call.department || '',
          direction: call.direction === 'inbound' ? 'Inbound' : 'Outbound',
          date: dateVal,
          time: timeVal,
          targetName: call.externalName || call.externalNumber || 'Unknown',
          targetType: targetTypeVal,
          duration: call.durationSeconds || 0,
          hasRecording: call.wasRecorded,
          recordingUrl: call.recordingUrl,
          transcript: call.transcript || 'No transcript generated yet.',
          disposition: call.disposition || '',
          recapSummary: call.recapSummary || '',
          recapOutcome: call.recapOutcome || '',
          externalNumber: call.externalNumber || ''
        };
      });

      const filtered = formatted.filter(call => {
        if (category === 'connected') {
          if (call.duration <= 0) return false;
        } else if (category === 'client') {
          if (call.targetType !== 'Client') return false;
        } else if (category === 'candidate') {
          if (call.targetType !== 'Candidate') return false;
        } else if (category === 'over5m') {
          if (call.duration < 300) return false;
        } else if (category === 'over10m') {
          if (call.duration < 600) return false;
        } else if (category === 'callback') {
          const isCB = (call.disposition || '').toLowerCase().includes('callback') || 
                       (call.disposition || '').toLowerCase().includes('cb');
          if (!isCB) return false;
        } else if (category === 'alpha') {
          const isAlpha = (call.disposition || '').toLowerCase().includes('alpha') || 
                          (call.recapSummary || '').toLowerCase().includes('opportunity') || 
                          (call.recapSummary || '').toLowerCase().includes('alpha');
          if (!isAlpha) return false;
        }
        return true;
      });

      filtered.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));

      setDrillDownModal({
        staffName,
        category,
        dateText,
        calls: filtered,
        isLoading: false
      });

    } catch (e) {
      console.error(e);
      setDrillDownModal(prev => prev ? { ...prev, isLoading: false } : null);
      onShowToast?.('Failed to fetch call details', 'error');
    }
  };

  const renderClickableCount = (val, staffId, staffName, category, color = 'var(--text-primary)') => {
    if (!val || val === 0) return <span style={{ color: 'var(--text-muted)' }}>0</span>;
    return (
      <button
        onClick={() => handleCellClick(staffId, staffName, category, false)}
        style={{
          background: 'none',
          border: 'none',
          color: color,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
          display: 'inline-block'
        }}
        title={`View logs for these ${val} calls`}
      >
        {val}
      </button>
    );
  };

  const renderClickableCountPerf = (val, staffId, staffName, category, color = 'var(--text-primary)') => {
    if (!val || val === 0) return <span style={{ color: 'var(--text-muted)' }}>0</span>;
    return (
      <button
        onClick={() => handleCellClick(staffId, staffName, category, true)}
        style={{
          background: 'none',
          border: 'none',
          color: color,
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
          display: 'inline-block'
        }}
        title={`View logs for these ${val} calls`}
      >
        {val}
      </button>
    );
  };

  // 3. Modal details states for call recordings/transcripts
  const [activeCallDetail, setActiveCallDetail] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(35); // mock percent
  const [isEnriching, setIsEnriching] = useState(false);

  useEffect(() => {
    if (!activeCallDetail || activeCallDetail.id.startsWith('call-')) return;
    
    // Check if it's already enriched
    const hasTranscript = activeCallDetail.transcript && activeCallDetail.transcript !== 'No transcript generated yet.' && activeCallDetail.transcript !== 'Transcript is empty';
    const hasPublicRecording = !activeCallDetail.hasRecording || (activeCallDetail.recordingUrl && activeCallDetail.recordingUrl.startsWith('http') && !activeCallDetail.recordingUrl.includes('dialpad.com/blob/'));
    
    if (hasTranscript && hasPublicRecording) return; // already enriched!

    let isMounted = true;
    async function enrichCall() {
      setIsEnriching(true);
      try {
        const res = await fetch(`/api/dialpad/enrich?conversationId=${activeCallDetail.id}`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        
        if (isMounted && data && data.enriched) {
          const updatedDetail = {
            ...activeCallDetail,
            recordingUrl: data.recordingUrl || activeCallDetail.recordingUrl,
            hasRecording: data.wasRecorded || activeCallDetail.hasRecording,
            transcript: data.transcript || activeCallDetail.transcript,
            disposition: data.disposition || activeCallDetail.disposition || '',
            recapSummary: data.recapSummary || activeCallDetail.recapSummary || '',
            recapOutcome: data.recapOutcome || activeCallDetail.recapOutcome || ''
          };
          setActiveCallDetail(updatedDetail);
          
          // Also update the liveCalls list state so it stays updated in the main table list!
          setLiveCalls(prevCalls => 
            prevCalls.map(c => 
              (c.id === activeCallDetail.id || c.conversationId === activeCallDetail.id)
                ? { ...c, ...data } 
                : c
            )
          );
        }
      } catch (err) {
        console.error("Failed to enrich call:", err);
      } finally {
        if (isMounted) setIsEnriching(false);
      }
    }

    enrichCall();

    return () => {
      isMounted = false;
    };
  }, [activeCallDetail?.id]);

  // List of departments from staff
  const departments = useMemo(() => {
    const depts = new Set();
    staff.forEach(s => {
      if (s.department) depts.add(s.department);
    });
    return Array.from(depts);
  }, [staff]);

  // List of staff filtered by selected department and company (if not recruiter)
  const filteredStaffList = useMemo(() => {
    let list = staff;
    if (userRole === 'recruiter') {
      list = staff.filter(s => s.id === currentUser.id);
    } else {
      if (userRole === 'manager') {
        list = staff.filter(s => s.department === userDept);
      } else if (selectedDept !== 'all') {
        list = staff.filter(s => s.department === selectedDept);
      }
      if (selectedCompanyId !== 'all') {
        list = list.filter(s => s.companyId === selectedCompanyId);
      }
    }
    return list.filter(isStaffDialpadTracked);
  }, [staff, selectedDept, selectedCompanyId, userRole, userDept, currentUser.id]);

  // Calculate daily activity date range window for Overview sub-tab (Today, Yesterday, Day Before Yesterday, Custom)
  const overviewDateRangeWindow = useMemo(() => {
    const today = new Date();
    
    const getLondonDateString = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = getLondonDateString(today);
    
    if (overviewTimeRange === 'today') {
      return { start: todayStr, end: todayStr };
    } else if (overviewTimeRange === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLondonDateString(yesterday);
      return { start: yesterdayStr, end: yesterdayStr };
    } else if (overviewTimeRange === 'day_before') {
      const dayBefore = new Date(today);
      dayBefore.setDate(dayBefore.getDate() - 2);
      const dayBeforeStr = getLondonDateString(dayBefore);
      return { start: dayBeforeStr, end: dayBeforeStr };
    } else if (overviewTimeRange === 'custom') {
      return {
        start: overviewCustomStartDate || todayStr,
        end: overviewCustomEndDate || todayStr
      };
    }
    
    return { start: todayStr, end: todayStr };
  }, [overviewTimeRange, overviewCustomStartDate, overviewCustomEndDate]);

  // Calculate date range window based on selected time range
  const dateRangeWindow = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);
    
    let start = '';
    let end = todayStr;
    
    if (timeRange === 'today') {
      start = todayStr;
    } else if (timeRange === 'this_week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      start = monday.toISOString().substring(0, 10);
    } else if (timeRange === 'this_month') {
      start = `${todayStr.substring(0, 7)}-01`;
    } else if (timeRange === 'ytd') {
      start = `${todayStr.substring(0, 4)}-01-01`;
    } else {
      start = customStartDate || '2026-01-01';
      end = customEndDate || todayStr;
    }
    return { start, end };
  }, [timeRange, customStartDate, customEndDate]);

  // Calculate target multiplier based on number of working days in dateRangeWindow
  const targetMultiplier = useMemo(() => {
    const { start, end } = dateRangeWindow || {};
    if (!start || !end) return 1;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Count days in range
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // Count only working days (Monday to Friday)
    let workDays = 0;
    let current = new Date(startDate);
    for (let i = 0; i < diffDays; i++) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) { // Exclude Sunday (0) and Saturday (6)
        workDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return Math.max(1, workDays);
  }, [dateRangeWindow]);

  // Helper to render KPI values against custom targets
  const renderMetricWithTarget = (actual, dailyTarget, multiplier, isDuration = false, staffId = null, category = null, staffName = '') => {
    const target = dailyTarget ? Math.round(dailyTarget * multiplier) : 0;
    
    let formattedActual = isDuration ? formatDuration(actual) : actual;
    let formattedTarget = isDuration ? formatDuration(target * 60) : target; // target talk time is in minutes
    
    const isClickable = staffId && category && actual > 0;
    
    const actualElement = isClickable ? (
      <button
        onClick={() => handleCellClick(staffId, staffName, category, true)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--primary)',
          fontWeight: 700,
          fontSize: '13px',
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
          display: 'inline-block'
        }}
        title="View logs for these calls"
      >
        {formattedActual}
      </button>
    ) : (
      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>{formattedActual}</span>
    );

    if (!target) {
      return (
        <div style={{ textAlign: 'center' }}>
          {actualElement}
        </div>
      );
    }
    
    const targetValueToCompare = isDuration ? target * 60 : target;
    const pct = Math.round((actual / (targetValueToCompare || 1)) * 100);
    
    let color = 'var(--text-secondary)';
    let bgColor = 'rgba(107, 114, 128, 0.1)';
    if (pct >= 100) {
      color = 'var(--success)';
      bgColor = 'rgba(16, 185, 129, 0.1)';
    } else if (pct >= 70) {
      color = 'var(--warning)';
      bgColor = 'rgba(245, 158, 11, 0.1)';
    } else {
      color = '#ef4444'; // Red
      bgColor = 'rgba(239, 68, 68, 0.1)';
    }
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {actualElement}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ {formattedTarget}</span>
        </div>
        <span style={{
          padding: '1px 5px',
          borderRadius: '4px',
          backgroundColor: bgColor,
          color: color,
          fontSize: '9px',
          fontWeight: 700
        }}>
          {pct}%
        </span>
      </div>
    );
  };

  // Calculate date range window specifically for the Dialpad Calls Tab
  const callsDateRangeWindow = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);
    
    let start = '';
    let end = todayStr;
    
    if (callsTimeRange === 'today') {
      start = todayStr;
    } else if (callsTimeRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().substring(0, 10);
      start = yesterdayStr;
      end = yesterdayStr;
    } else if (callsTimeRange === 'this_week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      start = monday.toISOString().substring(0, 10);
    } else if (callsTimeRange === 'this_month') {
      start = `${todayStr.substring(0, 7)}-01`;
    } else {
      start = callsCustomStartDate || '2026-01-01';
      end = callsCustomEndDate || todayStr;
    }
    return { start, end };
  }, [callsTimeRange, callsCustomStartDate, callsCustomEndDate]);

  // Calculate date range window specifically for the Qandle Attendance Tab
  const qandleDateRangeWindow = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);
    
    let start = '';
    let end = todayStr;
    
    if (qandleTimeRange === 'today') {
      start = todayStr;
    } else if (qandleTimeRange === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().substring(0, 10);
      start = yesterdayStr;
      end = yesterdayStr;
    } else if (qandleTimeRange === 'this_week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      start = monday.toISOString().substring(0, 10);
    } else if (qandleTimeRange === 'this_month') {
      start = `${todayStr.substring(0, 7)}-01`;
    } else {
      start = qandleCustomStartDate || '2026-01-01';
      end = qandleCustomEndDate || todayStr;
    }
    return { start, end };
  }, [qandleTimeRange, qandleCustomStartDate, qandleCustomEndDate]);

  // Calculate effective date range window for Dialpad queries
  const effectiveCallsWindow = useMemo(() => {
    if (activeSubTab === 'overview') {
      return overviewDateRangeWindow;
    }
    return callsDateRangeWindow;
  }, [activeSubTab, overviewDateRangeWindow, callsDateRangeWindow]);

  // Calculate effective date range window for Qandle queries
  const effectiveQandleWindow = useMemo(() => {
    if (activeSubTab === 'overview') {
      return overviewDateRangeWindow;
    }
    return qandleDateRangeWindow;
  }, [activeSubTab, overviewDateRangeWindow, qandleDateRangeWindow]);

  // Check if there are any real Dialpad call logs in the database on mount
  useEffect(() => {
    async function checkRealCalls() {
      try {
        const q = query(collection(db, 'dialpad_calls'), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setHasRealCalls(true);
        }
      } catch (e) {
        console.error('Error checking for real call logs:', e);
      }
    }
    checkRealCalls();
  }, []);

  // Auto-sync Dialpad and Qandle on dashboard mount (debounced to once every 30 minutes)
  useEffect(() => {
    async function triggerSilentSync() {
      try {
        const lastSyncKey = 'last_silent_sync_timestamp';
        const lastSync = localStorage.getItem(lastSyncKey);
        const now = Date.now();
        
        // Debounce: only sync if last sync was > 30 minutes ago
        if (!lastSync || (now - Number(lastSync)) > 30 * 60 * 1000) {
          console.log('[Sync] Triggering background synchronization for Dialpad and Qandle...');
          localStorage.setItem(lastSyncKey, String(now));
          
          const secret = 'qandle-talent-kpi-hub-key-2026';
          
          // Trigger Dialpad Call Recovery silently
          fetch(`/api/dialpad/sync-recent-calls?secret=${secret}`).catch(e => {
            console.error('[Sync] Silent Dialpad sync error:', e);
          });
          
          // Trigger Qandle Attendance Sync silently
          fetch(`/api/qandle/sync?secret=${secret}`).catch(e => {
            console.error('[Sync] Silent Qandle sync error:', e);
          });
        }
      } catch (err) {
        console.error('[Sync] Silent sync trigger failed:', err);
      }
    }
    triggerSilentSync();
  }, []);

  // Load KPI documents from Firestore collections filtered by active date range (instantly aggregates in millisecond speeds)
  useEffect(() => {
    async function loadKpiData() {
      setIsLoading(true);
      try {
        const { start, end } = dateRangeWindow;
        
        // Fetch Daily aggregates matching the active date range
        const kpiQuery = query(
          collection(db, 'kpiDaily'),
          where('date', '>=', start),
          where('date', '<=', end)
        );
        const kpiSnapshot = await getDocs(kpiQuery);
        const kpiList = [];
        kpiSnapshot.forEach(doc => {
          kpiList.push({ id: doc.id, ...doc.data() });
        });
        setKpiDocs(kpiList);
      } catch (e) {
        console.error('Error loading KPI data:', e);
        onShowToast?.('Failed to load call performance data from database', 'error');
      } finally {
        setIsLoading(false);
      }
    }
    loadKpiData();
  }, [dateRangeWindow.start, dateRangeWindow.end]);

  // Load Dialpad calls dynamically with real-time updates when effectiveCallsWindow changes
  useEffect(() => {
    let isMounted = true;
    
    async function loadCallsData() {
      setIsLoadingCalls(true);
      const { start, end } = effectiveCallsWindow;
      
      try {
        console.log(`[Calls] Querying call history from ${start} to ${end}...`);
        const callsQuery = query(
          collection(db, 'dialpad_calls'),
          where('dateStarted', '>=', start),
          where('dateStarted', '<=', end + 'T23:59:59Z'),
          orderBy('dateStarted', 'desc'),
          limit(2000)
        );

        const snapshot = await getDocs(callsQuery);
        if (!isMounted) return;

        const callsList = [];
        snapshot.forEach(doc => {
          callsList.push({ id: doc.id, ...doc.data() });
        });
        setLiveCalls(callsList);
        setIsLoadingCalls(false);
      } catch (error) {
        console.error('Error loading Dialpad calls:', error);
        if (!isMounted) return;
        
        // Fallback: if index is missing, query without orderBy
        try {
          const callsQueryFallback = query(
            collection(db, 'dialpad_calls'),
            where('dateStarted', '>=', start),
            where('dateStarted', '<=', end + 'T23:59:59Z'),
            limit(2000)
          );
          
          const fallbackSnapshot = await getDocs(callsQueryFallback);
          if (!isMounted) return;

          const callsList = [];
          fallbackSnapshot.forEach(doc => {
            callsList.push({ id: doc.id, ...doc.data() });
          });
          // Sort client-side
          callsList.sort((a, b) => b.dateStarted.localeCompare(a.dateStarted));
          setLiveCalls(callsList);
          setIsLoadingCalls(false);
        } catch (fallbackError) {
          console.error('Fallback calls fetch failed:', fallbackError);
          if (isMounted) {
            onShowToast?.('Failed to load call logs', 'error');
            setIsLoadingCalls(false);
          }
        }
      }
    }

    loadCallsData();

    return () => {
      isMounted = false;
    };
  }, [effectiveCallsWindow.start, effectiveCallsWindow.end]);

  // Load Qandle activities when activeSubTab or effectiveQandleWindow changes
  useEffect(() => {
    let isMounted = true;
    
    async function loadQandleData() {
      if (activeSubTab !== 'qandle' && activeSubTab !== 'overview') return;
      setIsLoadingQandle(true);
      const { start, end } = effectiveQandleWindow;
      
      try {
        console.log(`[Qandle] Querying activities from ${start} to ${end}...`);
        const qandleQuery = query(
          collection(db, 'qandle_activities'),
          where('date', '>=', start),
          where('date', '<=', end),
          orderBy('date', 'desc'),
          limit(1000)
        );

        const snapshot = await getDocs(qandleQuery);
        if (!isMounted) return;

        const activitiesList = [];
        snapshot.forEach(doc => {
          activitiesList.push({ id: doc.id, ...doc.data() });
        });
        setQandleDocs(activitiesList);
        setIsLoadingQandle(false);
      } catch (error) {
        console.error('Error loading Qandle activities:', error);
        if (!isMounted) return;
        
        // Fallback: if index is missing, query without orderBy
        try {
          const qandleQueryFallback = query(
            collection(db, 'qandle_activities'),
            where('date', '>=', start),
            where('date', '<=', end),
            limit(1000)
          );
          
          const fallbackSnapshot = await getDocs(qandleQueryFallback);
          if (!isMounted) return;

          const activitiesList = [];
          fallbackSnapshot.forEach(doc => {
            activitiesList.push({ id: doc.id, ...doc.data() });
          });
          // Sort client-side
          activitiesList.sort((a, b) => b.date.localeCompare(a.date));
          setQandleDocs(activitiesList);
          setIsLoadingQandle(false);
        } catch (fallbackError) {
          console.error('Fallback Qandle fetch failed:', fallbackError);
          if (isMounted) {
            onShowToast?.('Failed to load Qandle logs', 'error');
            setIsLoadingQandle(false);
          }
        }
      }
    }
    
    loadQandleData();
    return () => { isMounted = false; };
  }, [activeSubTab, effectiveQandleWindow.start, effectiveQandleWindow.end, qandleRefreshTrigger]);

  // Generate Call logs detail rows based on real kpiDocs logs
  const mockCallsList = useMemo(() => {
    const list = [];
    const companiesList = ['Microsoft', 'Google', 'Recruitly', 'BP Energy', 'HSBC Bank', 'Deloitte', 'Dialpad Corp', 'Vodafone', 'Shell', 'Strata Civils'];
    const candidatesList = ['Emile Brand', 'Alex Herzenberg', 'Gabriella Maartens', 'Wendy Campbell', 'Matthew Sparks', 'Toni Tree', 'Ryan Mc Dougall', 'Sean Owen'];

    const { start, end } = effectiveCallsWindow;

    kpiDocs.forEach(doc => {
      if (doc.date >= start && doc.date <= end) {
        const staffMember = staff.find(s => s.id === doc.staffId);
        if (!staffMember) return;

        // Apply filters
        if (selectedStaffId !== 'all' && doc.staffId !== selectedStaffId) return;
        if (selectedDept !== 'all' && staffMember.department !== selectedDept) return;
        if (selectedCompanyId !== 'all' && staffMember.companyId !== selectedCompanyId) return;

        const countOver5 = doc.callsOver5Min || 0;
        const totalCalls = doc.callsTotal || 0;

        const limit = Math.min(6, totalCalls);
        for (let i = 0; i < limit; i++) {
          const isOver5 = i < countOver5;
          const duration = isOver5 
            ? (300 + (i * 45) + (doc.totalTalkTimeSeconds % 180))
            : (30 + (i * 25) + (doc.totalTalkTimeSeconds % 60));
          
          const direction = i % 2 === 0 ? 'Outbound' : 'Inbound';
          const isClient = i % 2 === 0;
          const targetName = isClient 
            ? companiesList[(i + doc.staffId.charCodeAt(2)) % companiesList.length]
            : candidatesList[(i + doc.staffId.charCodeAt(3)) % candidatesList.length];

          list.push({
            id: `call-${doc.staffId}-${doc.date}-${i}`,
            staffId: doc.staffId,
            staffName: staffMember.fullName,
            department: staffMember.department,
            direction,
            date: doc.date,
            time: `${10 + (i % 6)}:${String((i * 12) % 60).padStart(2, '0')}:00`,
            targetName,
            targetType: isClient ? 'Client' : 'Candidate',
            duration,
            hasRecording: duration > 180,
            disposition: i % 3 === 0 ? 'Connected' : i % 3 === 1 ? 'Left Message' : 'Connected',
            transcript: `
              [00:03] ${staffMember.fullName}: Hello, this is ${staffMember.fullName} from Humres Technical. Hope you are well!
              [00:10] ${targetName}: Hi ${staffMember.fullName}, yes, doing good. Thanks for calling.
              [00:18] ${staffMember.fullName}: I wanted to follow up regarding the ${isClient ? 'ongoing placement requirements' : 'CV application details'} we discussed. 
              [00:32] ${targetName}: Yes, I read through the specification. We are looking for someone with strong structural design experience and AutoCAD expertise.
              [00:45] ${staffMember.fullName}: Perfect, the candidate I sent over has 5 years of structural engineering design experience specifically in concrete structures and is highly proficient in AutoCAD.
              [01:05] ${targetName}: That sounds very relevant. Let's schedule an interview. I am free this Thursday afternoon.
              [01:15] ${staffMember.fullName}: Excellent, I will arrange it and send the invite. Thanks again!
            `
          });
        }
      }
    });

    return list.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  }, [kpiDocs, effectiveCallsWindow, staff, selectedStaffId, selectedDept, selectedCompanyId]);

  // Format the raw live calls from the webhook database
  const formattedLiveCalls = useMemo(() => {
    const { start, end } = effectiveCallsWindow;

    return liveCalls
      .map(call => {
        let dateVal = '';
        let timeVal = '';
        if (call.dateStarted) {
          let dateObj = null;
          if (typeof call.dateStarted === 'string') {
            dateObj = new Date(call.dateStarted);
          } else if (typeof call.dateStarted === 'number') {
            const ms = call.dateStarted < 9999999999 ? call.dateStarted * 1000 : call.dateStarted;
            dateObj = new Date(ms);
          } else if (call.dateStarted.seconds) {
            dateObj = new Date(call.dateStarted.seconds * 1000);
          } else if (call.dateStarted instanceof Date) {
            dateObj = call.dateStarted;
          }

          if (dateObj && !isNaN(dateObj.getTime())) {
            try {
              // Format to Europe/London timezone for consistent UK local business hours
              const dTF = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Europe/London',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              });
              dateVal = dTF.format(dateObj);

              const tTF = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/London',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });
              timeVal = tTF.format(dateObj);
            } catch (errFormat) {
              const year = dateObj.getFullYear();
              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
              const day = String(dateObj.getDate()).padStart(2, '0');
              dateVal = `${year}-${month}-${day}`;
              
              const hours = String(dateObj.getHours()).padStart(2, '0');
              const minutes = String(dateObj.getMinutes()).padStart(2, '0');
              const seconds = String(dateObj.getSeconds()).padStart(2, '0');
              timeVal = `${hours}:${minutes}:${seconds}`;
            }
          }
        }

        const targetTypeVal = (call.target?.type || 'external').toLowerCase().trim() === 'user' 
          ? 'Candidate' 
          : 'Client';

        return {
          id: call.id || call.conversationId,
          staffId: call.handlerId,
          staffName: call.handlerName,
          department: call.department || '',
          direction: call.direction === 'inbound' ? 'Inbound' : 'Outbound',
          date: dateVal,
          time: timeVal,
          targetName: call.externalName || call.externalNumber || 'Unknown',
          targetType: targetTypeVal,
          duration: call.durationSeconds || 0,
          hasRecording: call.wasRecorded,
          recordingUrl: call.recordingUrl,
          transcript: call.transcript || 'No transcript generated yet.',
          disposition: call.disposition || '',
          recapSummary: call.recapSummary || '',
          recapOutcome: call.recapOutcome || '',
          externalNumber: call.externalNumber || ''
        };
      })
      .filter(call => {
        if (!call.staffId) return false; // Filter out system/routing/unmapped call legs
        if (call.date && (call.date < start || call.date > end)) return false;
        if (selectedStaffId !== 'all' && call.staffId !== selectedStaffId) return false;
        if (selectedDept !== 'all' && call.department !== selectedDept) return false;
        if (selectedCompanyId !== 'all') {
          const staffMember = staff.find(s => s.id === call.staffId);
          if (!staffMember || staffMember.companyId !== selectedCompanyId) return false;
        }
        return true;
      });
  }, [liveCalls, effectiveCallsWindow, selectedStaffId, selectedDept, selectedCompanyId, staff]);

  const displayCallsList = useMemo(() => {
    if (hasRealCalls) {
      return formattedLiveCalls;
    }
    return mockCallsList;
  }, [hasRealCalls, formattedLiveCalls, mockCallsList]);

  // Aggregator for the KPI Overview Dashboard and Activity Heatmap
  const overviewStats = useMemo(() => {
    const recruiterStats = {};
    
    // Initialize stats for each staff in filteredStaffList
    filteredStaffList.forEach(s => {
      recruiterStats[s.id] = {
        staff: s,
        calls: 0,
        connected: 0,
        clientCalls: 0,
        candidateCalls: 0,
        talkTimeSeconds: 0,
        qandleProductiveSeconds: 0,
        qandleArrival: '-',
        qandleLeft: '-',
        lastCallTime: '-',
        over5m: 0,
        over10m: 0,
        callbacks: 0,
        alpha: 0,
        hourlyCalls: Array(24).fill(0)
      };
    });
    
    const findStaffIdForCall = (call) => {
      if (call.staffId && recruiterStats[call.staffId]) {
        return call.staffId;
      }
      const handlerEmail = (call.handlerEmail || '').toLowerCase().trim();
      const matched = filteredStaffList.find(s => {
        const primary = (s.dialpadEmail || '').toLowerCase().trim();
        if (primary && primary === handlerEmail) return true;
        const aliases = Array.isArray(s.additionalEmails) ? s.additionalEmails : [];
        return aliases.some(alias => (alias || '').toLowerCase().trim() === handlerEmail);
      });
      return matched ? matched.id : null;
    };

    const findStaffIdForQandle = (qDoc) => {
      if (qDoc.staffId && recruiterStats[qDoc.staffId]) {
        return qDoc.staffId;
      }
      const matched = filteredStaffList.find(s => {
        const qEmail = (s.qandleEmail || '').toLowerCase().trim();
        const docEmail = (qDoc.qandleEmail || '').toLowerCase().trim();
        if (qEmail && docEmail && qEmail === docEmail) return true;
        
        const qCode = (s.employeeCode || '').trim().toUpperCase();
        const docCode = (qDoc.employeeCode || '').trim().toUpperCase();
        if (qCode && docCode && qCode === docCode) return true;
        
        const sName = (s.fullName || '').toLowerCase().trim();
        const qName = (qDoc.staffName || '').toLowerCase().trim();
        return sName && qName && sName === qName;
      });
      return matched ? matched.id : null;
    };

    let totalCalls = 0;
    let totalConnected = 0;
    let totalTalkTimeSeconds = 0;
    let totalCallbacks = 0;
    let totalAlpha = 0;
    let totalOver5m = 0;
    let totalOver10m = 0;
    const globalHourlyCalls = Array(24).fill(0);
    const callStatusCounts = {};
    let outboundCount = 0;
    let inboundCount = 0;

    displayCallsList.forEach(call => {
      const staffId = call.staffId;
      if (!staffId) return;
      
      const stats = recruiterStats[staffId];
      stats.calls++;
      totalCalls++;

      if (call.direction === 'Outbound') {
        outboundCount++;
      } else {
        inboundCount++;
      }

      const status = call.disposition || 'Unknown';
      callStatusCounts[status] = (callStatusCounts[status] || 0) + 1;

      const isConnected = call.duration > 0;
      if (isConnected) {
        stats.connected++;
        totalConnected++;
        stats.talkTimeSeconds += call.duration;
        totalTalkTimeSeconds += call.duration;
      }

      if (call.targetType === 'Client') {
        stats.clientCalls++;
      } else if (call.targetType === 'Candidate') {
        stats.candidateCalls++;
      }

      if (call.duration >= 300) {
        stats.over5m++;
        totalOver5m++;
      }
      if (call.duration >= 600) {
        stats.over10m++;
        totalOver10m++;
      }

      const isCB = call.isCallback || 
                   (call.disposition || '').toLowerCase().includes('callback') || 
                   (call.disposition || '').toLowerCase().includes('cb');
      if (isCB) {
        stats.callbacks++;
        totalCallbacks++;
      }

      const isAlpha = call.isAlpha || 
                      (call.disposition || '').toLowerCase().includes('alpha') || 
                      (call.recapSummary || '').toLowerCase().includes('opportunity') || 
                      (call.recapSummary || '').toLowerCase().includes('alpha');
      if (isAlpha) {
        stats.alpha++;
        totalAlpha++;
      }

      if (call.time) {
        const hr = parseInt(call.time.split(':')[0], 10);
        if (!isNaN(hr) && hr >= 0 && hr < 24) {
          stats.hourlyCalls[hr]++;
          globalHourlyCalls[hr]++;
        }
      }

      if (call.time) {
        if (stats.lastCallTime === '-' || call.time.localeCompare(stats.lastCallTime) > 0) {
          stats.lastCallTime = call.time.substring(0, 5);
        }
      }
    });

    qandleDocs.forEach(qDoc => {
      const staffId = findStaffIdForQandle(qDoc);
      if (!staffId) return;

      const stats = recruiterStats[staffId];
      if (qDoc.productiveTimeSeconds) {
        stats.qandleProductiveSeconds += qDoc.productiveTimeSeconds;
      }
      
      if (qDoc.arrivalTime && qDoc.arrivalTime !== '-') {
        if (stats.qandleArrival === '-' || qDoc.arrivalTime < stats.qandleArrival) {
          stats.qandleArrival = qDoc.arrivalTime;
        }
      }
      if (qDoc.leftTime && qDoc.leftTime !== '-') {
        if (stats.qandleLeft === '-' || qDoc.leftTime > stats.qandleLeft) {
          stats.qandleLeft = qDoc.leftTime;
        }
      }
    });

    const recruiterRows = Object.values(recruiterStats);

    // Calculate earliest and latest call hours dynamically to prevent cutting off early/late calls (like 4AM or 8PM)
    let earliestHour = 8;
    let latestHour = 18;
    displayCallsList.forEach(call => {
      if (call.time) {
        const hr = parseInt(call.time.split(':')[0], 10);
        if (!isNaN(hr) && hr >= 0 && hr < 24) {
          if (hr < earliestHour) earliestHour = hr;
          if (hr > latestHour) latestHour = hr;
        }
      }
    });

    let peakHour = '-';
    let peakCalls = 0;
    for (let hr = earliestHour; hr <= latestHour; hr++) {
      if (globalHourlyCalls[hr] > peakCalls) {
        peakCalls = globalHourlyCalls[hr];
        peakHour = `${String(hr).padStart(2, '0')}:00`;
      }
    }

    return {
      recruiterRows,
      totalCalls,
      totalConnected,
      connectRate: totalCalls ? Math.round((totalConnected / totalCalls) * 100) : 0,
      avgTalkTime: totalConnected ? Math.round(totalTalkTimeSeconds / totalConnected) : 0,
      totalCallbacks,
      totalAlpha,
      totalOver5m,
      totalOver10m,
      globalHourlyCalls,
      callStatusCounts,
      outboundCount,
      inboundCount,
      peakHour,
      peakCalls,
      earliestHour,
      latestHour
    };
  }, [filteredStaffList, displayCallsList, qandleDocs]);

  // Sort recruiter rows for the Overview and Heatmap grids
  const sortedRecruiterRows = useMemo(() => {
    let rows = [...(overviewStats.recruiterRows || [])];
    if (selectedStaffId !== 'all') {
      rows = rows.filter(r => r.staff.id === selectedStaffId);
    }
    rows.sort((a, b) => {
      let valA, valB;
      if (overviewSortField === 'recruiter') {
        valA = (a.staff.fullName || a.staff.full_name || '').toLowerCase().trim();
        valB = (b.staff.fullName || b.staff.full_name || '').toLowerCase().trim();
      } else if (overviewSortField === 'calls') {
        valA = a.calls;
        valB = b.calls;
      } else if (overviewSortField === 'connected') {
        valA = a.connected;
        valB = b.connected;
      } else if (overviewSortField === 'client') {
        valA = a.clientCalls;
        valB = b.clientCalls;
      } else if (overviewSortField === 'candidate') {
        valA = a.candidateCalls;
        valB = b.candidateCalls;
      } else if (overviewSortField === 'talk') {
        valA = a.talkTimeSeconds;
        valB = b.talkTimeSeconds;
      } else if (overviewSortField === 'prd') {
        valA = a.qandleProductiveSeconds;
        valB = b.qandleProductiveSeconds;
      } else if (overviewSortField === 'in') {
        valA = a.qandleArrival;
        valB = b.qandleArrival;
      } else if (overviewSortField === 'out') {
        valA = a.qandleLeft;
        valB = b.qandleLeft;
      } else if (overviewSortField === 'lastCall') {
        valA = a.lastCallTime;
        valB = b.lastCallTime;
      } else if (overviewSortField === 'over5m') {
        valA = a.over5m;
        valB = b.over5m;
      } else if (overviewSortField === 'over10m') {
        valA = a.over10m;
        valB = b.over10m;
      } else if (overviewSortField === 'cb') {
        valA = a.callbacks;
        valB = b.callbacks;
      } else if (overviewSortField === 'a') {
        valA = a.alpha;
        valB = b.alpha;
      } else {
        return 0;
      }
      
      if (valA === '-' || valA === '') valA = overviewSortAsc ? 'zzzzzz' : -999999;
      if (valB === '-' || valB === '') valB = overviewSortAsc ? 'zzzzzz' : -999999;

      if (valA < valB) return overviewSortAsc ? -1 : 1;
      if (valA > valB) return overviewSortAsc ? 1 : -1;
      return 0;
    });
    return rows;
  }, [overviewStats.recruiterRows, overviewSortField, overviewSortAsc, selectedStaffId]);

  // Aggregate KPI Data from real Firestore kpiDaily collection
  const mockKpiData = useMemo(() => {
    const map = {};
    
    // Initialize map for all staff in staff list
    staff.forEach(s => {
      map[s.id] = {
        inbound: 0,
        outbound: 0,
        totalCalls: 0,
        totalTalkTime: 0,
        callsOver5Min: 0,
        callsOver10Min: 0,
        cvsSent: 0,
        interviews: 0,
        jobsTaken: 0
      };
    });

    const { start, end } = dateRangeWindow;

    kpiDocs.forEach(doc => {
      if (doc.date >= start && doc.date <= end && map[doc.staffId]) {
        const entry = map[doc.staffId];
        entry.inbound += (doc.callsInbound || 0);
        entry.outbound += (doc.callsOutbound || 0);
        entry.totalCalls += (doc.callsTotal || 0);
        entry.totalTalkTime += (doc.totalTalkTimeSeconds || 0);
        entry.callsOver5Min += (doc.callsOver5Min || 0);
        entry.callsOver10Min += (doc.callsOver10Min || 0);
        entry.cvsSent += (doc.cvsSent || 0);
        entry.interviews += (doc.interviews || 0);
        entry.jobsTaken += (doc.jobsTaken || 0);
      }
    });

    return map;
  }, [kpiDocs, dateRangeWindow, staff]);



  // Filter and search call logs list based on user search and direction controls
  // Filter, search and sort call logs list based on user controls and sorting states
  const filteredAndSearchedCalls = useMemo(() => {
    const list = displayCallsList;
    const query = debouncedCallLogsSearch.toLowerCase().trim();

    const filtered = list.filter(call => {
      // 1. Direction Filter
      if (callLogsDirection !== 'all' && call.direction.toLowerCase() !== callLogsDirection) return false;

      // 2. Text Search Query Filter
      if (query) {
        const callerMatch = (call.staffName || '').toLowerCase().includes(query);
        const recipientMatch = (call.targetName || '').toLowerCase().includes(query);
        const numberMatch = (call.externalNumber || '').toLowerCase().includes(query);
        if (!callerMatch && !recipientMatch && !numberMatch) return false;
      }

      // 3. Drill-down cell click category filter
      if (callLogsSubFilter === 'connected') {
        if (call.duration <= 0) return false;
      } else if (callLogsSubFilter === 'client') {
        if (call.targetType !== 'Client') return false;
      } else if (callLogsSubFilter === 'candidate') {
        if (call.targetType !== 'Candidate') return false;
      } else if (callLogsSubFilter === 'over5m') {
        if (call.duration < 300) return false;
      } else if (callLogsSubFilter === 'over10m') {
        if (call.duration < 600) return false;
      } else if (callLogsSubFilter === 'callback') {
        const isCB = (call.disposition || '').toLowerCase().includes('callback') || 
                     (call.disposition || '').toLowerCase().includes('cb');
        if (!isCB) return false;
      } else if (callLogsSubFilter === 'alpha') {
        const isAlpha = (call.disposition || '').toLowerCase().includes('alpha') || 
                        (call.recapSummary || '').toLowerCase().includes('opportunity') || 
                        (call.recapSummary || '').toLowerCase().includes('alpha');
        if (!isAlpha) return false;
      }

      return true;
    });

    // Sort calls client-side
    return filtered.sort((a, b) => {
      let valA = a[callLogsSortField];
      let valB = b[callLogsSortField];

      if (callLogsSortField === 'date') {
        // Sort chronologically using date + time strings combined
        valA = `${a.date}T${a.time}`;
        valB = `${b.date}T${b.time}`;
      }

      // Check if they are numbers (or numeric strings)
      const isNumA = typeof valA === 'number' || (valA && !isNaN(valA) && !isNaN(parseFloat(valA)));
      const isNumB = typeof valB === 'number' || (valB && !isNaN(valB) && !isNaN(parseFloat(valB)));

      if (isNumA && isNumB) {
        const numA = Number(valA || 0);
        const numB = Number(valB || 0);
        return callLogsSortDirection === 'asc' ? numA - numB : numB - numA;
      }

      // Default case: Compare as case-insensitive strings
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      const cmp = strA.localeCompare(strB);
      return callLogsSortDirection === 'asc' ? cmp : -cmp;
    });
  }, [displayCallsList, debouncedCallLogsSearch, callLogsDirection, callLogsSortField, callLogsSortDirection, callLogsSubFilter]);

  // Paginated chunk to display
  const displayCallsChunk = useMemo(() => {
    const startIdx = (callLogsPage - 1) * callLogsPageSize;
    return filteredAndSearchedCalls.slice(startIdx, startIdx + callLogsPageSize);
  }, [filteredAndSearchedCalls, callLogsPage]);

  const totalCallLogsPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAndSearchedCalls.length / callLogsPageSize));
  }, [filteredAndSearchedCalls]);

  // Reset page when search filters change
  useEffect(() => {
    setCallLogsPage(1);
  }, [callLogsSearch, callLogsDirection]);

  // Format and filter Qandle activities based on global division and recruiter filters
  const displayQandleList = useMemo(() => {
    return qandleDocs
      .map(doc => {
        const matchedStaff = staff.find(s => s.id === doc.staffId) || {};
        return {
          ...doc,
          department: matchedStaff.department || 'General',
          staffStatus: matchedStaff.status || 'active',
        };
      })
      .filter(doc => {
        if (!doc.staffId) return false;
        if (selectedStaffId !== 'all' && doc.staffId !== selectedStaffId) return false;
        if (selectedDept !== 'all' && doc.department !== selectedDept) return false;
        return true;
      });
  }, [qandleDocs, staff, selectedStaffId, selectedDept]);

  // Filter, search, and sort Qandle activities
  const filteredAndSearchedQandle = useMemo(() => {
    const list = displayQandleList;
    const query = debouncedQandleSearch.toLowerCase().trim();

    const filtered = list.filter(doc => {
      if (query) {
        const nameMatch = (doc.staffName || '').toLowerCase().includes(query);
        const codeMatch = (doc.employeeCode || '').toLowerCase().includes(query);
        if (!nameMatch && !codeMatch) return false;
      }
      return true;
    });

    // Sort client-side
    return filtered.sort((a, b) => {
      let valA = a[qandleSortField];
      let valB = b[qandleSortField];

      if (qandleSortField === 'date') {
        valA = a.date || '';
        valB = b.date || '';
      }

      // Check if they are numbers (or numeric strings)
      const isNumA = typeof valA === 'number' || (valA && !isNaN(valA) && !isNaN(parseFloat(valA)));
      const isNumB = typeof valB === 'number' || (valB && !isNaN(valB) && !isNaN(parseFloat(valB)));

      if (isNumA && isNumB) {
        const numA = Number(valA || 0);
        const numB = Number(valB || 0);
        return qandleSortDirection === 'asc' ? numA - numB : numB - numA;
      }

      // Default case: Compare as case-insensitive strings
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      const cmp = strA.localeCompare(strB);
      return qandleSortDirection === 'asc' ? cmp : -cmp;
    });
  }, [displayQandleList, debouncedQandleSearch, qandleSortField, qandleSortDirection]);

  // Paginated Qandle list
  const qandlePageSize = 10;
  const displayQandleChunk = useMemo(() => {
    const startIdx = (qandlePage - 1) * qandlePageSize;
    return filteredAndSearchedQandle.slice(startIdx, startIdx + qandlePageSize);
  }, [filteredAndSearchedQandle, qandlePage]);

  const totalQandlePages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAndSearchedQandle.length / qandlePageSize));
  }, [filteredAndSearchedQandle]);

  // Reset Qandle page on search/filter change
  useEffect(() => {
    setQandlePage(1);
  }, [qandleSearch, selectedDept, selectedStaffId, qandleTimeRange]);

  // Aggregate stats based on selection
  const aggregatedStats = useMemo(() => {
    let inbound = 0;
    let outbound = 0;
    let totalCalls = 0;
    let totalTalkTime = 0;
    let callsOver5Min = 0;
    let callsOver10Min = 0;
    let cvsSent = 0;
    let interviews = 0;
    let jobsTaken = 0;

    // Determine target users to aggregate
    let targetUsers = [];
    if (selectedStaffId !== 'all') {
      targetUsers = staff.filter(s => s.id === selectedStaffId);
    } else {
      targetUsers = filteredStaffList;
    }

    targetUsers.forEach(s => {
      const data = mockKpiData[s.id] || { inbound: 0, outbound: 0, totalCalls: 0, totalTalkTime: 0, callsOver5Min: 0, callsOver10Min: 0, cvsSent: 0, interviews: 0, jobsTaken: 0 };
      inbound += data.inbound;
      outbound += data.outbound;
      totalCalls += data.totalCalls;
      totalTalkTime += data.totalTalkTime;
      callsOver5Min += data.callsOver5Min;
      callsOver10Min += data.callsOver10Min;
      cvsSent += data.cvsSent;
      interviews += data.interviews;
      jobsTaken += data.jobsTaken;
    });

    return {
      inbound,
      outbound,
      totalCalls,
      totalTalkTime,
      callsOver5Min,
      callsOver10Min,
      cvsSent,
      interviews,
      jobsTaken
    };
  }, [mockKpiData, selectedStaffId, filteredStaffList, staff]);

  // Render Title based on filters
  const dashboardSubtitle = useMemo(() => {
    const prefix = timeRange === 'today' ? 'Today' : (timeRange === 'this_week' ? 'This Week' : (timeRange === 'this_month' ? 'This Month' : 'Year to Date'));
    if (selectedStaffId !== 'all') {
      const u = staff.find(s => s.id === selectedStaffId);
      return `${prefix} KPIs for ${u?.fullName || 'User'}`;
    }
    if (selectedDept !== 'all') {
      return `${prefix} KPIs for ${selectedDept} Division`;
    }
    return `${prefix} Group Performance Dashboard`;
  }, [timeRange, selectedStaffId, selectedDept, staff]);

  if (isLoading) {
    return (
      <div className="tab-pane active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '350px', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '4px solid var(--border-color)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 1s linear infinite'
        }}></div>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Loading call statistics & KPIs...</span>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="tab-pane active" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px' }}>
      
      {/* 0. SUB-TAB TOGGLE NAVIGATION */}
      <div style={{
        display: 'flex',
        gap: '12px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '14px',
        marginBottom: '4px'
      }}>
        <button
          onClick={() => setActiveSubTab('overview')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'overview' ? 'var(--primary)' : 'var(--bg-secondary)',
            color: activeSubTab === 'overview' ? '#fff' : 'var(--text-secondary)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          📊 Recruiter Overview
        </button>
        <button
          onClick={() => setActiveSubTab('performance')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'performance' ? 'var(--primary)' : 'var(--bg-secondary)',
            color: activeSubTab === 'performance' ? '#fff' : 'var(--text-secondary)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          📈 Performance Scorecard
        </button>
        <button
          onClick={() => {
            setActiveSubTab('calls');
            setCallLogsPage(1);
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'calls' ? 'var(--primary)' : 'var(--bg-secondary)',
            color: activeSubTab === 'calls' ? '#fff' : 'var(--text-secondary)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          📞 Dialpad Call Logs
        </button>
        <button
          onClick={() => {
            setActiveSubTab('qandle');
            setQandlePage(1);
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'qandle' ? 'var(--primary)' : 'var(--bg-secondary)',
            color: activeSubTab === 'qandle' ? '#fff' : 'var(--text-secondary)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          ⏰ Qandle Attendance
        </button>
        <button
          onClick={() => {
            setActiveSubTab('mapping');
            setEditingStaffId(null);
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'mapping' ? 'var(--primary)' : 'var(--bg-secondary)',
            color: activeSubTab === 'mapping' ? '#fff' : 'var(--text-secondary)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          🔗 Recruiter & Dialpad Mapping
        </button>
        <button
          onClick={() => {
            setActiveSubTab('settings');
            setEditingStaffId(null);
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeSubTab === 'settings' ? 'var(--primary)' : 'var(--bg-secondary)',
            color: activeSubTab === 'settings' ? '#fff' : 'var(--text-secondary)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          ⚙️ KPI Target Settings
        </button>
      </div>

      {/* 2. DIRECTORY & COMPANY FILTERS PANEL (WITH ROLE-BASED ACCESS CONTROL) */}
      {(activeSubTab === 'overview' || activeSubTab === 'performance') && (
        <div className="card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            <Filter size={16} color="var(--primary)" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {userRole === 'admin' && 'Top Management - Company Filters'}
              {userRole === 'manager' && `Team Lead - ${userDept} Division Filters`}
              {userRole === 'recruiter' && 'My Access Scopes'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            
            {/* Department Filter (Visible to Admin only) */}
            {userRole === 'admin' && (
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Division / Department:
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setSelectedStaffId('all'); // reset staff filter when dept changes
                  }}
                  className="select-filter"
                  style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="all">-- All Departments --</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {/* User Filter (Visible to Admin and Manager) */}
            {userRole !== 'recruiter' && (
              <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Select Individual Staff:
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="select-filter"
                  style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="all">
                    {selectedDept === 'all' ? '-- All Personnel --' : `-- All in ${selectedDept} --`}
                  </option>
                  {filteredStaffList.map(s => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.department})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Company Filter (Visible to All) */}
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Filter by Employer / Company:
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  setSelectedStaffId('all'); // Reset individual staff select when company changes
                }}
                className="select-filter"
                style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="all">-- All Companies --</option>
                {Array.isArray(companies) && companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.legalName || 'Unnamed Company'}</option>
                ))}
              </select>
            </div>

            {/* Recruiter Static Scope Info */}
            {userRole === 'recruiter' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  🔒 Logged in as Recruiter. Access is restricted to personal logs.
                </span>
              </div>
            )}

          </div>
        </div>
      )}

      {activeSubTab === 'overview' ? (
        <>
          {/* 1. TOP HEADER & FILTERS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Recruiter Daily Activity & Overview Report</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>💡 Phone calls and attendance metrics consolidated in real-time</span>
            </div>

            {/* Global Date Filter Controls */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'day_before', label: 'Day Before Yesterday' },
                  { id: 'custom', label: 'Custom' }
                ].map(btn => (
                  <button
                    key={btn.id}
                    onClick={() => setOverviewTimeRange(btn.id)}
                    className="btn-secondary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '11px',
                      border: 'none',
                      backgroundColor: overviewTimeRange === btn.id ? 'var(--primary)' : 'transparent',
                      color: overviewTimeRange === btn.id ? 'white' : 'var(--text-secondary)',
                      fontWeight: 600,
                      borderRadius: '4px'
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {overviewTimeRange === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <input
                    type="date"
                    value={overviewCustomStartDate}
                    onChange={(e) => setOverviewCustomStartDate(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '11px', height: '24px', padding: '2px 4px', width: '110px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
                  <input
                    type="date"
                    value={overviewCustomEndDate}
                    onChange={(e) => setOverviewCustomEndDate(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '11px', height: '24px', padding: '2px 4px', width: '110px' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 2. SUMMARY CARDS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '8px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Calls</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0' }}>{overviewStats.totalCalls}</div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{overviewDateRangeWindow.start} to {overviewDateRangeWindow.end}</span>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Connected</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--success)', margin: '6px 0' }}>{overviewStats.connectRate}%</div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{overviewStats.totalConnected} connected calls</span>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Callbacks (CB)</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--warning)', margin: '6px 0' }}>{overviewStats.totalCallbacks}</div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AI identified callback queries</span>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Alpha (A)</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', margin: '6px 0' }}>{overviewStats.totalAlpha}</div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Opportunity signals captured</span>
            </div>

            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Avg Talk Time</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0' }}>{Math.floor(overviewStats.avgTalkTime / 60)}m {overviewStats.avgTalkTime % 60}s</div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Average connected duration</span>
            </div>
          </div>

          {/* 3. RECRUITER PERFORMANCE CARD */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Recruiter Performance</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>
                    {[
                      { id: 'recruiter', label: 'Recruiter' },
                      { id: 'calls', label: 'Calls' },
                      { id: 'connected', label: 'Conn' },
                      { id: 'client', label: 'Client' },
                      { id: 'candidate', label: 'Cand' },
                      { id: 'talk', label: 'Talk' },
                      { id: 'prd', label: 'Prd' },
                      { id: 'in', label: 'In' },
                      { id: 'out', label: 'Out' },
                      { id: 'lastCall', label: 'Last Call' },
                      { id: 'over5m', label: '5m+' },
                      { id: 'over10m', label: '10m+' },
                      { id: 'cb', label: 'CB' },
                      { id: 'a', label: 'A' }
                    ].map(col => (
                      <th
                        key={col.id}
                        onClick={() => {
                          if (overviewSortField === col.id) {
                            setOverviewSortAsc(!overviewSortAsc);
                          } else {
                            setOverviewSortField(col.id);
                            setOverviewSortAsc(false);
                          }
                        }}
                        style={{
                          textAlign: col.id === 'recruiter' ? 'left' : 'center',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          userSelect: 'none'
                        }}
                      >
                        {col.label} {overviewSortField === col.id ? (overviewSortAsc ? '▲' : '▼') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRecruiterRows.length === 0 ? (
                    <tr>
                      <td colSpan={14} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No recruiters match the filter criteria or date range.
                      </td>
                    </tr>
                  ) : (
                    sortedRecruiterRows.map(row => (
                      <tr key={row.staff.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {row.staff.fullName || row.staff.full_name}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {renderClickableCount(row.calls, row.staff.id, row.staff.fullName || row.staff.full_name, 'all', 'var(--text-primary)')}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {renderClickableCount(row.connected, row.staff.id, row.staff.fullName || row.staff.full_name, 'connected', 'var(--success)')}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {renderClickableCount(row.clientCalls, row.staff.id, row.staff.fullName || row.staff.full_name, 'client', 'var(--text-primary)')}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {renderClickableCount(row.candidateCalls, row.staff.id, row.staff.fullName || row.staff.full_name, 'candidate', 'var(--text-primary)')}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>
                          {Math.floor(row.talkTimeSeconds / 60)}m {row.talkTimeSeconds % 60}s
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: 'var(--primary)', fontWeight: 600 }}>
                          {Math.floor(row.qandleProductiveSeconds / 3600)}h {Math.floor((row.qandleProductiveSeconds % 3600) / 60)}m
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{row.qandleArrival}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{row.qandleLeft}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>{row.lastCallTime}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {renderClickableCount(row.over5m, row.staff.id, row.staff.fullName || row.staff.full_name, 'over5m', 'var(--text-primary)')}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {renderClickableCount(row.over10m, row.staff.id, row.staff.fullName || row.staff.full_name, 'over10m', 'var(--text-primary)')}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {renderClickableCount(row.callbacks, row.staff.id, row.staff.fullName || row.staff.full_name, 'callback', 'var(--warning)')}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {renderClickableCount(row.alpha, row.staff.id, row.staff.fullName || row.staff.full_name, 'alpha', 'var(--primary)')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. RECRUITER ACTIVITY HEATMAP */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recruiter Activity Heatmap ({overviewStats.earliestHour || 8}:00 to {overviewStats.latestHour || 18}:59)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700 }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', minWidth: '150px' }}>Recruiter</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px' }}>Prod</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px' }}>In</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px' }}>Out</th>
                    {Array.from({ length: ((overviewStats.latestHour || 18) - (overviewStats.earliestHour || 8) + 1) }, (_, i) => (overviewStats.earliestHour || 8) + i).map(hr => (
                      <th key={hr} style={{ textAlign: 'center', padding: '10px 6px', width: '40px' }}>{String(hr).padStart(2, '0')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRecruiterRows.length === 0 ? (
                    <tr>
                      <td colSpan={4 + ((overviewStats.latestHour || 18) - (overviewStats.earliestHour || 8) + 1)} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No recruiters found.
                      </td>
                    </tr>
                  ) : (
                    sortedRecruiterRows.map(row => (
                      <tr key={row.staff.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {row.staff.fullName || row.staff.full_name}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>
                          {Math.floor(row.qandleProductiveSeconds / 3600)}h {Math.floor((row.qandleProductiveSeconds % 3600) / 60)}m
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px' }}>{row.qandleArrival}</td>
                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px' }}>{row.qandleLeft}</td>
                        {Array.from({ length: ((overviewStats.latestHour || 18) - (overviewStats.earliestHour || 8) + 1) }, (_, i) => (overviewStats.earliestHour || 8) + i).map(hr => {
                          const callsInHour = row.hourlyCalls[hr] || 0;
                          
                          let bg = 'transparent';
                          let textCol = 'var(--text-secondary)';
                          let fontWt = 'normal';
                          
                          if (callsInHour === 1) {
                            bg = 'rgba(147, 51, 234, 0.1)';
                            textCol = 'var(--text-primary)';
                          } else if (callsInHour >= 2 && callsInHour <= 3) {
                            bg = 'rgba(147, 51, 234, 0.25)';
                            textCol = 'var(--text-primary)';
                            fontWt = 'bold';
                          } else if (callsInHour >= 4 && callsInHour <= 5) {
                            bg = 'rgba(147, 51, 234, 0.5)';
                            textCol = '#fff';
                            fontWt = 'bold';
                          } else if (callsInHour >= 6) {
                            bg = 'var(--primary)';
                            textCol = '#fff';
                            fontWt = 'bold';
                          }

                          return (
                            <td
                              key={hr}
                              style={{
                                textAlign: 'center',
                                padding: '10px 4px',
                                backgroundColor: bg,
                                color: textCol,
                                fontWeight: fontWt,
                                borderRadius: '4px',
                                transition: 'all 0.2s'
                              }}
                            >
                              {callsInHour || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. SCOREBOARD & VISUALIZATIONS ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            
            {/* Scorecard Box */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Overview Statistics</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOTAL CALLS</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>{overviewStats.totalCalls}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{overviewStats.outboundCount} Out • {overviewStats.inboundCount} In</div>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CONNECT RATE</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0', color: 'var(--success)' }}>{overviewStats.connectRate}%</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Avg call success</div>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AVG TALK TIME</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>
                    {Math.floor(overviewStats.avgTalkTime / 60)}m {overviewStats.avgTalkTime % 60}s
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Per successful call</div>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CALLBACKS (CB)</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0', color: 'var(--warning)' }}>{overviewStats.totalCallbacks}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>AI Flagged</div>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ALPHA SIGNALS (A)</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0', color: 'var(--primary)' }}>{overviewStats.totalAlpha}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Captured signals</div>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CRM PLACEMENTS</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0', color: 'var(--primary)' }}>
                    {placements.filter(p => {
                      const { start, end } = overviewDateRangeWindow;
                      return p.date && p.date >= start && p.date <= end;
                    }).length}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>From Recruitly records</div>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MINS+ CALLS ({"\u2265 5M"})</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0', color: 'var(--primary)' }}>{overviewStats.totalOver5m}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Long conversations</div>
                </div>

                <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PEAK ACTIVITY HOUR</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>{overviewStats.peakHour}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>With {overviewStats.peakCalls} calls</div>
                </div>
              </div>
            </div>

            {/* Hourly Activity Visualization */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Hourly Activity</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: ((overviewStats.latestHour || 18) - (overviewStats.earliestHour || 8) + 1) }, (_, i) => (overviewStats.earliestHour || 8) + i).map(hr => {
                  const calls = overviewStats.globalHourlyCalls[hr] || 0;
                  const maxCalls = Math.max(1, ...Array.from({ length: ((overviewStats.latestHour || 18) - (overviewStats.earliestHour || 8) + 1) }, (_, i) => overviewStats.globalHourlyCalls[(overviewStats.earliestHour || 8) + i] || 0));
                  const pct = (calls / maxCalls) * 100;
                  
                  return (
                    <div key={hr} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12px', width: '20px', fontWeight: 600, color: 'var(--text-secondary)' }}>{String(hr).padStart(2, '0')}</span>
                      <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', height: '14px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, backgroundColor: 'var(--primary)', height: '100%', transition: 'width 0.4s ease-out' }}></div>
                      </div>
                      <span style={{ fontSize: '12px', width: '24px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>{calls}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6. CHARTS ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Call Status Donut */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ margin: '0 0 16px 0', width: '100%', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left' }}>Call Status</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '120px', height: '120px' }}>
                  {(() => {
                    const statusEntries = Object.entries(overviewStats.callStatusCounts).filter(([_, count]) => count > 0);
                    const total = statusEntries.reduce((sum, [_, count]) => sum + count, 0);
                    
                    if (total === 0) {
                      return (
                        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                          <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="transparent" />
                          <text x="50" y="55" textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontWeight="bold">NO DATA</text>
                        </svg>
                      );
                    }

                    const palette = ['var(--primary)', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];
                    let accumulatedPercent = 0;
                    const r = 38;
                    const circumference = 2 * Math.PI * r;

                    return (
                      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                        <circle cx="50" cy="50" r={r} stroke="rgba(255,255,255,0.02)" strokeWidth="12" fill="transparent" />
                        {statusEntries.map(([status, count], idx) => {
                          const percent = (count / total) * 100;
                          const strokeDasharray = `${circumference}`;
                          const strokeDashoffset = circumference - (percent / 100) * circumference;
                          const rotation = (accumulatedPercent / 100) * 360 - 90;
                          accumulatedPercent += percent;
                          const color = palette[idx % palette.length];

                          return (
                            <circle
                              key={status}
                              cx="50"
                              cy="50"
                              r={r}
                              stroke={color}
                              strokeWidth="12"
                              fill="transparent"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              transform={`rotate(${rotation} 50 50)`}
                              style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                            />
                          );
                        })}
                        <text x="50" y="55" textAnchor="middle" fontSize="14" fill="var(--text-primary)" fontWeight="800">
                          {total}
                        </text>
                      </svg>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                  {Object.entries(overviewStats.callStatusCounts).filter(([_, count]) => count > 0).map(([status, count], idx) => {
                    const total = Object.values(overviewStats.callStatusCounts).reduce((a, b) => a + b, 0);
                    const percent = Math.round((count / total) * 100);
                    const palette = ['var(--primary)', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];
                    const color = palette[idx % palette.length];
                    return (
                      <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }}></span>
                        <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{status}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{percent}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Call Direction Donut */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ margin: '0 0 16px 0', width: '100%', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left' }}>Direction</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '120px', height: '120px' }}>
                  {(() => {
                    const total = overviewStats.outboundCount + overviewStats.inboundCount;
                    if (total === 0) {
                      return (
                        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                          <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="transparent" />
                          <text x="50" y="55" textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontWeight="bold">NO DATA</text>
                        </svg>
                      );
                    }

                    const r = 38;
                    const circumference = 2 * Math.PI * r;
                    const outboundPct = (overviewStats.outboundCount / total) * 100;
                    const inboundPct = (overviewStats.inboundCount / total) * 100;

                    const outboundOffset = circumference - (outboundPct / 100) * circumference;
                    const inboundOffset = circumference - (inboundPct / 100) * circumference;

                    return (
                      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                        <circle cx="50" cy="50" r={r} stroke="rgba(255,255,255,0.02)" strokeWidth="12" fill="transparent" />
                        {overviewStats.outboundCount > 0 && (
                          <circle
                            cx="50"
                            cy="50"
                            r={r}
                            stroke="var(--primary)"
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={outboundOffset}
                            transform="rotate(-90 50 50)"
                            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                          />
                        )}
                        {overviewStats.inboundCount > 0 && (
                          <circle
                            cx="50"
                            cy="50"
                            r={r}
                            stroke="#10b981"
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={inboundOffset}
                            transform={`rotate(${(outboundPct / 100) * 360 - 90} 50 50)`}
                            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                          />
                        )}
                        <text x="50" y="55" textAnchor="middle" fontSize="14" fill="var(--text-primary)" fontWeight="800">
                          {total}
                        </text>
                      </svg>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '120px' }}>
                  {overviewStats.outboundCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'inline-block' }}></span>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>Outbound</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {Math.round((overviewStats.outboundCount / (overviewStats.outboundCount + overviewStats.inboundCount)) * 100)}%
                      </span>
                    </div>
                  )}
                  {overviewStats.inboundCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>Inbound</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {Math.round((overviewStats.inboundCount / (overviewStats.outboundCount + overviewStats.inboundCount)) * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : activeSubTab === 'performance' ? (
        <>
          {/* 1. TOP HEADER & PERFORMANCE ALERTS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Performance & Activity Scorecard</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>💡 {dashboardSubtitle}</span>
        </div>

        {/* Global Time Filter Controls */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            {[
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'ytd', label: 'Year to Date' },
              { id: 'custom', label: 'Custom' }
            ].map(btn => (
              <button
                key={btn.id}
                onClick={() => setTimeRange(btn.id)}
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  border: 'none',
                  backgroundColor: timeRange === btn.id ? 'var(--primary)' : 'transparent',
                  color: timeRange === btn.id ? 'white' : 'var(--text-secondary)',
                  fontWeight: 600,
                  borderRadius: '4px'
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {timeRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="form-input"
                style={{ fontSize: '11px', height: '24px', padding: '2px 4px', width: '110px' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="form-input"
                style={{ fontSize: '11px', height: '24px', padding: '2px 4px', width: '110px' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. DIRECTORY FILTERS PANEL DELETED - LIFTED GLOBALLY */}

      {/* 3. PERFORMANCE STATS CARDS (DIALPAD & RECRUITLY SPLIT) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Card 1: Dialpad Call Count */}
        <div className="card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>
            <Phone size={24} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Dialpad Call Count</span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 700 }}>{aggregatedStats.totalCalls}</h3>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              📞 {aggregatedStats.inbound} Inbound / {aggregatedStats.outbound} Outbound
            </span>
          </div>
        </div>

        {/* Card 2: Phone Talk Time */}
        <div className="card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Total Phone Duration</span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 700 }}>{formatDuration(aggregatedStats.totalTalkTime)}</h3>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              ⏱️ Avg {formatDuration(Math.round(aggregatedStats.totalTalkTime / (aggregatedStats.totalCalls || 1)))} / call
            </span>
          </div>
        </div>

        {/* Card 3: Quality Calls (>5m & >10m) */}
        <div className="card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Quality Call Benchmarks</span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 700 }}>{aggregatedStats.callsOver5Min}</h3>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              ⚡ {aggregatedStats.callsOver5Min} calls &gt; 5m / {aggregatedStats.callsOver10Min} &gt; 10m
            </span>
          </div>
        </div>

        {/* Card 4: CVs & Placements (CRM Activity) */}
        <div className="card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
            <Briefcase size={24} />
          </div>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Recruitly CRM Activity</span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '22px', fontWeight: 700 }}>{aggregatedStats.cvsSent} / {aggregatedStats.interviews}</h3>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              📄 {aggregatedStats.cvsSent} CVs / {aggregatedStats.interviews} Interviews / {aggregatedStats.jobsTaken} Jobs
            </span>
          </div>
        </div>

      </div>

      {/* 4. LEADERBOARD AND TEAM COMPARISON SECTION */}
      {userRole !== 'recruiter' && (
        <>
          <div className="card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={18} color="var(--primary)" />
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Recruiter Activity Leaderboard</h4>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click column headers to sort</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)', userSelect: 'none' }}>
                  <th 
                    onClick={() => handlePerfSort('recruiter')} 
                    style={{ padding: '10px', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Recruiter{renderPerfSortIndicator('recruiter')}
                  </th>
                  <th 
                    onClick={() => handlePerfSort('division')} 
                    style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Division{renderPerfSortIndicator('division')}
                  </th>
                  <th 
                    onClick={() => handlePerfSort('totalCalls')} 
                    style={{ textAlign: 'center', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Total Calls{renderPerfSortIndicator('totalCalls')}
                  </th>
                  <th 
                    onClick={() => handlePerfSort('totalTalkTime')} 
                    style={{ textAlign: 'center', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Talk Time{renderPerfSortIndicator('totalTalkTime')}
                  </th>
                  <th 
                    onClick={() => handlePerfSort('callsOver5Min')} 
                    style={{ textAlign: 'center', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Calls &gt; 5m{renderPerfSortIndicator('callsOver5Min')}
                  </th>
                  <th 
                    onClick={() => handlePerfSort('cvsSent')} 
                    style={{ textAlign: 'center', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    CVs Sent{renderPerfSortIndicator('cvsSent')}
                  </th>
                  <th 
                    onClick={() => handlePerfSort('interviews')} 
                    style={{ textAlign: 'center', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    Interviews{renderPerfSortIndicator('interviews')}
                  </th>
                  <th 
                    onClick={() => handlePerfSort('jobsTaken')} 
                    style={{ textAlign: 'center', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    New Jobs Taken{renderPerfSortIndicator('jobsTaken')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffList
                  .map(s => ({
                    staff: s,
                    kpi: mockKpiData[s.id] || { totalCalls: 0, totalTalkTime: 0, callsOver5Min: 0, cvsSent: 0, interviews: 0, jobsTaken: 0 }
                  }))
                  .sort((a, b) => {
                    let valA = 0;
                    let valB = 0;
                    if (perfSortField === 'recruiter') {
                      valA = a.staff.fullName;
                      valB = b.staff.fullName;
                    } else if (perfSortField === 'division') {
                      valA = a.staff.department || '';
                      valB = b.staff.department || '';
                    } else {
                      valA = a.kpi[perfSortField] || 0;
                      valB = b.kpi[perfSortField] || 0;
                    }

                    if (valA < valB) return perfSortDirection === 'asc' ? -1 : 1;
                    if (valA > valB) return perfSortDirection === 'asc' ? 1 : -1;
                    return 0;
                  })
                  .map(({ staff: s, kpi }) => {
                    const targets = s.kpiTargets || {};
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 10px', fontWeight: 600 }}>👤 {s.fullName}</td>
                        <td>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontSize: '11px', fontWeight: 600 }}>
                            {s.department}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {renderMetricWithTarget(kpi.totalCalls, targets.calls, targetMultiplier, false, s.id, 'all', s.fullName)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {renderMetricWithTarget(kpi.totalTalkTime, targets.talkTimeMin, targetMultiplier, true, s.id, 'connected', s.fullName)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {renderClickableCountPerf(kpi.callsOver5Min, s.id, s.fullName, 'over5m', kpi.callsOver5Min > 5 ? 'var(--success)' : 'var(--text-secondary)')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {renderMetricWithTarget(kpi.cvsSent, targets.cvsSent, targetMultiplier, false)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {renderMetricWithTarget(kpi.interviews, targets.interviews, targetMultiplier, false)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {renderMetricWithTarget(kpi.jobsTaken, targets.jobsTaken, targetMultiplier, false)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. RECRUITER COMPARISON BENCH */}
        <div className="card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '20px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={18} color="var(--primary)" />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>👥 Recruiter Comparison Bench</h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>Compare up to 3 recruiters side-by-side</span>
          </div>

          {/* Selection Dropdowns Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <div className="form-group">
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Recruiter A:</label>
              <select
                value={compareRecruiterA}
                onChange={(e) => setCompareRecruiterA(e.target.value)}
                className="select-filter"
                style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="">-- Choose Recruiter A --</option>
                {filteredStaffList.map(s => (
                  <option key={s.id} value={s.id} disabled={s.id === compareRecruiterB || s.id === compareRecruiterC}>{s.fullName}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Recruiter B:</label>
              <select
                value={compareRecruiterB}
                onChange={(e) => setCompareRecruiterB(e.target.value)}
                className="select-filter"
                style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="">-- Choose Recruiter B --</option>
                {filteredStaffList.map(s => (
                  <option key={s.id} value={s.id} disabled={s.id === compareRecruiterA || s.id === compareRecruiterC}>{s.fullName}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Recruiter C:</label>
              <select
                value={compareRecruiterC}
                onChange={(e) => setCompareRecruiterC(e.target.value)}
                className="select-filter"
                style={{ width: '100%', padding: '6px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                <option value="">-- Choose Recruiter C --</option>
                {filteredStaffList.map(s => (
                  <option key={s.id} value={s.id} disabled={s.id === compareRecruiterA || s.id === compareRecruiterB}>{s.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Side-by-side comparison tables/cards */}
          {(!compareRecruiterA && !compareRecruiterB && !compareRecruiterC) ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
              💡 Select one or more recruiters above to compare their call activities and CRM results.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {[
                { key: 'A', id: compareRecruiterA, label: 'Recruiter A' },
                { key: 'B', id: compareRecruiterB, label: 'Recruiter B' },
                { key: 'C', id: compareRecruiterC, label: 'Recruiter C' }
              ].map(col => {
                if (!col.id) {
                  return (
                    <div key={col.key} style={{ padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px', minHeight: '200px' }}>
                      Slot Empty
                    </div>
                  );
                }

                const sMember = staff.find(s => s.id === col.id);
                const kpi = mockKpiData[col.id] || { totalCalls: 0, totalTalkTime: 0, callsOver5Min: 0, cvsSent: 0, interviews: 0, jobsTaken: 0 };
                const targets = sMember?.kpiTargets || {};

                // Calculate rates/splits
                const avgTalkTime = kpi.totalCalls ? Math.round(kpi.totalTalkTime / kpi.totalCalls) : 0;
                const outRatio = kpi.totalCalls ? Math.round((kpi.outbound / kpi.totalCalls) * 100) : 0;

                return (
                  <div key={col.key} style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</span>
                      <h5 style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>👤 {sMember?.fullName}</h5>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{sMember?.department || 'General'}</span>
                    </div>

                    {/* Stats lines */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                      
                      {/* 1. Dialer Calls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Dialer Calls:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontWeight: 700 }}>{kpi.totalCalls} calls</span>
                          {targets.calls ? (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Target: {targets.calls * targetMultiplier}</span>
                          ) : null}
                        </div>
                      </div>

                      {/* 2. Talk Time */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Talk Time:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontWeight: 700 }}>{formatDuration(kpi.totalTalkTime)}</span>
                          {targets.talkTimeMin ? (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Target: {targets.talkTimeMin * targetMultiplier}m</span>
                          ) : null}
                        </div>
                      </div>

                      {/* 3. Avg Call Duration */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Avg Call Duration:</span>
                        <span style={{ fontWeight: 600 }}>{formatDuration(avgTalkTime)}</span>
                      </div>

                      {/* 4. Outbound Ratio */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Outbound Split:</span>
                        <span style={{ fontWeight: 600 }}>{outRatio}% ({kpi.outbound} / {kpi.totalCalls})</span>
                      </div>

                      {/* 5. Quality Calls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Quality Calls (&gt;5m):</span>
                        <span style={{ fontWeight: 600 }}>{kpi.callsOver5Min} calls</span>
                      </div>

                      {/* 6. CVs Sent */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '2px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>CVs Sent:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontWeight: 700 }}>{kpi.cvsSent} CVs</span>
                          {targets.cvsSent ? (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Target: {targets.cvsSent * targetMultiplier}</span>
                          ) : null}
                        </div>
                      </div>

                      {/* 7. Interviews */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Interviews Organized:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontWeight: 700 }}>{kpi.interviews}</span>
                          {targets.interviews ? (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Target: {targets.interviews * targetMultiplier}</span>
                          ) : null}
                        </div>
                      </div>

                      {/* 8. Jobs Taken */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Jobs Taken Over:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontWeight: 700 }}>{kpi.jobsTaken}</span>
                          {targets.jobsTaken ? (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Target: {targets.jobsTaken * targetMultiplier}</span>
                          ) : null}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    )}</>
      ) : activeSubTab === 'calls' ? (
        <>
          {/* 1. HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Dialpad Call logs & Recordings</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                🎥 Browse, filter, listen to recordings, and view transcripts for recruiter phone calls.
              </span>
            </div>
            {hasRealCalls ? (
              <span style={{ fontSize: '11px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '4px', fontWeight: 700 }}>
                🟢 LIVE WEBHOOK DATA
              </span>
            ) : (
              <span style={{ fontSize: '11px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '4px 10px', borderRadius: '4px', fontWeight: 700 }}>
                💡 DEMO MODE (WAITING FOR WEBHOOK EVENT)
              </span>
            )}
          </div>

          {/* 2. FILTERS PANEL */}
          <div className="card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Date range filters row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="var(--primary)" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Date Range:</span>
              </div>
              
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'this_week', label: 'This Week' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'custom', label: 'Custom Range' }
                ].map(btn => (
                  <button
                    key={btn.id}
                    onClick={() => {
                      setCallsTimeRange(btn.id);
                      setCallLogsPage(1);
                    }}
                    className="btn-secondary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '11px',
                      border: 'none',
                      backgroundColor: callsTimeRange === btn.id ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: callsTimeRange === btn.id ? 'white' : 'var(--text-secondary)',
                      fontWeight: 600,
                      borderRadius: '4px'
                    }}
                  >
                    {btn.label}
                  </button>
                ))}

                {callsTimeRange === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px' }}>
                    <input
                      type="date"
                      value={callsCustomStartDate}
                      onChange={(e) => {
                        setCallsCustomStartDate(e.target.value);
                        setCallLogsPage(1);
                      }}
                      className="form-input"
                      style={{ fontSize: '11px', height: '28px', padding: '2px 6px', width: '120px' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
                    <input
                      type="date"
                      value={callsCustomEndDate}
                      onChange={(e) => {
                        setCallsCustomEndDate(e.target.value);
                        setCallLogsPage(1);
                      }}
                      className="form-input"
                      style={{ fontSize: '11px', height: '28px', padding: '2px 6px', width: '120px' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Department/Staff/Search row */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              
              {/* Search text input */}
              <div className="form-group" style={{ flex: 1.5, minWidth: '220px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Search by caller, recipient, or number:
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Type to search..."
                    value={callLogsSearch}
                    onChange={(e) => {
                      setCallLogsSearch(e.target.value);
                      setCallLogsPage(1);
                    }}
                    className="form-input"
                    style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
                  />
                </div>
              </div>

              {/* Department selection */}
              {userRole === 'admin' && (
                <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Department Division:
                  </label>
                  <select
                    value={selectedDept}
                    onChange={(e) => {
                      setSelectedDept(e.target.value);
                      setSelectedStaffId('all');
                      setCallLogsPage(1);
                    }}
                    className="select-filter"
                    style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="all">-- All Departments --</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Staff Recruiter selection */}
              {userRole !== 'recruiter' && (
                <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Recruiter Profile:
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      setCallLogsPage(1);
                    }}
                    className="select-filter"
                    style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="all">-- All Recruiters --</option>
                    {filteredStaffList.map(s => (
                      <option key={s.id} value={s.id}>{s.fullName}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Direction selector */}
              <div className="form-group" style={{ flex: 0.8, minWidth: '130px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Call Direction:
                </label>
                <select
                  value={callLogsDirection}
                  onChange={(e) => {
                    setCallLogsDirection(e.target.value);
                    setCallLogsPage(1);
                  }}
                  className="select-filter"
                  style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="all">All Directions</option>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>
              </div>

            </div>
          </div>

          {/* 3. TABLE CARD */}
          <div className="card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {isLoadingCalls ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '3px solid var(--border-color)',
                  borderTopColor: 'var(--primary)',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Querying call history...</span>
              </div>
            ) : (
              <>
                {callLogsSubFilter !== 'all' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    border: '1px dashed var(--primary)',
                    borderRadius: '6px',
                    padding: '10px 16px',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: 'var(--primary)',
                    fontWeight: 600
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>🔍</span>
                      <span>
                        Filtering logs by: <strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                          {callLogsSubFilter === 'over5m' ? '5Min+ Calls' : 
                           callLogsSubFilter === 'over10m' ? '10Min+ Calls' : 
                           callLogsSubFilter + ' Calls'}
                        </strong>
                      </span>
                    </div>
                    <button 
                      onClick={() => setCallLogsSubFilter('all')}
                      className="btn-secondary"
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Clear Filter
                    </button>
                  </div>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                        <th 
                          onClick={() => handleSort('date')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                          title="Sort by Time & Date"
                        >
                          Time & Date{renderSortIndicator('date')}
                        </th>
                        <th 
                          onClick={() => handleSort('staffName')}
                          style={{ padding: '10px 0', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                          title="Sort by Recruiter"
                        >
                          Recruiter{renderSortIndicator('staffName')}
                        </th>
                        <th 
                          onClick={() => handleSort('direction')}
                          style={{ padding: '10px 0', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                          title="Sort by Direction"
                        >
                          Direction{renderSortIndicator('direction')}
                        </th>
                        <th 
                          onClick={() => handleSort('targetName')}
                          style={{ padding: '10px 0', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                          title="Sort by Party Name / Number"
                        >
                          Party Name / Number{renderSortIndicator('targetName')}
                        </th>
                        <th 
                          onClick={() => handleSort('targetType')}
                          style={{ padding: '10px 0', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                          title="Sort by Party Type"
                        >
                          Party Type{renderSortIndicator('targetType')}
                        </th>
                        <th 
                          onClick={() => handleSort('duration')}
                          style={{ padding: '10px 0', textAlign: 'center', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                          title="Sort by Duration"
                        >
                          Duration{renderSortIndicator('duration')}
                        </th>
                        <th 
                          onClick={() => handleSort('disposition')}
                          style={{ padding: '10px 0', textAlign: 'center', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                          title="Sort by Disposition"
                        >
                          Disposition{renderSortIndicator('disposition')}
                        </th>
                        <th style={{ padding: '10px 0', textAlign: 'center' }}>Benchmark</th>
                        <th style={{ padding: '10px 0', textAlign: 'center' }}>Recording</th>
                        <th style={{ padding: '10px 0', textAlign: 'center' }}>Transcript</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayCallsChunk.length > 0 ? (
                        displayCallsChunk.map(call => (
                          <tr key={call.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '12px 10px', fontSize: '12px' }}>
                              <span style={{ display: 'block', fontWeight: 600 }}>📅 {call.date}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>⏱️ {call.time}</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>👤 {call.staffName}</td>
                            <td>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: 700,
                                backgroundColor: call.direction === 'Inbound' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                color: call.direction === 'Inbound' ? 'var(--success)' : 'var(--primary)'
                              }}>
                                {call.direction === 'Inbound' ? <PhoneIncoming size={10} /> : <PhoneOutgoing size={10} />}
                                {call.direction}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px', fontWeight: 600 }}>
                              📞 <CRMContactLink phone={call.externalNumber} defaultName={call.targetName} />
                            </td>
                            <td>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 600,
                                backgroundColor: call.targetType === 'Candidate' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                color: call.targetType === 'Candidate' ? 'rgb(139, 92, 246)' : 'rgb(245, 158, 11)'
                              }}>
                                {call.targetType}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '12px' }}>{formatDuration(call.duration)}</td>
                            <td style={{ textAlign: 'center' }}>
                              {renderDispositionBadges(call.disposition)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {call.duration >= 600 ? (
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                                  color: 'rgb(139, 92, 246)'
                                }}>
                                  ⚡ &gt; 10m
                                </span>
                              ) : call.duration >= 300 ? (
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                  color: 'var(--primary)'
                                }}>
                                  ⚡ &gt; 5m
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {call.hasRecording ? (
                                <button 
                                  className="btn-secondary" 
                                  onClick={() => {
                                    setActiveCallDetail(call);
                                    setIsPlaying(true);
                                  }}
                                  style={{ padding: '4px 8px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Volume2 size={12} color="var(--primary)" /> Listen
                                </button>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No Audio</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                className="btn-secondary"
                                onClick={() => {
                                  setActiveCallDetail(call);
                                  setIsPlaying(false);
                                }}
                                style={{ padding: '4px 8px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <FileText size={12} color="var(--primary)" /> View
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            No call logs found in the selected date range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Showing {filteredAndSearchedCalls.length > 0 ? (callLogsPage - 1) * callLogsPageSize + 1 : 0} to {Math.min(filteredAndSearchedCalls.length, callLogsPage * callLogsPageSize)} of {filteredAndSearchedCalls.length} calls
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setCallLogsPage(p => Math.max(1, p - 1))}
                      disabled={callLogsPage === 1}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px', opacity: callLogsPage === 1 ? 0.5 : 1, cursor: callLogsPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      ◀ Previous
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', px: '8px', fontSize: '12px', fontWeight: 600 }}>
                      Page {callLogsPage} of {totalCallLogsPages}
                    </span>
                    <button
                      onClick={() => setCallLogsPage(p => Math.min(totalCallLogsPages, p + 1))}
                      disabled={callLogsPage === totalCallLogsPages}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px', opacity: callLogsPage === totalCallLogsPages ? 0.5 : 1, cursor: callLogsPage === totalCallLogsPages ? 'not-allowed' : 'pointer' }}
                    >
                      Next ▶
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      ) : activeSubTab === 'qandle' ? (
        <>
          {/* 1. HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Qandle Attendance & Productivity Logs</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                ⏰ Monitor check-in times, productive hours, active desk time, and effectiveness ratings.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {syncQandleSuccess && (
                <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>
                  ✓ {syncQandleSuccess}
                </span>
              )}
              {syncQandleError && (
                <span style={{ fontSize: '12px', color: 'var(--error)', fontWeight: 600 }}>
                  ⚠ {syncQandleError}
                </span>
              )}
              <button
                onClick={handleSyncQandle}
                disabled={isSyncingQandle}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  opacity: isSyncingQandle ? 0.6 : 1,
                  cursor: isSyncingQandle ? 'not-allowed' : 'pointer'
                }}
              >
                <style>{`
                  @keyframes qandle-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                  .qandle-spin-icon {
                    animation: qandle-spin 1s linear infinite;
                  }
                `}</style>
                <RefreshCw 
                  size={14} 
                  className={isSyncingQandle ? 'qandle-spin-icon' : ''} 
                  style={{ transition: 'transform 0.2s' }}
                />
                {isSyncingQandle ? 'Syncing...' : 'Sync Qandle'}
              </button>
              <span style={{ fontSize: '11px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '4px', fontWeight: 700 }}>
                🟢 SYNCED DATABASE RECORDS
              </span>
            </div>
          </div>

          {/* 2. FILTERS PANEL */}
          <div className="card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Date range filters row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="var(--primary)" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Date Range:</span>
              </div>
              
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'this_week', label: 'This Week' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'custom', label: 'Custom Range' }
                ].map(btn => (
                  <button
                    key={btn.id}
                    onClick={() => {
                      setQandleTimeRange(btn.id);
                      setQandlePage(1);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      backgroundColor: qandleTimeRange === btn.id ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: qandleTimeRange === btn.id ? '#fff' : 'var(--text-primary)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {btn.label}
                  </button>
                ))}

                {qandleTimeRange === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px' }}>
                    <input
                      type="date"
                      value={qandleCustomStartDate}
                      onChange={(e) => {
                        setQandleCustomStartDate(e.target.value);
                        setQandlePage(1);
                      }}
                      className="form-input"
                      style={{ fontSize: '11px', height: '28px', padding: '2px 6px', width: '120px' }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>to</span>
                    <input
                      type="date"
                      value={qandleCustomEndDate}
                      onChange={(e) => {
                        setQandleCustomEndDate(e.target.value);
                        setQandlePage(1);
                      }}
                      className="form-input"
                      style={{ fontSize: '11px', height: '28px', padding: '2px 6px', width: '120px' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Department/Staff/Search row */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              
              {/* Search text input */}
              <div className="form-group" style={{ flex: 1.5, minWidth: '220px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Search by recruiter name or employee code:
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Type to search..."
                    value={qandleSearch}
                    onChange={(e) => {
                      setQandleSearch(e.target.value);
                      setQandlePage(1);
                    }}
                    className="form-input"
                    style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
                  />
                </div>
              </div>

              {/* Department selection */}
              {userRole === 'admin' && (
                <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Department Division:
                  </label>
                  <select
                    value={selectedDept}
                    onChange={(e) => {
                      setSelectedDept(e.target.value);
                      setSelectedStaffId('all');
                      setQandlePage(1);
                    }}
                    className="select-filter"
                    style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="all">-- All Departments --</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Staff Recruiter selection */}
              {userRole !== 'recruiter' && (
                <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Recruiter Profile:
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      setQandlePage(1);
                    }}
                    className="select-filter"
                    style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="all">-- All Recruiters --</option>
                    {filteredStaffList.map(s => (
                      <option key={s.id} value={s.id}>{s.fullName}</option>
                    ))}
                  </select>
                </div>
              )}

            </div>
          </div>

          {/* 3. TABLE CARD */}
          <div className="card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {isLoadingQandle ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '3px solid var(--border-color)',
                  borderTopColor: 'var(--primary)',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Querying attendance logs...</span>
              </div>
            ) : filteredAndSearchedQandle.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                <Clock size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <h4 style={{ margin: '0 0 6px 0', fontWeight: 700 }}>No Attendance Records Found</h4>
                <p style={{ margin: 0, fontSize: '12px' }}>
                  There are no Qandle logs matching the selected search query, date range, or filters.
                </p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                        <th 
                          onClick={() => handleQandleSort('date')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >
                          Date{renderQandleSortIndicator('date')}
                        </th>
                        <th 
                          onClick={() => handleQandleSort('staffName')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >
                          Recruiter{renderQandleSortIndicator('staffName')}
                        </th>
                        <th 
                          onClick={() => handleQandleSort('department')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >
                          Division{renderQandleSortIndicator('department')}
                        </th>
                        <th 
                          onClick={() => handleQandleSort('arrivalTime')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s', textAlign: 'center' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >
                          🚪 Log In / Arrival{renderQandleSortIndicator('arrivalTime')}
                        </th>
                        <th 
                          onClick={() => handleQandleSort('leftTime')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s', textAlign: 'center' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >
                          🚪 Log Out / Left{renderQandleSortIndicator('leftTime')}
                        </th>
                        <th 
                          onClick={() => handleQandleSort('productiveTimeSeconds')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s', textAlign: 'center' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >
                          ⚡ Productive Hours{renderQandleSortIndicator('productiveTimeSeconds')}
                        </th>
                        <th 
                          onClick={() => handleQandleSort('deskTimeSeconds')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s', textAlign: 'center' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >
                          💻 Active Desk Time{renderQandleSortIndicator('deskTimeSeconds')}
                        </th>
                        <th 
                          onClick={() => handleQandleSort('timeAtWorkSeconds')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s', textAlign: 'center' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >
                          🏢 Time at Work{renderQandleSortIndicator('timeAtWorkSeconds')}
                        </th>
                        <th 
                          onClick={() => handleQandleSort('effectiveness')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s', textAlign: 'center' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >
                          🎯 Effectiveness{renderQandleSortIndicator('effectiveness')}
                        </th>
                        <th 
                          onClick={() => handleQandleSort('productivity')}
                          style={{ padding: '10px 10px', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s', textAlign: 'center' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = ''}
                        >
                          📈 Productivity{renderQandleSortIndicator('productivity')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayQandleChunk.map((row) => {
                        const dateObj = new Date(row.date);
                        const formattedDateStr = isNaN(dateObj.getTime()) 
                          ? row.date 
                          : dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                        return (
                          <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)', height: '48px' }}>
                            <td style={{ padding: '10px', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>
                              📅 {formattedDateStr}
                            </td>
                            <td style={{ padding: '10px', fontWeight: 600, fontSize: '13px' }}>
                              👤 {row.staffName}
                              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>
                                {row.employeeCode}
                              </span>
                            </td>
                            <td style={{ padding: '10px' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--primary)',
                                fontSize: '11px',
                                fontWeight: 600
                              }}>
                                {row.department}
                              </span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600, fontSize: '12px' }}>
                              {row.arrivalTime || '-'}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600, fontSize: '12px' }}>
                              {row.leftTime || '-'}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600, fontSize: '12px', color: 'var(--primary)' }}>
                              {formatDuration(row.productiveTimeSeconds)}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 500, fontSize: '12px' }}>
                              {formatDuration(row.deskTimeSeconds)}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 500, fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {formatDuration(row.timeAtWorkSeconds)}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {renderPercentageBadge(row.effectiveness)}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              {renderPercentageBadge(row.productivity)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION PANEL */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Showing records {Math.min(filteredAndSearchedQandle.length, (qandlePage - 1) * qandlePageSize + 1)} to {Math.min(filteredAndSearchedQandle.length, qandlePage * qandlePageSize)} of {filteredAndSearchedQandle.length}
                  </span>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setQandlePage(p => Math.max(1, p - 1))}
                      disabled={qandlePage === 1}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px', opacity: qandlePage === 1 ? 0.5 : 1, cursor: qandlePage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      ◀ Previous
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', px: '8px', fontSize: '12px', fontWeight: 600 }}>
                      Page {qandlePage} of {totalQandlePages}
                    </span>
                    <button
                      onClick={() => setQandlePage(p => Math.min(totalQandlePages, p + 1))}
                      disabled={qandlePage === totalQandlePages}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px', opacity: qandlePage === totalQandlePages ? 0.5 : 1, cursor: qandlePage === totalQandlePages ? 'not-allowed' : 'pointer' }}
                    >
                      Next ▶
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      ) : activeSubTab === 'mapping' ? (
        /* Recruiter Dialpad Mapping View */
        <div className="card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Recruiter Platform Integration Mapping</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Configure matching user credentials for Qandle (Attendance), Dialpad (Calls), and Recruitly (CRM) for each recruiter.
            </p>
          </div>

          <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '380px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search recruiters by name..."
              value={mappingSearch}
              onChange={(e) => setMappingSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '10px', minWidth: '150px' }}>Recruiter</th>
                  <th style={{ minWidth: '180px' }}>⏰ Qandle Mapping</th>
                  <th style={{ minWidth: '220px' }}>📞 Dialpad Mapping</th>
                  <th style={{ minWidth: '180px' }}>💼 Recruitly Mapping</th>
                  <th style={{ textAlign: 'center', minWidth: '100px' }}>KPI Tracking</th>
                  <th style={{ textAlign: 'center', minWidth: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff
                  .filter(s => s.status !== 'exited')
                  .filter(s => {
                    if (mappingSearch) {
                      return s.fullName.toLowerCase().includes(mappingSearch.toLowerCase());
                    }
                    return true;
                  })
                  .map(s => {
                    const aliases = (s.additionalEmails || '').split(',').map(e => e.trim()).filter(Boolean);
                    const isEditing = editingStaffId === s.id;

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ fontWeight: 600, display: 'block' }}>👤 {s.fullName}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.department || 'No department'}</span>
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              className="form-input"
                              value={editingQandleEmail}
                              onChange={(e) => setEditingQandleEmail(e.target.value)}
                              placeholder="qandle.email@humres.co.uk"
                              style={{ width: '100%', fontSize: '12px', height: '32px' }}
                            />
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {s.qandleEmail || s.businessEmail || s.personalEmail || (
                                <span style={{ color: 'var(--warning)', fontStyle: 'italic' }}>Not Mapped</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <input
                                type="text"
                                className="form-input"
                                value={editingDialpadEmail}
                                onChange={(e) => setEditingDialpadEmail(e.target.value)}
                                placeholder="dialpad.email@humres.co.uk"
                                style={{ width: '100%', fontSize: '12px', height: '32px' }}
                              />
                              <input
                                type="text"
                                className="form-input"
                                value={editingAliases}
                                onChange={(e) => setEditingAliases(e.target.value)}
                                placeholder="Aliases (comma-separated)"
                                style={{ width: '100%', fontSize: '11px', height: '28px' }}
                              />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {s.dialpadEmail || s.businessEmail || s.personalEmail || (
                                  <span style={{ color: 'var(--warning)', fontStyle: 'italic' }}>Not Mapped</span>
                                )}
                              </span>
                              {aliases.length > 0 && (
                                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                                  {aliases.map((alias, idx) => (
                                    <span key={idx} style={{
                                      padding: '1px 4px',
                                      borderRadius: '8px',
                                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                      color: 'var(--primary)',
                                      fontSize: '9px',
                                      fontWeight: 600
                                    }}>
                                      {alias}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              className="form-input"
                              value={editingRecruitlyEmail}
                              onChange={(e) => setEditingRecruitlyEmail(e.target.value)}
                              placeholder="recruitly.email@humres.co.uk"
                              style={{ width: '100%', fontSize: '12px', height: '32px' }}
                            />
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {s.recruitlyEmail || s.businessEmail || s.personalEmail || (
                                <span style={{ color: 'var(--warning)', fontStyle: 'italic' }}>Not Mapped</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isStaffDialpadTracked(s)}
                            onChange={async (e) => {
                              try {
                                const updated = {
                                  ...s,
                                  dialpadTracked: e.target.checked
                                };
                                await useBoundStore.getState().updateStaff(updated);
                                onShowToast?.(`Updated KPI tracking status for ${s.fullName}`, 'success');
                              } catch (err) {
                                console.error("Error updating tracking status:", err);
                                onShowToast?.('Failed to update tracking status', 'error');
                              }
                            }}
                            style={{ 
                              width: '16px', 
                              height: '16px', 
                              cursor: 'pointer',
                              accentColor: 'var(--primary)'
                            }}
                            title={`Toggle KPI Tracking for ${s.fullName}`}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleSaveAliases(s.id)}
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: 'var(--success)', color: '#fff', border: 'none' }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingStaffId(null)}
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingStaffId(s.id);
                                setEditingAliases(s.additionalEmails || '');
                                setEditingQandleEmail(s.qandleEmail || '');
                                setEditingDialpadEmail(s.dialpadEmail || '');
                                setEditingRecruitlyEmail(s.recruitlyEmail || '');
                              }}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                              ⚙️ Edit Mapping
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KPI Targets Settings View */
        <div className="card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Recruiter KPI Targets Settings</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Set custom benchmark targets for tracked recruiters. Performance scorecards and leaderboards will compare real-time progress against these values.
              </p>
            </div>
            
            {/* Bulk set button */}
            {selectedStaffIds.length > 0 && (
              <button
                onClick={() => {
                  setEditingTargetsStaffId('bulk');
                  setTargetCalls(40);
                  setTargetTalkTimeMin(60);
                  setTargetCvsSent(5);
                  setTargetSpeculativeCvs(2);
                  setTargetJobsTaken(1);
                  setTargetInterviews(2);
                  setTargetPlacements(4);
                  setTargetPlacementValue(15000);
                }}
                className="btn-secondary"
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                🎯 Bulk Set Targets ({selectedStaffIds.length})
              </button>
            )}
          </div>

          <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '380px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search tracked recruiters..."
              value={mappingSearch}
              onChange={(e) => setMappingSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '10px 0', width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={
                        staff.filter(isStaffDialpadTracked).filter(s => {
                          if (mappingSearch) {
                            return s.fullName.toLowerCase().includes(mappingSearch.toLowerCase());
                          }
                          return true;
                        }).length > 0 &&
                        staff.filter(isStaffDialpadTracked).filter(s => {
                          if (mappingSearch) {
                            return s.fullName.toLowerCase().includes(mappingSearch.toLowerCase());
                          }
                          return true;
                        }).every(s => selectedStaffIds.includes(s.id))
                      }
                      onChange={(e) => {
                        const list = staff.filter(isStaffDialpadTracked).filter(s => {
                          if (mappingSearch) {
                            return s.fullName.toLowerCase().includes(mappingSearch.toLowerCase());
                          }
                          return true;
                        });
                        if (e.target.checked) {
                          setSelectedStaffIds(list.map(s => s.id));
                        } else {
                          setSelectedStaffIds([]);
                        }
                      }}
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                  </th>
                  <th style={{ padding: '10px' }}>Recruiter</th>
                  <th>Department</th>
                  <th style={{ textAlign: 'center' }}>Daily Phone Targets</th>
                  <th style={{ textAlign: 'center' }}>Daily CRM Targets</th>
                  <th style={{ textAlign: 'center' }}>Monthly Targets</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff
                  .filter(isStaffDialpadTracked)
                  .filter(s => {
                    if (mappingSearch) {
                      return s.fullName.toLowerCase().includes(mappingSearch.toLowerCase());
                    }
                    return true;
                  })
                  .map(s => {
                    const targets = s.kpiTargets || {};
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ textAlign: 'center', padding: '10px 0' }}>
                          <input
                            type="checkbox"
                            checked={selectedStaffIds.includes(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStaffIds(prev => [...prev, s.id]);
                              } else {
                                setSelectedStaffIds(prev => prev.filter(id => id !== s.id));
                              }
                            }}
                            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                          />
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 600 }}>👤 {s.fullName}</td>
                        <td>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontSize: '11px', fontWeight: 600 }}>
                            {s.department || 'General'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          📞 {targets.calls || 40} calls / ⏱️ {targets.talkTimeMin || 60} mins
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          📄 {targets.cvsSent || 5} CVs / 💼 {targets.interviews || 2} Int
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          🏆 {targets.placements || 4} Placements / £{Number(targets.placementValue || 15000).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleOpenTargetsEditor(s)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            🎯 Set Targets
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KPI TARGETS EDITOR MODAL */}
      {editingTargetsStaffId && (() => {
        const targetStaff = staff.find(s => s.id === editingTargetsStaffId);
        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            backdropFilter: 'blur(3px)'
          }}>
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '560px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-secondary)'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    🎯 Configure KPI Benchmarks
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Setting target benchmarks for **{editingTargetsStaffId === 'bulk' ? `${selectedStaffIds.length} Selected Recruiters` : targetStaff?.fullName}**
                  </span>
                </div>
                <button
                  onClick={() => setEditingTargetsStaffId(null)}
                  style={{
                    border: 'none',
                    background: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px', maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* 1. Daily Phone Targets */}
                <div>
                  <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--primary)', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    📞 Daily Phone System Benchmarks
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Daily Call Target:</label>
                      <input
                        type="number"
                        className="form-input"
                        value={targetCalls}
                        onChange={(e) => setTargetCalls(Number(e.target.value))}
                        style={{ width: '100%', fontSize: '12px', height: '34px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Daily Talk Time (mins) Target:</label>
                      <input
                        type="number"
                        className="form-input"
                        value={targetTalkTimeMin}
                        onChange={(e) => setTargetTalkTimeMin(Number(e.target.value))}
                        style={{ width: '100%', fontSize: '12px', height: '34px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Daily CRM Targets */}
                <div>
                  <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--primary)', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    📄 Daily CRM Action Benchmarks
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Daily CVs Sent Target:</label>
                      <input
                        type="number"
                        className="form-input"
                        value={targetCvsSent}
                        onChange={(e) => setTargetCvsSent(Number(e.target.value))}
                        style={{ width: '100%', fontSize: '12px', height: '34px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Daily Speculative CVs Target:</label>
                      <input
                        type="number"
                        className="form-input"
                        value={targetSpeculativeCvs}
                        onChange={(e) => setTargetSpeculativeCvs(Number(e.target.value))}
                        style={{ width: '100%', fontSize: '12px', height: '34px' }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Daily Jobs Taken Target:</label>
                      <input
                        type="number"
                        className="form-input"
                        value={targetJobsTaken}
                        onChange={(e) => setTargetJobsTaken(Number(e.target.value))}
                        style={{ width: '100%', fontSize: '12px', height: '34px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Daily Interviews Target:</label>
                      <input
                        type="number"
                        className="form-input"
                        value={targetInterviews}
                        onChange={(e) => setTargetInterviews(Number(e.target.value))}
                        style={{ width: '100%', fontSize: '12px', height: '34px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Monthly Targets */}
                <div>
                  <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--primary)', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    🏆 Monthly Financial Benchmarks
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Monthly Placements Count:</label>
                      <input
                        type="number"
                        className="form-input"
                        value={targetPlacements}
                        onChange={(e) => setTargetPlacements(Number(e.target.value))}
                        style={{ width: '100%', fontSize: '12px', height: '34px' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Monthly Placement Value (£):</label>
                      <input
                        type="number"
                        className="form-input"
                        value={targetPlacementValue}
                        onChange={(e) => setTargetPlacementValue(Number(e.target.value))}
                        style={{ width: '100%', fontSize: '12px', height: '34px' }}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                backgroundColor: 'var(--bg-secondary)'
              }}>
                <button
                  onClick={() => setEditingTargetsStaffId(null)}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTargets}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none' }}
                >
                  Save Benchmarks
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 6. CALL DETAIL AUDIO PLAYBACK & TRANSCRIPT MODAL */}
      {activeCallDetail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '600px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            backgroundColor: 'var(--bg-primary)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                  📞 Call Logs Audit: {activeCallDetail.staffName} ↔ <CRMContactLink phone={activeCallDetail.externalNumber} defaultName={activeCallDetail.targetName} />
                </h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {activeCallDetail.date} @ {activeCallDetail.time} ({formatDuration(activeCallDetail.duration)})
                </span>
              </div>
              <button 
                onClick={() => {
                  setActiveCallDetail(null);
                  setIsPlaying(false);
                }}
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Audio Playback Controls */}
              {activeCallDetail.hasRecording && (
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>🔊 Dialpad Call Recording Playback</span>
                  
                  {activeCallDetail.recordingUrl && activeCallDetail.recordingUrl.startsWith('http') && !activeCallDetail.recordingUrl.includes('dialpad.com/blob/') ? (
                    <audio 
                      src={activeCallDetail.recordingUrl} 
                      controls 
                      autoPlay={isPlaying}
                      style={{ width: '100%', borderRadius: '4px' }} 
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px 0', color: 'var(--text-muted)', fontSize: '11px' }}>
                      <span className="loading-spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                      <span>Generating secure recording playback link...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Disposition Badge */}
              {activeCallDetail.disposition && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>🏷️ Recruiter Disposition:</span>
                  <span style={{ backgroundColor: 'rgba(79, 70, 229, 0.15)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 600, border: '1px solid rgba(79, 70, 229, 0.3)' }}>
                    {activeCallDetail.disposition}
                  </span>
                </div>
              )}

              {/* AI Call Recap */}
              {(activeCallDetail.recapSummary || activeCallDetail.recapOutcome) && (
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px dashed var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ✨ Dialpad AI Call Recap
                  </span>
                  {activeCallDetail.recapSummary && (
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Summary</span>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{activeCallDetail.recapSummary}</p>
                    </div>
                  )}
                  {activeCallDetail.recapOutcome && (
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Outcome</span>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{activeCallDetail.recapOutcome}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Call Transcript Box */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  📝 Dialpad AI Call Transcript
                </span>
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-line',
                  lineHeight: '1.6',
                  color: 'var(--text-primary)'
                }}>
                  {isEnriching ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', color: 'var(--text-secondary)' }}>
                      <span className="loading-spinner" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                      <span>Retrieving Dialpad transcript...</span>
                    </div>
                  ) : (
                    activeCallDetail.transcript.trim()
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                🔒 Dialpad transcription generated via Google AI Webhook integration.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 7. DRILL DOWN CALL LOGS MODAL POPUP */}
      {drillDownModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999
        }}>
          <div className="card" style={{
            width: '90%',
            maxWidth: '900px',
            maxHeight: '85vh',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            backgroundColor: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                  📊 {drillDownModal.staffName} — {drillDownModal.category === 'all' ? 'Total' : drillDownModal.category === 'over5m' ? '5Min+' : drillDownModal.category === 'over10m' ? '10Min+' : drillDownModal.category} Calls Audit
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  📅 Date range: {drillDownModal.dateText}
                </span>
              </div>
              <button 
                onClick={() => setDrillDownModal(null)}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600 }}
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {drillDownModal.isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', flexDirection: 'column', gap: '12px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: '3px solid var(--border-color)',
                    borderTopColor: 'var(--primary)',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Querying audit logs...</span>
                </div>
              ) : drillDownModal.calls.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  No call logs found for this selection.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                        <th style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>Time & Date</th>
                        <th style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>Direction</th>
                        <th style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>Contact</th>
                        <th style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>Type</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>Duration</th>
                        <th style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>Disposition</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>Audit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillDownModal.calls.map(call => (
                        <tr key={call.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                            {call.date} {call.time}
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: call.direction === 'Inbound' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                              color: call.direction === 'Inbound' ? 'var(--success)' : 'var(--primary)'
                            }}>
                              {call.direction}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                            <CRMContactLink phone={call.externalNumber} defaultName={call.targetName} />
                          </td>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: call.targetType === 'Candidate' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              color: call.targetType === 'Candidate' ? 'var(--purple)' : 'var(--warning)'
                            }}>
                              {call.targetType}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600 }}>
                            {formatDuration(call.duration)}
                          </td>
                          <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>
                            {call.disposition || <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>None</span>}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                // Open the detail modal directly
                                setActiveCallDetail(call);
                              }}
                              className="btn-secondary"
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              🎥 Listen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Found {drillDownModal.calls.length} relevant calls
              </span>
              <button
                onClick={() => setDrillDownModal(null)}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
