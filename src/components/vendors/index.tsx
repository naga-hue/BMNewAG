import React, { useState } from 'react';
import { Company, Staff, Expense, Vendor } from '../../types';
import VendorDirectory from './VendorDirectory';
import ContractsRegister from './ContractsRegister';
import LicenseAllocations from './LicenseAllocations';
import ForecastMatrix from './ForecastMatrix';
import VendorProfileView from './VendorProfileView';
import VendorRegisterModal from './VendorRegisterModal';
import ContractRegisterModal from './ContractRegisterModal';
import BatchAllocateSeatsModal from './BatchAllocateSeatsModal';
import ReconcileCellModal from './ReconcileCellModal';
import UnifiedAssetsManager from './UnifiedAssetsManager';
import CategorizationDesk from '../expenses/CategorizationDesk';
import HardwareAssetsRegister from './HardwareAssetsRegister';
import '../vendors.css';

export interface VendorsDashboardProps {
  companies?: Company[];
  staff?: Staff[];
  vendors?: Vendor[];
  contracts?: any[];
  assetAssignments?: any[];
  expenses?: Expense[];
  onSaveExpense: (exp: Expense) => Promise<any>;
  onSaveVendor: (v: Vendor) => Promise<any>;
  onDeleteVendor?: (id: string) => Promise<any>;
  onSaveContract?: (contract: any) => Promise<any>;
  onDeleteContract?: (id: string) => Promise<any>;
  onSaveAssetAssignment?: (assignment: any) => Promise<any>;
  onDeleteAssetAssignment?: (id: string) => Promise<any>;
  onShowToast: (msg: string, type?: string) => void;
  currentUser?: any;
}

