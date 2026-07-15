import React, { useState } from 'react';
import { UploadCloud, Grid, AlertTriangle, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { Staff } from '../../types';
import { parseCSV, parseFlexibleDate } from './utils';

interface PlacementsImporterProps {
  staff: Staff[];
  onSavePlacementsBatch: (batch: any[]) => Promise<any>;
  onClearAllPlacements?: () => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
  onImportDone: () => void;
}

export default function PlacementsImporter({
  staff,
  onSavePlacementsBatch,
  onClearAllPlacements,
  onShowToast,
  onImportDone
}: PlacementsImporterProps) {
  // Wizard states
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [validatedPlacements, setValidatedPlacements] = useState<any[]>([]);
  const [importStep, setImportStep] = useState(1); // 1: upload, 2: mapping, 3: validation & preview
  const [unmatchedRecruiterMappings, setUnmatchedRecruiterMappings] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Mapping Profiles states
  const [savedProfiles, setSavedProfiles] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const saved = localStorage.getItem('placement_importer_profiles');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedProfileKey, setSelectedProfileKey] = useState('');

  const handleSaveProfile = () => {
    if (!newProfileName.trim()) return;
    const updated = {
      ...savedProfiles,
      [newProfileName.trim()]: columnMappings
    };
    setSavedProfiles(updated);
    localStorage.setItem('placement_importer_profiles', JSON.stringify(updated));
    setSelectedProfileKey(newProfileName.trim());
    setNewProfileName('');
    onShowToast(`Saved mapping profile "${newProfileName.trim()}"`, "success");
  };

  const handleApplyProfile = (profileName: string) => {
    setSelectedProfileKey(profileName);
    if (savedProfiles[profileName]) {
      setColumnMappings(savedProfiles[profileName]);
      onShowToast(`Applied mapping profile "${profileName}"`, "success");
    }
  };

  const handleCSVDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCSVDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleCSVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processCSVFile(e.target.files[0]);
    }
  };

  const processCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event: any) => {
      const text = event.target.result;
      const parsedData = parseCSV(text);
      if (parsedData.length < 2) {
        onShowToast("The uploaded CSV has no rows or is invalid.", "warning");
        return;
      }

      const headers = parsedData[0];
      const rows = parsedData.slice(1);

      setCsvHeaders(headers);
      setCsvRows(rows);
      setCsvFile(file);

      const initialMap: Record<string, string> = {};
      const requiredMappings = [
        { key: 'placementId', labels: ['Placement ID', 'Import Key', 'id'] },
        { key: 'invoiceNumber', labels: ['Invoice Number', 'Invoice #', 'InvoiceNo'] },
        { key: 'internalCompany', labels: ['Internal Company', 'InternalCompany', 'Entity'] },
        { key: 'clientCompany', labels: ['Client Company', 'Client', 'Company'] },
        { key: 'candidateName', labels: ['Candidate', 'Candidate Name', 'CandidateName'] },
        { key: 'startDate', labels: ['Start Date', 'Start', 'StartDate', 'Joining Date'] },
        { key: 'scoredDate', labels: ['Scored Month', 'Scored Date', 'Confirm Date', 'ScoredMonth', 'ScoredDate'] },
        { key: 'scoredWeek', labels: ['Scored Week', 'ScoredWeek'] },
        { key: 'dnsWeek', labels: ['DNS Week', 'DNSWeek'] },
        { key: 'grossBillAmount', labels: ['Gross Bill Amount', 'Gross', 'Bill Amount', 'GrossBillAmount'] },
        { key: 'dnsRebateAmount', labels: ['DNS/Rebate Amount', 'Deduction', 'Rebate', 'DNSRebateAmount', 'DNS/Rebate'] },
        { key: 'netScoreValue', labels: ['Net Score Value', 'Net Score', 'NetScoreValue'] },
        { key: 'status', labels: ['Status', 'State'] },
        { key: 'source', labels: ['Source', 'Candidate Source'] },
        { key: 'consultants', labels: ['Consultants', 'Recruiter', 'Owner'] },
        { key: 'splitsJson', labels: ['Split Details JSON', 'Splits JSON', 'SplitDetailsJSON'] },
        { key: 'clientPaymentStatus', labels: ['Client Payment Status', 'Payment Status', 'Paid Status'] },
        { key: 'clientPaidDate', labels: ['Client Paid Date', 'Payment Date', 'Date Paid'] }
      ];

      requiredMappings.forEach(mapObj => {
        const foundIdx = headers.findIndex(h => {
          const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          return mapObj.labels.some(label => {
            const cleanL = label.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanH === cleanL || cleanH.includes(cleanL) || cleanL.includes(cleanH);
          });
        });
        if (foundIdx > -1) {
          initialMap[mapObj.key] = headers[foundIdx];
        }
      });

      setColumnMappings(initialMap);
      setImportStep(2);
    };
    reader.readAsText(file);
  };

  const handleApplyMappings = () => {
    const required = ['placementId', 'clientCompany', 'candidateName', 'startDate', 'grossBillAmount'];
    const missing = required.filter(field => !columnMappings[field]);

    if (missing.length > 0) {
      onShowToast(`Please map the required columns: ${missing.join(', ')}`, "warning");
      return;
    }

    validateMappedRows();
    setImportStep(3);
  };



  const validateMappedRows = () => {
    const parsed: any[] = [];
    const unmatchedNames = new Set<string>();

    csvRows.forEach((row, idx) => {
      const getVal = (field: string): string => {
        const header = columnMappings[field];
        if (!header) return '';
        const colIdx = csvHeaders.indexOf(header);
        return colIdx > -1 ? String(row[colIdx] || '') : '';
      };

      const pId = getVal('placementId') || `PL-IMP-${idx}-${Date.now()}`;
      const candidate = getVal('candidateName');
      const client = getVal('clientCompany');
      const internalCompany = getVal('internalCompany');
      const scoredWeek = getVal('scoredWeek');
      const dnsWeek = getVal('dnsWeek');

      const start = parseFlexibleDate(getVal('startDate'));

      const scoredRaw = getVal('scoredDate') || getVal('startDate') || '';
      let scored = parseFlexibleDate(scoredRaw);
      if (!scored && scoredRaw.includes(' ')) {
        const parts = scoredRaw.split(' ');
        if (parts.length >= 2) {
          const monthsMap: Record<string, number> = {
            jan: 0,
            feb: 1,
            mar: 2,
            apr: 3,
            may: 4,
            jun: 5,
            jul: 6,
            aug: 7,
            sep: 8,
            oct: 9,
            nov: 10,
            dec: 11
          };
          const month = monthsMap[parts[0].toLowerCase().substring(0, 3)] || 0;
          const year = Number(parts[1]) || 2026;
          scored = new Date(year, month, 15).toISOString().split('T')[0];
        }
      }
      if (!scored) {
        scored = start;
      }

      const grossVal = getVal('grossBillAmount') || '0';
      const gross = Number(grossVal.replace(/[^0-9.]/g, '')) || 0;

      const deductionsVal = getVal('dnsRebateAmount') || '0';
      const deductions = Number(deductionsVal.replace(/[^0-9.]/g, '')) || 0;

      const netVal = getVal('netScoreValue') || '';
      const net =
        netVal !== ''
          ? Number(netVal.replace(/[^0-9.]/g, '')) || 0
          : Math.max(0, gross - deductions);

      // Parse status
      let status = (getVal('status') || 'active').toLowerCase().trim();
      if (!['active', 'dns', 'rebate'].includes(status)) {
        status = deductions >= gross ? 'dns' : deductions > 0 ? 'rebate' : 'active';
      }

      // Parse Client Payment details
      let clientPaidStatus = (getVal('clientPaymentStatus') || 'unpaid').toLowerCase().trim();
      if (
        clientPaidStatus.includes('paid') ||
        clientPaidStatus.includes('yes') ||
        clientPaidStatus.includes('true') ||
        clientPaidStatus.includes('received')
      ) {
        clientPaidStatus = 'paid';
      } else {
        clientPaidStatus = 'unpaid';
      }

      const clientPaidDateRaw = getVal('clientPaidDate') || new Date().toISOString().split('T')[0];
      const clientPaidDate =
        clientPaidStatus === 'paid'
          ? parseFlexibleDate(clientPaidDateRaw) || new Date().toISOString().split('T')[0]
          : null;

      // Parse splits
      const consultantsStr = getVal('consultants');
      const splitsJsonStr = getVal('splitsJson');
      let finalSplits: any[] = [];
      const rowIssues: string[] = [];

      if (splitsJsonStr && splitsJsonStr.trim() !== '') {
        try {
          let cleanJsonStr = splitsJsonStr.replace(/""/g, '"').trim();
          if (cleanJsonStr.includes("'")) {
            cleanJsonStr = cleanJsonStr.replace(/'/g, '"');
          }

          const parsedJson = JSON.parse(cleanJsonStr);
          if (Array.isArray(parsedJson)) {
            let specifiedCount = 0;
            const itemsParsed = parsedJson.map((item: any) => {
              const name =
                item.consultant ||
                item.Consultant ||
                item.name ||
                item.fullName ||
                item.recruiter ||
                item.recruiterName ||
                '';
              const percentageVal =
                item.share || item.percent || item.percentage || item.value || item.split;
              let pct = null;
              if (percentageVal !== undefined && percentageVal !== null) {
                const cleanedPct = String(percentageVal).replace('%', '').trim();
                const num = Number(cleanedPct);
                if (!isNaN(num) && num > 0) {
                  pct = num;
                  specifiedCount++;
                }
              }
              return { name: name.trim(), pct };
            });

            if (specifiedCount === 0 && itemsParsed.length > 0) {
              const share = Math.round(100 / itemsParsed.length);
              finalSplits = itemsParsed.map((item: any, idx: number) => ({
                name: item.name,
                percentage:
                  idx === itemsParsed.length - 1
                    ? 100 - share * (itemsParsed.length - 1)
                    : share
              }));
            } else {
              finalSplits = itemsParsed.map((item: any) => ({
                name: item.name,
                percentage: item.pct !== null ? item.pct : 100
              }));
            }
          } else {
            const entries = Object.entries(parsedJson);
            let specifiedCount = 0;
            const itemsParsed = entries.map(([name, percent]) => {
              let pct = null;
              if (percent !== undefined && percent !== null) {
                const cleanedPct = String(percent).replace('%', '').trim();
                const num = Number(cleanedPct);
                if (!isNaN(num) && num > 0) {
                  pct = num;
                  specifiedCount++;
                }
              }
              return { name: name.trim(), pct };
            });

            if (specifiedCount === 0 && itemsParsed.length > 0) {
              const share = Math.round(100 / itemsParsed.length);
              finalSplits = itemsParsed.map((item: any, idx: number) => ({
                name: item.name,
                percentage:
                  idx === itemsParsed.length - 1
                    ? 100 - share * (itemsParsed.length - 1)
                    : share
              }));
            } else {
              finalSplits = itemsParsed.map((item: any) => ({
                name: item.name,
                percentage: item.pct !== null ? item.pct : 100
              }));
            }
          }
        } catch {
          rowIssues.push('Could not parse split JSON field. Falling back to consultant list.');
        }
      }

      if (finalSplits.length === 0 && consultantsStr) {
        const names = consultantsStr
          .split(/[,&;]/)
          .map(n => n.trim())
          .filter(n => n !== '');
        if (names.length > 0) {
          const share = Math.round(100 / names.length);
          finalSplits = names.map((name, i) => ({
            name,
            percentage: i === names.length - 1 ? 100 - share * (names.length - 1) : share
          }));
        }
      }

      if (finalSplits.length === 0) {
        rowIssues.push('No recruiters assigned. Auto-mapping 100% to first user in list.');
        if (staff.length > 0) {
          finalSplits = [{ name: staff[0].fullName, percentage: 100 }];
        }
      }

      // Validation checks
      const isValidDate = (dStr: string) => {
        if (!dStr) return false;
        const d = new Date(dStr);
        return !isNaN(d.getTime());
      };

      if (!client || client.trim() === '') {
        rowIssues.push('Client Company is missing.');
      }
      if (!candidate || candidate.trim() === '') {
        rowIssues.push('Candidate Name is missing.');
      }
      if (!start || !isValidDate(start)) {
        rowIssues.push(
          'Official Start Date is missing or invalid (must be DD/MM/YYYY or YYYY-MM-DD).'
        );
      }
      if (scored && !isValidDate(scored)) {
        rowIssues.push('Scored Date is invalid.');
      }
      if (isNaN(gross) || gross <= 0) {
        rowIssues.push('Gross Bill Amount must be greater than 0.');
      }

      // Attempt to resolve staff ids
      const mappedSplits = finalSplits.map(s => {
        const sName = String(s.name || '')
          .trim()
          .toLowerCase();

        let matchedStaff = staff.find(member => {
          const mName = String(member.fullName || '')
            .trim()
            .toLowerCase();
          return mName === sName;
        });

        if (!matchedStaff && sName !== '') {
          matchedStaff = staff.find(member => {
            const mName = String(member.fullName || '')
              .trim()
              .toLowerCase();
            return mName.includes(sName) || sName.includes(mName);
          });
        }

        if (matchedStaff) {
          return {
            staffId: matchedStaff.id,
            name: matchedStaff.fullName,
            percentage: s.percentage,
            resolved: true
          };
        } else {
          unmatchedNames.add(s.name || 'Unassigned');
          return {
            staffId: '',
            name: s.name || 'Unassigned',
            percentage: s.percentage,
            resolved: false
          };
        }
      });

      const sum = mappedSplits.reduce((acc, item) => acc + item.percentage, 0);
      if (sum !== 100 && mappedSplits.length > 0) {
        rowIssues.push(`Recruiter splits sum is ${sum}% instead of 100%`);
      }

      const hasUnresolved = mappedSplits.some(s => !s.resolved);

      parsed.push({
        id: `place-imp-${idx}-${Date.now()}`,
        placementId: pId,
        invoiceNumber: getVal('invoiceNumber') || `INV-IMP-${idx}`,
        internalCompany,
        clientCompany: client,
        candidateName: candidate,
        startDate: start,
        scoredDate: scored,
        scoredWeek,
        dnsWeek,
        dnsDate: status === 'dns' ? start : null,
        status,
        source: getVal('source') || 'LinkedIn',
        grossBillAmount: gross,
        dnsRebateAmount: deductions,
        dnsAmount: status === 'dns' ? gross : 0,
        rebateAmount: status === 'rebate' || (status !== 'dns' && deductions > 0) ? deductions : 0,
        netScoreValue: net,
        splits: mappedSplits,
        clientPaymentStatus: clientPaidStatus,
        clientPaidDate,
        issues: rowIssues,
        isValid: !hasUnresolved && sum === 100 && rowIssues.length === 0,
        importKey: `batch-${csvFile?.name || 'csv'}`
      });
    });

    setValidatedPlacements(parsed);

    const mapper: Record<string, string> = {};
    unmatchedNames.forEach(name => {
      mapper[name] = '';
    });
    setUnmatchedRecruiterMappings(mapper);
  };

  const handleUnmatchedMapChange = (name: string, staffId: string) => {
    setUnmatchedRecruiterMappings(prev => ({
      ...prev,
      [name]: staffId
    }));
  };

  const handleResolveUnmatched = () => {
    const updatedPlacements = validatedPlacements.map(p => {
      let allResolved = true;
      const updatedSplits = p.splits.map((s: any) => {
        if (s.resolved) return s;

        const manualStaffId = unmatchedRecruiterMappings[s.name];
        if (manualStaffId) {
          const matchedStaff = staff.find(member => member.id === manualStaffId);
          return {
            ...s,
            staffId: manualStaffId,
            name: matchedStaff ? matchedStaff.fullName : s.name,
            resolved: true
          };
        }
        allResolved = false;
        return s;
      });

      const sum = updatedSplits.reduce((acc: number, item: any) => acc + item.percentage, 0);
      const hasIssues = p.issues.length > 0 || sum !== 100;

      return {
        ...p,
        splits: updatedSplits,
        isValid: allResolved && !hasIssues
      };
    });

    setValidatedPlacements(updatedPlacements);
    onShowToast("Applied custom recruiter maps.", "success");
  };

  const handleEditPlacementField = (rowIndex: number, field: string, value: any) => {
    setValidatedPlacements(prev => {
      return prev.map((p, idx) => {
        if (idx !== rowIndex) return p;

        // Build updated placement
        const updated = { ...p, [field]: value };

        // Re-run validation checks on the edited row
        const rowIssues: string[] = [];
        const isValidDate = (dStr: string) => {
          if (!dStr) return false;
          const d = new Date(dStr);
          return !isNaN(d.getTime());
        };

        const client = updated.clientCompany;
        const candidate = updated.candidateName;
        const start = updated.startDate;
        const gross = Number(updated.grossBillAmount);

        if (!client || client.trim() === '') {
          rowIssues.push('Client Company is missing.');
        }
        if (!candidate || candidate.trim() === '') {
          rowIssues.push('Candidate Name is missing.');
        }
        if (!start || !isValidDate(start)) {
          rowIssues.push(
            'Official Start Date is missing or invalid (must be DD/MM/YYYY or YYYY-MM-DD).'
          );
        }
        if (isNaN(gross) || gross <= 0) {
          rowIssues.push('Gross Bill Amount must be greater than 0.');
        }

        const sum = updated.splits?.reduce((acc: number, item: any) => acc + item.percentage, 0) || 0;
        if (sum !== 100 && updated.splits?.length > 0) {
          rowIssues.push(`Recruiter splits sum is ${sum}% instead of 100%`);
        }

        const hasUnresolved = updated.splits?.some((s: any) => !s.resolved);
        const newNet = gross - (Number(updated.dnsRebateAmount) || 0);

        return {
          ...updated,
          netScoreValue: newNet,
          issues: rowIssues,
          isValid: !hasUnresolved && sum === 100 && rowIssues.length === 0
        };
      });
    });
  };

  const handleSaveImportBatch = async () => {
    const invalidRowsCount = validatedPlacements.filter(p => !p.isValid).length;
    if (invalidRowsCount > 0) {
      if (
        !window.confirm(
          `There are ${invalidRowsCount} rows with errors or unmapped staff. These rows will NOT be imported. Continue?`
        )
      ) {
        return;
      }
    }

    const cleanImports = validatedPlacements
      .filter(p => p.isValid)
      .map(p => {
        const finalSplits = p.splits.map((s: any) => ({
          staffId: s.staffId,
          percentage: s.percentage
        }));
        return {
          id: p.id,
          placementId: p.placementId,
          invoiceNumber: p.invoiceNumber,
          internalCompany: p.internalCompany || '',
          clientCompany: p.clientCompany,
          candidateName: p.candidateName,
          startDate: p.startDate,
          scoredDate: p.scoredDate,
          scoredWeek: p.scoredWeek || '',
          dnsWeek: p.dnsWeek || '',
          dnsDate: p.dnsDate,
          status: p.status,
          source: p.source,
          grossBillAmount: p.grossBillAmount,
          dnsRebateAmount: p.dnsRebateAmount,
          dnsAmount: p.dnsAmount || (p.status === 'dns' ? p.grossBillAmount : 0),
          rebateAmount:
            p.rebateAmount ||
            (p.status === 'rebate' || (p.status !== 'dns' && p.dnsRebateAmount > 0)
              ? p.dnsRebateAmount
              : 0),
          netScoreValue: p.netScoreValue,
          splits: finalSplits,
          clientPaymentStatus: p.clientPaymentStatus,
          clientPaidDate: p.clientPaidDate,
          importKey: p.importKey
        };
      });

    if (cleanImports.length === 0) {
      onShowToast("No valid rows to import.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      await onSavePlacementsBatch(cleanImports);
      onShowToast(`Successfully imported ${cleanImports.length} placements!`, "success");

      setCsvFile(null);
      setCsvHeaders([]);
      setCsvRows([]);
      setValidatedPlacements([]);
      setImportStep(1);
      onImportDone();
    } catch (err: any) {
      onShowToast(`Error saving import batch: ${err.message}`, "warning");
    } finally {
      setIsSaving(false);
    }
  };
  const handleClearDatabase = async () => {
    if (!window.confirm("Are you absolutely sure you want to clear ALL placements from the database? This cannot be undone.")) return;
    setIsSaving(true);
    try {
      if (onClearAllPlacements) {
        await onClearAllPlacements();
        onShowToast("Cleared all placement records successfully.", "info");
      }
    } catch (err: any) {
      onShowToast(`Error clearing records: ${err.message}`, "warning");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>CRM Placement Spreadsheet Importer</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Upload your placement CSV records directly from your CRM, map headers, resolve recruiter roster names, and batch upload.
          </p>
        </div>
        {onClearAllPlacements && (
          <button
            type="button"
            className="btn-danger"
            disabled={isSaving}
            onClick={handleClearDatabase}
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
          >
            <Trash2 size={14} />
            {isSaving ? "Clearing..." : "Clear Database"}
          </button>
        )}
      </div>

      {importStep === 1 && (
        <div
          className="upload-zone"
          onDragOver={handleCSVDragOver}
          onDrop={handleCSVDrop}
          onClick={() => {
            const picker = document.getElementById('csv-uploader-file-picker');
            if (picker) picker.click();
          }}
          style={{ padding: '40px', borderStyle: 'dashed', borderRadius: '8px', cursor: 'pointer' }}
        >
          <input
            type="file"
            id="csv-uploader-file-picker"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleCSVSelect}
          />
          <UploadCloud size={48} className="upload-icon" style={{ marginBottom: '16px' }} />
          <span className="upload-text" style={{ fontSize: '16px', fontWeight: 600 }}>
            Drag and drop placement CSV here or Browse
          </span>
          <span className="upload-subtext" style={{ marginTop: '8px' }}>
            Supported header keys: Placement ID, Client, Candidate, Start Date, Gross Bill Amount, Split details...
          </span>
        </div>
      )}

      {importStep === 2 && (
        <div className="detail-section" style={{ animation: 'fadeIn 0.2s' }}>
          <div className="section-title">
            <Grid size={16} /> Map CSV Headers to Database Fields
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            We parsed the column headers of your file **{csvFile?.name}**. Map them to target placements values below.
          </p>

          {/* Mapping Profiles Management */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Apply Saved Profile:</span>
              <select
                className="select-filter"
                value={selectedProfileKey}
                onChange={e => handleApplyProfile(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <option value="">-- Select Profile --</option>
                {Object.keys(savedProfiles).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="placements-form-input"
                placeholder="Profile Name (e.g. CRM A)"
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '12px', width: '180px' }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveProfile}
                style={{ padding: '6px 12px', fontSize: '12px' }}
                disabled={!newProfileName.trim()}
              >
                Save Profile
              </button>
            </div>
          </div>

          <div className="form-group-row" style={{ flexWrap: 'wrap' }}>
            {[
              { key: 'placementId', label: 'Placement ID (CRM ID) *' },
              { key: 'invoiceNumber', label: 'Invoice Number' },
              { key: 'clientCompany', label: 'Client Company *' },
              { key: 'candidateName', label: 'Candidate Full Name *' },
              { key: 'startDate', label: 'Start Date (Start)*' },
              { key: 'scoredDate', label: 'Scored Confirmation Date' },
              { key: 'grossBillAmount', label: 'Gross Fee Amount *' },
              { key: 'dnsRebateAmount', label: 'DNS/Rebate Deduction' },
              { key: 'status', label: 'Status field' },
              { key: 'source', label: 'Sourcing channel' },
              { key: 'consultants', label: 'Consultants Name List' },
              { key: 'splitsJson', label: 'Splits Details JSON' },
              { key: 'clientPaymentStatus', label: 'Client Payment Status' },
              { key: 'clientPaidDate', label: 'Client Payment Date' }
            ].map(item => (
              <div key={item.key} className="form-group" style={{ flex: '1 1 250px' }}>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  {item.label}
                </label>
                <select
                  className="select-filter"
                  value={columnMappings[item.key] || ''}
                  onChange={e =>
                    setColumnMappings(prev => ({ ...prev, [item.key]: e.target.value }))
                  }
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">-- Ignore / Not in CSV --</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn-primary" onClick={handleApplyMappings}>
              Validate Mapped Rows
            </button>
            <button type="button" className="btn-secondary" onClick={() => setImportStep(1)}>
              Back
            </button>
          </div>
        </div>
      )}

      {importStep === 3 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            animation: 'fadeIn 0.2s'
          }}
        >
          {Object.keys(unmatchedRecruiterMappings).length > 0 && (
            <div
              className="detail-section"
              style={{
                border: '1px solid var(--warning)',
                backgroundColor: 'rgba(245,158,11,0.02)'
              }}
            >
              <div className="section-title" style={{ color: 'var(--warning)' }}>
                <AlertTriangle size={16} /> Unresolved Recruiter Names Found
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                The following recruiter names in the CSV splits could not be resolved automatically.
                Map them manually to employees:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.keys(unmatchedRecruiterMappings).map(name => (
                  <div key={name} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, width: '200px' }}>
                      "{name}" maps to:
                    </span>
                    <select
                      className="select-filter"
                      value={unmatchedRecruiterMappings[name]}
                      onChange={e => handleUnmatchedMapChange(name, e.target.value)}
                      style={{ padding: '6px', minWidth: '220px' }}
                    >
                      <option value="">-- Choose Active Employee --</option>
                      {staff.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleResolveUnmatched}
                style={{ marginTop: '16px', padding: '6px 16px' }}
              >
                Apply Mappings & Validate
              </button>
            </div>
          )}

          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
              CSV Import Rows Preview ({validatedPlacements.length} rows parsed)
            </h3>

            <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table className="entity-table dense">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Placement ID</th>
                    <th>Client</th>
                    <th>Candidate</th>
                    <th>Start Date</th>
                    <th>Client Payment</th>
                    <th style={{ textAlign: 'right' }}>Net Billing</th>
                    <th>Recruiters Splits Mapped</th>
                    <th>Errors / Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {validatedPlacements.map((p, i) => (
                    <tr key={i} style={{ opacity: p.isValid ? 1 : 0.75 }}>
                      <td>
                        {p.isValid ? (
                          <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                        ) : (
                          <XCircle size={16} style={{ color: 'var(--danger)' }} />
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          className="placements-form-input"
                          style={{ padding: '4px', fontSize: '11px', minWidth: '85px', fontFamily: 'monospace' }}
                          value={p.placementId}
                          onChange={(e) => handleEditPlacementField(i, 'placementId', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="placements-form-input"
                          style={{ padding: '4px', fontSize: '11px', minWidth: '120px' }}
                          value={p.clientCompany}
                          onChange={(e) => handleEditPlacementField(i, 'clientCompany', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="placements-form-input"
                          style={{ padding: '4px', fontSize: '11px', minWidth: '120px' }}
                          value={p.candidateName}
                          onChange={(e) => handleEditPlacementField(i, 'candidateName', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="placements-form-input"
                          style={{ padding: '4px', fontSize: '11px', minWidth: '110px' }}
                          value={p.startDate}
                          onChange={(e) => handleEditPlacementField(i, 'startDate', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="select-filter"
                          style={{ padding: '4px', fontSize: '11px', minWidth: '85px' }}
                          value={p.clientPaymentStatus || 'unpaid'}
                          onChange={(e) => handleEditPlacementField(i, 'clientPaymentStatus', e.target.value)}
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="paid">Paid</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <input
                            type="number"
                            className="placements-form-input"
                            style={{ padding: '4px', fontSize: '11px', width: '85px', textAlign: 'right' }}
                            value={p.grossBillAmount || 0}
                            onChange={(e) => handleEditPlacementField(i, 'grossBillAmount', Number(e.target.value))}
                          />
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Net: £{p.netScoreValue.toLocaleString()}</span>
                        </div>
                      </td>
                      <td>
                        {p.splits.map((s: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '11px',
                              color: s.resolved ? 'var(--text-primary)' : 'var(--danger)'
                            }}
                          >
                            &bull; {s.name} ({s.percentage}%) {s.resolved ? '✔️' : '❌ Unmapped'}
                          </div>
                        ))}
                      </td>
                      <td style={{ color: 'var(--danger)', fontSize: '11px' }}>
                        {p.issues.map((issue: string, idx: number) => (
                          <div key={idx}>&bull; {issue}</div>
                        ))}
                        {p.splits.some((s: any) => !s.resolved) && (
                          <div>&bull; Contains unmapped staff name.</div>
                        )}
                        {p.isValid && <span style={{ color: 'var(--success)' }}>Ready</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '16px'
            }}
          >
            <button type="button" className="btn-primary" onClick={handleSaveImportBatch} disabled={isSaving}>
              {isSaving ? "Saving Batch..." : `Commit Valid Imports (${validatedPlacements.filter(p => p.isValid).length} rows)`}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setImportStep(2)} disabled={isSaving}>
              Back to Mappings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
