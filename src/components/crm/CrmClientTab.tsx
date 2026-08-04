import React, { useState } from 'react';
import { CrmClientCompany, Placement } from '../../types';
import { useBoundStore } from '../../store/useBoundStore';

interface CrmClientTabProps {
  onShowToast: (msg: string, type?: string) => void;
}

export default function CrmClientTab({ onShowToast }: CrmClientTabProps) {
  const crmClientCompanies = useBoundStore(state => state.crmClientCompanies);
  const placements = useBoundStore(state => state.placements) as Placement[];
  const saveCrmClientCompany = useBoundStore(state => state.saveCrmClientCompany);
  const deleteCrmClientCompany = useBoundStore(state => state.deleteCrmClientCompany);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<CrmClientCompany | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Form states
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [accountsContactName, setAccountsContactName] = useState('');
  const [accountsContactEmail, setAccountsContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const openAddForm = () => {
    setId(crypto.randomUUID());
    setName('');
    setRegNumber('');
    setAddress('');
    setContactName('');
    setContactEmail('');
    setAccountsContactName('');
    setAccountsContactEmail('');
    setPhone('');
    setNotes('');
    setIsAdding(true);
    setIsEditing(false);
  };

  const openEditForm = (client: CrmClientCompany) => {
    setId(client.id);
    setName(client.name);
    setRegNumber(client.regNumber || '');
    setAddress(client.address || '');
    setContactName(client.contactName || '');
    setContactEmail(client.contactEmail || '');
    setAccountsContactName(client.accountsContactName || '');
    setAccountsContactEmail(client.accountsContactEmail || '');
    setPhone(client.phone || '');
    setNotes(client.notes || '');
    setIsEditing(true);
    setIsAdding(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowToast('Company Name is required', 'error');
      return;
    }

    const payload: CrmClientCompany = {
      id,
      name: name.trim(),
      regNumber: regNumber.trim(),
      address: address.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      accountsContactName: accountsContactName.trim(),
      accountsContactEmail: accountsContactEmail.trim(),
      phone: phone.trim(),
      notes: notes.trim()
    };

    try {
      await saveCrmClientCompany(payload);
      onShowToast(`Client ${name} saved successfully`, 'success');
      setIsAdding(false);
      setIsEditing(false);
      if (selectedClient && selectedClient.id === id) {
        setSelectedClient(payload);
      }
    } catch (err) {
      console.error(err);
      onShowToast('Failed to save client details', 'error');
    }
  };

  const handleDelete = async (clientId: string, clientName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${clientName}?`)) return;
    try {
      await deleteCrmClientCompany(clientId);
      onShowToast('Client deleted successfully', 'success');
      setSelectedClient(null);
    } catch (err) {
      console.error(err);
      onShowToast('Failed to delete client', 'error');
    }
  };

  // Filter clients
  const filteredClients = crmClientCompanies.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(term) ||
      (c.contactName || '').toLowerCase().includes(term) ||
      (c.contactEmail || '').toLowerCase().includes(term) ||
      (c.accountsContactEmail || '').toLowerCase().includes(term) ||
      (c.regNumber || '').toLowerCase().includes(term)
    );
  });

  // Helper to fetch placements for a client
  const getClientPlacements = (clientName: string) => {
    if (!clientName) return [];
    return placements.filter(p => (p.clientCompany || '').toLowerCase() === clientName.toLowerCase());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className="search-bar" style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Search clients by name, contact, registration..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        <button className="btn-primary" onClick={openAddForm}>
          + Add Client Company
        </button>
      </div>

      {/* Grid of clients */}
      <div className="table-container">
        <table className="entity-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Reg Number</th>
              <th>Address</th>
              <th>Primary Contact</th>
              <th>Accounts Contact</th>
              <th>Phone</th>
              <th style={{ textAlign: 'center' }}>Placements</th>
              <th style={{ textAlign: 'right' }}>Total Billing</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                  No client companies found matching your search.
                </td>
              </tr>
            ) : (
              filteredClients.map(client => {
                const clientPlacements = getClientPlacements(client.name);
                const totalBilling = clientPlacements.reduce((sum, p) => sum + (Number(p.netScoreValue) || 0), 0);

                return (
                  <tr
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    style={{ cursor: 'pointer' }}
                    className="hover-row"
                  >
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{client.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{client.regNumber || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={client.address || '—'}>
                      {client.address || '—'}
                    </td>
                    <td>
                      <div>{client.contactName || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{client.contactEmail}</div>
                    </td>
                    <td>
                      <div>{client.accountsContactName || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{client.accountsContactEmail}</div>
                    </td>
                    <td>{client.phone || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      <span className="badge badge-info" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        {clientPlacements.length}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                      £{totalBilling.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn-secondary dense"
                          onClick={() => {
                            openEditForm(client);
                            setSelectedClient(null);
                          }}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-danger dense"
                          onClick={() => handleDelete(client.id, client.name)}
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

      {/* Slide-over Drawer: Detail View */}
      {selectedClient && (
        <div className="slide-over-overlay active" onClick={() => setSelectedClient(null)} style={{ zIndex: 999 }}>
          <div className="slide-over-panel" onClick={(e) => e.stopPropagation()} style={{ width: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Client Profile Details</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {selectedClient.id}</span>
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Profile Card */}
              <div className="details-card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
                  {selectedClient.name}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Registration No.</span>
                    <strong>{selectedClient.regNumber || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Phone</span>
                    <strong>{selectedClient.phone || '—'}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Address</span>
                    <strong>{selectedClient.address || '—'}</strong>
                  </div>
                </div>
              </div>

              {/* Contacts Card */}
              <div className="details-card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h5 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  Point of Contacts
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Primary Sales Contact</span>
                    <div style={{ marginTop: '4px' }}>Name: {selectedClient.contactName || '—'}</div>
                    <div>Email: <a href={`mailto:${selectedClient.contactEmail}`} style={{ color: '#3b82f6' }}>{selectedClient.contactEmail || '—'}</a></div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Accounts & Invoicing Contact</span>
                    <div style={{ marginTop: '4px' }}>Name: {selectedClient.accountsContactName || '—'}</div>
                    <div>Email: <a href={`mailto:${selectedClient.accountsContactEmail}`} style={{ color: '#3b82f6' }}>{selectedClient.accountsContactEmail || '—'}</a></div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedClient.notes && (
                <div className="details-card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Notes & Comments</span>
                  <p style={{ fontSize: '13px', margin: 0, whiteSpace: 'pre-wrap' }}>{selectedClient.notes}</p>
                </div>
              )}

              {/* Dynamic Placements Mapped */}
              <div>
                <h5 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 12px 0' }}>
                  Placement History ({getClientPlacements(selectedClient.name).length})
                </h5>
                <div className="table-container" style={{ overflowY: 'auto', maxHeight: '200px' }}>
                  <table className="entity-table dense" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Candidate</th>
                        <th>Start Date</th>
                        <th style={{ textAlign: 'right' }}>Total Fee</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getClientPlacements(selectedClient.name).length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '12px' }}>
                            No placements recorded with this client yet.
                          </td>
                        </tr>
                      ) : (
                        getClientPlacements(selectedClient.name).map(p => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600 }}>{p.candidateName}</td>
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
                onClick={() => handleDelete(selectedClient.id, selectedClient.name)}
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                Delete Client Profile
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    openEditForm(selectedClient);
                    setSelectedClient(null);
                  }}
                >
                  Edit Profile
                </button>
                <button className="btn-primary" onClick={() => setSelectedClient(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Add / Edit Client Form */}
      {(isAdding || isEditing) && (
        <div className="slide-over-overlay active" onClick={() => { setIsAdding(false); setIsEditing(false); }} style={{ zIndex: 999 }}>
          <div className="slide-over-panel" onClick={(e) => e.stopPropagation()} style={{ width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                {isAdding ? 'Add Client Company Profile' : 'Edit Client Company Profile'}
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
                <label>Company Name <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Humres Contracting Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Company Registration No.</label>
                  <input
                    type="text"
                    placeholder="e.g. 12345678"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +44 20 7123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Corporate Address</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Suite 1, London Chambers, EC1A 1BB"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                Primary Point of Contact (Sales)
              </div>
              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Contact Email</label>
                  <input
                    type="email"
                    placeholder="e.g. jane@client.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                Accounts & Invoicing Contact
              </div>
              <div className="form-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Accounts Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Invoice Admin"
                    value={accountsContactName}
                    onChange={(e) => setAccountsContactName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Accounts Contact Email</label>
                  <input
                    type="email"
                    placeholder="e.g. accounts@client.com"
                    value={accountsContactEmail}
                    onChange={(e) => setAccountsContactEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Internal Notes / Directives</label>
                <textarea
                  rows={3}
                  placeholder="Billing schedule notes, client payment trends..."
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
                  Save Client Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