export default function VendorsDashboard({
  companies = [],
  staff = [],
  vendors = [],
  contracts = [],
  assetAssignments = [],
  expenses = [],
  nominalCodes = [],
  onSaveExpense,
  onSaveVendor,
  onDeleteVendor = async () => {},
  onSaveContract = async () => {},
  onDeleteContract = async () => {},
  onSaveAssetAssignment = async () => {},
  onDeleteAssetAssignment = async () => {},
  onShowToast,
  currentUser
}: VendorsDashboardProps) {
  const isFinanceOrAdmin = currentUser?.permissions?.role === 'admin' || 
    currentUser?.permissions?.role === 'finance_admin';
  const hasVendorsWrite = isFinanceOrAdmin || currentUser?.permissions?.role === 'hr_admin';
  const readOnly = !hasVendorsWrite;

  const [activeSubTab, setActiveSubTab] = useState('unified');
  
  // Modals state
  const [selectedVendorProfileId, setSelectedVendorProfileId] = useState<string | null>(null);
  
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState<any | null>(null);
  
  const [multiAssignContract, setMultiAssignContract] = useState<any | null>(null);
  const [reconcilingCell, setReconcilingCell] = useState<{ contract: any; monthKey: string; projectedAmount: number } | null>(null);

  const handleEditVendor = (v: Vendor) => {
    setEditingVendor(v);
    setShowVendorForm(true);
  };

  const handleCreateVendor = () => {
    setEditingVendor(null);
    setShowVendorForm(true);
  };

  const handleEditContract = (c: any) => {
    setEditingContract(c);
    setShowContractForm(true);
  };

  const handleCreateContract = () => {
    setEditingContract(null);
    setShowContractForm(true);
  };

  return (
    <div className="tab-panelactive" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Tab Header Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '12px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { key: 'unified', label: '💻 Unified Assets & Licenses' },
            { key: 'vendors', label: '🏢 Vendors Directory' },
            { key: 'contracts', label: '📄 Contracts Register' },
            { key: 'allocations', label: '💻 Seat Allocations' },
            { key: 'forecast', label: '📊 Forecast Matrix' },
            { key: 'hardware', label: '🔌 Hardware Inventory' },
            { key: 'categorization', label: '⚡ Categorization Desk' }
          ].filter(t => isFinanceOrAdmin || t.key !== 'categorization').map(t => (
            <button 
              key={t.key}
              type="button" 
              className={`tab-btn ${activeSubTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveSubTab(t.key)}
              style={t.key === 'categorization' ? {
                fontWeight: (expenses || []).some(e => (!e.recipientType || e.recipientType === 'other' || !e.nominalCode) && e.status !== 'dns' && e.status !== 'cancelled') ? 700 : undefined,
                color: (expenses || []).some(e => (!e.recipientType || e.recipientType === 'other' || !e.nominalCode) && e.status !== 'dns' && e.status !== 'cancelled') && activeSubTab !== 'categorization' ? 'var(--warning)' : undefined
              } : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

      </div>

      {/* Main Content Render */}
      {activeSubTab === 'categorization' && (
        <CategorizationDesk onShowToast={onShowToast} />
      )}

      {activeSubTab === 'unified' && (
        <UnifiedAssetsManager
          companies={companies}
          staff={staff}
          vendors={vendors}
          contracts={contracts}
          assetAssignments={assetAssignments}
          onSaveAssetAssignment={onSaveAssetAssignment}
          onDeleteAssetAssignment={onDeleteAssetAssignment}
          onSaveContract={onSaveContract}
          onShowToast={onShowToast}
          readOnly={readOnly}
        />
      )}

      {activeSubTab === 'vendors' && (
        selectedVendorProfileId ? (
          <VendorProfileView
            vendorId={selectedVendorProfileId}
            vendors={vendors}
            contracts={contracts}
            staff={staff}
            companies={companies}
            assetAssignments={assetAssignments}
            onBack={() => setSelectedVendorProfileId(null)}
            onEditVendor={handleEditVendor}
            onDeleteVendor={onDeleteVendor}
            onEditContract={handleEditContract}
            onDeleteContract={onDeleteContract}
            onSaveAssetAssignment={onSaveAssetAssignment}
            onDeleteAssetAssignment={onDeleteAssetAssignment}
            onShowToast={onShowToast}
            readOnly={readOnly}
          />
        ) : (
          <VendorDirectory 
            vendors={vendors}
            contracts={contracts}
            nominalCodes={nominalCodes}
            onSaveVendor={onSaveVendor}
            onEditVendor={handleEditVendor}
            onDeleteVendor={onDeleteVendor}
            onShowToast={onShowToast}
            onSelectProfileId={setSelectedVendorProfileId}
            onAddNewVendorClick={readOnly ? undefined : handleCreateVendor}
            readOnly={readOnly}
          />
        )
      )}

      {activeSubTab === 'contracts' && (
        <ContractsRegister 
          contracts={contracts}
          vendors={vendors}
          companies={companies}
          staff={staff}
          assetAssignments={assetAssignments}
          expenses={expenses}
          onEditContract={handleEditContract}
          handleEditContract={handleEditContract}
          onDeleteContract={onDeleteContract}
          onSaveContract={onSaveContract}
          onSaveAssetAssignment={onSaveAssetAssignment}
          onDeleteAssetAssignment={onDeleteAssetAssignment}
          onShowToast={onShowToast}
          onBatchAllocateSeatsClick={readOnly ? undefined : setMultiAssignContract}
          onRegisterContractClick={readOnly ? undefined : handleCreateContract}
          readOnly={readOnly}
        />
      )}

      {activeSubTab === 'allocations' && (
        <LicenseAllocations 
          contracts={contracts}
          vendors={vendors}
          staff={staff}
          companies={companies}
          assetAssignments={assetAssignments}
          onSaveContract={onSaveContract}
          onSaveAssetAssignment={onSaveAssetAssignment}
          onDeleteAssetAssignment={onDeleteAssetAssignment}
          onShowToast={onShowToast}
          readOnly={readOnly}
        />
      )}

      {activeSubTab === 'forecast' && (
        <ForecastMatrix 
          contracts={contracts}
          vendors={vendors}
          companies={companies}
          staff={staff}
          expenses={expenses}
          assetAssignments={assetAssignments}
          onCellClick={readOnly ? undefined : (contract, year, monthIndex, projectedVal) => {
            const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            setReconcilingCell({ contract, monthKey, projectedAmount: projectedVal });
          }}
        />
      )}

      {activeSubTab === 'hardware' && (
        <HardwareAssetsRegister 
          staff={staff}
          assetAssignments={assetAssignments}
          contracts={contracts}
          onShowToast={onShowToast}
          readOnly={readOnly}
        />
      )}

      {/* Modals Container */}
      {showVendorForm && (
        <VendorRegisterModal 
          vendor={editingVendor}
          onClose={() => {
            setShowVendorForm(false);
            setEditingVendor(null);
          }}
          nominalCodes={nominalCodes}
          onSaveVendor={onSaveVendor}
          onShowToast={onShowToast}
        />
      )}

      {showContractForm && (
        <ContractRegisterModal 
          contract={editingContract}
          onClose={() => {
            setShowContractForm(false);
            setEditingContract(null);
          }}
          vendors={vendors}
          companies={companies}
          staff={staff}
          nominalCodes={nominalCodes}
          onSaveContract={onSaveContract}
          onShowToast={onShowToast}
        />
      )}

      {multiAssignContract && (
        <BatchAllocateSeatsModal 
          contract={multiAssignContract}
          onClose={() => setMultiAssignContract(null)}
          staff={staff}
          companies={companies}
          assetAssignments={assetAssignments}
          onSaveAssetAssignment={onSaveAssetAssignment}
          onShowToast={onShowToast}
        />
      )}

      {reconcilingCell && (
        <ReconcileCellModal 
          reconcilingCell={reconcilingCell}
          onClose={() => setReconcilingCell(null)}
          vendors={vendors}
          expenses={expenses}
          onSaveExpense={onSaveExpense}
          onShowToast={onShowToast}
        />
      )}

    </div>
  );
}
