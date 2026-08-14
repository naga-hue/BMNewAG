import React, { useState, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, writeBatch, doc, increment } from 'firebase/firestore';
import { Upload, CheckCircle2, AlertTriangle, Play, Loader2, Info } from 'lucide-react';

export default function CRMImporterTab({ onShowToast, staff = [], companies = [] }) {
  const [csvFile, setCsvFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [enrichCrmData, setEnrichCrmData] = useState(false);

  // Mappings
  const [mappings, setMappings] = useState({
    timestamp: '',
    recruiterKey: '', // Holds the header for recruiter identifier
    candidateName: '',
    candidateEmail: '',
    clientCompany: '',
    contactName: '',
    jobTitle: '',
    value: '',
    activityTypeColumn: '',
  });

  const [matchBy, setMatchBy] = useState('email'); // 'email' or 'name'
  const [activityTypeSource, setActivityTypeSource] = useState('single'); // 'single' or 'column'
  const [singleActivityType, setSingleActivityType] = useState('cv_sent');
  
  // Custom value mappings for columns
  const [mixedMappings, setMixedMappings] = useState({});
  const [uniqueActivityValues, setUniqueActivityValues] = useState([]);

  // Execution states
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState(null);
  const [enrichmentStatusText, setEnrichmentStatusText] = useState('');

  // Simple CSV quote-aware line splitter
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsParsing(true);
    setCsvFile(file);
    setImportSummary(null);
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result || '';
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        onShowToast?.('The selected CSV file is empty.', 'error');
        setIsParsing(false);
        return;
      }

      const parsedHeaders = parseCSVLine(lines[0]);
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length > 0) {
          const row = {};
          // Fill row with keys matched to header indices
          parsedHeaders.forEach((h, idx) => {
            row[h] = values[idx] || '';
          });
          rows.push(row);
        }
      }

      setHeaders(parsedHeaders);
      setParsedRows(rows);
      
      // Auto-match common header names
      const lowerHeaders = parsedHeaders.map(h => h.toLowerCase());
      const newMappings = {
        timestamp: parsedHeaders[lowerHeaders.findIndex(h => h.includes('date') || h.includes('time') || h.includes('created'))] || '',
        recruiterKey: parsedHeaders[lowerHeaders.findIndex(h => h.includes('recruiter') || h.includes('consultant') || h.includes('user') || h.includes('staff') || h.includes('owner'))] || '',
        candidateName: parsedHeaders[lowerHeaders.findIndex(h => h.includes('candidate') || h.includes('candidate name') || h.includes('person'))] || '',
        candidateEmail: parsedHeaders[lowerHeaders.findIndex(h => h.includes('email') || h.includes('candidate email'))] || '',
        clientCompany: parsedHeaders[lowerHeaders.findIndex(h => h.includes('client') || h.includes('company') || h.includes('employer') || h.includes('organisation'))] || '',
        contactName: parsedHeaders[lowerHeaders.findIndex(h => h.includes('contact') || h.includes('attention') || h.includes('contact name') || h.includes('client contact'))] || '',
        jobTitle: parsedHeaders[lowerHeaders.findIndex(h => h.includes('job') || h.includes('vacancy') || h.includes('role') || h.includes('opportunity'))] || '',
        value: parsedHeaders[lowerHeaders.findIndex(h => h.includes('value') || h.includes('net') || h.includes('salary') || h.includes('fee') || h.includes('amount'))] || '',
        activityTypeColumn: parsedHeaders[lowerHeaders.findIndex(h => h.includes('type') || h.includes('activity') || h.includes('event'))] || '',
      };
      setMappings(newMappings);
      setIsParsing(false);
      onShowToast?.(`Parsed ${rows.length} rows successfully!`, 'success');
    };
    reader.onerror = () => {
      onShowToast?.('Failed to read file.', 'error');
      setIsParsing(false);
    };
    reader.readAsText(file);
  };

  // Find unique values in the selected activity type column (for column-based activity mapping)
  const handleActivityColumnChange = (columnHeader) => {
    setMappings(prev => ({ ...prev, activityTypeColumn: columnHeader }));
    if (!columnHeader) {
      setUniqueActivityValues([]);
      return;
    }
    const values = new Set();
    parsedRows.forEach(row => {
      const val = row[columnHeader];
      if (val) values.add(val.trim());
    });
    const valList = Array.from(values);
    setUniqueActivityValues(valList);
    
    // Auto-initialize mappings
    const initialMixed = {};
    valList.forEach(v => {
      const lower = v.toLowerCase();
      if (lower.includes('cv shared') || lower.includes('cv sent') || lower.includes('cv_sent') || lower.includes('send cv')) {
        initialMixed[v] = 'cv_sent';
      } else if (lower.includes('spec') || lower.includes('speculative')) {
        initialMixed[v] = 'speculative_cv';
      } else if (lower.includes('interview')) {
        initialMixed[v] = 'interview';
      } else if (lower.includes('opportunity') || lower.includes('lead')) {
        initialMixed[v] = 'opportunity';
      } else if (lower.includes('job') || lower.includes('vacancy') || lower.includes('role') || lower === 'job_taken') {
        initialMixed[v] = 'job_taken';
      } else if (lower.includes('placement') || lower.includes('placed') || lower.includes('deal')) {
        initialMixed[v] = 'placement';
      } else {
        initialMixed[v] = 'cv_sent'; // Fallback default
      }
    });
    setMixedMappings(initialMixed);
  };

  // Staff mapper resolver
  const resolveRecruiter = (row) => {
    const rawVal = (row[mappings.recruiterKey] || '').trim();
    if (!rawVal) return null;
    
    const cleanVal = rawVal.toLowerCase();

    return staff.find(s => {
      if (matchBy === 'email') {
        const business = (s.businessEmail || '').toLowerCase().trim();
        if (business && business === cleanVal) return true;
        const personal = (s.personalEmail || '').toLowerCase().trim();
        if (personal && personal === cleanVal) return true;
        const crmEmail = (s.recruitlyEmail || '').toLowerCase().trim();
        if (crmEmail && crmEmail === cleanVal) return true;
        const aliases = Array.isArray(s.additionalEmails) ? s.additionalEmails : [];
        return aliases.some(alias => (alias || '').toLowerCase().trim() === cleanVal);
      } else {
        const fullName = (s.fullName || '').toLowerCase().trim();
        return fullName && fullName === cleanVal;
      }
    }) || null;
  };

  // Preview / Dry-run calculation
  const dryRunPreview = useMemo(() => {
    if (parsedRows.length === 0 || !mappings.recruiterKey || !mappings.timestamp) {
      return { total: 0, matched: 0, unmatched: 0, samples: [] };
    }

    let matched = 0;
    let unmatched = 0;
    const samples = [];
    const unmatchedRecruiters = new Set();

    parsedRows.forEach((row, idx) => {
      const recruiter = resolveRecruiter(row);
      if (recruiter) {
        matched++;
      } else {
        unmatched++;
        const rawRecruiter = row[mappings.recruiterKey];
        if (rawRecruiter) unmatchedRecruiters.add(rawRecruiter);
      }

      if (idx < 5) {
        let type = singleActivityType;
        if (activityTypeSource === 'column' && mappings.activityTypeColumn) {
          const colVal = row[mappings.activityTypeColumn];
          type = mixedMappings[colVal] || singleActivityType;
        }

        samples.push({
          rawDate: row[mappings.timestamp] || 'Missing',
          rawRecruiter: row[mappings.recruiterKey] || 'Missing',
          resolvedRecruiter: recruiter ? recruiter.fullName : 'Unmatched ⚠️',
          activityType: type,
          client: row[mappings.clientCompany] || '',
          candidate: row[mappings.candidateName] || '',
          value: row[mappings.value] || '0',
        });
      }
    });

    return {
      total: parsedRows.length,
      matched,
      unmatched,
      samples,
      unmatchedList: Array.from(unmatchedRecruiters).slice(0, 15)
    };
  }, [parsedRows, mappings, matchBy, activityTypeSource, singleActivityType, mixedMappings, staff]);

  // Execute Batch Imports
  const startImport = async () => {
    if (parsedRows.length === 0) return;
    if (!mappings.recruiterKey || !mappings.timestamp) {
      onShowToast?.('Please map the Recruiter and Date columns before importing.', 'error');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportSummary(null);

    const total = parsedRows.length;
    let successCount = 0;
    let skippedCount = 0;
    let placementCount = 0;

    const batchSize = 200;
    let batch = writeBatch(db);
    let opCount = 0;

    try {
      for (let i = 0; i < total; i++) {
        const row = parsedRows[i];
        
        // 1. Resolve date
        const rawDate = row[mappings.timestamp];
        let timestampIso = '';
        let dateKey = '';
        if (rawDate) {
          try {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              timestampIso = d.toISOString();
              dateKey = timestampIso.substring(0, 10);
            }
          } catch (e) {}
        }

        if (!timestampIso || !dateKey) {
          skippedCount++;
          continue;
        }

        // 2. Resolve recruiter
        const recruiter = resolveRecruiter(row);

        // 3. Resolve activity type
        let activityType = singleActivityType;
        if (activityTypeSource === 'column' && mappings.activityTypeColumn) {
          const colVal = row[mappings.activityTypeColumn];
          activityType = mixedMappings[colVal] || singleActivityType;
        }

        // 3b. Optional CRM Enrichment
        let crmCandidateId = '';
        let crmCompanyId = '';
        let crmContactId = '';
        let crmJobId = '';
        let crmContactName = '';
        let crmContactJobTitle = '';
        let crmContactEmail = '';
        let crmClientCompany = '';
        let crmJobTitle = '';

        if (enrichCrmData && recruiter && recruiter.companyId) {
          const candName = row[mappings.candidateName] || '';
          const clientComp = row[mappings.clientCompany] || '';
          setEnrichmentStatusText(`Enriching row ${i + 1} of ${total}: ${candName} at ${clientComp}...`);
          try {
            const enrichRes = await fetch('/api/crm/enrich', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId: recruiter.companyId,
                candidateEmail: row[mappings.candidateEmail] || '',
                candidateName: candName,
                clientCompany: clientComp,
                contactName: row[mappings.contactName] || '',
                jobTitle: row[mappings.jobTitle] || ''
              })
            });
            if (enrichRes.ok) {
              const enrichData = await enrichRes.json();
              if (enrichData.success) {
                crmCandidateId = enrichData.candidateId || '';
                crmCompanyId = enrichData.companyId || '';
                crmContactId = enrichData.contactId || '';
                crmJobId = enrichData.jobId || '';
                crmContactName = enrichData.contactName || '';
                crmContactJobTitle = enrichData.contactJobTitle || '';
                crmContactEmail = enrichData.contactEmail || '';
                crmClientCompany = enrichData.clientCompany || '';
                crmJobTitle = enrichData.jobTitle || '';
              }
            }
          } catch (enrichErr) {
            console.error(`Row ${i} CRM enrichment failed:`, enrichErr);
          }

          // Increment progress row-by-row since api calls add latency
          const progress = Math.round((i / total) * 100);
          setImportProgress(progress);
        }

        // 4. Save CRM activity log
        const activityRef = doc(collection(db, 'crm_activities'));
        const activityData = {
          recruiterId: recruiter ? recruiter.id : 'unmapped',
          recruiterName: recruiter ? recruiter.fullName : (row[mappings.recruiterKey] || 'Unmapped Historic Recruiter'),
          activityType,
          candidateName: row[mappings.candidateName] || '',
          candidateEmail: row[mappings.candidateEmail] || '',
          clientCompany: crmClientCompany || row[mappings.clientCompany] || '',
          jobTitle: crmJobTitle || row[mappings.jobTitle] || '',
          placementValue: Number(row[mappings.value] || 0),
          timestamp: timestampIso,
          dateKey,
          createdAt: new Date().toISOString(),
          candidateId: crmCandidateId,
          companyId: crmCompanyId,
          contactId: crmContactId,
          jobId: crmJobId,
          contactName: crmContactName || row[mappings.contactName] || '',
          contactJobTitle: crmContactJobTitle || '',
          contactEmail: crmContactEmail || ''
        };
        batch.set(activityRef, activityData);
        opCount++;

        // 5. Update KPI scorecard daily aggregates
        if (recruiter) {
          const kpiRef = doc(db, 'kpiDaily', `${recruiter.id}_${dateKey}`);
          const kpiData = {
            staffId: recruiter.id,
            staffName: recruiter.fullName,
            department: recruiter.department || '',
            email: recruiter.businessEmail || recruiter.personalEmail || '',
            date: dateKey,
            lastUpdated: new Date().toISOString()
          };

          if (activityType === 'cv_sent') kpiData.cvsSent = increment(1);
          else if (activityType === 'speculative_cv') kpiData.speculativeCvs = increment(1);
          else if (activityType === 'interview') kpiData.interviews = increment(1);
          else if (activityType === 'opportunity') kpiData.opportunities = increment(1);
          else if (activityType === 'job_taken') kpiData.jobsTaken = increment(1);

          batch.set(kpiRef, kpiData, { merge: true });
          opCount++;
        }

        // 6. Save placement dashboard records
        if (activityType === 'placement') {
          placementCount++;
          const placementId = `placement_${activityRef.id}`;
          const placementRef = doc(db, 'placements', placementId);
          const placementData = {
            id: placementId,
            placementId,
            candidateName: row[mappings.candidateName] || 'Unknown Candidate',
            clientCompany: row[mappings.clientCompany] || 'Unknown Client',
            netScoreValue: Number(row[mappings.value] || 0),
            clientPaymentStatus: 'Pending',
            status: 'active',
            splits: [
              {
                staffId: recruiter ? recruiter.id : 'unmapped',
                percentage: 100
              }
            ],
            createdAt: timestampIso,
            date: dateKey,
            startDate: dateKey,
            scoredDate: dateKey,
            candidateId: crmCandidateId,
            companyId: crmCompanyId,
            contactId: crmContactId,
            jobId: crmJobId
          };
          batch.set(placementRef, placementData);
          opCount++;
        }

        successCount++;

        // Commit batch periodically to stay within limits
        if (opCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
          
          const progress = Math.round((i / total) * 100);
          setImportProgress(progress);
        }
      }

      // Commit final batch operations
      if (opCount > 0) {
        await batch.commit();
      }

      setImportProgress(100);
      setImportSummary({
        total,
        success: successCount,
        skipped: skippedCount,
        placements: placementCount
      });
      onShowToast?.(`Import completed successfully! Saved ${successCount} CRM activity logs.`, 'success');
    } catch (err) {
      console.error('Historic import execution failed:', err);
      onShowToast?.(`Error performing historic import: ${err.message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="card" style={{ padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* HEADER SECTION */}
      <div>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Import Historical CRM Data</h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Import historic recruitment activity logs directly from a CSV spreadsheet backup. Uploaded entries will populate scorecards, placement financial tools, and team activity timelines.
        </p>
      </div>

      {/* STEP 1: FILE SELECTOR */}
      <div style={{ padding: '16px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', textAlign: 'center' }}>
        <input 
          type="file" 
          accept=".csv" 
          id="csv-file-input" 
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <label htmlFor="csv-file-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Upload size={32} color="var(--primary)" />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {csvFile ? `Selected File: ${csvFile.name}` : 'Click here to select a CRM export CSV file'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Must be a standard comma-separated text file (.csv)
          </span>
        </label>
      </div>

      {csvFile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'left' }}>
          <input 
            type="checkbox" 
            id="enrich-crm-checkbox" 
            checked={enrichCrmData} 
            onChange={e => setEnrichCrmData(e.target.checked)} 
            style={{ cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
          />
          <label htmlFor="enrich-crm-checkbox" style={{ fontSize: '13px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span>Enrich with Recruitly CRM Data via API</span>
            <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-secondary)' }}>
              Queries Recruitly dynamically to match and associate Candidate, Company, Contact, and Job Pipeline IDs.
            </span>
          </label>
        </div>
      )}

      {isParsing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <Loader2 size={16} className="spin" />
          <span>Parsing spreadsheet contents...</span>
        </div>
      )}

      {/* STEP 2: CONFIGURE COLUMNS MAPPING */}
      {parsedRows.length > 0 && !isParsing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Configure Column Mappings</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            
            {/* DATE MAPPING */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Date & Time Column <span style={{ color: 'red' }}>*</span>
              </label>
              <select 
                className="form-input" 
                value={mappings.timestamp}
                onChange={e => setMappings(prev => ({ ...prev, timestamp: e.target.value }))}
                style={{ width: '100%', height: '34px', fontSize: '13px' }}
              >
                <option value="">-- Choose Column --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            {/* RECRUITER MAPPING */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Recruiter Column <span style={{ color: 'red' }}>*</span>
              </label>
              <select 
                className="form-input" 
                value={mappings.recruiterKey}
                onChange={e => setMappings(prev => ({ ...prev, recruiterKey: e.target.value }))}
                style={{ width: '100%', height: '34px', fontSize: '13px' }}
              >
                <option value="">-- Choose Column --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            {/* RESOLUTION METHOD */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Resolve Recruiter By
              </label>
              <select 
                className="form-input" 
                value={matchBy}
                onChange={e => setMatchBy(e.target.value)}
                style={{ width: '100%', height: '34px', fontSize: '13px' }}
              >
                <option value="email">Email Address</option>
                <option value="name">Full Name (Exactly matching profile)</option>
              </select>
            </div>

            {/* CLIENT COMPANY */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Client Company Column
              </label>
              <select 
                className="form-input" 
                value={mappings.clientCompany}
                onChange={e => setMappings(prev => ({ ...prev, clientCompany: e.target.value }))}
                style={{ width: '100%', height: '34px', fontSize: '13px' }}
              >
                <option value="">-- Ignore (Optional) --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            {/* CONTACT NAME */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Contact Name Column
              </label>
              <select 
                className="form-input" 
                value={mappings.contactName}
                onChange={e => setMappings(prev => ({ ...prev, contactName: e.target.value }))}
                style={{ width: '100%', height: '34px', fontSize: '13px' }}
              >
                <option value="">-- Ignore (Optional) --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            {/* CANDIDATE NAME */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Candidate Name Column
              </label>
              <select 
                className="form-input" 
                value={mappings.candidateName}
                onChange={e => setMappings(prev => ({ ...prev, candidateName: e.target.value }))}
                style={{ width: '100%', height: '34px', fontSize: '13px' }}
              >
                <option value="">-- Ignore (Optional) --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            {/* CANDIDATE EMAIL */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Candidate Email Column
              </label>
              <select 
                className="form-input" 
                value={mappings.candidateEmail}
                onChange={e => setMappings(prev => ({ ...prev, candidateEmail: e.target.value }))}
                style={{ width: '100%', height: '34px', fontSize: '13px' }}
              >
                <option value="">-- Ignore (Optional) --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            {/* JOB TITLE */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Job Title Column
              </label>
              <select 
                className="form-input" 
                value={mappings.jobTitle}
                onChange={e => setMappings(prev => ({ ...prev, jobTitle: e.target.value }))}
                style={{ width: '100%', height: '34px', fontSize: '13px' }}
              >
                <option value="">-- Ignore (Optional) --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            {/* PLACEMENT NET VALUE */}
            <div className="form-group">
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Net Placement Value Column
              </label>
              <select 
                className="form-input" 
                value={mappings.value}
                onChange={e => setMappings(prev => ({ ...prev, value: e.target.value }))}
                style={{ width: '100%', height: '34px', fontSize: '13px' }}
              >
                <option value="">-- Ignore / Zero (Optional) --</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          {/* CRM ACTIVITY TYPE MAPPING STRATEGY */}
          <div className="card" style={{ padding: '14px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>CRM Activity Type Configuration</h5>
            
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="activityTypeSource" 
                  value="single" 
                  checked={activityTypeSource === 'single'} 
                  onChange={() => setActivityTypeSource('single')} 
                />
                Single Activity Type for whole file
              </label>
              
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="activityTypeSource" 
                  value="column" 
                  checked={activityTypeSource === 'column'} 
                  onChange={() => setActivityTypeSource('column')} 
                />
                Read Activity Type from CSV Column (Mixed File)
              </label>
            </div>

            {activityTypeSource === 'single' ? (
              <div className="form-group" style={{ maxWidth: '280px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Target Activity Type
                </label>
                <select 
                  className="form-input" 
                  value={singleActivityType} 
                  onChange={e => setSingleActivityType(e.target.value)}
                  style={{ width: '100%', height: '34px', fontSize: '13px' }}
                >
                  <option value="cv_sent">📄 CV Shared for Job</option>
                  <option value="speculative_cv">📨 Speculative CVs</option>
                  <option value="interview">🤝 Interviews Organized</option>
                  <option value="opportunity">📈 Opportunities</option>
                  <option value="job_taken">📋 Jobs / Vacancies</option>
                  <option value="placement">🏆 Placements</option>
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="form-group" style={{ maxWidth: '280px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Activity Type Column
                  </label>
                  <select 
                    className="form-input" 
                    value={mappings.activityTypeColumn} 
                    onChange={e => handleActivityColumnChange(e.target.value)}
                    style={{ width: '100%', height: '34px', fontSize: '13px' }}
                  >
                    <option value="">-- Choose Column --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {uniqueActivityValues.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Map CSV Column Values to CRM Dashboard Types:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
                      {uniqueActivityValues.map(val => (
                        <div key={val} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', borderRadius: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }} title={val}>
                            {val}
                          </span>
                          <select
                            value={mixedMappings[val] || 'cv_sent'}
                            onChange={e => setMixedMappings(prev => ({ ...prev, [val]: e.target.value }))}
                            className="form-input"
                            style={{ height: '28px', fontSize: '11px', width: '140px', padding: '2px 4px' }}
                          >
                            <option value="cv_sent">📄 CV Sent</option>
                            <option value="speculative_cv">📨 Speculative CV</option>
                            <option value="interview">🤝 Interview</option>
                            <option value="opportunity">📈 Opportunity</option>
                            <option value="job_taken">📋 Job / Vacancy</option>
                            <option value="placement">🏆 Placement</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: DRY-RUN VALIDATION PREVIEW */}
      {dryRunPreview.total > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={16} color="var(--primary)" />
            Staff Match Validation Preview
          </h4>

          {/* Validation Metrics Row */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', flex: 1, minWidth: '120px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{dryRunPreview.total}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Rows</div>
            </div>
            
            <div style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', flex: 1, minWidth: '120px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{dryRunPreview.matched}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Staff Matched ({Math.round((dryRunPreview.matched/dryRunPreview.total)*100) || 0}%)</div>
            </div>

            <div style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: dryRunPreview.unmatched > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)', color: dryRunPreview.unmatched > 0 ? 'var(--error)' : 'var(--text-secondary)', flex: 1, minWidth: '120px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{dryRunPreview.unmatched}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Unmatched Rows</div>
            </div>
          </div>

          {/* Warning regarding unmatched staff */}
          {dryRunPreview.unmatched > 0 && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)', backgroundColor: 'rgba(245, 158, 11, 0.05)', color: 'var(--warning)', fontSize: '12px' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Warning:</strong> {dryRunPreview.unmatched} rows could not be matched to active staff profiles. 
                These will be imported under the raw recruiter name found in the CSV, but <strong>will not populate any user's KPI scorecard totals</strong>. 
                <br/>
                <span style={{ fontSize: '11px', marginTop: '4px', display: 'block', color: 'var(--text-secondary)' }}>
                  Unresolved recruiter keys found in CSV: {dryRunPreview.unmatchedList.join(', ')}{dryRunPreview.unmatchedList.length >= 15 ? '...' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Sample Rows Preview */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Raw Date</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>CSV Recruiter</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Resolved Staff</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Type</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Client</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Candidate</th>
                  <th style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {dryRunPreview.samples.map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{s.rawDate}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.rawRecruiter}</td>
                    <td style={{ padding: '8px 12px', color: s.resolvedRecruiter.includes('⚠️') ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                      {s.resolvedRecruiter}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--primary)'
                      }}>
                        {s.activityType}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>{s.client}</td>
                    <td style={{ padding: '8px 12px' }}>{s.candidate}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>£{Number(s.value).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '6px 12px', backgroundColor: 'var(--bg-secondary)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
              Showing first 5 sample rows of the file
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: EXECUTION PROGRESS AND TRIGGER BUTTON */}
      {parsedRows.length > 0 && !isParsing && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Progress bar */}
          {isImporting && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                <span>Executing Bulk Import...</span>
                <span>{importProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                <div style={{ width: `${importProgress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.2s ease' }} />
              </div>
              {enrichCrmData && enrichmentStatusText && (
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px', textAlign: 'left' }}>
                  {enrichmentStatusText}
                </div>
              )}
            </div>
          )}

          {/* Import Summary Result */}
          {importSummary && (
            <div style={{ padding: '12px 16px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
              <CheckCircle2 size={20} />
              <div>
                <strong>Import complete!</strong> Successfully processed {importSummary.success} rows, skipped {importSummary.skipped} rows (due to invalid dates), and created {importSummary.placements} new placement records.
              </div>
            </div>
          )}

          {/* Trigger action button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              onClick={startImport}
              disabled={isImporting || !mappings.recruiterKey || !mappings.timestamp}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 700,
                opacity: (isImporting || !mappings.recruiterKey || !mappings.timestamp) ? 0.5 : 1,
                cursor: (isImporting || !mappings.recruiterKey || !mappings.timestamp) ? 'not-allowed' : 'pointer'
              }}
            >
              {isImporting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Execute Historical Import
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
