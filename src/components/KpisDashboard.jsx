import React, { useState, useMemo } from 'react';
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

  // Generate deterministic Mock KPI Data mapped directly to real staff directory
  const mockKpiData = useMemo(() => {
    const map = {};
    const seedRandom = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash);
    };

    staff.forEach(s => {
      const seed = seedRandom(s.id + timeRange);
      
      // Scale metrics depending on time range selection
      let multiplier = 1.0;
      if (timeRange === 'today') multiplier = 0.05;
      else if (timeRange === 'this_week') multiplier = 0.25;
      else if (timeRange === 'ytd') multiplier = 7.0;
      
      const inbound = Math.round(((seed % 15) + 5) * multiplier);
      const outbound = Math.round(((seed % 25) + 10) * multiplier);
      const totalCalls = inbound + outbound;
      
      // Average 3.5 mins talk time per call
      const totalTalkTime = totalCalls * Math.round(((seed % 100) + 120) * multiplier);
      
      // Calls over 5 mins
      const callsOver5Min = Math.round(totalCalls * (0.15 + (seed % 15) / 100));
      const callsOver10Min = Math.round(callsOver5Min * 0.3);

      // CRM activities
      const cvsSent = Math.round(((seed % 12) + 2) * multiplier);
      const interviews = Math.round(((seed % 6) + 1) * multiplier);
      const jobsTaken = Math.round(((seed % 4) + 1) * multiplier);

      map[s.id] = {
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
    });
    return map;
  }, [staff, timeRange]);

  // Generate Mock individual calls database for the Call Detail Logs
  const mockCallsList = useMemo(() => {
    const list = [];
    const companiesList = ['Microsoft', 'Google', 'Recruitly', 'BP Energy', 'HSBC Bank', 'Deloitte', 'Dialpad Corp', 'Vodafone', 'Shell', 'Strata Civils'];
    const candidatesList = ['Emile Brand', 'Alex Herzenberg', 'Gabriella Maartens', 'Wendy Campbell', 'Matthew Sparks', 'Toni Tree', 'Ryan Mc Dougall', 'Sean Owen'];

    filteredStaffList.forEach(s => {
      const kpis = mockKpiData[s.id] || { totalCalls: 5 };
      const callCount = Math.min(10, kpis.totalCalls);

      for (let i = 0; i < callCount; i++) {
        const timeSeed = (s.id.charCodeAt(0) * (i + 1) * 31) % 60;
        const durSeed = (s.id.charCodeAt(1) * (i + 2) * 17) % 800 + 60; // 60s - 860s
        const direction = i % 3 === 0 ? 'Inbound' : 'Outbound';
        
        const isClient = i % 2 === 0;
        const targetName = isClient 
          ? companiesList[(i + s.id.charCodeAt(2)) % companiesList.length]
          : candidatesList[(i + s.id.charCodeAt(3)) % candidatesList.length];

        list.push({
          id: `call-${s.id}-${i}`,
          staffId: s.id,
          staffName: s.fullName,
          department: s.department,
          direction,
          date: `2026-07-${String((29 - (i % 7))).padStart(2, '0')}`,
          time: `1${i % 4}:${String(timeSeed).padStart(2, '0')}:00`,
          targetName,
          targetType: isClient ? 'Client' : 'Candidate',
          duration: durSeed,
          hasRecording: durSeed > 120, // Calls over 2 mins get mock recordings
          transcript: `
            [00:05] ${s.fullName}: Hello, this is ${s.fullName} from Humres Technical. Am I speaking with ${targetName}?
            [00:12] ${targetName}: Yes, speaking. How can I help you?
            [00:19] ${s.fullName}: I am following up on the ${isClient ? 'Structural Civil Engineer contract vacancy' : 'CV submission for the Senior Estimator role'} we discussed yesterday.
            [00:35] ${targetName}: Ah yes, I reviewed the file. The experience looks very solid. I wanted to verify if they have the specific civil engineering site accreditation.
            [00:50] ${s.fullName}: Yes, they actually worked on the highway expansion scheme in Belfast where that certification was mandatory. They have full logs.
            [01:05] ${targetName}: Excellent. In that case, let's proceed to set up an interview for next Tuesday at 10:00 AM. Can you confirm the availability?
            [01:15] ${s.fullName}: I will confirm with them right now and send the calendar invite across shortly. Thank you for your time!
          `
        });
      }
    });

    // Sort by duration descending to showcase "Calls over 5 mins" and long calls first
    return list.sort((a, b) => b.duration - a.duration);
  }, [filteredStaffList, mockKpiData]);

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

  return (
    <div className="tab-pane active" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px' }}>
      
      {/* 1. TOP HEADER & PERFORMANCE ALERTS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Performance & Activity Scorecard</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>💡 {dashboardSubtitle}</span>
        </div>

        {/* Global Time Filter Controls */}
        <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'ytd', label: 'Year to Date' }
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
                fontWeight: 600
              }}
            >
              {btn.label}
            </button>
          ))}
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
      )}

      {/* 5. CALL RECORDINGS & TRANSCRIPT AUDIT LOGS TABLE */}
      <div className="card" style={{ padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Phone size={18} color="var(--primary)" />
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Dialpad Call detail logs & Recordings</h4>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🎥 Shows recordings for calls &gt; 2 mins</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '10px' }}>Time & Date</th>
                <th>Caller (Staff)</th>
                <th>Direction</th>
                <th>Recipient (Client / Candidate)</th>
                <th>Duration</th>
                <th style={{ textAlign: 'center' }}>Recording</th>
                <th style={{ textAlign: 'center' }}>Transcript</th>
              </tr>
            </thead>
            <tbody>
              {mockCallsList
                .filter(call => {
                  if (selectedStaffId !== 'all' && call.staffId !== selectedStaffId) return false;
                  return true;
                })
                .slice(0, 8) // Limit to top 8 calls for clean UI
                .map(call => (
                  <tr key={call.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 10px', fontSize: '12px' }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{call.date}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{call.time}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{call.staffName}</td>
                    <td>
                      <span style={{ 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '10px', 
                        fontWeight: 700,
                        backgroundColor: call.direction === 'Inbound' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: call.direction === 'Inbound' ? 'var(--success)' : 'var(--primary)'
                      }}>
                        {call.direction === 'Inbound' ? '⬇️ Inbound' : '⬆️ Outbound'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{call.targetName}</span>
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{call.targetType}</span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{formatDuration(call.duration)}</td>
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
                ))}
            </tbody>
          </table>
        </div>
      </div>

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
              
              {/* Audio Playback Controls (Mock Player) */}
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
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="btn-primary"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 0
                      }}
                    >
                      {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>

                    {/* Progress slider bar */}
                    <div style={{ flex: 1 }}>
                      <div style={{ height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', position: 'relative' }}>
                        <div style={{ width: `${playProgress}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '2px' }}></div>
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--primary)',
                          position: 'absolute',
                          top: '-3px',
                          left: `calc(${playProgress}% - 5px)`
                        }}></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <span>0:42</span>
                        <span>{formatDuration(activeCallDetail.duration)}</span>
                      </div>
                    </div>
                  </div>
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
                  {activeCallDetail.transcript.trim()}
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
