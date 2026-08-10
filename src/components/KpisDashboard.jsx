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
  Filter
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

export default function KpisDashboard({ staff, companies, currentUser, onShowToast }) {
  // Firestore data states
  const [kpiDocs, setKpiDocs] = useState([]);
  const [liveCalls, setLiveCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);
  const [hasRealCalls, setHasRealCalls] = useState(false);

  // Dashboard view states
  const [activeSubTab, setActiveSubTab] = useState('performance'); // 'performance' | 'calls' | 'mapping'

  // Call Logs time filtering states
  const [callsTimeRange, setCallsTimeRange] = useState('today'); // today, yesterday, this_week, this_month, custom
  const [callsCustomStartDate, setCallsCustomStartDate] = useState('');
  const [callsCustomEndDate, setCallsCustomEndDate] = useState('');

  // Call Logs search & pagination states
  const [callLogsSearch, setCallLogsSearch] = useState('');
  const [callLogsDirection, setCallLogsDirection] = useState('all'); // 'all' | 'inbound' | 'outbound'
  const [callLogsPage, setCallLogsPage] = useState(1);
  const callLogsPageSize = 10;

  // Recruiter Mapping edit states
  const [mappingSearch, setMappingSearch] = useState('');
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingAliases, setEditingAliases] = useState('');

  // Action to save recruiter matching aliases to Firestore via Zustand store
  const handleSaveAliases = async (staffId) => {
    try {
      const staffMember = staff.find(s => s.id === staffId);
      if (!staffMember) return;

      const updated = {
        ...staffMember,
        additionalEmails: editingAliases.trim()
      };

      await useBoundStore.getState().updateStaff(updated);
      onShowToast?.(`Matching aliases updated for ${staffMember.fullName}`, 'success');
      setEditingStaffId(null);
    } catch (e) {
      console.error('Error updating matching aliases:', e);
      onShowToast?.('Failed to update matching aliases', 'error');
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
            transcript: data.transcript || activeCallDetail.transcript
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

  // List of staff filtered by selected department (if not recruiter)
  const filteredStaffList = useMemo(() => {
    if (userRole === 'recruiter') {
      return staff.filter(s => s.id === currentUser.id);
    }
    let list = staff;
    if (userRole === 'manager') {
      list = staff.filter(s => s.department === userDept);
    } else if (selectedDept !== 'all') {
      list = staff.filter(s => s.department === selectedDept);
    }
    return list;
  }, [staff, selectedDept, userRole, userDept, currentUser.id]);

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
  }, [dateRangeWindow]);

  // Load Dialpad calls dynamically with real-time updates when callsDateRangeWindow changes (for the dedicated Dialpad Calls Tab)
  useEffect(() => {
    let unsubscribe = () => {};
    
    function setupCallsListener() {
      setIsLoadingCalls(true);
      const { start, end } = callsDateRangeWindow;
      
      const callsQuery = query(
        collection(db, 'dialpad_calls'),
        where('dateStarted', '>=', start),
        where('dateStarted', '<=', end + 'T23:59:59Z'),
        orderBy('dateStarted', 'desc'),
        limit(500)
      );

      unsubscribe = onSnapshot(callsQuery, (snapshot) => {
        const callsList = [];
        snapshot.forEach(doc => {
          callsList.push({ id: doc.id, ...doc.data() });
        });
        setLiveCalls(callsList);
        setIsLoadingCalls(false);
      }, (error) => {
        console.error('Error loading Dialpad calls in real-time:', error);
        
        // Fallback: if index is missing, query without orderBy
        try {
          const callsQueryFallback = query(
            collection(db, 'dialpad_calls'),
            where('dateStarted', '>=', start),
            where('dateStarted', '<=', end + 'T23:59:59Z'),
            limit(500)
          );
          
          // Re-subscribe with fallback query
          unsubscribe();
          unsubscribe = onSnapshot(callsQueryFallback, (fallbackSnapshot) => {
            const callsList = [];
            fallbackSnapshot.forEach(doc => {
              callsList.push({ id: doc.id, ...doc.data() });
            });
            // Sort client-side
            callsList.sort((a, b) => b.dateStarted.localeCompare(a.dateStarted));
            setLiveCalls(callsList);
            setIsLoadingCalls(false);
          }, (fallbackError) => {
            console.error('Fallback real-time listener failed:', fallbackError);
            onShowToast?.('Failed to listen to live call logs', 'error');
            setIsLoadingCalls(false);
          });
        } catch (errFallback) {
          console.error('Fallback subscription setup failed:', errFallback);
          setIsLoadingCalls(false);
        }
      });
    }

    setupCallsListener();

    return () => {
      unsubscribe();
    };
  }, [callsDateRangeWindow, onShowToast]);

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

  // Generate Call logs detail rows based on real kpiDocs logs
  const mockCallsList = useMemo(() => {
    const list = [];
    const companiesList = ['Microsoft', 'Google', 'Recruitly', 'BP Energy', 'HSBC Bank', 'Deloitte', 'Dialpad Corp', 'Vodafone', 'Shell', 'Strata Civils'];
    const candidatesList = ['Emile Brand', 'Alex Herzenberg', 'Gabriella Maartens', 'Wendy Campbell', 'Matthew Sparks', 'Toni Tree', 'Ryan Mc Dougall', 'Sean Owen'];

    const { start, end } = dateRangeWindow;

    kpiDocs.forEach(doc => {
      if (doc.date >= start && doc.date <= end) {
        const staffMember = staff.find(s => s.id === doc.staffId);
        if (!staffMember) return;

        // Apply filters
        if (selectedStaffId !== 'all' && doc.staffId !== selectedStaffId) return;
        if (selectedDept !== 'all' && staffMember.department !== selectedDept) return;

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
  }, [kpiDocs, dateRangeWindow, staff, selectedStaffId, selectedDept]);

  // Format the raw live calls from the webhook database
  const formattedLiveCalls = useMemo(() => {
    const { start, end } = callsDateRangeWindow;

    return liveCalls
      .map(call => {
        let dateVal = '';
        let timeVal = '';
        if (call.dateStarted) {
          let dateObj = null;
          if (typeof call.dateStarted === 'string') {
            if (call.dateStarted.includes('-') && call.dateStarted.length >= 10) {
              dateVal = call.dateStarted.substring(0, 10);
              timeVal = call.dateStarted.substring(11, 19);
            } else {
              dateObj = new Date(call.dateStarted);
            }
          } else if (typeof call.dateStarted === 'number') {
            const ms = call.dateStarted < 9999999999 ? call.dateStarted * 1000 : call.dateStarted;
            dateObj = new Date(ms);
          } else if (call.dateStarted.seconds) {
            dateObj = new Date(call.dateStarted.seconds * 1000);
          } else if (call.dateStarted instanceof Date) {
            dateObj = call.dateStarted;
          }

          if (dateObj && !isNaN(dateObj.getTime())) {
            dateVal = dateObj.toISOString().substring(0, 10);
            timeVal = dateObj.toISOString().substring(11, 19);
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
          transcript: call.transcript || 'No transcript generated yet.'
        };
      })
      .filter(call => {
        if (!call.staffId) return false; // Filter out system/routing/unmapped call legs
        if (call.date && (call.date < start || call.date > end)) return false;
        if (selectedStaffId !== 'all' && call.staffId !== selectedStaffId) return false;
        if (selectedDept !== 'all' && call.department !== selectedDept) return false;
        return true;
      });
  }, [liveCalls, callsDateRangeWindow, selectedStaffId, selectedDept]);

  const displayCallsList = useMemo(() => {
    if (hasRealCalls) {
      return formattedLiveCalls;
    }
    return mockCallsList;
  }, [hasRealCalls, formattedLiveCalls, mockCallsList]);

  // Filter and search call logs list based on user search and direction controls
  const filteredAndSearchedCalls = useMemo(() => {
    const list = displayCallsList;
    const query = callLogsSearch.toLowerCase().trim();

    return list.filter(call => {
      // 1. Direction Filter
      if (callLogsDirection !== 'all' && call.direction.toLowerCase() !== callLogsDirection) return false;

      // 2. Text Search Query Filter
      if (query) {
        const callerMatch = (call.staffName || '').toLowerCase().includes(query);
        const recipientMatch = (call.targetName || '').toLowerCase().includes(query);
        const numberMatch = (call.externalNumber || '').toLowerCase().includes(query);
        if (!callerMatch && !recipientMatch && !numberMatch) return false;
      }
      return true;
    });
  }, [displayCallsList, callLogsSearch, callLogsDirection]);

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
          🔗 Recruiter Dialpad Mapping
        </button>
      </div>

      {activeSubTab === 'performance' ? (
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

      {/* 2. DIRECTORY FILTERS PANEL (WITH ROLE-BASED ACCESS CONTROL) */}
      <div className="card" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
        <div className="card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={18} color="var(--primary)" />
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Recruiter Activity Leaderboard</h4>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sorted by Total Dialer Calls</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '10px' }}>Recruiter</th>
                  <th>Division</th>
                  <th style={{ textAlign: 'center' }}>Total Calls</th>
                  <th style={{ textAlign: 'center' }}>Talk Time</th>
                  <th style={{ textAlign: 'center' }}>Calls &gt; 5m</th>
                  <th style={{ textAlign: 'center' }}>CVs Sent</th>
                  <th style={{ textAlign: 'center' }}>Interviews</th>
                  <th style={{ textAlign: 'center' }}>New Jobs Taken</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaffList
                  .map(s => ({
                    staff: s,
                    kpi: mockKpiData[s.id] || { totalCalls: 0, totalTalkTime: 0, callsOver5Min: 0, cvsSent: 0, interviews: 0, jobsTaken: 0 }
                  }))
                  .sort((a, b) => b.kpi.totalCalls - a.kpi.totalCalls)
                  .map(({ staff: s, kpi }) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>👤 {s.fullName}</td>
                      <td>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontSize: '11px', fontWeight: 600 }}>
                          {s.department}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{kpi.totalCalls}</td>
                      <td style={{ textAlign: 'center' }}>{formatDuration(kpi.totalTalkTime)}</td>
                      <td style={{ textAlign: 'center', color: kpi.callsOver5Min > 5 ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {kpi.callsOver5Min}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{kpi.cvsSent}</td>
                      <td style={{ textAlign: 'center' }}>{kpi.interviews}</td>
                      <td style={{ textAlign: 'center' }}>{kpi.jobsTaken}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}      </>
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
                <div style={{ overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                        <th style={{ padding: '10px' }}>Time & Date</th>
                        <th>Recruiter</th>
                        <th>Direction</th>
                        <th>Party Name / Number</th>
                        <th>Party Type</th>
                        <th style={{ textAlign: 'center' }}>Duration</th>
                        <th style={{ textAlign: 'center' }}>Recording</th>
                        <th style={{ textAlign: 'center' }}>Transcript</th>
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
                            <td style={{ fontSize: '12px', fontWeight: 600 }}>📞 {call.targetName}</td>
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
      ) : (
        /* Recruiter Dialpad Mapping View */
        <div className="card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Recruiter Dialpad Integration Map</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Configure matching email addresses for each recruiter. Webhook calls and activities are mapped automatically by matching Dialpad email addresses to these aliases.
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
                  <th style={{ padding: '10px' }}>Recruiter</th>
                  <th>Primary Email</th>
                  <th>Dialpad Match Aliases</th>
                  <th style={{ textAlign: 'center' }}>Integration Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff
                  .filter(s => {
                    if (mappingSearch) {
                      return s.fullName.toLowerCase().includes(mappingSearch.toLowerCase());
                    }
                    return true;
                  })
                  .map(s => {
                    const aliases = (s.additionalEmails || '').split(',').map(e => e.trim()).filter(Boolean);
                    const isMapped = !!s.businessEmail || aliases.length > 0;
                    const isEditing = editingStaffId === s.id;

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{ fontWeight: 600, display: 'block' }}>👤 {s.fullName}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.department || 'No department'}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.businessEmail || s.personalEmail || '-'}</span>
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              className="form-input"
                              value={editingAliases}
                              onChange={(e) => setEditingAliases(e.target.value)}
                              placeholder="e.g. a.moore@humres.co.uk, amoore@stratass.com"
                              style={{ width: '100%', fontSize: '12px', height: '32px' }}
                            />
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {aliases.length > 0 ? (
                                aliases.map((alias, idx) => (
                                  <span key={idx} style={{
                                    padding: '2px 6px',
                                    borderRadius: '12px',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    color: 'var(--primary)',
                                    fontSize: '11px',
                                    fontWeight: 600
                                  }}>
                                    {alias}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--warning)', fontStyle: 'italic' }}>
                                  ⚠️ No additional matching aliases set
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            backgroundColor: isMapped ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: isMapped ? 'var(--success)' : 'var(--warning)'
                          }}>
                            {isMapped ? 'Mapped' : 'Unmapped'}
                          </span>
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
                              }}
                              className="btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                            >
                              ⚙️ Edit Aliases
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
      )}

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
                  📞 Call Logs Audit: {activeCallDetail.staffName} ↔ {activeCallDetail.targetName}
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

    </div>
  );
}
