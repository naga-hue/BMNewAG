import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useBoundStore } from '../store/useBoundStore';
import { FX_RATES, toGBP } from '../utils/currency';
import { Sparkles, MessageSquare, X, Send, Bot, User, CornerDownLeft, Info, HelpCircle, Mic, MicOff } from 'lucide-react';

export default function AiChatbot({ assetAssignments = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your **Humres AI Companion**. As a Super Admin, you can query me about any module details (e.g. active leaves today, outstanding client payments, follow-up chase notes, nominal expenses, or contract statuses).'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const startingTextRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event) => {
        let sessionTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          sessionTranscript += event.results[i][0].transcript;
        }
        if (sessionTranscript) {
          const start = startingTextRef.current || '';
          const separator = start.trim() ? ' ' : '';
          setInputValue(start + separator + sessionTranscript);
        }
      };

      rec.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          setMessages(prev => [
            ...prev,
            {
              id: 'voice-err-' + Date.now(),
              role: 'assistant',
              content: '⚠️ **Microphone access denied.** Please allow microphone permissions in your browser settings to use voice commands.'
            }
          ]);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const handleToggleListening = () => {
    if (!recognitionRef.current) {
      setMessages(prev => [
        ...prev,
        {
          id: 'voice-unsupported-' + Date.now(),
          role: 'assistant',
          content: '⚠️ **Voice commands unsupported.** Your current browser does not support the Web Speech API. Please try Chrome, Edge, or Safari.'
        }
      ]);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      startingTextRef.current = inputValue; // Save starting input box text
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Speech recognition start failed:", err);
      }
    }
  };

  // Retrieve store states for context aggregation
  const staff = useBoundStore(state => state.staff);
  const companies = useBoundStore(state => state.companies);
  const leaveRequests = useBoundStore(state => state.leaveRequests);
  const placements = useBoundStore(state => state.placements);
  const contracts = useBoundStore(state => state.contracts || []);
  const expenses = useBoundStore(state => state.expenses || []);
  const leavePolicies = useBoundStore(state => state.leavePolicies || []);
  const holidays = useBoundStore(state => state.holidays || []);
  const vendors = useBoundStore(state => state.vendors || []);
  const nominalCodes = useBoundStore(state => state.nominalCodes || []);
  const payrollRecords = useBoundStore(state => state.payrollRecords || []);
  const payrollPolicies = useBoundStore(state => state.payrollPolicies || []);
  const reimbursementClaims = useBoundStore(state => state.reimbursementClaims || []);

  // Quick suggestions list
  const suggestions = [
    "Who is on leave today?",
    "Show outstanding payments",
    "Which contracts are outstanding?",
    "Show unreconciled expenses"
  ];

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Helper to pre-calculate direct/indirect expenses allocated to a specific staff member
  const getStaffExpensesBreakdown = (member) => {
    let directTotal = 0;
    let indirectTotal = 0;
    const transactions = [];

    // Filter active staff for apportionment sharing
    const activeStaff = staff.filter(s => s.status !== 'exited');

    expenses.forEach(exp => {
      const gbpAmt = toGBP(exp.amount, exp.currency);
      const targets = (Array.isArray(exp.allocationTarget) ? exp.allocationTarget : [exp.allocationTarget].filter(Boolean));

      if (exp.allocationType === 'staff') {
        if (targets.includes(member.id)) {
          const share = gbpAmt / (targets.length || 1);
          directTotal += share;
          transactions.push({
            date: exp.date,
            payee: exp.payee,
            type: 'Direct Staff Split',
            nominalCode: exp.nominalCode || 'Unassigned',
            shareAmount: Number(share.toFixed(2))
          });
        }
      } else if (exp.allocationType === 'company') {
        if (targets.includes(member.companyId)) {
          const eligibleStaff = activeStaff.filter(s => targets.includes(s.companyId));
          const share = gbpAmt / (eligibleStaff.length || 1);
          indirectTotal += share;
          transactions.push({
            date: exp.date,
            payee: exp.payee,
            type: 'Company Apportionment',
            nominalCode: exp.nominalCode || 'Unassigned',
            shareAmount: Number(share.toFixed(2))
          });
        }
      } else if (exp.allocationType === 'department') {
        if (member.department && targets.includes(member.department)) {
          const eligibleStaff = activeStaff.filter(s => s.department && targets.includes(s.department));
          const share = gbpAmt / (eligibleStaff.length || 1);
          indirectTotal += share;
          transactions.push({
            date: exp.date,
            payee: exp.payee,
            type: 'Department Apportionment',
            nominalCode: exp.nominalCode || 'Unassigned',
            shareAmount: Number(share.toFixed(2))
          });
        }
      } else {
        // Group-wide / Default
        const share = gbpAmt / (activeStaff.length || 1);
        indirectTotal += share;
        transactions.push({
          date: exp.date,
          payee: exp.payee,
          type: 'Group-wide Allocation',
          nominalCode: exp.nominalCode || 'Unassigned',
          shareAmount: Number(share.toFixed(2))
        });
      }
    });

    return {
      directExpenses: Number(directTotal.toFixed(2)),
      indirectExpenses: Number(indirectTotal.toFixed(2)),
      totalExpenses: Number((directTotal + indirectTotal).toFixed(2)),
      transactions
    };
  };

  // Helper to pre-calculate placement revenue and splits for a specific staff member
  const getStaffRevenueSummary = (member) => {
    let totalNet = 0;
    let totalGross = 0;
    const list = [];

    placements.forEach(p => {
      if (p.status === 'dns') return; // Skip DNS/Rebates items

      let splitPercentage = 0;
      let hasInvolvement = false;

      if (p.splits && p.splits.length > 0) {
        const splitObj = p.splits.find(sp => sp.staffId === member.id || (sp.name && sp.name.toLowerCase() === member.fullName.toLowerCase()));
        if (splitObj) {
          splitPercentage = splitObj.percentage || 100;
          hasInvolvement = true;
        }
      } else {
        if (p.recruiterId === member.id || (p.recruiterName && p.recruiterName.toLowerCase() === member.fullName.toLowerCase())) {
          splitPercentage = 100;
          hasInvolvement = true;
        }
      }

      if (hasInvolvement) {
        const netVal = p.netScoreValue || 0;
        const grossVal = p.grossBillAmount || 0;
        const netShare = (netVal * splitPercentage) / 100;
        const grossShare = (grossVal * splitPercentage) / 100;

        totalNet += netShare;
        totalGross += grossShare;

        list.push({
          client: p.clientCompany,
          candidate: p.candidateName,
          totalPlacementNetScore: netVal,
          splitPercentage: splitPercentage,
          yourShareNetScore: Number(netShare.toFixed(2)),
          status: p.clientPaymentStatus || p.paymentStatus || 'not-invoiced',
          startDate: p.startDate || ''
        });
      }
    });

    return {
      revenueNet: Number(totalNet.toFixed(2)),
      revenueGross: Number(totalGross.toFixed(2)),
      placementsList: list
    };
  };

  // Helper to retrieve all vendor seat license and hardware asset assignments for a staff member
  const getStaffLicenses = (member) => {
    return assetAssignments
      .filter(a => a.staffId === member.id)
      .map(a => {
        const contract = contracts.find(c => c.id === a.contractId);
        return {
          licenseName: contract?.name || a.assetName || a.name || 'Unknown License/Asset',
          emailAlias: a.emailAlias || '',
          notes: a.notes || '',
          dateAssigned: a.dateAssigned || ''
        };
      });
  };

  // Aggregate current business context
  const getContextSummary = () => {
    const todayStr = new Date().toISOString().split('T')[0];

    const resolveAnnualAllowance = (member, pol) => {
      if (!pol) return 20;
      if (pol.name.toLowerCase().includes('global recruiters')) {
        if (!member.startDate) return 20;
        const start = new Date(member.startDate);
        if (isNaN(start.getTime())) return 20;

        const today = new Date();
        let years = today.getFullYear() - start.getFullYear();
        const m = today.getMonth() - start.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < start.getDate())) {
          years--;
        }
        const calculated = 20 + Math.max(0, years);
        return Math.min(25, calculated);
      }
      return pol.annualAllowance || 20;
    };

    // 1. Active Staff
    const staffSummary = staff.map(s => {
      const expensesBreakdown = getStaffExpensesBreakdown(s);
      const revenueBreakdown = getStaffRevenueSummary(s);
      
      const policy = leavePolicies.find(p => p.id === s.leavePolicyId);
      const approvedLeaves = leaveRequests.filter(r => r.staffId === s.id && r.status === 'approved');
      
      const annualAllowed = resolveAnnualAllowance(s, policy);
      const annualTaken = approvedLeaves.filter(r => r.leaveType === 'annual').reduce((sum, r) => sum + r.totalDays, 0);
      const annualRemaining = Math.max(0, annualAllowed - annualTaken);

      const sickAllowed = policy ? policy.sickAllowance : 10;
      const sickTaken = approvedLeaves.filter(r => r.leaveType === 'sick').reduce((sum, r) => sum + r.totalDays, 0);
      const sickRemaining = Math.max(0, sickAllowed - sickTaken);

      return {
        name: s.fullName,
        role: s.jobTitle || 'Team Member',
        dept: s.department,
        company: companies.find(c => c.id === s.companyId)?.name || 'Unknown',
        currency: s.currency || 'GBP',
        salary: s.salary || 0,
        salaryType: s.salaryType || 'salaried',
        startDate: s.startDate || '',
        dateOfBirth: s.dateOfBirth || '',
        directExpenses: expensesBreakdown.directExpenses,
        indirectExpenses: expensesBreakdown.indirectExpenses,
        totalExpenses: expensesBreakdown.totalExpenses,
        expensesTransactionsList: expensesBreakdown.transactions,
        revenueGeneratedNet: revenueBreakdown.revenueNet,
        revenueGeneratedGross: revenueBreakdown.revenueGross,
        placementsList: revenueBreakdown.placementsList,
        assignedLicenses: getStaffLicenses(s),
        leavePolicyName: policy ? policy.name : 'None',
        annualLeaveAllowed: annualAllowed,
        annualLeaveTaken: annualTaken,
        annualLeaveRemaining: annualRemaining,
        sickLeaveAllowed: sickAllowed,
        sickLeaveTaken: sickTaken,
        sickLeaveRemaining: sickRemaining,
        leaveRequestsHistory: approvedLeaves.map(r => ({ type: r.leaveType, start: r.startDate, end: r.endDate, days: r.totalDays }))
      };
    });

    // 2. Leaves Today
    const activeLeaves = leaveRequests
      .filter(req => req.status === 'approved' && req.startDate <= todayStr && req.endDate >= todayStr)
      .map(req => {
        const s = staff.find(member => member.id === req.staffId);
        return {
          employee: s?.fullName || 'Unknown',
          type: req.leaveType,
          start: req.startDate,
          end: req.endDate
        };
      });

    // 3. Outstanding Payments / Invoices from Placements
    const outstandingInvoices = placements
      .filter(p => p.status !== 'dns')
      .map(p => {
        const gross = Number(p.grossBillAmount) || 0;
        const vat = Number(p.vatAmount) || (gross * 0.20);
        const total = Number(p.totalInvoiceAmount) || (gross + vat);
        const paid = Number(p.amountPaid) || 0;
        const outstanding = Math.max(0, total - paid);
        
        const raisedDate = p.invoiceRaisedDate || p.startDate || todayStr;
        const termsDays = Number(p.paymentTermsDays) || 30;
        let dueDate = p.invoiceDueDate;
        if (!dueDate) {
          try {
            const d = new Date(raisedDate);
            d.setDate(d.getDate() + termsDays);
            dueDate = d.toISOString().split('T')[0];
          } catch(e) {}
        }

        let overdueDays = 0;
        if (dueDate && dueDate < todayStr && p.clientPaymentStatus !== 'paid' && outstanding > 0) {
          const diff = new Date(todayStr).getTime() - new Date(dueDate).getTime();
          overdueDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }

        return {
          invoiceNumber: p.invoiceNumber || 'N/A',
          client: p.clientCompany,
          candidate: p.candidateName,
          total: total,
          paid: paid,
          outstanding: outstanding,
          dueDate: dueDate || 'N/A',
          overdueDays: overdueDays,
          status: p.clientPaymentStatus || p.paymentStatus || 'pending',
          latestChaserNote: p.chaseHistory && p.chaseHistory.length > 0 
            ? p.chaseHistory[0].content 
            : 'No follow-up log recorded'
        };
      })
      .filter(inv => inv.outstanding > 0);

    // 4. Contracts
    const contractSummary = contracts.map((c) => ({
      candidate: c.candidateName,
      client: c.clientCompany,
      status: c.status || 'Pending Signature',
      startDate: c.startDate || 'N/A'
    }));

    // 5. Unreconciled Expenses
    const unreconciledExpenses = expenses
      .filter(e => !e.isReconciled)
      .map(e => ({
        date: e.date,
        payee: e.payee,
        amount: e.amount,
        currency: e.currency || 'GBP',
        nominalCode: e.nominalCode || 'Unassigned'
      }));

    // 6. Placements (Revenue, sales performance, and recruiter splits)
    const placementsSummary = placements.map(p => {
      let splitsInfo = [];
      if (p.splits && p.splits.length > 0) {
        splitsInfo = p.splits.map(sp => {
          const s = staff.find(member => member.id === sp.staffId);
          return {
            recruiterName: s?.fullName || sp.name || 'Unknown',
            percentage: sp.percentage || 100
          };
        });
      } else {
        const s = staff.find(member => member.id === p.recruiterId);
        splitsInfo = [{
          recruiterName: s?.fullName || p.recruiterName || 'Unknown',
          percentage: 100
        }];
      }

      return {
        client: p.clientCompany,
        candidate: p.candidateName,
        netScore: p.netScoreValue || 0,
        grossAmount: p.grossBillAmount || 0,
        status: p.clientPaymentStatus || p.paymentStatus || 'not-invoiced',
        startDate: p.startDate || '',
        splits: splitsInfo
      };
    });

    // 7. Companies Registry
    const companiesSummary = companies.map(c => ({
      name: c.name,
      country: c.country || 'UK',
      currency: c.currency || 'GBP',
      registrationNumber: c.registrationNumber || 'N/A',
      vatNumber: c.vatNumber || 'N/A',
      bankAccounts: (c.bankAccounts || []).map(acc => ({
        bankName: acc.bankName,
        accountName: acc.accountName,
        accountNumber: acc.accountNumber,
        sortCode: acc.sortCode,
        balance: acc.balance,
        currency: acc.currency
      }))
    }));

    // 8. Vendors & SaaS Assets
    const vendorsSummary = vendors.map(v => ({
      name: v.name,
      category: v.category || 'SaaS',
      unitCost: v.unitCost || 0,
      totalUnits: v.totalUnits || 0,
      monthlyCost: v.monthlyCost || 0
    }));

    // 9. Nominal Codes
    const nominalsSummary = nominalCodes.map(nc => ({
      code: nc.code,
      name: nc.name,
      type: nc.type || 'direct'
    }));

    // 10. Public Holidays
    const holidaysSummary = holidays.map(h => ({
      name: h.name,
      date: h.date,
      companyId: h.companyId
    }));

    return {
      currentDate: todayStr,
      activeLeavesToday: activeLeaves,
      outstandingInvoices: outstandingInvoices,
      contracts: contractSummary,
      unreconciledExpenses: unreconciledExpenses,
      staff: staffSummary,
      placements: placementsSummary,
      companies: companiesSummary,
      leavePolicies: leavePolicies,
      holidays: holidaysSummary,
      nominalCodes: nominalsSummary,
      vendors: vendorsSummary,
      payrollRecords: payrollRecords,
      payrollPolicies: payrollPolicies,
      reimbursementClaims: reimbursementClaims
    };
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() || loading) return;

    const userMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const systemContext = getContextSummary();

      // Build context history slice
      const history = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text.trim(),
          systemContext: systemContext,
          history: history
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Server error');
      }

      setMessages(prev => [
        ...prev,
        {
          id: 'msg-reply-' + Date.now(),
          role: 'assistant',
          content: resData.response || 'No reply generated.'
        }
      ]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: 'msg-error-' + Date.now(),
          role: 'assistant',
          content: `⚠️ **Error connecting to AI Companion:** ${err.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to convert Markdown (Headers, bullet lists, bold, italics, tables) into structured React elements
  const formatMsgText = (text) => {
    if (!text) return '';

    const lines = text.split('\n');
    const elements = [];
    let inTable = false;
    let tableRows = [];
    let inList = false;
    let listItems = [];

    const flushTable = () => {
      if (tableRows.length > 0) {
        // Parse rows by splitting on |
        const parsedRows = tableRows
          .map(r => r.split('|').map(cell => cell.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1))
          .filter(r => !r.every(cell => /^[-:\s]+$/.test(cell))); // Skip separating lines like |---|---|

        if (parsedRows.length > 0) {
          const header = parsedRows[0];
          const body = parsedRows.slice(1);
          
          elements.push(
            <div key={`table-${elements.length}`} style={{ overflowX: 'auto', margin: '10px 0', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid var(--border-color)', minWidth: '320px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', borderBottom: '2px solid var(--border-color)' }}>
                    {header.map((cell, idx) => (
                      <th key={idx} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                        {parseInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, rowIdx) => (
                    <tr key={rowIdx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.03)' }}>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} style={{ padding: '6px 8px', borderRight: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        tableRows = [];
      }
      inTable = false;
    };

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} style={{ margin: '8px 0', paddingLeft: '20px', listStyleType: 'disc', color: 'inherit' }}>
            {listItems.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '4px', color: 'inherit' }}>
                {parseInline(item)}
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
      inList = false;
    };

    // Helper to format inline bold, italics, code
    const parseInline = (str) => {
      let temp = str;
      temp = temp.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      temp = temp.replace(/\*(.*?)\*/g, '<em>$1</em>');
      temp = temp.replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.15); padding: 2px 4px; borderRadius: 4px; font-family: monospace;">$1</code>');
      return <span dangerouslySetInnerHTML={{ __html: temp }} />;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Table Row Check
      if (line.startsWith('|') && line.endsWith('|')) {
        if (inList) flushList();
        inTable = true;
        tableRows.push(line);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // List Item Check
      if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        if (inTable) flushTable();
        inList = true;
        listItems.push(line.substring(2));
        continue;
      } else if (inList) {
        flushList();
      }

      // Headers
      if (line.startsWith('### ')) {
        elements.push(<h4 key={i} style={{ fontSize: '13px', fontWeight: 700, margin: '14px 0 6px 0', color: 'var(--primary-light)' }}>{parseInline(line.substring(4))}</h4>);
      } else if (line.startsWith('## ')) {
        elements.push(<h3 key={i} style={{ fontSize: '14px', fontWeight: 700, margin: '16px 0 8px 0', color: 'var(--primary-light)' }}>{parseInline(line.substring(3))}</h3>);
      } else if (line.startsWith('# ')) {
        elements.push(<h2 key={i} style={{ fontSize: '15px', fontWeight: 800, margin: '18px 0 10px 0', color: 'var(--primary-light)' }}>{parseInline(line.substring(2))}</h2>);
      } else if (line !== '') {
        elements.push(<p key={i} style={{ margin: '6px 0', lineHeight: 1.4 }}>{parseInline(line)}</p>);
      }
    }

    if (inTable) flushTable();
    if (inList) flushList();

    return elements;
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
          color: 'white',
          border: 'none',
          boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'rotate(90deg) scale(0.95)' : 'scale(1)'
        }}
        title="Open AI Companion"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }} />}
        {!isOpen && (
          <div style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#fbbf24',
            border: '2px solid var(--bg-primary)',
            boxShadow: '0 0 8px #fbbf24'
          }} />
        )}
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '24px',
            width: '380px',
            height: '520px',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 9998,
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bot size={20} style={{ color: '#fbbf24' }} />
              </div>
              <div>
                <h4 style={{ fontSize: '13px', margin: 0, fontWeight: 700, letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Humres AI Companion <Sparkles size={12} style={{ color: '#fbbf24' }} />
                </h4>
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 500 }}>Super Admin Console</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Panel */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: 'var(--bg-secondary)',
              scrollbarWidth: 'thin'
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                {/* Avatar Icon */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-card)',
                  border: `1px solid ${msg.role === 'user' ? 'transparent' : 'var(--border-color)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {msg.role === 'user' ? (
                    <User size={14} style={{ color: 'white' }} />
                  ) : (
                    <Bot size={14} style={{ color: '#fbbf24' }} />
                  )}
                </div>

                {/* Text Bubble */}
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-card)',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                  }}
                >
                  {formatMsgText(msg.content)}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Bot size={14} style={{ color: '#fbbf24' }} />
                </div>
                <div style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  display: 'flex',
                  gap: '4px',
                  alignItems: 'center'
                }}>
                  <span className="dot-blink" style={{ width: '6px', height: '6px', backgroundColor: 'var(--text-muted)', borderRadius: '50%' }}></span>
                  <span className="dot-blink" style={{ width: '6px', height: '6px', backgroundColor: 'var(--text-muted)', borderRadius: '50%', animationDelay: '0.2s' }}></span>
                  <span className="dot-blink" style={{ width: '6px', height: '6px', backgroundColor: 'var(--text-muted)', borderRadius: '50%', animationDelay: '0.4s' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Footer */}
          {messages.length === 1 && (
            <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <HelpCircle size={10} /> Quick Queries
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(sug)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.color = 'var(--primary)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--bg-card)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}
          >
            <input
              type="text"
              placeholder="Ask me anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={loading}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '12px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
            <style>{`
              @keyframes pulseMic {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.8; }
                100% { transform: scale(1); opacity: 1; }
              }
            `}</style>
            <button
              type="button"
              onClick={handleToggleListening}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: isListening ? '#ef4444' : 'var(--bg-secondary)',
                color: isListening ? '#ffffff' : 'var(--text-secondary)',
                border: isListening ? 'none' : '1px solid var(--border-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: isListening ? 'pulseMic 1.5s infinite' : 'none'
              }}
              title={isListening ? "Listening... Click to stop" : "Start voice input"}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (loading || !inputValue.trim()) ? 0.6 : 1
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
