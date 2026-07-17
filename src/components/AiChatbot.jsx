import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useBoundStore } from '../store/useBoundStore';
import { FX_RATES } from '../utils/currency';
import { Sparkles, MessageSquare, X, Send, Bot, User, CornerDownLeft, Info, HelpCircle } from 'lucide-react';

export default function AiChatbot() {
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

  const messagesEndRef = useRef(null);

  // Retrieve store states for context aggregation
  const staff = useBoundStore(state => state.staff);
  const companies = useBoundStore(state => state.companies);
  const leaveRequests = useBoundStore(state => state.leaveRequests);
  const placements = useBoundStore(state => state.placements);
  const contracts = useBoundStore(state => state.contracts || []);
  const expenses = useBoundStore(state => state.expenses || []);

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

  // Aggregate current business context
  const getContextSummary = () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Active Staff
    const staffSummary = staff.map(s => ({
      name: s.fullName,
      role: s.jobTitle,
      dept: s.department,
      company: companies.find(c => c.id === s.companyId)?.name || 'Unknown',
      currency: s.currency || 'GBP'
    }));

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

    return {
      currentDate: todayStr,
      activeLeavesToday: activeLeaves,
      outstandingInvoices: outstandingInvoices,
      contracts: contractSummary,
      unreconciledExpenses: unreconciledExpenses,
      staff: staffSummary
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

  // Helper to convert simple Markdown bold and bullets to HTML safely
  const formatMsgText = (text) => {
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.2); padding: 2px 4px; borderRadius: 4px;">$1</code>')
      .replace(/\n/g, '<br/>');

    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
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
