import React, { useState, useEffect } from 'react';
import { CrmCandidate, Placement } from '../../types';
import { useBoundStore } from '../../store/useBoundStore';
import { firebaseService } from '../../services/firebase';

interface CrmCandidateTabProps {
  onShowToast: (msg: string, type?: string) => void;
}

export default function CrmCandidateTab({ onShowToast }: CrmCandidateTabProps) {
  const crmCandidates = useBoundStore(state => state.crmCandidates);
  const placements = useBoundStore(state => state.placements) as Placement[];
  const saveCrmCandidate = useBoundStore(state => state.saveCrmCandidate);
  const deleteCrmCandidate = useBoundStore(state => state.deleteCrmCandidate);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<CrmCandidate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentSalary, setCurrentSalary] = useState<number | ''>('');
  const [desiredSalary, setDesiredSalary] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [location, setLocation] = useState('');
  const [cvName, setCvName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [crmCandidateId, setCrmCandidateId] = useState('');
  const [employmentHistory, setEmploymentHistory] = useState<any[]>([]);
  const [educationHistory, setEducationHistory] = useState<any[]>([]);

  const getCandidateApiKey = (candName: string) => {
    const p = placements.find(pl => pl.candidateName?.toLowerCase() === candName.toLowerCase());
    return (p as any)?.crmApiKey || '';
  };

  useEffect(() => {
    if (selectedCandidate) {
      const candAny = selectedCandidate as any;
      const crmId = candAny.crmCandidateId || selectedCandidate.crmCandidateId;
      const apiKey = getCandidateApiKey(selectedCandidate.name);
      
      if (crmId && apiKey) {
        const runBackgroundSync = async () => {
          try {
            console.log(`[Background Sync] Fetching details for ${selectedCandidate.name} from Recruitly ID ${crmId}...`);
            const syncRes = await fetch('/api/recruitly-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                candidateId: crmId,
                apiKey: apiKey
              })
            });

            if (syncRes.ok) {
              const resData = await syncRes.json();
              
              // Now fetch the CV blob and upload it directly to Firebase Storage if not already a Firebase link
              let firebaseCvUrl = selectedCandidate.cvUrl || '';
              let firebaseCvName = selectedCandidate.cvName || '';
              
              const isNotFirebase = !firebaseCvUrl || firebaseCvUrl.includes('recruitly') || firebaseCvUrl.includes('/api/recruitly-cv');
              
              if (resData.candidateHasCv && isNotFirebase) {
                console.log(`[Background Sync] Fetching CV from Recruitly and uploading to Firebase Storage...`);
                const cvRes = await fetch(`/api/recruitly-cv?candidateId=${crmId}&apiKey=${apiKey}`);
                if (cvRes.ok) {
                  const blob = await cvRes.blob();
                  const file = new File([blob], "Curriculum_Vitae.pdf", { type: blob.type || "application/pdf" });
                  const storageUrl = await firebaseService.uploadCandidateCv(selectedCandidate.id, file);
                  firebaseCvUrl = storageUrl;
                  firebaseCvName = 'Recruitly CV';
                  console.log(`[Background Sync] Saved CV to Firebase Storage: ${storageUrl}`);
                }
              }

              // Build the updated candidate profile prioritizing live values
              const updatedCandidate: CrmCandidate = {
                ...selectedCandidate,
                email: resData.candidateEmail || selectedCandidate.email || '',
                phone: resData.candidateMobile || selectedCandidate.phone || '',
                cvUrl: firebaseCvUrl,
                cvName: firebaseCvName,
                notes: selectedCandidate.notes || `Synced from CRM Candidate (ID: ${crmId}).`,
                ...({
                  location: resData.candidateLocation || candAny.location || '',
                  skills: resData.candidateSkills ? resData.candidateSkills.join(', ') : candAny.skills || '',
                  crmCandidateId: crmId,
                  employmentHistory: resData.candidateEmploymentHistory || candAny.employmentHistory || [],
                  educationHistory: resData.candidateEducationHistory || candAny.educationHistory || []
                } as any)
              };

              // Save to Firestore if anything changed (or always update to heal database)
              const hasChanged = 
                selectedCandidate.email !== updatedCandidate.email ||
                selectedCandidate.phone !== updatedCandidate.phone ||
                selectedCandidate.cvUrl !== updatedCandidate.cvUrl ||
                candAny.location !== (updatedCandidate as any).location;

              if (hasChanged) {
                await saveCrmCandidate(updatedCandidate);
                setSelectedCandidate(updatedCandidate);
                onShowToast(`Profile updated from CRM!`, 'success');
              }
            }
          } catch (err) {
            console.error("[Background Sync] Failed to update candidate profile:", err);
          }
        };
        runBackgroundSync();
      }
    }
  }, [selectedCandidate?.id]);

  const openAddForm = () => {
    setId(crypto.randomUUID());
    setName('');
    setEmail('');
    setPhone('');
    setCurrentSalary('');
    setDesiredSalary('');
    setNotes('');
    setCvUrl('');
    setLocation('');
    setCvName('');
    setJobTitle('');
    setSkills('');
    setCrmCandidateId('');
    setEmploymentHistory([]);
    setEducationHistory([]);
    setIsAdding(true);
    setIsEditing(false);
  };

  const openEditForm = (cand: CrmCandidate) => {
    const candAny = cand as any;
    setId(cand.id);
    setName(cand.name);
    setEmail(cand.email || '');
    setPhone(cand.phone || '');
    setCurrentSalary(cand.currentSalary ?? '');
    setDesiredSalary(cand.desiredSalary ?? '');
    setNotes(cand.notes || '');
    setCvUrl(cand.cvUrl || '');
    setLocation(candAny.location || '');
    setCvName(cand.cvName || '');
    setJobTitle(cand.jobTitle || '');
    setSkills(candAny.skills || '');
    setCrmCandidateId(candAny.crmCandidateId || '');
    setEmploymentHistory(candAny.employmentHistory || []);
    setEducationHistory(candAny.educationHistory || []);
    setIsEditing(true);
    setIsAdding(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast('Candidate Name is required', 'error');
      return;
    }

    const payload: CrmCandidate = {
      id,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      currentSalary: currentSalary === '' ? undefined : Number(currentSalary),
      desiredSalary: desiredSalary === '' ? undefined : Number(desiredSalary),
      notes: notes.trim(),
      cvUrl,
      cvName,
      jobTitle,
      ...({
        location: location.trim(),
        skills,
        crmCandidateId,
        employmentHistory,
        educationHistory
      } as any)
    };

    try {
      await saveCrmCandidate(payload);
      onShowToast(`Candidate ${name} saved successfully`, 'success');
      setIsAdding(false);
      setIsEditing(false);
      if (selectedCandidate && selectedCandidate.id === id) {
        setSelectedCandidate(payload);
      }
    } catch (err) {
      console.error(err);
      onShowToast('Failed to save candidate details', 'error');
    }
  };

  const handleDelete = async (candId: string, candName: string) => {
    if (!window.confirm(`Are you sure you want to delete candidate ${candName}?`)) return;
    try {
      await deleteCrmCandidate(candId);
      onShowToast('Candidate profile deleted successfully', 'success');
      setSelectedCandidate(null);
    } catch (err) {
      console.error(err);
      onShowToast('Failed to delete candidate', 'error');
    }
  };

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCandidate) return;

    setUploading(true);
    try {
      const url = await firebaseService.uploadCandidateCv(selectedCandidate.id, file);
      const updated: CrmCandidate = {
        ...selectedCandidate,
        cvUrl: url
      };
      await saveCrmCandidate(updated);
      setSelectedCandidate(updated);
      onShowToast('CV uploaded and candidate profile updated successfully', 'success');
    } catch (err) {
      console.error(err);
      onShowToast('Failed to upload CV document', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Filter candidates
  const filteredCandidates = crmCandidates.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term) ||
      (c.phone || '').toLowerCase().includes(term)
    );
  });

  // Helper to fetch placements for a candidate
  const getCandidatePlacements = (candName: string) => {
    if (!candName) return [];
    return placements.filter(p => (p.candidateName || '').toLowerCase() === candName.toLowerCase());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className="search-bar" style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Search candidates by name, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <button className="btn-primary" onClick={openAddForm}>
          + Add Candidate
        </button>
      </div>

      {/* Grid of candidates */}
      <div className="table-container">
        <table className="entity-table">
          <thead>
            <tr>
              <th>Candidate Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th style={{ textAlign: 'right' }}>Current Salary / Rate</th>
              <th style={{ textAlign: 'right' }}>Desired Salary / Rate</th>
              <th style={{ textAlign: 'center' }}>CV Status</th>
              <th style={{ textAlign: 'center' }}>Placements</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCandidates.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                  No candidates found matching your search.
                </td>
              </tr>
            ) : (
              filteredCandidates.map(cand => {
                const candPlacements = getCandidatePlacements(cand.name);

                return (
                  <tr
                    key={cand.id}
                    onClick={() => setSelectedCandidate(cand)}
                    style={{ cursor: 'pointer' }}
                    className="hover-row"
                  >
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cand.name}</td>
                    <td>
                      {cand.email ? (
                        <a href={`mailto:${cand.email}`} onClick={e => e.stopPropagation()} style={{ color: '#3b82f6' }}>
                          {cand.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{cand.phone || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{(cand as any).location || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {cand.currentSalary ? `£${Number(cand.currentSalary).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {cand.desiredSalary ? `£${Number(cand.desiredSalary).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {cand.cvUrl ? (
                        <span className="badge badge-success" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                          Uploaded
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' }}>
                          Missing
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      <span className="badge badge-info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        {candPlacements.length}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn-secondary dense"
                          onClick={() => {
                            openEditForm(cand);
                            setSelectedCandidate(null);
                          }}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-danger dense"
                          onClick={() => handleDelete(cand.id, cand.name)}
                          style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over Drawer: Candidate Detail View */}
      {selectedCandidate && (
        <div className="slide-over-overlay active" onClick={() => setSelectedCandidate(null)} style={{ zIndex: 999 }}>
          <div className="slide-over-panel" onClick={(e) => e.stopPropagation()} style={{ width: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Candidate Profile Details</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {selectedCandidate.id}</span>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Profile Card */}
              <div className="details-card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
                  {selectedCandidate.name}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Email Address</span>
                    <strong>{selectedCandidate.email ? <a href={`mailto:${selectedCandidate.email}`} style={{ color: '#3b82f6' }}>{selectedCandidate.email}</a> : '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Phone</span>
                    <strong>{selectedCandidate.phone || '—'}</strong>
                  </div>
                  {((selectedCandidate as any).location) && (
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Location</span>
                      <strong>{(selectedCandidate as any).location}</strong>
                    </div>
                  )}
                  {(selectedCandidate.jobTitle) && (
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Recruitly Job Title</span>
                      <strong>{selectedCandidate.jobTitle}</strong>
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Current Salary / Rate</span>
                    <strong>{selectedCandidate.currentSalary ? `£${Number(selectedCandidate.currentSalary).toLocaleString()}` : '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Desired Salary / Rate</span>
                    <strong>{selectedCandidate.desiredSalary ? `£${Number(selectedCandidate.desiredSalary).toLocaleString()}` : '—'}</strong>
                  </div>
                </div>
              </div>

              {/* Key Skills */}
              {((selectedCandidate as any).skills) && (
                <div className="details-card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>Key Skills</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(selectedCandidate as any).skills.split(',').map((skill: string, sidx: number) => (
                      <span key={sidx} style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        color: '#3b82f6',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        {skill.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CV Document / Recruitly Card */}
              <div className="details-card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h5 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  Curriculum Vitae (CV) & Recruitly Profile
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  {selectedCandidate.cvUrl ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>📄</span>
                        <div style={{ fontSize: '13px' }}>
                          <div style={{ fontWeight: 600 }}>Curriculum_Vitae.pdf</div>
                          <a href={selectedCandidate.cvUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline', fontSize: '12px' }}>
                            Open/Download CV
                          </a>
                        </div>
                      </div>
                      <label className="btn-secondary dense" style={{ margin: 0, cursor: 'pointer', padding: '6px 12px' }}>
                        Replace CV File
                        <input type="file" onChange={handleCvUpload} style={{ display: 'none' }} />
                      </label>
                    </div>
                  ) : selectedCandidate.cvName === 'Recruitly CV' ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(59, 130, 246, 0.05)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>📄</span>
                        <div style={{ fontSize: '13px' }}>
                          <div style={{ fontWeight: 600 }}>Recruitly Profile CV</div>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CV is synced live from CRM</span>
                        </div>
                      </div>
                      {((selectedCandidate as any).crmCandidateId) && (
                        <a href={`https://secure.recruitly.io/candidate/${(selectedCandidate as any).crmCandidateId}`} target="_blank" rel="noopener noreferrer" className="btn-primary dense" style={{ margin: 0, padding: '6px 12px', fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}>
                          View Original CV
                        </a>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px', border: '2px dashed var(--border-color)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '24px' }}>📁</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No CV document uploaded yet.</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <label className="btn-primary dense" style={{ margin: 0, cursor: 'pointer' }}>
                          {uploading ? 'Uploading...' : 'Upload CV File'}
                          <input type="file" disabled={uploading} onChange={handleCvUpload} style={{ display: 'none' }} />
                        </label>
                        {((selectedCandidate as any).crmCandidateId) && (
                          <a href={`https://secure.recruitly.io/candidate/${(selectedCandidate as any).crmCandidateId}`} target="_blank" rel="noopener noreferrer" className="btn-secondary dense" style={{ margin: 0, padding: '6px 12px', fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}>
                            View on Recruitly
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Synced Resume Timeline */}
              {(((selectedCandidate as any).employmentHistory && (selectedCandidate as any).employmentHistory.length > 0) || ((selectedCandidate as any).educationHistory && (selectedCandidate as any).educationHistory.length > 0)) && (
                <div className="details-card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h5 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', color: 'var(--text-primary)' }}>
                    Synced Resume / Professional History
                  </h5>
                  
                  {/* Work Experience Timeline */}
                  {((selectedCandidate as any).employmentHistory && (selectedCandidate as any).employmentHistory.length > 0) && (
                    <div style={{ marginBottom: '20px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Work Experience</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid var(--border-color)', paddingLeft: '16px', marginLeft: '6px' }}>
                        {(selectedCandidate as any).employmentHistory.map((job: any, jidx: number) => (
                          <div key={jidx} style={{ position: 'relative' }}>
                            <div style={{
                              position: 'absolute',
                              left: '-22px',
                              top: '4px',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: '#3b82f6',
                              border: '2px solid var(--bg-primary)'
                            }} />
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{job.jobTitle}</div>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px' }}>{job.companyName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              🗓️ {job.startDate ? job.startDate.split(' ')[0] : 'N/A'} — {job.endDate ? job.endDate.split(' ')[0] : 'Present'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education History */}
                  {((selectedCandidate as any).educationHistory && (selectedCandidate as any).educationHistory.length > 0) && (
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', display: 'block', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Education</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid var(--border-color)', paddingLeft: '16px', marginLeft: '6px' }}>
                        {(selectedCandidate as any).educationHistory.map((edu: any, eidx: number) => (
                          <div key={eidx} style={{ position: 'relative' }}>
                            <div style={{
                              position: 'absolute',
                              left: '-22px',
                              top: '4px',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: '#10b981',
                              border: '2px solid var(--bg-primary)'
                            }} />
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{edu.organisation}</div>
                            {edu.major && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{edu.major}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedCandidate.notes && (
                <div className="details-card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Internal Background / Notes</span>
                  <p style={{ fontSize: '13px', margin: 0, whiteSpace: 'pre-wrap' }}>{selectedCandidate.notes}</p>
                </div>
              )}

              {/* Dynamic Placements Mapped */}
              <div>
                <h5 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0' }}>
                  Placement History ({getCandidatePlacements(selectedCandidate.name).length})
                </h5>
                <div className="table-container" style={{ overflowY: 'auto', maxHeight: '200px' }}>
                  <table className="entity-table dense" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Client Company</th>
                        <th>Start Date</th>
                        <th style={{ textAlign: 'right' }}>Total Fee</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getCandidatePlacements(selectedCandidate.name).length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '12px' }}>
                            No placement logs associated with this candidate profile.
                          </td>
                        </tr>
                      ) : (
                        getCandidatePlacements(selectedCandidate.name).map(p => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}>{p.clientCompany}</td>
                            <td>{(p as any).startDate || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              £{Number(p.netScoreValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </td>
                            <td>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: p.clientPaymentStatus === 'paid' ? 'var(--success)' : 'var(--warning)',
                                backgroundColor: p.clientPaymentStatus === 'paid' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                                padding: '2px 6px',
                                borderRadius: '3px'
                              }}>
                                {p.clientPaymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                className="btn-danger"
                onClick={() => handleDelete(selectedCandidate.id, selectedCandidate.name)}
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                Delete Candidate Profile
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    openEditForm(selectedCandidate);
                    setSelectedCandidate(null);
                  }}
                >
                  Edit Profile
                </button>
                <button className="btn-primary" onClick={() => setSelectedCandidate(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Add / Edit Candidate Form */}
      {(isAdding || isEditing) && (
        <div className="slide-over-overlay active" onClick={() => { setIsAdding(false); setIsEditing(false); }} style={{ zIndex: 999 }}>
          <div className="slide-over-panel" onClick={(e) => e.stopPropagation()} style={{ width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                {isAdding ? 'Add Candidate Profile' : 'Edit Candidate Profile'}
              </h3>
              <button
                onClick={() => { setIsAdding(false); setIsEditing(false); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Candidate Name <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. john@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +44 7712 345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Candidate Address / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Aylesbury, England"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Current Salary / Rate (£)</label>
                  <input
                    type="number"
                    placeholder="e.g. 45000"
                    value={currentSalary}
                    onChange={(e) => setCurrentSalary(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Desired Salary / Rate (£)</label>
                  <input
                    type="number"
                    placeholder="e.g. 55000"
                    value={desiredSalary}
                    onChange={(e) => setDesiredSalary(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Internal Background Notes / Comments</label>
                <textarea
                  rows={4}
                  placeholder="Experience details, notice period status, general feedback..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setIsAdding(false); setIsEditing(false); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Candidate Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
