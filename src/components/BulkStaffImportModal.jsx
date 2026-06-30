import React, { useState, useRef } from 'react';
import { Upload, Download, AlertTriangle, Check, X, AlertOctagon, Info } from 'lucide-react';
import { parseCSV, mapHeaders, validateStaffRow } from '../services/csvImporter';

export default function BulkStaffImportModal({ isOpen, onClose, onImportComplete, companies = [], leavePolicies = [], onShowToast }) {
  const [step, setStep] = useState(1);
  const [dragActive, setDragActive] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [importSummary, setImportSummary] = useState({ total: 0, valid: 0, invalid: 0 });
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const downloadTemplate = () => {
    const headers = [
      "Full Name",
      "Personal Email",
      "Personal Phone",
      "Date of Birth (DD/MM/YYYY)",
      "Address",
      "Employer Company",
      "Department",
      "Job Title",
      "Official Start Date (DD/MM/YYYY)",
      "Annual Salary",
      "Currency (GBP/USD/AED/INR/ZAR)",
      "Business Email (Optional)",
      "Business Phone (Optional)"
    ];
    const sampleRow = [
      "John Doe",
      "john.doe@example.com",
      "+44 7700 900077",
      "15/10/1988",
      "22 Baker Street, London",
      companies[0] ? companies[0].name : "Global Recruiters LLC FZ",
      "Recruitment",
      "Senior Consultant",
      "01/07/2026",
      "55000",
      "GBP",
      "j.doe@humres.co.uk",
      "+44 7700 900088"
    ];
    
    // Escape values that have commas
    const escapeCsvValue = (val) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.map(escapeCsvValue).join(","), sampleRow.map(escapeCsvValue).join(",")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Staff_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (onShowToast) {
      onShowToast("Template downloaded successfully! Open it in Excel.", "success");
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    if (!file.name.endsWith('.csv')) {
      if (onShowToast) {
        onShowToast("Please upload a valid CSV file (.csv)", "danger");
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const csvLines = parseCSV(text);
        
        if (csvLines.length < 2) {
          throw new Error("The file must contain a header row and at least one staff row.");
        }

        const headerRow = csvLines[0];
        const headerMap = mapHeaders(headerRow);
        
        // Check if we mapped the absolute minimum columns
        if (!headerMap.fullName || !headerMap.personalEmail) {
          throw new Error("Unable to identify required column headers. Please download and use the provided template.");
        }

        const rows = csvLines.slice(1);
        const validated = [];
        let validCount = 0;
        let invalidCount = 0;

        rows.forEach((row, index) => {
          // Skip completely empty lines
          if (row.length === 0 || (row.length === 1 && row[0].trim() === '')) {
            return;
          }
          
          const result = validateStaffRow(row, headerMap, companies, leavePolicies, index);
          validated.push(result);
          
          if (result.errors.length === 0) {
            validCount++;
          } else {
            invalidCount++;
          }
        });

        setParsedRows(validated);
        setImportSummary({ total: validated.length, valid: validCount, invalid: invalidCount });
        setStep(2);
        
        if (onShowToast) {
          onShowToast(`Successfully parsed ${validated.length} rows. Please review before committing.`, "success");
        }
      } catch (err) {
        if (onShowToast) {
          onShowToast(err.message, "danger");
        }
      }
    };
    
    reader.onerror = () => {
      if (onShowToast) {
        onShowToast("Error reading file", "danger");
      }
    };

    reader.readAsText(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleBack = () => {
    setParsedRows([]);
    setStep(1);
  };

  const handleCommitImport = async () => {
    const validProfiles = parsedRows
      .filter(r => r.errors.length === 0)
      .map(r => r.data);

    if (validProfiles.length === 0) {
      if (onShowToast) {
        onShowToast("No valid rows to import.", "warning");
      }
      return;
    }

    try {
      await onImportComplete(validProfiles);
      onClose();
      if (onShowToast) {
        onShowToast(`Successfully imported ${validProfiles.length} staff profiles!`, "success");
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast("Failed to complete database import.", "danger");
      }
    }
  };

  return (
    <div className="slide-over-overlay active" onClick={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="slide-over-panel" 
        onClick={(e) => e.stopPropagation()} 
        style={{ width: '850px', maxWidth: '90vw' }}
      >
        <div className="slide-over-header">
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Bulk Import Staff (Excel/CSV)</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Upload staff roster list exported from Excel spreadsheets.</p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="slide-over-body" style={{ padding: '24px', overflowY: 'auto' }}>
          {step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Instructions Panel */}
              <div style={{ 
                padding: '16px', 
                backgroundColor: 'rgba(99, 102, 241, 0.05)', 
                border: '1px dashed rgba(99, 102, 241, 0.3)', 
                borderRadius: '8px' 
              }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Info size={20} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>CSV Upload Guidelines</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      To prevent database sync errors, make sure to format your Excel spreadsheet correctly:
                    </p>
                    <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '16px', marginTop: '6px', lineHeight: '1.6' }}>
                      <li><strong>Required Fields:</strong> Full Name, Personal Email, Job Title, Official Start Date.</li>
                      <li><strong>Employer Company:</strong> Set company name matching your database profiles (e.g. <em>"Global Recruiters LLC FZ"</em>).</li>
                      <li><strong>Start Date & DOB Format:</strong> Use standard formats like <strong>DD/MM/YYYY</strong> or <strong>YYYY-MM-DD</strong>.</li>
                      <li><strong>Excel Tip:</strong> In Microsoft Excel, save your list as a <strong>CSV UTF-8 (comma delimited) (*.csv)</strong> before uploading.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Template Downloader Card */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '16px', 
                backgroundColor: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px' 
              }}>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: '14px' }}>Need a formatted template?</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Download our pre-structured template containing exact headings and sample values.</p>
                </div>
                <button 
                  className="btn-secondary" 
                  onClick={downloadTemplate}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Download size={14} /> Download Template
                </button>
              </div>

              {/* Drag and Drop Zone */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                style={{
                  border: dragActive ? '2px solid var(--accent)' : '2px dashed var(--border-color)',
                  backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.04)' : 'rgba(255,255,255,0.01)',
                  borderRadius: '12px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".csv" 
                  style={{ display: 'none' }} 
                />
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '50%', 
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)'
                }}>
                  <Upload size={22} />
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '14px' }}>Drag & drop your CSV file here, or <span style={{ color: 'var(--accent)' }}>browse files</span></p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Supports standard comma-separated .csv exports</p>
                </div>
              </div>

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Preview Dashboard */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '16px',
                padding: '16px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{importSummary.total}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total Rows Parsed</div>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success)' }}>{importSummary.valid}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Ready to Import</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: importSummary.invalid > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{importSummary.invalid}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Blocked (Errors)</div>
                </div>
              </div>

              {/* Parsed List Grid */}
              <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table className="entity-table dense" style={{ fontSize: '11px', minWidth: '700px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Row</th>
                      <th>Full Name</th>
                      <th>Company / Dept</th>
                      <th>Job Title</th>
                      <th style={{ textAlign: 'center' }}>Start Date</th>
                      <th style={{ textAlign: 'right' }}>Annual Salary</th>
                      <th>Status & Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, idx) => {
                      const hasErrors = row.errors.length > 0;
                      const hasWarnings = row.warnings.length > 0;

                      return (
                        <tr key={idx} style={{ 
                          backgroundColor: hasErrors ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                          opacity: hasErrors ? 0.75 : 1
                        }}>
                          <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{row.rowNumber}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{row.data.fullName || '—'}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{row.data.personalEmail || 'No Email'}</div>
                          </td>
                          <td>
                            <div>{row.data.companyName || 'Unknown'}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{row.data.department || '—'}</div>
                          </td>
                          <td>{row.data.jobTitle || '—'}</td>
                          <td style={{ textAlign: 'center' }}>{row.data.startDate || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {row.data.salary ? `${row.data.currency} ${row.data.salary.toLocaleString()}` : '—'}
                          </td>
                          <td>
                            {hasErrors ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {row.errors.map((e, eIdx) => (
                                  <span key={eIdx} style={{ color: 'var(--danger)', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <AlertOctagon size={10} /> {e}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '9px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Check size={10} /> Ready
                                </span>
                                {hasWarnings && row.warnings.map((w, wIdx) => (
                                  <span key={wIdx} style={{ color: 'var(--warning)', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '3px' }} title={w}>
                                    <AlertTriangle size={10} /> {w.length > 25 ? `${w.substring(0, 22)}...` : w}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Warning box if errors exist */}
              {importSummary.invalid > 0 && (
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  padding: '12px', 
                  backgroundColor: 'rgba(239, 68, 68, 0.05)', 
                  border: '1px solid rgba(239, 68, 68, 0.2)', 
                  borderRadius: '6px', 
                  fontSize: '11px',
                  color: 'var(--danger)'
                }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>
                    Some rows contain validation errors and will be **skipped** during import. Correct these rows in Excel and upload again if you wish to import them.
                  </span>
                </div>
              )}

            </div>
          )}
        </div>

        <div className="slide-over-footer">
          {step === 1 ? (
            <>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>Next Step</button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={handleBack}>Upload Different File</button>
              <button 
                className="btn-primary" 
                onClick={handleCommitImport}
                disabled={importSummary.valid === 0}
                style={{
                  opacity: importSummary.valid === 0 ? 0.5 : 1,
                  cursor: importSummary.valid === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                Import {importSummary.valid} Staff Members
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
