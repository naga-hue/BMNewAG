import React, { useState, useMemo } from 'react';
import { toGBP, FX_RATES } from '../utils/currency';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Laptop, 
  FileText, 
  UploadCloud, 
  Eye, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Grid,
  Info,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  UserCheck,
  Edit3,
  Mail,
  Phone,
  Bell,
  X
} from 'lucide-react';
import { firebaseService } from '../services/firebase';

const CURRENCIES = [
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'AED', symbol: 'AED ' },
  { code: 'INR', symbol: '₹' },
  { code: 'ZAR', symbol: 'R' }
];

const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };

const getCategoryStyles = (category) => {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('software') || cat.includes('license') || cat.includes('it') || cat.includes('saas')) {
    return {
      accent: 'var(--primary)',
      bg: 'rgba(99, 102, 241, 0.08)',
      border: 'rgba(99, 102, 241, 0.2)',
      indicator: '💻',
      badgeColor: '#38bdf8'
    };
  }
  if (cat.includes('rent') || cat.includes('lease') || cat.includes('landlord') || cat.includes('office')) {
    return {
      accent: 'var(--success)',
      bg: 'rgba(16, 185, 129, 0.08)',
      border: 'rgba(16, 185, 129, 0.2)',
      indicator: '🏢',
      badgeColor: '#34d399'
    };
  }
  if (cat.includes('utilities') || cat.includes('utility') || cat.includes('phone') || cat.includes('internet') || cat.includes('comm')) {
    return {
      accent: 'var(--warning)',
      bg: 'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.2)',
      indicator: '📞',
      badgeColor: '#fbbf24'
    };
  }
  return {
    accent: 'var(--text-secondary)',
    bg: 'rgba(148, 163, 184, 0.08)',
    border: 'rgba(148, 163, 184, 0.2)',
    indicator: '💼',
    badgeColor: '#cbd5e1'
  };
};

export default function VendorsDashboard({ 
  companies = [], 
  staff = [], 
  vendors = [], 
  contracts = [], 
  assetAssignments = [],
  expenses = [],
  onSaveExpense,
  onSaveVendor,
  onDeleteVendor,
  onSaveContract,
  onDeleteContract,
  onSaveAssetAssignment,
  onDeleteAssetAssignment,
  onShowToast 
}) {
  const [activeSubTab, setActiveSubTab] = useState('vendors'); // vendors, contracts, allocations, forecast
  const [selectedVendorProfileId, setSelectedVendorProfileId] = useState(null);
  const [presetCategory, setPresetCategory] = useState('Software License');
  
  // Reconciliation states for 12-Month Vendor Matrix
  const [reconcilingCell, setReconcilingCell] = useState(null); // { contract, monthKey, projectedAmount }
  const [selectedExpenseId, setSelectedExpenseId] = useState('');

  const allAvailableDepts = useMemo(() => {
    const set = new Set();
    companies.forEach(c => {
      (c.departments || []).forEach(d => {
        if (d.name) set.add(d.name);
      });
    });
    ['Operations', 'Sales', 'Admin', 'Recruitment', 'Accounts'].forEach(d => set.add(d));
    return Array.from(set).sort();
  }, [companies]);

  // Editing trackers
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [editingContractId, setEditingContractId] = useState(null);
  const [expandedContractId, setExpandedContractId] = useState(null);
  const [expandedSplitsContractId, setExpandedSplitsContractId] = useState(null);
  const [expandedVendorIds, setExpandedVendorIds] = useState({});

  const toggleVendorExpand = (vendorId) => {
    setExpandedVendorIds(prev => ({
      ...prev,
      [vendorId]: !prev[vendorId]
    }));
  };

  // Form states - Vendor
  const [vendorName, setVendorName] = useState('');
  const [vendorCategory, setVendorCategory] = useState('Software License');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorDesc, setVendorDesc] = useState('');
  const [showVendorForm, setShowVendorForm] = useState(false);

  // Form states - Contract
  const [contractName, setContractName] = useState('');
  const [contractVendorId, setContractVendorId] = useState('');
  const [contractCompanyId, setContractCompanyId] = useState('');
  const [costInterval, setCostInterval] = useState('monthly');
  const [unitCost, setUnitCost] = useState('');
  const [quantityPurchased, setQuantityPurchased] = useState('1');
  const [contractCurrency, setContractCurrency] = useState('GBP');
  const [taxRate, setTaxRate] = useState('20.0'); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [unusedCompanyId, setUnusedCompanyId] = useState('');
  const [unusedDept, setUnusedDept] = useState('Operations');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [paymentReminderDate, setPaymentReminderDate] = useState('');
  const [splitPackageCost, setSplitPackageCost] = useState(false);
  const [showContractForm, setShowContractForm] = useState(false);
  const [multiAssignContract, setMultiAssignContract] = useState(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [staffSortKey, setStaffSortKey] = useState('name'); // name, company
  const [activeAllocId, setActiveAllocId] = useState(null);

  const availableDeptsForChosenCompany = useMemo(() => {
    if (!unusedCompanyId) return ['Operations', 'Recruitment', 'Finance', 'Marketing', 'Sales'];
    
    const depts = [];
    const companyProfile = companies.find(c => c.id === unusedCompanyId);
    if (companyProfile && Array.isArray(companyProfile.departments)) {
      companyProfile.departments.forEach(d => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    }
    const companyStaff = staff.filter(s => s.companyId === unusedCompanyId);
    companyStaff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    if (depts.length === 0) {
      return ['Operations', 'Recruitment', 'Finance', 'Marketing', 'Sales'];
    }
    return depts.sort();
  }, [unusedCompanyId, companies, staff]);

  const handleCompanyChange = (companyId) => {
    setUnusedCompanyId(companyId);
    const depts = [];
    const companyProfile = companies.find(c => c.id === companyId);
    if (companyProfile && Array.isArray(companyProfile.departments)) {
      companyProfile.departments.forEach(d => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    }
    const companyStaff = staff.filter(s => s.companyId === companyId);
    companyStaff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    const fallbackList = depts.length > 0 ? depts.sort() : ['Operations', 'Recruitment', 'Finance', 'Marketing', 'Sales'];
    setUnusedDept(fallbackList[0]);
  };

  // Upload Invoice states
  const [uploadContractId, setUploadContractId] = useState(null);
  const [uploadDocType, setUploadDocType] = useState('invoice');
  const [isUploading, setIsUploading] = useState(false);

  // Forecast currency selector
  const [forecastCurrency, setForecastCurrency] = useState('GBP');
  const [forecastCompanyFilter, setForecastCompanyFilter] = useState('all');

  // Handle inline seat allocation
  const handleAllocateSeatInline = async (e, contractId, contractName) => {
    e.preventDefault();
    const staffId = e.target.elements.staffSelect.value;
    const qty = parseInt(e.target.elements.quantityInput?.value || 1, 10);
    const email = e.target.elements.emailInput?.value || '';
    const notes = e.target.elements.notesInput?.value || '';
    if (!staffId) return;

    const staffMember = staff.find(s => s.id === staffId);
    if (!staffMember) return;

    try {
      for (let i = 0; i < qty; i++) {
        const newAssignment = {
          id: `ass-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
          contractId: contractId,
          staffId: staffId,
          assignedDate: new Date().toISOString().split('T')[0],
          email: qty === 1 ? email : (email ? `${email} (Seat ${i+1})` : ''),
          notes: qty === 1 ? notes : (notes ? `${notes} (Seat ${i+1})` : '')
        };
        await onSaveAssetAssignment(newAssignment);
      }
      onShowToast(`Assigned ${qty} license seat(s) of "${contractName}" to ${staffMember.fullName}.`, 'success');
      e.target.reset();
      if (e.target.elements.quantityInput) {
        e.target.elements.quantityInput.value = "1";
      }
    } catch (err) {
      onShowToast(`Error allocating seat: ${err.message}`, 'warning');
    }
  };

  // Handle inline seat release
  const handleReleaseSeat = async (assignmentId, contractName, staffName) => {
    if (window.confirm(`Are you sure you want to release the "${contractName}" license seat from ${staffName}?`)) {
      try {
        await onDeleteAssetAssignment(assignmentId);
        onShowToast(`Released "${contractName}" seat for ${staffName} back to pool.`, 'info');
      } catch (err) {
        onShowToast(`Error releasing seat: ${err.message}`, 'warning');
      }
    }
  };

  // Handle updating allocation fields inline (email or notes)
  const handleUpdateAssignmentField = async (assignmentId, field, value) => {
    const assignment = assetAssignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    if (assignment[field] === value) return;

    const updated = {
      ...assignment,
      [field]: value
    };

    try {
      await onSaveAssetAssignment(updated);
      onShowToast(`Updated seat ${field} successfully.`, 'success');
    } catch (err) {
      onShowToast(`Error updating seat ${field}: ${err.message}`, 'warning');
    }
  };

  // Handle batch seat allocations
  const handleBatchAllocateSeats = async () => {
    if (!multiAssignContract) return;
    if (selectedStaffIds.length === 0) {
      onShowToast("Please select at least one staff member.", "warning");
      return;
    }

    const assigned = assetAssignments.filter(a => a.contractId === multiAssignContract.id);
    const assignedCount = assigned.length;
    const unusedCount = Math.max(0, multiAssignContract.quantityPurchased - assignedCount);

    if (selectedStaffIds.length > unusedCount) {
      onShowToast(`Cannot allocate ${selectedStaffIds.length} seats. Only ${unusedCount} seats are left in the pool.`, 'warning');
      return;
    }

    try {
      const promises = selectedStaffIds.map(staffId => {
        const newAssignment = {
          id: `ass-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          contractId: multiAssignContract.id,
          staffId: staffId,
          assignedDate: new Date().toISOString().split('T')[0]
        };
        return onSaveAssetAssignment(newAssignment);
      });

      await Promise.all(promises);
      onShowToast(`Successfully allocated ${selectedStaffIds.length} seat(s) for "${multiAssignContract.name}".`, 'success');
      setMultiAssignContract(null);
      setSelectedStaffIds([]);
    } catch (err) {
      onShowToast(`Error allocating seats: ${err.message}`, 'warning');
    }
  };

  // Load defaults when lists load
  React.useEffect(() => {
    if (vendors.length > 0 && !contractVendorId) {
      setContractVendorId(vendors[0].id);
    }
  }, [vendors]);

  React.useEffect(() => {
    if (companies.length > 0 && !contractCompanyId) {
      setContractCompanyId(companies[0].id);
      setUnusedCompanyId(companies[0].id);
    }
  }, [companies]);

  // Trigger Edit Vendor
  const handleEditVendor = (vendor) => {
    setVendorName(vendor.name);
    setVendorCategory(vendor.category);
    setVendorEmail(vendor.contactEmail || '');
    setVendorPhone(vendor.phone || '');
    setVendorDesc(vendor.description || '');
    setEditingVendorId(vendor.id);
    setShowVendorForm(true);
    setShowContractForm(false);

    const presets = ['Software License', 'Office Rental', 'Telecom', 'AI Service', 'Other'];
    if (presets.includes(vendor.category)) {
      setPresetCategory(vendor.category);
    } else {
      setPresetCategory('custom');
    }
  };

  // Submit Vendor
  const handleVendorSubmit = async (e) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      onShowToast("Please enter a vendor name.", "warning");
      return;
    }

    const updatedVendor = {
      id: editingVendorId || `vendor-${Date.now()}`,
      name: vendorName.trim(),
      category: vendorCategory,
      contactEmail: vendorEmail.trim(),
      phone: vendorPhone.trim(),
      description: vendorDesc.trim()
    };

    try {
      await onSaveVendor(updatedVendor);
      onShowToast(
        editingVendorId 
          ? `Updated vendor details for "${vendorName}"` 
          : `Registered vendor partner "${vendorName}"`, 
        "success"
      );
      
      // Reset
      setVendorName('');
      setVendorEmail('');
      setVendorPhone('');
      setVendorDesc('');
      setPresetCategory('Software License');
      setEditingVendorId(null);
      setShowVendorForm(false);
    } catch (err) {
      onShowToast(`Error saving vendor: ${err.message}`, "warning");
    }
  };

  // Trigger Edit Contract
  const handleEditContract = (contract) => {
    setContractName(contract.name);
    setContractVendorId(contract.vendorId);
    setContractCompanyId(contract.companyId);
    setCostInterval(contract.costInterval);
    setUnitCost(String(contract.unitCost));
    setQuantityPurchased(String(contract.quantityPurchased));
    setContractCurrency(contract.currency);
    setTaxRate(String(contract.taxRate || 0));
    setStartDate(contract.startDate);
    setEndDate(contract.endDate);
    setRenewalDate(contract.renewalDate || '');
    setUnusedCompanyId(contract.unusedCostTag?.companyId || contract.companyId);
    setUnusedDept(contract.unusedCostTag?.department || 'Operations');
    setPaymentDueDate(contract.paymentDueDate || '');
    setPaymentReminderDate(contract.paymentReminderDate || '');
    setSplitPackageCost(!!contract.splitPackageCost);
    setEditingContractId(contract.id);
    setShowContractForm(true);
    setShowVendorForm(false);
  };

  // Update contract splits
  const handleUpdateContractSplits = async (contractId, newSplits) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;
    
    const updatedContract = {
      ...contract,
      splits: newSplits
    };
    
    try {
      await onSaveContract(updatedContract);
      onShowToast("Updated contract cost splits successfully.", "success");
    } catch (err) {
      onShowToast(`Error updating splits: ${err.message}`, "warning");
    }
  };

  // Submit Contract
  const handleContractSubmit = async (e) => {
    e.preventDefault();
    if (!contractName.trim() || !contractVendorId || !contractCompanyId || !unitCost || !startDate || !endDate) {
      onShowToast("Please enter all required contract fields.", "warning");
      return;
    }

    const targetContract = contracts.find(c => c.id === editingContractId);
    const attachedDocs = targetContract ? (targetContract.documents || []) : [];

    const updatedContract = {
      id: editingContractId || `contract-${Date.now()}`,
      vendorId: contractVendorId,
      companyId: contractCompanyId,
      name: contractName.trim(),
      costInterval,
      unitCost: Number(unitCost),
      quantityPurchased: Number(quantityPurchased),
      currency: contractCurrency,
      taxRate: Number(taxRate) || 0,
      startDate,
      endDate,
      renewalDate: renewalDate || endDate,
      unusedCostTag: { companyId: unusedCompanyId, department: unusedDept },
      paymentDueDate: paymentDueDate || null,
      paymentReminderDate: paymentReminderDate || null,
      splitPackageCost,
      documents: attachedDocs
    };

    try {
      await onSaveContract(updatedContract);
      onShowToast(
        editingContractId 
          ? `Updated contract parameters for "${contractName}"` 
          : `Registered contract agreement "${contractName}"`, 
        "success"
      );
      
      // Reset
      setContractName('');
      setUnitCost('');
      setQuantityPurchased('1');
      setTaxRate('20.0');
      setStartDate('');
      setEndDate('');
      setRenewalDate('');
      setPaymentDueDate('');
      setPaymentReminderDate('');
      setSplitPackageCost(false);
      setEditingContractId(null);
      setShowContractForm(false);
    } catch (err) {
      onShowToast(`Error saving contract: ${err.message}`, "warning");
    }
  };

  // Calculate payment alert flags
  const getPaymentAlert = (dueDateStr) => {
    if (!dueDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { type: 'overdue', text: `Overdue by ${Math.abs(diffDays)} days`, color: 'var(--danger)' };
    } else if (diffDays === 0) {
      return { type: 'today', text: 'Due Today', color: 'var(--danger)' };
    } else if (diffDays <= 7) {
      return { type: 'soon', text: `Due in ${diffDays} days`, color: 'var(--warning)' };
    }
    return null;
  };

  // Forecast calculations (next 12 months)
  const getForecastData = () => {
    const months = [];
    const date = new Date('2026-07-01'); // anchor start: July 2026
    for (let i = 0; i < 12; i++) {
      months.push(new Date(date.getFullYear(), date.getMonth() + i, 1));
    }

    const forecastData = months.map(m => {
      const year = m.getFullYear();
      const monthIndex = m.getMonth();
      const monthStr = m.toLocaleString('default', { month: 'short' }) + ' ' + year;

      let fixedCosts = 0;
      let assignedCosts = 0;
      let unusedCosts = 0;
      const renewalsList = [];

      contracts
        .forEach(c => {
          const cStart = new Date(c.startDate);
          const cEnd = new Date(c.endDate);
          const currentMonthDate = new Date(year, monthIndex, 1);

          if (cStart <= new Date(year, monthIndex + 1, 0) && cEnd >= currentMonthDate) {
            
            // Calculate base monthly cost (excluding tax) converted to GBP
            let monthlyTotal = 0;
            const unitCostGBP = toGBP(c.unitCost, c.currency);
            
            if (c.costInterval === 'monthly') {
              monthlyTotal = unitCostGBP * c.quantityPurchased;
            } else if (c.costInterval === 'annual') {
              monthlyTotal = (unitCostGBP * c.quantityPurchased) / 12;
            } else if (c.costInterval === 'one_time' && cEnd.getMonth() === monthIndex && cEnd.getFullYear() === year) {
              monthlyTotal = unitCostGBP * c.quantityPurchased;
            }

            const taxFactor = 1 + (Number(c.taxRate || 0) / 100);
            const monthlyTotalWithTax = monthlyTotal * taxFactor;

            if (c.quantityPurchased === 1) {
              fixedCosts += monthlyTotalWithTax;
            } else {
              const assignedSeats = assetAssignments.filter(a => a.contractId === c.id).length;
              const unusedSeats = Math.max(0, c.quantityPurchased - assignedSeats);
              const costPerSeatWithTax = unitCostGBP * taxFactor;
              
              assignedCosts += assignedSeats * costPerSeatWithTax;
              unusedCosts += unusedSeats * costPerSeatWithTax;
            }

            if (cEnd.getMonth() === monthIndex && cEnd.getFullYear() === year) {
              renewalsList.push(c.name);
            }
          }
        });

      return {
        month: monthStr,
        fixed: fixedCosts,
        assigned: assignedCosts,
        unused: unusedCosts,
        total: fixedCosts + assignedCosts + unusedCosts,
        renewals: renewalsList
      };
    });

    return forecastData;
  };

  // Resolve active staff headcount per company for a given month
  const getActiveHeadcountsForMonth = (year, monthIndex) => {
    const periodStart = new Date(year, monthIndex, 1);
    const periodEnd = new Date(year, monthIndex + 1, 0);

    const activeStaff = staff.filter(s => {
      // Exclude staff that exited before this month
      if (s.status === 'exited' && s.exitDate) {
        const exit = new Date(s.exitDate);
        if (exit < periodStart) return false;
      }
      // Exclude staff that joined after this month
      if (s.joinDate) {
        const join = new Date(s.joinDate);
        if (join > periodEnd) return false;
      }
      return s.status !== 'exited' || (s.exitDate && new Date(s.exitDate) >= periodStart);
    });

    const counts = {};
    companies.forEach(c => {
      counts[c.id] = 0;
    });

    activeStaff.forEach(s => {
      if (s.companyId) {
        counts[s.companyId] = (counts[s.companyId] || 0) + 1;
      }
    });

    return counts;
  };

  const getSplitProRataShares = (splits, year, monthIndex) => {
    const periodStart = new Date(year, monthIndex, 1);
    const periodEnd = new Date(year, monthIndex + 1, 0);

    const activeStaff = staff.filter(s => {
      if (s.status === 'exited' && s.exitDate) {
        const exit = new Date(s.exitDate);
        if (exit < periodStart) return false;
      }
      if (s.joinDate) {
        const join = new Date(s.joinDate);
        if (join > periodEnd) return false;
      }
      return s.status !== 'exited' || (s.exitDate && new Date(s.exitDate) >= periodStart);
    });

    const counts = splits.map(s => {
      if (s.type === 'company') {
        return activeStaff.filter(member => member.companyId === s.targetId).length;
      } else if (s.type === 'department') {
        return activeStaff.filter(member => member.department === s.targetId).length;
      } else if (s.type === 'user') {
        return activeStaff.some(member => member.id === s.targetId) ? 1 : 0;
      }
      return 0;
    });

    const totalCount = counts.reduce((a, b) => a + b, 0);

    return splits.map((s, idx) => {
      const count = counts[idx];
      const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;
      return {
        ...s,
        percentage: Math.round(percentage)
      };
    });
  };

  const getContractCompanyShare = (c, companyId, year, monthIndex) => {
    const splits = c.splits || [];
    if (c.useHeadcountSplit) {
      if (splits.length === 0) {
        const headcounts = getActiveHeadcountsForMonth(year, monthIndex);
        const total = Object.values(headcounts).reduce((a, b) => a + b, 0);
        const count = headcounts[companyId] || 0;
        return total > 0 ? (count / total) : 0;
      } else {
        const activeStaff = staff.filter(s => {
          const periodStart = new Date(year, monthIndex, 1);
          const periodEnd = new Date(year, monthIndex + 1, 0);
          if (s.status === 'exited' && s.exitDate) {
            const exit = new Date(s.exitDate);
            if (exit < periodStart) return false;
          }
          if (s.joinDate) {
            const join = new Date(s.joinDate);
            if (join > periodEnd) return false;
          }
          return s.status !== 'exited' || (s.exitDate && new Date(s.exitDate) >= periodStart);
        });

        const counts = splits.map(s => {
          if (s.type === 'company') {
            return activeStaff.filter(member => member.companyId === s.targetId).length;
          } else if (s.type === 'department') {
            return activeStaff.filter(member => member.department === s.targetId).length;
          } else if (s.type === 'user') {
            return activeStaff.some(member => member.id === s.targetId) ? 1 : 0;
          }
          return 0;
        });

        const totalCount = counts.reduce((a, b) => a + b, 0);
        if (totalCount <= 0) return 0;

        let companyShare = 0;
        splits.forEach((s, idx) => {
          const count = counts[idx];
          const targetShare = count / totalCount;
          
          if (s.type === 'company' && s.targetId === companyId) {
            companyShare += targetShare;
          } else if (s.type === 'department') {
            const deptStaff = activeStaff.filter(member => member.department === s.targetId);
            const targetCompStaffCount = deptStaff.filter(member => member.companyId === companyId).length;
            if (deptStaff.length > 0) {
              companyShare += targetShare * (targetCompStaffCount / deptStaff.length);
            }
          } else if (s.type === 'user' && s.targetId) {
            const member = activeStaff.find(member => member.id === s.targetId);
            if (member && member.companyId === companyId) {
              companyShare += targetShare;
            }
          }
        });

        return companyShare;
      }
    } else {
      if (splits.length === 0) {
        return c.companyId === companyId ? 1.0 : 0;
      }

      let companyShare = 0;
      const totalManualPercentage = splits.reduce((acc, curr) => acc + Number(curr.percentage || 0), 0);
      
      splits.forEach(s => {
        const manualPct = Number(s.percentage || 0) / 100;
        if (s.type === 'company' && s.targetId === companyId) {
          companyShare += manualPct;
        } else if (s.type === 'department') {
          const activeStaff = staff.filter(member => {
            const periodStart = new Date(year, monthIndex, 1);
            const periodEnd = new Date(year, monthIndex + 1, 0);
            if (member.status === 'exited' && member.exitDate) {
              const exit = new Date(member.exitDate);
              if (exit < periodStart) return false;
            }
            if (member.joinDate) {
              const join = new Date(member.joinDate);
              if (join > periodEnd) return false;
            }
            return member.status !== 'exited' || (member.exitDate && new Date(member.exitDate) >= periodStart);
          });
          const deptStaff = activeStaff.filter(member => member.department === s.targetId);
          const targetCompStaffCount = deptStaff.filter(member => member.companyId === companyId).length;
          if (deptStaff.length > 0) {
            companyShare += manualPct * (targetCompStaffCount / deptStaff.length);
          }
        } else if (s.type === 'user' && s.targetId) {
          const member = staff.find(member => member.id === s.targetId);
          if (member && member.companyId === companyId) {
            companyShare += manualPct;
          }
        }
      });

      if (c.companyId === companyId) {
        const fallbackShare = Math.max(0, 100 - totalManualPercentage) / 100;
        companyShare += fallbackShare;
      }
      return companyShare;
    }
  };

  const forecastPoints = getForecastData();
  const activeCurrencySymbol = symbolMap[forecastCurrency] || '£';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Sub-tab Navigation (Premium Glassmorphic Segmented Control) */}
      <div style={{ 
        display: 'flex', 
        backgroundColor: 'rgba(30, 41, 59, 0.5)', 
        border: '1px solid var(--border-color)',
        borderRadius: '30px',
        padding: '5px',
        width: 'fit-content',
        gap: '6px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        {[
          { key: 'vendors', label: '📁 Vendor Directory' },
          { key: 'contracts', label: '📜 Contracts & Leases' },
          { key: 'allocations', label: '🔑 License Allocations' },
          { key: 'forecast', label: '📊 Expense Forecasting' }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            style={{
              background: activeSubTab === t.key ? 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' : 'none',
              border: 'none',
              color: activeSubTab === t.key ? '#fff' : 'var(--text-secondary)',
              padding: '10px 20px',
              borderRadius: '24px',
              fontWeight: 700,
              fontSize: '12.5px',
              cursor: 'pointer',
              boxShadow: activeSubTab === t.key ? '0 4px 15px rgba(99, 102, 241, 0.2)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ==============================================================
          VENDOR PROFILE DETAILS SCREEN
          ============================================================== */}
      {selectedVendorProfileId ? (() => {
        const v = vendors.find(vend => vend.id === selectedVendorProfileId);
        if (!v) {
          setSelectedVendorProfileId(null);
          return null;
        }

        const vendorContracts = contracts.filter(c => c.vendorId === v.id);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.2s' }}>
            {/* Header / Back Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  setSelectedVendorProfileId(null);
                  setShowContractForm(false);
                  setShowVendorForm(false);
                }}
                style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                ← Back to Vendor Directory
              </button>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" onClick={() => handleEditVendor(v)} title="Edit Vendor Details">
                  <Edit3 size={14} /> Edit Partner
                </button>
                <button className="btn-secondary delete" onClick={() => {
                  if (window.confirm(`Are you sure you want to delete vendor "${v.name}"?`)) {
                    onDeleteVendor(v.id);
                    onShowToast(`Deleted vendor "${v.name}"`, "info");
                    setSelectedVendorProfileId(null);
                  }
                }} title="Delete Vendor Partner">
                  <Trash2 size={14} /> Delete Partner
                </button>
              </div>
            </div>

            {/* Vendor Details Card */}
            <div className="entity-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--primary)', height: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{v.name}</h2>
                  <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{v.category}</span>
                </div>
              </div>
              {v.description && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
                  {v.description}
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                {v.contactEmail && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={12} />
                    <strong>Email:</strong> <a href={`mailto:${v.contactEmail}`} style={{ color: 'var(--accent)' }}>{v.contactEmail}</a>
                  </span>
                )}
                {v.phone && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={12} />
                    <strong>Phone:</strong> <a href={`tel:${v.phone}`} style={{ color: 'var(--accent)' }}>{v.phone}</a>
                  </span>
                )}
                <span>
                  <strong>Active Contracts:</strong> {vendorContracts.length}
                </span>
              </div>
            </div>



            {/* Contracts & Licenses list */}
            <div className="detail-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} /> Contracts & Landlord Leases ({vendorContracts.length})
                </h3>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    setEditingContractId(null);
                    setContractName('');
                    setContractVendorId(v.id);
                    setUnitCost('');
                    setQuantityPurchased('1');
                    setTaxRate('20.0');
                    setStartDate('');
                    setEndDate('');
                    setRenewalDate('');
                    setPaymentDueDate('');
                    setPaymentReminderDate('');
                    setShowContractForm(prev => !prev);
                  }}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <Plus size={14} /> Register New Contract
                </button>
              </div>



              {/* List of Contracts */}
              {vendorContracts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
                  No active contracts or leases registered under this vendor partner.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {vendorContracts.map(c => {
                    const assigned = assetAssignments.filter(a => a.contractId === c.id);
                    const assignedCount = assigned.length;
                    const unusedCount = Math.max(0, c.quantityPurchased - assignedCount);
                    const symbol = symbolMap[c.currency] || '£';
                    const taxFactor = 1 + ((c.taxRate || 0) / 100);
                    const seatCostPerMonth = (c.costInterval === 'annual' ? (c.unitCost / 12) : (c.costInterval === 'one_time' || c.costInterval === 'one-off' ? 0 : c.unitCost));
                    const costPerSeatWithTax = seatCostPerMonth * taxFactor;
                    const unusedCostWithTax = unusedCount * costPerSeatWithTax;
                    const intervalSuffix = c.costInterval === 'monthly' ? '/mo' : (c.costInterval === 'annual' ? '/yr' : ' (one-off)');
                    const matchedCompany = companies.find(comp => comp.id === c.companyId);

                    return (
                      <div key={c.id} className="entity-card" style={{ height: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{c.name}</h4>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Billed to: <strong>{matchedCompany ? matchedCompany.name : 'Group'}</strong> &bull; Cost: <strong>{symbol}{c.unitCost}{intervalSuffix}</strong> {c.taxRate > 0 && `(+${c.taxRate}% VAT)`} &bull; Qty: <strong>{c.quantityPurchased}</strong>
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warning)' }}>
                                Unused: {symbol}{unusedCostWithTax.toFixed(2)}/mo
                              </span>
                              <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                {unusedCount} unallocated seats
                              </div>
                            </div>
                            <button className="btn-icon" onClick={() => {
                              // Edit Contract details
                              setEditingContractId(c.id);
                              setContractName(c.name);
                              setUnusedCompanyId(c.companyId || companies[0].id);
                              setUnitCost(c.unitCost || '');
                              setQuantityPurchased(c.quantityPurchased || '1');
                              setContractCurrency(c.currency || 'GBP');
                              setTaxRate(c.taxRate || '20.0');
                              setCostInterval(c.costInterval || 'monthly');
                              setStartDate(c.startDate || '');
                              setEndDate(c.endDate || '');
                              setRenewalDate(c.renewalDate || '');
                              setPaymentDueDate(c.paymentDueDate || '');
                              setPaymentReminderDate(c.paymentReminderDate || '');
                              setUnusedDept(c.unusedDept || 'Operations');
                              setShowContractForm(true);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }} title="Edit Contract details">
                              <Edit3 size={11} />
                            </button>
                            <button className="btn-icon delete" onClick={() => {
                              if (window.confirm(`Are you sure you want to delete contract "${c.name}"?`)) {
                                onDeleteContract(c.id);
                                onShowToast(`Deleted contract "${c.name}"`, "info");
                              }
                            }} title="Delete Contract">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        {/* If software license */}
                        {(() => {
                          const matchedVendor = vendors.find(vend => vend.id === c.vendorId);
                          return matchedVendor && matchedVendor.category === 'Software License';
                        })() && (
                          <div>
                            {/* Progress bar */}
                            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, (assignedCount / c.quantityPurchased) * 100)}%`, height: '100%', backgroundColor: 'var(--primary)' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              <span><strong>{assignedCount} Assigned</strong></span>
                              <span><strong>{c.quantityPurchased} Seats Total</strong></span>
                            </div>

                            {/* Assignments Grid */}
                            {assigned.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 40px', gap: '8px', padding: '6px 12px', backgroundColor: 'var(--bg-secondary)', fontSize: '9px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                  <div>Staff Member</div>
                                  <div>Email / Alias</div>
                                  <div>Notes</div>
                                  <div style={{ textAlign: 'center' }}>Release</div>
                                </div>
                                {assigned.map(a => {
                                  const member = staff.find(s => s.id === a.staffId);
                                  if (!member) return null;
                                  return (
                                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 40px', gap: '8px', padding: '6px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.01)', alignItems: 'center', fontSize: '11px' }}>
                                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{member.fullName}</div>
                                      <div>
                                        <input 
                                          type="text" 
                                          placeholder="Enter Email/Alias" 
                                          defaultValue={a.email || ''} 
                                          onBlur={(e) => handleUpdateAssignmentField(a.id, 'email', e.target.value)}
                                          style={{ width: '100%', padding: '2px 6px', fontSize: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                        />
                                      </div>
                                      <div>
                                        <input 
                                          type="text" 
                                          placeholder="Add notes..." 
                                          defaultValue={a.notes || ''} 
                                          onBlur={(e) => handleUpdateAssignmentField(a.id, 'notes', e.target.value)}
                                          style={{ width: '100%', padding: '2px 6px', fontSize: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <button 
                                          onClick={() => handleReleaseSeat(a.id, c.name, member.fullName)}
                                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Allocate Seat Form */}
                            {unusedCount > 0 && (() => {
                              const activeStaffList = staff.filter(s => s.status !== 'exited');
                              if (activeStaffList.length === 0) return null;
                              const sortedStaffSingle = [...activeStaffList].sort((a, b) => a.fullName.localeCompare(b.fullName));

                              return (
                                <form 
                                  onSubmit={(e) => handleAllocateSeatInline(e, c.id, c.name)} 
                                  style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.01)', padding: '6px', borderRadius: '4px', border: '1px dashed var(--border-color)', width: 'fit-content', flexWrap: 'wrap', marginTop: '10px' }}
                                >
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Allocate:</span>
                                  <select name="staffSelect" className="select-filter" style={{ padding: '3px 6px', fontSize: '11px', minWidth: '130px' }} required>
                                    <option value="">-- Choose Staff --</option>
                                    {sortedStaffSingle.map(s => (
                                      <option key={s.id} value={s.id}>{s.fullName}</option>
                                    ))}
                                  </select>
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Qty:</span>
                                  <input type="number" name="quantityInput" min="1" max={unusedCount} defaultValue="1" style={{ width: '45px', padding: '3px 4px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} required />
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email:</span>
                                  <input type="text" name="emailInput" placeholder="Email/Alias" style={{ width: '100px', padding: '3px 4px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes:</span>
                                  <input type="text" name="notesInput" placeholder="Notes..." style={{ width: '100px', padding: '3px 4px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                                  <button type="submit" className="btn-primary" style={{ padding: '3px 8px', fontSize: '10px' }}>Assign</button>
                                </form>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })() : (
        <>
          {/* ==============================================================
              SUB-TAB 1: VENDOR REGISTER DIRECTORY
              ============================================================== */}
          {activeSubTab === 'vendors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Vendor Directory & Partners</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Register service providers, software vendors, and office landlords.</p>
            </div>
            
            <button className="btn-primary" onClick={() => {
              setEditingVendorId(null);
              setVendorName('');
              setVendorEmail('');
              setVendorPhone('');
              setVendorDesc('');
              setPresetCategory('Software License');
              setVendorCategory('Software License');
              setShowVendorForm(prev => !prev);
            }}>
              <Plus size={16} /> Add Vendor Partner
            </button>
          </div>

          {/* Vendors Spreadsheet Grid Table */}
          <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Vendor Name</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Category</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Contact Email</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Phone Number</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '120px' }}>Active Contracts</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Description / Notes</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v, idx) => {
                  const catStyles = getCategoryStyles(v.category);
                  const vendorContracts = contracts.filter(c => c.vendorId === v.id);
                  return (
                    <tr 
                      key={v.id} 
                      onClick={() => setSelectedVendorProfileId(v.id)}
                      className="table-row-hover"
                      style={{ 
                        cursor: 'pointer',
                        backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                        borderBottom: '1px solid var(--border-color)'
                      }}
                    >
                      <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {v.name}
                      </td>
                      <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px' }}>
                        <span style={{ 
                          fontSize: '9.5px', 
                          color: catStyles.badgeColor, 
                          fontWeight: 700, 
                          textTransform: 'uppercase',
                          backgroundColor: catStyles.bg,
                          border: `1px solid ${catStyles.border}`,
                          padding: '1px 6px',
                          borderRadius: '8px',
                          display: 'inline-block'
                        }}>
                          {catStyles.indicator} {v.category}
                        </span>
                      </td>
                      <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-secondary)' }}>
                        {v.contactEmail ? <a href={`mailto:${v.contactEmail}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--primary)' }}>{v.contactEmail}</a> : '—'}
                      </td>
                      <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {v.phone || '—'}
                      </td>
                      <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                        {vendorContracts.length}
                      </td>
                      <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.description || '—'}
                      </td>
                      <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button className="btn-icon" onClick={() => handleEditVendor(v)} title="Edit Vendor" style={{ padding: '4px', borderRadius: '4px' }}>
                            <Edit3 size={11} />
                          </button>
                          <button className="btn-icon delete" onClick={() => {
                            if (window.confirm(`Are you sure you want to delete vendor "${v.name}"?`)) {
                              onDeleteVendor(v.id);
                              onShowToast(`Deleted vendor "${v.name}"`, "info");
                            }
                          }} title="Delete Vendor" style={{ padding: '4px', borderRadius: '4px' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {vendors.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ border: '1px solid var(--border-color)', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No registered vendor partners found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

          {activeSubTab === 'contracts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Contracts & Landlord Leases</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Manage software license pools, landlord leases, payment schedules, and currency settings.</p>
            </div>
            
            <button className="btn-primary" onClick={() => {
              setEditingContractId(null);
              setContractName('');
              setUnitCost('');
              setQuantityPurchased('1');
              setTaxRate('20.0');
              setStartDate('');
              setEndDate('');
              setRenewalDate('');
              setPaymentDueDate('');
              setPaymentReminderDate('');
              setShowContractForm(prev => !prev);
            }}>
              <Plus size={16} /> Register Contract
            </button>
          </div>

          {/* Contracts Spreadsheet Grid Table */}
          <div className="table-container" style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Contract Name</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Vendor Partner</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'left', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)' }}>Paying Entity</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '130px' }}>Cost Splits</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '140px' }}>Unit Cost</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '80px' }}>Qty (Seats)</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '110px' }}>Allocations</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'right', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '140px' }}>Equiv. Monthly Cost</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '90px' }}>Interval</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '100px' }}>Start Date</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '100px' }}>End Date</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '110px' }}>Next Payment Due</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '60px' }}>Docs</th>
                  <th style={{ border: '1px solid var(--border-color)', padding: '8px 10px', textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-primary)', width: '140px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract, idx) => {
                  const matchedVendor = vendors.find(v => v.id === contract.vendorId);
                  const matchedCompany = companies.find(c => c.id === contract.companyId);
                  const symbol = symbolMap[contract.currency] || '£';
                  
                  const unitCostGBP = toGBP(contract.unitCost, contract.currency);
                  const rawCost = unitCostGBP * contract.quantityPurchased;
                  const taxRateVal = contract.taxRate || 0;
                  const taxAmount = (rawCost * taxRateVal) / 100;
                  const totalWithTax = rawCost + taxAmount;

                  const monthlyCostEquivalent = contract.costInterval === 'monthly'
                    ? totalWithTax
                    : contract.costInterval === 'annual'
                    ? totalWithTax / 12
                    : totalWithTax;

                  const alert = getPaymentAlert(contract.paymentDueDate);
                  const catStyles = getCategoryStyles(matchedVendor?.category);

                  return (
                    <React.Fragment key={contract.id}>
                      <tr 
                        onClick={() => handleEditContract(contract)}
                        className="table-row-hover"
                        style={{ 
                          cursor: 'pointer',
                          backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                          borderBottom: '1px solid var(--border-color)'
                        }}
                      >
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {contract.name}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-secondary)' }}>
                          {matchedVendor ? matchedVendor.name : '—'}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', color: 'var(--text-secondary)' }}>
                          {matchedCompany ? matchedCompany.name : 'Group'}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const splits = contract.splits || [];
                            const splitsCount = splits.length;
                            const totalSplitPercentage = splits.reduce((acc, curr) => acc + Number(curr.percentage || 0), 0);
                            
                            return (
                              <span 
                                onClick={() => {
                                  setExpandedSplitsContractId(expandedSplitsContractId === contract.id ? null : contract.id);
                                  setExpandedContractId(null); // Close seat allocations drawer if open
                                }}
                                style={{ 
                                  cursor: 'pointer',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  backgroundColor: expandedSplitsContractId === contract.id 
                                    ? 'var(--accent)' 
                                    : (splitsCount > 0 ? 'rgba(167, 139, 250, 0.08)' : 'rgba(255, 255, 255, 0.03)'),
                                  color: expandedSplitsContractId === contract.id 
                                    ? '#fff' 
                                    : (splitsCount > 0 ? '#a78bfa' : 'var(--text-muted)'),
                                  border: '1px solid var(--border-color)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.2s'
                                }}
                              >
                                🔗 {splitsCount > 0 ? `${splitsCount} Splits (${totalSplitPercentage}%)` : 'Assign Splits'}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {symbol}{contract.unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                          {contract.quantityPurchased}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const isSoftware = matchedVendor && matchedVendor.category === 'Software License';
                            if (!isSoftware) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
                            const assigned = assetAssignments.filter(a => a.contractId === contract.id);
                            const assignedCount = assigned.length;
                            const unusedCount = Math.max(0, contract.quantityPurchased - assignedCount);
                            return (
                              <span 
                                onClick={() => setExpandedContractId(expandedContractId === contract.id ? null : contract.id)}
                                style={{ 
                                  cursor: 'pointer',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: expandedContractId === contract.id 
                                    ? 'var(--primary)' 
                                    : (unusedCount > 0 ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)'),
                                  color: expandedContractId === contract.id 
                                    ? '#fff' 
                                    : (unusedCount > 0 ? '#38bdf8' : '#34d399'),
                                  border: '1px solid var(--border-color)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  boxShadow: expandedContractId === contract.id ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none',
                                  transition: 'all 0.2s'
                                }}
                              >
                                👥 {assignedCount} / {contract.quantityPurchased}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--success)', fontWeight: 700 }}>
                          £{monthlyCostEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }}>
                          <span style={{ 
                            fontSize: '10px', 
                            textTransform: 'uppercase', 
                            fontWeight: 700, 
                            color: contract.costInterval === 'monthly' ? '#38bdf8' : (contract.costInterval === 'annual' ? '#fbbf24' : '#a78bfa'),
                            backgroundColor: contract.costInterval === 'monthly' ? 'rgba(56, 189, 248, 0.08)' : (contract.costInterval === 'annual' ? 'rgba(251, 191, 36, 0.08)' : 'rgba(167, 139, 250, 0.08)'),
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {contract.costInterval}
                          </span>
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {contract.startDate || '—'}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {contract.endDate || '—'}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: alert ? alert.color : 'inherit', fontWeight: alert ? 700 : 'normal' }}>{contract.paymentDueDate || '—'}</span>
                            {alert && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: alert.color }} title={alert.text} />}
                          </div>
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {(contract.documents || []).length > 0 ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              {(contract.documents || []).slice(0, 2).map(doc => (
                                <a key={doc.id} href="#" onClick={(e) => { e.preventDefault(); handlePreviewInvoice(doc); }} style={{ color: 'var(--primary)' }} title={`Preview: ${doc.name}`}>
                                  <FileText size={12} />
                                </a>
                              ))}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '6px 10px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {uploadContractId === contract.id ? (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                              <input 
                                type="file" 
                                onChange={(e) => handleFileUpload(e, contract.id)} 
                                style={{ fontSize: '10px', width: '110px' }} 
                              />
                              <button type="button" className="btn-secondary" onClick={() => setUploadContractId(null)} style={{ padding: '2px 4px', fontSize: '9px' }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button className="btn-icon" onClick={() => setUploadContractId(contract.id)} title="Attach Invoice Document" style={{ padding: '4px', borderRadius: '4px' }}>
                                <Plus size={11} />
                              </button>
                              <button className="btn-icon" onClick={() => handleEditContract(contract)} title="Edit Contract" style={{ padding: '4px', borderRadius: '4px' }}>
                                <Edit3 size={11} />
                              </button>
                              <button className="btn-icon delete" onClick={() => {
                                if (window.confirm(`Are you sure you want to delete contract "${contract.name}"?`)) {
                                  onDeleteContract(contract.id);
                                  onShowToast(`Deleted contract "${contract.name}"`, "info");
                                }
                              }} title="Delete Contract" style={{ padding: '4px', borderRadius: '4px' }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      
                  {expandedContractId === contract.id && (() => {
                        const isSoftware = matchedVendor && matchedVendor.category === 'Software License';
                        if (!isSoftware) return null;
                        const assigned = assetAssignments.filter(a => a.contractId === contract.id);
                        const assignedCount = assigned.length;
                        const isPackage = !!contract.splitPackageCost;
                        const unusedCount = isPackage ? 999999 : Math.max(0, contract.quantityPurchased - assignedCount);
                        const activeStaffList = staff.filter(s => s.status !== 'exited');
                        const sortedStaff = [...activeStaffList].sort((a, b) => a.fullName.localeCompare(b.fullName));

                        return (
                          <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.25)' }}>
                            <td colSpan="14" style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                                    Manage Seat Allocations for "{contract.name}"
                                  </h4>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    {isPackage 
                                      ? `Allocations: ${assignedCount} assigned users (Unlimited package pool)`
                                      : `Remaining: ${unusedCount} unallocated seats`
                                    }
                                  </span>
                                </div>

                                {assigned.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {assigned.map(a => {
                                      const member = staff.find(s => s.id === a.staffId);
                                      if (!member) return null;
                                      return (
                                        <div key={a.id} style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          gap: '8px', 
                                          backgroundColor: 'var(--bg-secondary)', 
                                          border: '1px solid var(--border-color)', 
                                          padding: '4px 10px', 
                                          borderRadius: '6px',
                                          fontSize: '11.5px' 
                                        }}>
                                          <strong style={{ color: 'var(--text-primary)' }}>${member.fullName}</strong>
                                          {a.email && <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>(${a.email})</span>}
                                          <button 
                                            onClick={() => handleReleaseSeat(a.id, contract.name, member.fullName)}
                                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '12px', padding: 0, marginLeft: '4px' }}
                                            title="Release Seat"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    No staff users allocated to this license pool yet. Choose a member below to assign.
                                  </div>
                                )}

                                {isPackage || unusedCount > 0 ? (
                                  <form 
                                    onSubmit={async (e) => {
                                      await handleAllocateSeatInline(e, contract.id, contract.name);
                                    }}
                                    style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}
                                  >
                                    <select name="staffSelect" className="select-filter" style={{ padding: '4px 8px', fontSize: '11px', minWidth: '160px' }} required>
                                      <option value="">-- Choose Staff Member --</option>
                                      {sortedStaff.map(s => (
                                        <option key={s.id} value={s.id}>${s.fullName}</option>
                                      ))}
                                    </select>
                                    
                                    <input 
                                      type="text" 
                                      name="emailInput" 
                                      placeholder="Optional Email/Alias" 
                                      style={{ width: '160px', padding: '4px 8px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                    />
 
                                    <input 
                                      type="text" 
                                      name="notesInput" 
                                      placeholder="Optional Notes..." 
                                      style={{ width: '160px', padding: '4px 8px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                    />
 
                                    <button type="submit" className="btn-primary" style={{ padding: '4px 14px', fontSize: '11px' }}>
                                      Assign Seat
                                    </button>
                                  </form>
                                ) : (
                                  <div style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: 600, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '10px' }}>
                                    ⚠️ All license seats are fully allocated. Release an existing user to assign a new one.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })()}
                    {expandedSplitsContractId === contract.id && (() => {
                      const splits = contract.splits || [];
                      const totalSplitPercentage = splits.reduce((acc, curr) => acc + Number(curr.percentage || 0), 0);
                      const activeStaffList = staff.filter(s => s.status !== 'exited');
                      const sortedStaff = [...activeStaffList].sort((a, b) => a.fullName.localeCompare(b.fullName));

                      const renderCheckboxItem = (id, type, name) => {
                        const isChecked = splits.some(s => s.type === type && s.targetId === id);
                        const splitItem = splits.find(s => s.type === type && s.targetId === id);

                        // Resolve dynamic pro-rata share if Automatic is selected
                        let proRataLabel = '';
                        if (contract.useHeadcountSplit && splits.length > 0) {
                          const shares = getSplitProRataShares(splits, new Date().getFullYear(), new Date().getMonth());
                          const matchedShare = shares.find(s => s.type === type && s.targetId === id);
                          proRataLabel = matchedShare ? `${matchedShare.percentage}%` : '0%';
                        }

                        return (
                          <div 
                            key={id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              gap: '8px', 
                              fontSize: '11px', 
                              padding: '6px 8px', 
                              borderRadius: '4px', 
                              backgroundColor: isChecked ? 'rgba(167, 139, 250, 0.05)' : 'transparent', 
                              border: isChecked ? '1px solid rgba(167, 139, 250, 0.2)' : '1px solid transparent',
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={async (e) => {
                                  let updatedSplits;
                                  if (e.target.checked) {
                                    updatedSplits = [...splits, { type, targetId: id, percentage: 0 }];
                                  } else {
                                    updatedSplits = splits.filter(s => !(s.type === type && s.targetId === id));
                                  }
                                  await handleUpdateContractSplits(contract.id, updatedSplits);
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isChecked ? 600 : 400 }}>{name}</span>
                            </div>
                            {isChecked && (
                              <div>
                                {contract.useHeadcountSplit ? (
                                  <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '11px' }}>{proRataLabel}</span>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <input
                                      type="number"
                                      value={splitItem.percentage || 0}
                                      onChange={async (e) => {
                                        const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                        const updatedSplits = splits.map(s => {
                                          if (s.type === type && s.targetId === id) {
                                            return { ...s, percentage: pct };
                                          }
                                          return s;
                                        });
                                        const total = updatedSplits.reduce((sum, item) => sum + item.percentage, 0);
                                        if (total > 100) {
                                          onShowToast(`Cannot set to ${pct}%. Total manual split would exceed 100% (currently ${total}%).`, 'warning');
                                          return;
                                        }
                                        await handleUpdateContractSplits(contract.id, updatedSplits);
                                      }}
                                      style={{ 
                                        width: '45px', 
                                        padding: '2px 4px', 
                                        fontSize: '10.5px', 
                                        textAlign: 'center', 
                                        background: 'var(--bg-card)', 
                                        border: '1px solid var(--border-color)', 
                                        color: 'var(--text-primary)', 
                                        borderRadius: '4px' 
                                      }}
                                    />
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '10.5px' }}>%</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <tr style={{ backgroundColor: 'rgba(167, 139, 250, 0.02)' }}>
                          <td colSpan="14" style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa', margin: 0 }}>
                                  Cost Splits & Distributions for "{contract.name}"
                                </h4>
                                <div style={{ display: 'flex', gap: '8px', backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '4px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const updatedContract = { ...contract, useHeadcountSplit: true };
                                      try {
                                        await onSaveContract(updatedContract);
                                        onShowToast("Dynamic headcount split active.", "success");
                                      } catch (err) {
                                        onShowToast("Error updating split mode: " + err.message, "warning");
                                      }
                                    }}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '11px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      border: 'none',
                                      backgroundColor: contract.useHeadcountSplit ? 'var(--primary)' : 'transparent',
                                      color: contract.useHeadcountSplit ? '#fff' : 'var(--text-secondary)',
                                      fontWeight: 600
                                    }}
                                  >
                                    👥 Automatic (Staff Headcount)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const updatedContract = { ...contract, useHeadcountSplit: false };
                                      try {
                                        await onSaveContract(updatedContract);
                                        onShowToast("Manual percentage splits active.", "success");
                                      } catch (err) {
                                        onShowToast("Error updating split mode: " + err.message, "warning");
                                      }
                                    }}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '11px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      border: 'none',
                                      backgroundColor: !contract.useHeadcountSplit ? 'var(--primary)' : 'transparent',
                                      color: !contract.useHeadcountSplit ? '#fff' : 'var(--text-secondary)',
                                      fontWeight: 600
                                    }}
                                  >
                                    ⚙️ Manual Override (%)
                                  </button>
                                </div>
                              </div>

                              {contract.useHeadcountSplit && (
                                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(56, 189, 248, 0.04)', border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: '6px', fontSize: '11px', color: '#38bdf8' }}>
                                  {splits.length === 0 ? (
                                    <span>
                                      ℹ️ <strong>Global Mode</strong>: Cost is dynamically split pro-rata across <strong>all companies</strong> in the workspace based on active headcount.
                                    </span>
                                  ) : (
                                    <span>
                                      ℹ️ <strong>Targeted Mode</strong>: Cost is dynamically split pro-rata based on headcount <strong>only among the selected targets</strong> checked below.
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Three-column checkbox grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏢 Companies</span>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {companies.map(c => renderCheckboxItem(c.id, 'company', c.name))}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💼 Departments</span>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {allAvailableDepts.map(d => renderCheckboxItem(d, 'department', d))}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Staff Users</span>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {sortedStaff.map(s => renderCheckboxItem(s.id, 'user', s.fullName))}
                                  </div>
                                </div>
                              </div>

                              {!contract.useHeadcountSplit && (
                                <div style={{ fontSize: '11px', color: totalSplitPercentage === 100 ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 600, borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>Total Manual Splits: {totalSplitPercentage}%</span>
                                  {totalSplitPercentage < 100 && (
                                    <span style={{ fontStyle: 'italic', fontWeight: 400 }}>
                                      * Remaining {100 - totalSplitPercentage}% will be billed to the primary Paying Entity ({companies.find(comp => comp.id === contract.companyId)?.name || 'Unassigned'}).
                                    </span>
                                  )}
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                    </React.Fragment>
                  );
                })}
                {contracts.length === 0 && (
                  <tr>
                    <td colSpan="14" style={{ border: '1px solid var(--border-color)', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No registered contracts or operating leases found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 2: LICENSE ALLOCATIONS & UNUSED COST ROUTING
          ============================================================== */}
      {activeSubTab === 'allocations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>License Allocations Desk</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Track license pool allocations, identify unassigned license overheads, and route unused seat costs to designated cost centers.</p>
          </div>

                    {(() => {
            const seatPoolContracts = contracts.filter(c => {
              const v = vendors.find(vend => vend.id === c.vendorId);
              return v && v.category === 'Software License' && c.quantityPurchased >= 1;
            });
            const currentAllocContract = activeAllocId 
              ? (seatPoolContracts.find(c => c.id === activeAllocId) || seatPoolContracts[0])
              : seatPoolContracts[0];

            return (
              <div style={{ display: 'flex', gap: '24px', minHeight: '600px', alignItems: 'flex-start' }}>
                {/* Left Sidebar: List of Seat Pool Contracts */}
                <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px', borderRight: '1px solid var(--border-color)', paddingRight: '20px' }}>
                  <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0, fontWeight: 700, letterSpacing: '0.5px' }}>
                    License Pools ({seatPoolContracts.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)', paddingRight: '4px' }}>
                    {seatPoolContracts.map(c => {
                      const assigned = assetAssignments.filter(a => a.contractId === c.id);
                      const assignedCount = assigned.length;
                      const isSelected = currentAllocContract && currentAllocContract.id === c.id;
                      const matchedComp = companies.find(comp => comp.id === c.companyId);

                      return (
                        <div 
                          key={c.id} 
                          onClick={() => setActiveAllocId(c.id)}
                          style={{ 
                            padding: '12px 14px', 
                            borderRadius: '8px', 
                            border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-card)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <strong style={{ fontSize: '12px', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', wordBreak: 'break-word' }}>{c.name}</strong>
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: 700, 
                              color: assignedCount === c.quantityPurchased ? 'var(--success)' : 'var(--warning)',
                              backgroundColor: assignedCount === c.quantityPurchased ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap'
                            }}>
                              {assignedCount}/{c.quantityPurchased}
                            </span>
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            Billed to: {matchedComp ? matchedComp.name : 'Group'}
                          </span>
                        </div>
                      );
                    })}
                    {seatPoolContracts.length === 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                        No seat pool contracts registered.
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Panel: Detail view of selected contract */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {currentAllocContract ? (() => {
                    const c = currentAllocContract;
                    const assigned = assetAssignments.filter(a => a.contractId === c.id);
                    const assignedCount = assigned.length;
                    const unusedCount = Math.max(0, c.quantityPurchased - assignedCount);
                    const symbol = symbolMap[c.currency] || '£';
                    
                    const taxFactor = 1 + ((c.taxRate || 0) / 100);
                    const seatCostPerMonth = (c.costInterval === 'annual' ? (c.unitCost / 12) : (c.costInterval === 'one_time' || c.costInterval === 'one-off' ? 0 : c.unitCost));
                    const costPerSeatWithTax = seatCostPerMonth * taxFactor;
                    const unusedCostWithTax = unusedCount * costPerSeatWithTax;
                    
                    const matchedCompany = companies.find(comp => comp.id === c.companyId);

                    return (
                      <div className="entity-card" style={{ height: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{c.name}</h3>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                              Billed to: <strong>{matchedCompany ? matchedCompany.name : 'Group'}</strong> &bull; Seat Cost: <strong>{symbol}{c.unitCost}/mo</strong> {c.taxRate > 0 && `(+${c.taxRate}% VAT)`}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--warning)' }}>
                              Unused cost: {symbol}{unusedCostWithTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                            </span>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {unusedCount} unallocated seats (incl. tax)
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div>
                          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(100, (assignedCount / c.quantityPurchased) * 100)}%`, 
                              height: '100%', 
                              backgroundColor: 'var(--primary)' 
                            }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', alignItems: 'center' }}>
                            <span><strong>{assignedCount} Assigned</strong></span>
                            <span><strong>{c.quantityPurchased} Seats Total</strong></span>
                          </div>
                        </div>

                        {/* Assigned Users list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                            Assigned Staff Users ({assignedCount})
                          </h4>
                          {assigned.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 60px', gap: '8px', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                <div>Staff Member</div>
                                <div>Email / Alias</div>
                                <div>Notes</div>
                                <div style={{ textAlign: 'center' }}>Release</div>
                              </div>
                              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                {assigned.map(a => {
                                  const member = staff.find(s => s.id === a.staffId);
                                  if (!member) return null;
                                  return (
                                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 60px', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--border-color)', alignItems: 'center', fontSize: '12px' }}>
                                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{member.fullName}</div>
                                      <div>
                                        <input 
                                          type="text" 
                                          placeholder="Enter Email/Alias" 
                                          defaultValue={a.email || ''} 
                                          onBlur={(e) => handleUpdateAssignmentField(a.id, 'email', e.target.value)}
                                          style={{ width: '100%', padding: '4px 8px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                        />
                                      </div>
                                      <div>
                                        <input 
                                          type="text" 
                                          placeholder="Add notes (e.g. branch, role)" 
                                          defaultValue={a.notes || ''} 
                                          onBlur={(e) => handleUpdateAssignmentField(a.id, 'notes', e.target.value)}
                                          style={{ width: '100%', padding: '4px 8px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <button 
                                          onClick={() => handleReleaseSeat(a.id, c.name, member.fullName)}
                                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                          title="Release license seat"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                              No staff members assigned to this license pool.
                            </div>
                          )}
                        </div>

                        {/* Inline Allocate Seat Form */}
                        {unusedCount > 0 && (() => {
                          const activeStaffList = staff.filter(s => s.status !== 'exited');
                          if (activeStaffList.length === 0) return null;
                          
                          const sortedStaffSingle = [...activeStaffList].sort((a, b) => a.fullName.localeCompare(b.fullName));

                          return (
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                              <form 
                                onSubmit={(e) => handleAllocateSeatInline(e, c.id, c.name)} 
                                style={{ 
                                  display: 'flex', 
                                  gap: '8px', 
                                  alignItems: 'center', 
                                  backgroundColor: 'rgba(255,255,255,0.01)',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: '1px dashed var(--border-color)',
                                  flexWrap: 'wrap',
                                  flex: 1
                                }}
                              >
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Allocate Seat:</span>
                                <select 
                                  className="select-filter"
                                  name="staffSelect"
                                  style={{ padding: '6px 10px', fontSize: '12px', minWidth: '160px' }}
                                  required
                                >
                                  <option value="">-- Choose Staff --</option>
                                  {sortedStaffSingle.map(s => {
                                    const comp = companies.find(comp => comp.id === s.companyId);
                                    return (
                                      <option key={s.id} value={s.id}>
                                        {s.fullName} ({comp ? comp.name : 'Group'})
                                      </option>
                                    );
                                  })}
                                </select>
                                
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Qty:</span>
                                <input 
                                  type="number" 
                                  name="quantityInput"
                                  min="1"
                                  max={unusedCount}
                                  defaultValue="1"
                                  style={{ 
                                    width: '55px', 
                                    padding: '6px 8px', 
                                    fontSize: '12px', 
                                    background: 'var(--bg-secondary)', 
                                    border: '1px solid var(--border-color)', 
                                    color: 'var(--text-primary)', 
                                    borderRadius: '4px' 
                                  }}
                                  required
                                />

                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Email:</span>
                                <input 
                                  type="text" 
                                  name="emailInput"
                                  placeholder="Email / Alias"
                                  style={{ 
                                    width: '140px', 
                                    padding: '6px 8px', 
                                    fontSize: '12px', 
                                    background: 'var(--bg-secondary)', 
                                    border: '1px solid var(--border-color)', 
                                    color: 'var(--text-primary)', 
                                    borderRadius: '4px' 
                                  }}
                                />

                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes:</span>
                                <input 
                                  type="text" 
                                  name="notesInput"
                                  placeholder="Add notes..."
                                  style={{ 
                                    width: '140px', 
                                    padding: '6px 8px', 
                                    fontSize: '12px', 
                                    background: 'var(--bg-secondary)', 
                                    border: '1px solid var(--border-color)', 
                                    color: 'var(--text-primary)', 
                                    borderRadius: '4px' 
                                  }}
                                />

                                <button 
                                  type="submit" 
                                  className="btn-primary" 
                                  style={{ padding: '6px 12px', fontSize: '11px' }}
                                >
                                  Assign
                                </button>
                              </form>

                              <button
                                type="button"
                                onClick={() => {
                                  setMultiAssignContract(c);
                                  setSelectedStaffIds([]);
                                }}
                                className="btn-secondary"
                                style={{ padding: '10px 14px', fontSize: '11px', height: 'fit-content', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                              >
                                ＋ Allocate to Multiple Users...
                              </button>
                            </div>
                          );
                        })()}

                        {/* Unused cost account routing picker */}
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          backgroundColor: 'var(--bg-secondary)', 
                          padding: '12px 16px', 
                          borderRadius: '6px', 
                          border: '1px solid var(--border-color)',
                          gap: '16px',
                          marginTop: '10px'
                        }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Info size={14} style={{ color: 'var(--primary)' }} />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Unused seats overhead billed to:
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <select 
                              className="select-filter"
                              value={c.unusedCostTag?.companyId || ''}
                              onChange={(e) => handleUpdateUnusedTag(c.id, e.target.value, c.unusedCostTag?.department || 'Operations')}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              {companies.map(comp => (
                                <option key={comp.id} value={comp.id}>{comp.name}</option>
                              ))}
                            </select>

                            <select 
                              className="select-filter"
                              value={c.unusedCostTag?.department || 'Operations'}
                              onChange={(e) => handleUpdateUnusedTag(c.id, c.unusedCostTag?.companyId || companies[0]?.id || '', e.target.value)}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              {allAvailableDepts.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                      </div>
                    );
                  })() : (
                    <div style={{ padding: '40px', border: '1px dashed var(--border-color)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Please select a license pool from the left panel to manage allocations.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

        </div>
      )}

      {/* ==============================================================
          SUB-TAB 3: EXPENSE FORECASTING
          ============================================================== */}
      {activeSubTab === 'forecast' && (() => {
        const activeCurrencySymbol = symbolMap[forecastCurrency] || '£';

        const forecastMonths = [
          { label: 'Jan', year: 2026, monthIndex: 0 },
          { label: 'Feb', year: 2026, monthIndex: 1 },
          { label: 'Mar', year: 2026, monthIndex: 2 },
          { label: 'Apr', year: 2026, monthIndex: 3 },
          { label: 'May', year: 2026, monthIndex: 4 },
          { label: 'Jun', year: 2026, monthIndex: 5 },
          { label: 'Jul', year: 2026, monthIndex: 6 },
          { label: 'Aug', year: 2026, monthIndex: 7 },
          { label: 'Sep', year: 2026, monthIndex: 8 },
          { label: 'Oct', year: 2026, monthIndex: 9 },
          { label: 'Nov', year: 2026, monthIndex: 10 },
          { label: 'Dec', year: 2026, monthIndex: 11 }
        ];

        const softwareContracts = contracts.filter(c => {
          const v = vendors.find(vend => vend.id === c.vendorId);
          return v && v.category === 'Software License';
        });
        const leaseContracts = contracts.filter(c => {
          const v = vendors.find(vend => vend.id === c.vendorId);
          return !v || v.category !== 'Software License';
        });

        const getContractCostForMonth = (c, year, monthIndex) => {
          const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
          const linkedExp = expenses?.find(e => e.linkedVendorCellId === `${c.id}_${monthKey}`);
          
          if (linkedExp) {
            const actualGBP = Number(linkedExp.amount) || 0;
            let actualTarget = actualGBP;
            if (forecastCurrency !== 'GBP') {
              actualTarget = actualGBP / (FX_RATES[forecastCurrency] || 1.0);
            }
            if (forecastCompanyFilter !== 'all') {
              const share = getContractCompanyShare(c, forecastCompanyFilter, year, monthIndex);
              return actualTarget * share;
            }
            return actualTarget;
          }

          const parseContractDate = (dateStr, fallbackYear, fallbackMonth) => {
            if (!dateStr) return new Date(fallbackYear, fallbackMonth, 1);
            const cleanStr = String(dateStr).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
              return new Date(cleanStr);
            }
            if (/^\d{4}-\d{2}$/.test(cleanStr)) {
              return new Date(cleanStr + '-02');
            }
            const d = new Date(cleanStr);
            if (!isNaN(d.getTime())) return d;
            return new Date(fallbackYear, fallbackMonth, 1);
          };

          const cStart = parseContractDate(c.startDate, 2026, 0);
          const cEnd = parseContractDate(c.endDate, 2026, 11);
          const currentMonthDate = new Date(year, monthIndex, 1);
          const endOfMonthDate = new Date(year, monthIndex + 1, 0);
          
          if (cStart <= endOfMonthDate && cEnd >= currentMonthDate) {
            let monthlyTotal = 0;
            const unitCostGBP = toGBP(c.unitCost, c.currency);
            
            let unitCostTarget = unitCostGBP;
            if (forecastCurrency !== 'GBP') {
              unitCostTarget = unitCostGBP / (FX_RATES[forecastCurrency] || 1.0);
            }
            
            if (c.costInterval === 'monthly') {
              monthlyTotal = unitCostTarget * c.quantityPurchased;
            } else if (c.costInterval === 'annual') {
              monthlyTotal = (unitCostTarget * c.quantityPurchased) / 12;
            } else if (c.costInterval === 'one_time' || c.costInterval === 'one-off') {
              const parseDate = (dStr) => {
                if (!dStr) return new Date(year, monthIndex, 1);
                return new Date(String(dStr).trim());
              };
              const dateRef = parseDate(c.endDate || c.startDate);
              if (!isNaN(dateRef.getTime()) && dateRef.getMonth() === monthIndex && dateRef.getFullYear() === year) {
                monthlyTotal = unitCostTarget * c.quantityPurchased;
              }
            }

            const taxFactor = 1 + (Number(c.taxRate || 0) / 100);
            const fullCost = monthlyTotal * taxFactor;

            // Apply Company Filter Allocation rules
            if (forecastCompanyFilter !== 'all') {
              const share = getContractCompanyShare(c, forecastCompanyFilter, year, monthIndex);
              return fullCost * share;
            }

            return fullCost;
          }
          return 0;
        };

        const handleCellClick = (contract, year, monthIndex, projectedVal) => {
          const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
          setReconcilingCell({
            contract,
            monthKey,
            projectedAmount: projectedVal
          });
          const linkedExp = expenses?.find(e => e.linkedVendorCellId === `${contract.id}_${monthKey}`);
          setSelectedExpenseId(linkedExp ? linkedExp.id : '');
        };

        const monthlyFixedTotal = Array(12).fill(0);
        const monthlyAssignedTotal = Array(12).fill(0);
        const monthlyUnusedTotal = Array(12).fill(0);

        forecastMonths.forEach((m, idx) => {
          contracts.forEach(c => {
            const cost = getContractCostForMonth(c, m.year, m.monthIndex);
            if (cost > 0) {
              const v = vendors.find(vend => vend.id === c.vendorId);
              const isSoftware = v && v.category === 'Software License';
              
              if (!isSoftware) {
                monthlyFixedTotal[idx] += cost;
              } else {
                // If it is software, calculate seat-by-seat routing based on company
                const unitCostGBP = toGBP(c.unitCost, c.currency);
                let unitCostTarget = unitCostGBP;
                if (forecastCurrency !== 'GBP') {
                  unitCostTarget = unitCostGBP / (FX_RATES[forecastCurrency] || 1.0);
                }
                const taxFactor = 1 + (Number(c.taxRate || 0) / 100);
                
                let monthlyTotalTarget = 0;
                if (c.costInterval === 'monthly') {
                  monthlyTotalTarget = unitCostTarget;
                } else if (c.costInterval === 'annual') {
                  monthlyTotalTarget = unitCostTarget / 12;
                } else if (c.costInterval === 'one_time' || c.costInterval === 'one-off') {
                  const parseDate = (dStr) => {
                    if (!dStr) return new Date(m.year, m.monthIndex, 1);
                    return new Date(String(dStr).trim());
                  };
                  const dateRef = parseDate(c.endDate || c.startDate);
                  if (!isNaN(dateRef.getTime()) && dateRef.getMonth() === m.monthIndex && dateRef.getFullYear() === m.year) {
                    monthlyTotalTarget = unitCostTarget;
                  }
                }
                
                const allAssigned = assetAssignments.filter(a => a.contractId === c.id);
                const totalSeats = c.quantityPurchased || 1;

                if (c.splitPackageCost) {
                  const totalContractCost = monthlyTotalTarget * totalSeats * taxFactor;
                  if (allAssigned.length === 0) {
                    let filteredUnusedCost = totalContractCost;
                    if (forecastCompanyFilter !== 'all') {
                      const share = getContractCompanyShare(c, forecastCompanyFilter, m.year, m.monthIndex);
                      filteredUnusedCost = totalContractCost * share;
                    }
                    monthlyUnusedTotal[idx] += filteredUnusedCost;
                  } else {
                    let filteredAssignedCost = totalContractCost;
                    if (forecastCompanyFilter !== 'all') {
                      const assignedInFilter = allAssigned.filter(a => {
                        const member = staff.find(s => s.id === a.staffId);
                        return member && member.companyId === forecastCompanyFilter;
                      }).length;
                      filteredAssignedCost = totalContractCost * (assignedInFilter / allAssigned.length);
                    }
                    monthlyAssignedTotal[idx] += filteredAssignedCost;
                  }
                } else {
                  const costPerSeat = monthlyTotalTarget * taxFactor;
                  const unusedCountRaw = Math.max(0, totalSeats - allAssigned.length);

                  let filteredAssignedCount = allAssigned.length;
                  if (forecastCompanyFilter !== 'all') {
                    filteredAssignedCount = allAssigned.filter(a => {
                      const member = staff.find(s => s.id === a.staffId);
                      return member && member.companyId === forecastCompanyFilter;
                    }).length;
                  }
                  monthlyAssignedTotal[idx] += filteredAssignedCount * costPerSeat;

                  let filteredUnusedCost = unusedCountRaw * costPerSeat;
                  if (forecastCompanyFilter !== 'all') {
                    const share = getContractCompanyShare(c, forecastCompanyFilter, m.year, m.monthIndex);
                    filteredUnusedCost = (unusedCountRaw * costPerSeat) * share;
                  }
                  monthlyUnusedTotal[idx] += filteredUnusedCost;
                }
              }
            }
          });
        });

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>12-Month Expense & Vendor Matrix (Jan - Dec 2026)</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  View full year-to-date and forecasted software license seat allocations, landlord leases, and unused capacities in a spreadsheet row ledger.
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Filter by Billed Company:</span>
                  <select 
                    className="select-filter"
                    value={forecastCompanyFilter}
                    onChange={(e) => setForecastCompanyFilter(e.target.value)}
                  >
                    <option value="all">🏢 All Group Companies</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>🏢 {c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Forecast Currency:</span>
                  <select 
                    className="select-filter"
                    value={forecastCurrency}
                    onChange={(e) => setForecastCurrency(e.target.value)}
                  >
                    <option value="GBP">GBP (£)</option>
                    <option value="USD">USD ($)</option>
                    <option value="AED">AED (AED)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="ZAR">ZAR (R)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="entity-table dense" style={{ minWidth: '1100px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th style={{ minWidth: '180px' }}>Vendor & Contract / Expense Row</th>
                    <th>Type</th>
                    {forecastMonths.map((m, idx) => (
                      <th key={idx} style={{ textAlign: 'right', fontSize: '11px' }}>{m.label}</th>
                    ))}
                    <th style={{ textAlign: 'right', fontWeight: 700 }}>Total ({activeCurrencySymbol})</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Category 1: Software Licenses & Seat Pools */}
                  <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.04)' }}>
                    <td colSpan="15" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--primary)' }}>
                      SOFTWARE LICENSES (SEAT POOLS)
                    </td>
                  </tr>
                  {(() => {
                    const grouped = {};
                    softwareContracts.forEach(c => {
                      const vId = c.vendorId || 'unknown';
                      if (!grouped[vId]) grouped[vId] = [];
                      grouped[vId].push(c);
                    });

                    const vendorIds = Object.keys(grouped);

                    return vendorIds.map(vId => {
                      const vendor = vendors.find(v => v.id === vId);
                      const vendorName = vendor ? vendor.name : 'Unknown Vendor';
                      const isExpanded = !!expandedVendorIds[vId];
                      const vendorContracts = grouped[vId];

                      const monthlySums = Array(12).fill(0);
                      forecastMonths.forEach((m, idx) => {
                        vendorContracts.forEach(c => {
                          monthlySums[idx] += getContractCostForMonth(c, m.year, m.monthIndex);
                        });
                      });
                      const groupTotal = monthlySums.reduce((a, b) => a + b, 0);

                      return (
                        <React.Fragment key={vId}>
                          <tr 
                            onClick={() => toggleVendorExpand(vId)}
                            style={{ cursor: 'pointer', backgroundColor: 'rgba(99, 102, 241, 0.05)', fontWeight: 600 }}
                          >
                            <td style={{ paddingLeft: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '8px', display: 'inline-block', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                                ▶
                              </span>
                              {vendorName}
                            </td>
                            <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Software Vendor</td>
                            {monthlySums.map((val, idx) => (
                              <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                {val > 0 ? Math.round(val).toLocaleString() : '-'}
                              </td>
                            ))}
                            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>
                              {Math.round(groupTotal).toLocaleString()}
                            </td>
                          </tr>

                          {isExpanded && vendorContracts.map(c => {
                            let rowSum = 0;
                            return (
                              <tr key={c.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.005)' }}>
                                <td style={{ paddingLeft: '32px', color: 'var(--text-secondary)' }}>
                                  ↳ {c.name}
                                </td>
                                <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>License Type</td>
                                {forecastMonths.map((m, idx) => {
                                  const val = getContractCostForMonth(c, m.year, m.monthIndex);
                                  rowSum += val;
                                  const monthKey = `${m.year}-${String(m.monthIndex + 1).padStart(2, '0')}`;
                                  const linkedExp = expenses?.find(e => e.linkedVendorCellId === `${c.id}_${monthKey}`);
                                  return (
                                    <td 
                                      key={idx} 
                                      onClick={() => handleCellClick(c, m.year, m.monthIndex, val)}
                                      style={{ 
                                        textAlign: 'right', 
                                        fontFamily: 'monospace', 
                                        cursor: 'pointer',
                                        backgroundColor: linkedExp ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                                        color: linkedExp ? 'var(--success)' : 'var(--text-muted)',
                                        transition: 'all 0.15s'
                                      }}
                                      title={linkedExp ? `Reconciled & Paid\nActual: £${Math.round(linkedExp.amount).toLocaleString()} on ${linkedExp.date}\nPayee: ${linkedExp.payee}\nClick to unlink/change` : `Projected Cost: £${Math.round(val).toLocaleString()}\nClick to reconcile with bank payment`}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                        {linkedExp && <span style={{ fontSize: '9px', fontWeight: 800 }}>🔗</span>}
                                        <span>{val > 0 ? Math.round(val).toLocaleString() : '-'}</span>
                                      </div>
                                    </td>
                                  );
                                })}
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                  {Math.round(rowSum).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    });
                  })()}
                  {softwareContracts.length === 0 && (
                    <tr>
                      <td colSpan="15" style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                        No software seat pool contracts found.
                      </td>
                    </tr>
                  )}

                  {/* Category 2: Leases & Fixed Contracts */}
                  <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.04)' }}>
                    <td colSpan="15" style={{ fontWeight: 700, fontSize: '12px', color: 'var(--success)' }}>
                      LANDLORD LEASES & FIXED VENDORS
                    </td>
                  </tr>
                  {(() => {
                    const grouped = {};
                    leaseContracts.forEach(c => {
                      const vId = c.vendorId || 'unknown';
                      if (!grouped[vId]) grouped[vId] = [];
                      grouped[vId].push(c);
                    });

                    const vendorIds = Object.keys(grouped);

                    return vendorIds.map(vId => {
                      const vendor = vendors.find(v => v.id === vId);
                      const vendorName = vendor ? vendor.name : 'Unknown Vendor';
                      const isExpanded = !!expandedVendorIds[vId];
                      const vendorContracts = grouped[vId];

                      const monthlySums = Array(12).fill(0);
                      forecastMonths.forEach((m, idx) => {
                        vendorContracts.forEach(c => {
                          monthlySums[idx] += getContractCostForMonth(c, m.year, m.monthIndex);
                        });
                      });
                      const groupTotal = monthlySums.reduce((a, b) => a + b, 0);

                      return (
                        <React.Fragment key={vId}>
                          <tr 
                            onClick={() => toggleVendorExpand(vId)}
                            style={{ cursor: 'pointer', backgroundColor: 'rgba(16, 185, 129, 0.05)', fontWeight: 600 }}
                          >
                            <td style={{ paddingLeft: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '8px', display: 'inline-block', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                                ▶
                              </span>
                              {vendorName}
                            </td>
                            <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Operating / Lease Vendor</td>
                            {monthlySums.map((val, idx) => (
                              <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                {val > 0 ? Math.round(val).toLocaleString() : '-'}
                              </td>
                            ))}
                            <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: 'var(--success)' }}>
                              {Math.round(groupTotal).toLocaleString()}
                            </td>
                          </tr>

                          {isExpanded && vendorContracts.map(c => {
                            let rowSum = 0;
                            return (
                              <tr key={c.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.005)' }}>
                                <td style={{ paddingLeft: '32px', color: 'var(--text-secondary)' }}>
                                  ↳ {c.name}
                                </td>
                                <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Lease / Expense Type</td>
                                {forecastMonths.map((m, idx) => {
                                  const val = getContractCostForMonth(c, m.year, m.monthIndex);
                                  rowSum += val;
                                  const monthKey = `${m.year}-${String(m.monthIndex + 1).padStart(2, '0')}`;
                                  const linkedExp = expenses?.find(e => e.linkedVendorCellId === `${c.id}_${monthKey}`);
                                  return (
                                    <td 
                                      key={idx} 
                                      onClick={() => handleCellClick(c, m.year, m.monthIndex, val)}
                                      style={{ 
                                        textAlign: 'right', 
                                        fontFamily: 'monospace', 
                                        cursor: 'pointer',
                                        backgroundColor: linkedExp ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                                        color: linkedExp ? 'var(--success)' : 'var(--text-muted)',
                                        transition: 'all 0.15s'
                                      }}
                                      title={linkedExp ? `Reconciled & Paid\nActual: £${Math.round(linkedExp.amount).toLocaleString()} on ${linkedExp.date}\nPayee: ${linkedExp.payee}\nClick to unlink/change` : `Projected Cost: £${Math.round(val).toLocaleString()}\nClick to reconcile with bank payment`}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                        {linkedExp && <span style={{ fontSize: '9px', fontWeight: 800 }}>🔗</span>}
                                        <span>{val > 0 ? Math.round(val).toLocaleString() : '-'}</span>
                                      </div>
                                    </td>
                                  );
                                })}
                                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                  {Math.round(rowSum).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    });
                  })()}
                  {leaseContracts.length === 0 && (
                    <tr>
                      <td colSpan="15" style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>
                        No leases or fixed cost vendor contracts found.
                      </td>
                    </tr>
                  )}

                  {/* Summary Breakdowns */}
                  <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 600 }}>
                    <td colSpan="2" style={{ color: 'var(--text-secondary)' }}>Subtotal: Fixed Leases & Rents (incl. tax)</td>
                    {monthlyFixedTotal.map((val, idx) => (
                      <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {val > 0 ? Math.round(val).toLocaleString() : '0'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {Math.round(monthlyFixedTotal.reduce((a, b) => a + b, 0)).toLocaleString()}
                    </td>
                  </tr>

                  <tr style={{ fontWeight: 600 }}>
                    <td colSpan="2" style={{ color: 'var(--text-secondary)' }}>Subtotal: Assigned Software Seats (incl. tax)</td>
                    {monthlyAssignedTotal.map((val, idx) => (
                      <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {val > 0 ? Math.round(val).toLocaleString() : '0'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {Math.round(monthlyAssignedTotal.reduce((a, b) => a + b, 0)).toLocaleString()}
                    </td>
                  </tr>

                  <tr style={{ fontWeight: 600 }}>
                    <td colSpan="2" style={{ color: 'var(--warning)' }}>Subtotal: Unused Seats Waste (incl. tax)</td>
                    {monthlyUnusedTotal.map((val, idx) => (
                      <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--warning)' }}>
                        {val > 0 ? Math.round(val).toLocaleString() : '0'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--warning)' }}>
                      {Math.round(monthlyUnusedTotal.reduce((a, b) => a + b, 0)).toLocaleString()}
                    </td>
                  </tr>

                  <tr style={{ backgroundColor: 'var(--bg-secondary)', fontWeight: 700, fontSize: '13px', borderTop: '2px solid var(--border-color)' }}>
                    <td colSpan="2" style={{ color: 'var(--accent)' }}>GRAND TOTAL SPEND ({activeCurrencySymbol})</td>
                    {forecastMonths.map((m, idx) => {
                      const mTotal = monthlyFixedTotal[idx] + monthlyAssignedTotal[idx] + monthlyUnusedTotal[idx];
                      return (
                        <td key={idx} style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)' }}>
                          {Math.round(mTotal).toLocaleString()}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent)', fontSize: '14px' }}>
                      {Math.round(
                        monthlyFixedTotal.reduce((a, b) => a + b, 0) +
                        monthlyAssignedTotal.reduce((a, b) => a + b, 0) +
                        monthlyUnusedTotal.reduce((a, b) => a + b, 0)
                      ).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
        </>
      )}

      {/* Batch Software License Assignment Modal */}
      {multiAssignContract && (() => {
        const assigned = assetAssignments.filter(a => a.contractId === multiAssignContract.id);
        const assignedCount = assigned.length;
        const unusedCount = Math.max(0, multiAssignContract.quantityPurchased - assignedCount);

        const nonAssignedStaff = staff.filter(s => s.status !== 'exited' && !assigned.some(a => a.staffId === s.id));
        
        // Group staff by company
        const staffByCompany = {};
        nonAssignedStaff.forEach(s => {
          const compId = s.companyId || 'group';
          if (!staffByCompany[compId]) {
            staffByCompany[compId] = [];
          }
          staffByCompany[compId].push(s);
        });

        // Map and sort companies
        const groupedCompanies = Object.keys(staffByCompany).map(compId => {
          const comp = companies.find(c => c.id === compId);
          const compName = comp ? comp.name : 'Group / Other';
          const sortedUsers = staffByCompany[compId].sort((a, b) => a.fullName.localeCompare(b.fullName));
          return {
            id: compId,
            name: compName,
            users: sortedUsers
          };
        }).sort((a, b) => a.name.localeCompare(b.name));

        const toggleStaffSelection = (staffId) => {
          if (selectedStaffIds.includes(staffId)) {
            setSelectedStaffIds(selectedStaffIds.filter(id => id !== staffId));
          } else {
            setSelectedStaffIds([...selectedStaffIds, staffId]);
          }
        };

        const toggleAllStaff = () => {
          const allUserIds = nonAssignedStaff.map(s => s.id);
          if (selectedStaffIds.length === allUserIds.length) {
            setSelectedStaffIds([]);
          } else {
            setSelectedStaffIds(allUserIds);
          }
        };

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px',
            backdropFilter: 'blur(4px)'
          }}>
            <div className="table-container" style={{
              width: '100%',
              maxWidth: '650px',
              maxHeight: '85vh',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                    Allocate Seats: {multiAssignContract.name}
                  </h3>
                  <span style={{ fontSize: '12px', color: selectedStaffIds.length > unusedCount ? 'var(--danger)' : 'var(--text-secondary)' }}>
                    Selected <strong>{selectedStaffIds.length}</strong> of <strong>{unusedCount}</strong> available seats remaining
                  </span>
                </div>
                <button
                  onClick={() => setMultiAssignContract(null)}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 700,
                    color: 'var(--text-primary)'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Toolbar */}
              <div style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-secondary)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="selectAllMulti"
                    checked={nonAssignedStaff.length > 0 && selectedStaffIds.length === nonAssignedStaff.length}
                    onChange={toggleAllStaff}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="selectAllMulti" style={{ fontSize: '12px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                    Select All ({nonAssignedStaff.length})
                  </label>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Grouped by Company Entity</span>
              </div>

              {/* Grouped Staff List */}
              <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {groupedCompanies.map(comp => {
                  const companyUserIds = comp.users.map(u => u.id);
                  const selectedInCompany = companyUserIds.filter(id => selectedStaffIds.includes(id));
                  const isAllCompanySelected = companyUserIds.length > 0 && selectedInCompany.length === companyUserIds.length;
                  const isPartiallySelected = selectedInCompany.length > 0 && selectedInCompany.length < companyUserIds.length;

                  const toggleCompanySelection = () => {
                    if (isAllCompanySelected) {
                      setSelectedStaffIds(selectedStaffIds.filter(id => !companyUserIds.includes(id)));
                    } else {
                      const otherSelected = selectedStaffIds.filter(id => !companyUserIds.includes(id));
                      setSelectedStaffIds([...otherSelected, ...companyUserIds]);
                    }
                  };

                  return (
                    <div key={comp.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Company Header Row */}
                      <div 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          backgroundColor: 'var(--bg-secondary)',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          userSelect: 'none'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isAllCompanySelected}
                          ref={el => {
                            if (el) el.indeterminate = isPartiallySelected;
                          }}
                          onChange={toggleCompanySelection}
                          style={{ cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {comp.name} ({comp.users.length})
                        </span>
                      </div>

                      {/* Expanded Company Users */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '24px' }}>
                        {comp.users.map(s => {
                          const isChecked = selectedStaffIds.includes(s.id);
                          return (
                            <div 
                              key={s.id} 
                              onClick={() => toggleStaffSelection(s.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                backgroundColor: isChecked ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                                border: isChecked ? '1px solid rgba(59, 130, 246, 0.15)' : '1px solid transparent',
                                transition: 'all 0.1s ease'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                readOnly
                                style={{ cursor: 'pointer' }}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.fullName}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  {s.department || 'Operations'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {nonAssignedStaff.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    All active staff members are already assigned to this license pool.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: 'var(--bg-secondary)',
                gap: '12px'
              }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMultiAssignContract(null)}
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleBatchAllocateSeats}
                  disabled={selectedStaffIds.length === 0 || selectedStaffIds.length > unusedCount}
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Allocate {selectedStaffIds.length} Seats
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit / Create Vendor Popup Modal */}
      {showVendorForm && (
        <div className="form-wizard-overlay" onClick={() => { setShowVendorForm(false); setEditingVendorId(null); }}>
          <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                    {editingVendorId ? 'Update Vendor Company Details' : 'Add Vendor Partner Details'}
                  </h2>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Fill in company information below</span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => { setShowVendorForm(false); setEditingVendorId(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleVendorSubmit} className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group-row" style={{ marginBottom: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Vendor Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Microsoft Ireland"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Category <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={presetCategory}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPresetCategory(val);
                      if (val !== 'custom') {
                        setVendorCategory(val);
                      } else {
                        setVendorCategory('');
                      }
                    }}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="Software License">Software Licenses (Office, CRM, etc.)</option>
                    <option value="Office Rental">Office Rentals & Landlords</option>
                    <option value="Telecom">Telecom & Phone Systems</option>
                    <option value="AI Service">AI Services (OpenAI, Anthropic)</option>
                    <option value="Other">Other Vendors</option>
                    <option value="custom">Custom / New Category...</option>
                  </select>
                  {(presetCategory === 'custom' || !['Software License', 'Office Rental', 'Telecom', 'AI Service', 'Other'].includes(vendorCategory)) && (
                    <div style={{ marginTop: '8px' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Type custom category..."
                        value={vendorCategory}
                        onChange={(e) => setVendorCategory(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group-row" style={{ marginBottom: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Contact Email</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="e.g. billing@microsoft.com"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Contact Phone</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. +353 1 1234567"
                    value={vendorPhone}
                    onChange={(e) => setVendorPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Notes & Description</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  placeholder="What products or services they supply..."
                  value={vendorDesc}
                  onChange={(e) => setVendorDesc(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="wizard-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => { setShowVendorForm(false); setEditingVendorId(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingVendorId ? 'Update Vendor Company' : 'Save Vendor Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Create Contract Popup Modal */}
      {showContractForm && (
        <div className="form-wizard-overlay" onClick={() => { setShowContractForm(false); setEditingContractId(null); }}>
          <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                    {editingContractId ? 'Modify Contract Agreement' : 'Register Contract Agreement'}
                  </h2>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Fill in agreement parameters</span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => { setShowContractForm(false); setEditingContractId(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleContractSubmit} className="wizard-content" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              <div className="form-group-row" style={{ marginBottom: 0 }}>
                <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                  <label className="form-label">Agreement Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Office 365 Seats Group Plan"
                    value={contractName}
                    onChange={(e) => setContractName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Vendor Partner <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={contractVendorId}
                    onChange={(e) => setContractVendorId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    <option value="">-- Select Vendor --</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group-row" style={{ marginBottom: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Billing Entity (Company) <span>*</span></label>
                  <select 
                    className="select-filter"
                    value={contractCompanyId}
                    onChange={(e) => setContractCompanyId(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    required
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group-row" style={{ flex: 1, gap: '10px', marginBottom: 0 }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="form-label">Billing Frequency <span>*</span></label>
                    <select 
                      className="select-filter"
                      value={costInterval}
                      onChange={(e) => setCostInterval(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                    >
                      <option value="monthly">Monthly Recurring</option>
                      <option value="quarterly">Quarterly Recurring</option>
                      <option value="annual">Annual Recurring</option>
                      <option value="one-off">One-Off / Direct Pay</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label className="form-label">Contract Currency <span>*</span></label>
                    <select 
                      className="select-filter"
                      value={contractCurrency}
                      onChange={(e) => setContractCurrency(e.target.value)}
                      style={{ width: '100%', padding: '10px' }}
                    >
                      {CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code}>{curr.code} ({curr.symbol})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-group-row" style={{ marginBottom: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Unit Cost (excl. Tax) <span>*</span></label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="0.00"
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quantity / Seats Purchased <span>*</span></label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={quantityPurchased}
                    onChange={(e) => setQuantityPurchased(e.target.value)}
                    min="1"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">VAT / Tax Rate (%) <span>*</span></label>
                  <input 
                    type="number" 
                    className="form-input" 
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    required
                  />
                </div>
              </div>


              {(() => {
                const selectedVendor = vendors.find(v => v.id === contractVendorId);
                if (selectedVendor && selectedVendor.category === 'Software License') {
                  return (
                    <div style={{ padding: '8px 12px', backgroundColor: 'rgba(99, 102, 241, 0.03)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={splitPackageCost} 
                          onChange={(e) => setSplitPackageCost(e.target.checked)} 
                          style={{ cursor: 'pointer' }}
                        />
                        💼 Split total package cost equally among all assigned staff users
                      </label>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', marginLeft: '20px' }}>
                        Check this if you pay a flat package rate (e.g. CVLibrary package) rather than per-seat licensing. This enables allocating any number of users, and divides the fixed total cost equally among them.
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="form-group-row" style={{ marginBottom: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Agreement Start Date <span>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Agreement End Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Contract Renewal Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={renewalDate}
                    onChange={(e) => setRenewalDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Payment Alert Parameters */}
              <div className="form-group-row" style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px', marginBottom: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Next Payment Due Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={paymentDueDate}
                    onChange={(e) => setPaymentDueDate(e.target.value)}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Used to trigger overdue and imminent payment alarms.
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Payment Reminder Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={paymentReminderDate}
                    onChange={(e) => setPaymentReminderDate(e.target.value)}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Date when an admin reminder will trigger.
                  </span>
                </div>
              </div>

              <div className="form-group-row" style={{ marginTop: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '16px', marginBottom: 0 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Unused License Cost absorbed by (Company)</label>
                  <select 
                    className="select-filter"
                    value={unusedCompanyId}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Unused License Cost absorbed by (Department)</label>
                  <select 
                    className="select-filter"
                    value={unusedDept}
                    onChange={(e) => setUnusedDept(e.target.value)}
                    style={{ width: '100%', padding: '10px' }}
                    disabled={!unusedCompanyId}
                  >
                    {!unusedCompanyId ? (
                      <option value="">-- Select Company First --</option>
                    ) : (
                      availableDeptsForChosenCompany.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="wizard-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => { setShowContractForm(false); setEditingContractId(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingContractId ? 'Update Contract' : 'Save Contract Agreement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Vendor Cell Modal */}
      {reconcilingCell && (() => {
        const { contract, monthKey, projectedAmount } = reconcilingCell;
        const vendor = vendors.find(v => v.id === contract.vendorId);
        const vendorName = vendor ? vendor.name : 'Unknown Vendor';
        
        // Find currently linked expense
        const currentLinkedExp = expenses?.find(
          e => e.linkedVendorCellId === `${contract.id}_${monthKey}`
        );

        // Candidate filter: same month, and not linked to payroll/other vendors (unless it's the current one)
        const candidates = (expenses || []).filter(e => {
          if (!e.date || !e.date.startsWith(monthKey)) return false;
          if (e.id === currentLinkedExp?.id) return true; // keep current
          return !e.linkedPayrollCellId && (!e.linkedVendorCellId || e.linkedVendorCellId === `${contract.id}_${monthKey}`);
        });

        // Sort candidates: matches vendor name substring first
        const term = vendorName.toLowerCase();
        candidates.sort((a, b) => {
          const aMatch = a.payee?.toLowerCase().includes(term) || term.includes(a.payee?.toLowerCase() || '');
          const bMatch = b.payee?.toLowerCase().includes(term) || term.includes(b.payee?.toLowerCase() || '');
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return 0;
        });

        const handleSaveLink = () => {
          if (!selectedExpenseId) {
            onShowToast('Please select a payment transaction to link.', 'error');
            return;
          }
          const chosenExp = expenses.find(e => e.id === selectedExpenseId);
          if (!chosenExp) return;

          // Save linkage
          const updatedExp = {
            ...chosenExp,
            linkedVendorCellId: `${contract.id}_${monthKey}`,
            recipientType: 'vendor',
            recipientId: contract.vendorId
          };
          
          onSaveExpense(updatedExp);
          onShowToast(`Linked payment successfully!`, 'success');
          setReconcilingCell(null);
        };

        const handleUnlink = () => {
          if (!currentLinkedExp) return;
          const updatedExp = {
            ...currentLinkedExp,
            linkedVendorCellId: ''
          };
          onSaveExpense(updatedExp);
          onShowToast(`Unlinked payment successfully!`, 'success');
          setReconcilingCell(null);
        };

        // Format month key for display
        const displayMonth = new Date(monthKey + '-02').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

        return (
          <div className="form-wizard-overlay" onClick={() => setReconcilingCell(null)}>
            <div className="form-wizard-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="wizard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="wizard-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '8px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800 }}>🔗</span>
                  </div>
                  <div>
                    <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#fff' }}>
                      Reconcile Vendor Payment
                    </h2>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Link contract matrix cell to bank/ledger expense</span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setReconcilingCell(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>
                  ✕
                </button>
              </div>

              <div className="wizard-body" style={{ padding: '16px', overflowY: 'auto' }}>
                <div style={{ padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Contract:</span>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{contract.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Vendor Partner:</span>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{vendorName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Target Month:</span>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{displayMonth}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Projected Budget:</span>
                    <span style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>
                      {symbolMap[forecastCurrency] || '£'}{Math.round(projectedAmount).toLocaleString()}
                    </span>
                  </div>
                </div>

                {currentLinkedExp ? (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', marginBottom: '16px' }}>
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--success)', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>✅</span> Currently Reconciled & Paid
                      </h4>
                      <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Bank Date:</span>
                          <span style={{ color: '#fff' }}>{currentLinkedExp.date}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Payee Description:</span>
                          <span style={{ color: '#fff', fontWeight: 600 }}>{currentLinkedExp.payee}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Actual Paid Amount:</span>
                          <span style={{ color: 'var(--success)', fontWeight: 700, fontFamily: 'monospace' }}>
                            £{Number(currentLinkedExp.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {currentLinkedExp.notes && (
                          <div style={{ marginTop: '4px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                            <span style={{ color: 'var(--text-muted)', display: 'block' }}>Notes:</span>
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{currentLinkedExp.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                      <button type="button" className="btn-secondary" onClick={handleUnlink} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                        Unlink Payment Transaction
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 10px 0', color: '#fff' }}>
                      Select bank statement transaction to reconcile:
                    </h3>
                    {candidates.length === 0 ? (
                      <div style={{ padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        No unlinked expense transactions found for {displayMonth}.
                        Please upload or log a transaction in the Ledger/Expenses tab first.
                      </div>
                    ) : (
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <select
                          className="select-filter"
                          value={selectedExpenseId}
                          onChange={(e) => setSelectedExpenseId(e.target.value)}
                          style={{ width: '100%', padding: '10px' }}
                        >
                          <option value="">-- Choose Transaction --</option>
                          {candidates.map(e => {
                            const isNameMatch = e.payee?.toLowerCase().includes(term) || term.includes(e.payee?.toLowerCase() || '');
                            return (
                              <option key={e.id} value={e.id}>
                                {isNameMatch ? '⭐ ' : ''}{e.date} | {e.payee} - £{Number(e.amount).toLocaleString()}
                              </option>
                            );
                          })}
                        </select>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                          ⭐ indicates matching payee name suggested for this vendor.
                        </span>
                      </div>
                    )}

                    <div className="wizard-footer" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <button type="button" className="btn-secondary" onClick={() => setReconcilingCell(null)}>
                        Cancel
                      </button>
                      <button 
                        type="button" 
                        className="btn-primary" 
                        onClick={handleSaveLink}
                        disabled={!selectedExpenseId}
                      >
                        Reconcile with Selected Payment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      
    </div>
  );
}
