import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { 
  Bell,
  LayoutDashboard, 
  Building2, 
  Users, 
  TrendingUp, 
  Receipt, 
  PieChart, 
  Moon, 
  Sun, 
  Plus, 
  Search, 
  Grid, 
  List, 
  Lock, 
  Briefcase,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Info,
  Calendar,
  Wallet,
  ShieldCheck,
  FileWarning,
  Laptop,
  History,
  Key,
  Upload,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  Mail,
  BarChart2,
  Radio,
  FileSpreadsheet,
  Link2,
  Clock,
  Phone, 
  Settings,
  HelpCircle,
  X
} from 'lucide-react';

import { initialCompanies } from './mockData';
import { initialStaff } from './mockStaff';
import { initialPolicies, initialHolidays, initialLeaveRequests } from './mockLeaves';
import { initialCommissionPolicies } from './mockCommissions';
import { initialVendors, initialContracts, initialAssetAssignments } from './mockVendors';
import { initialPlacements } from './mockPlacements';
import { initialPayrollPolicies } from './mockPayroll';
import { firebaseService } from './services/firebase';
import { useBoundStore } from './store/useBoundStore';
import Dashboard from './components/Dashboard';
import CompanyDetail from './components/CompanyDetail';
import CompanyForm from './components/CompanyForm';
import StaffDetail from './components/StaffDetail';
import StaffForm from './components/StaffForm';
import StaffExitModal from './components/StaffExitModal';
import ExitEmailTriggerModal from './components/ExitEmailTriggerModal';
import BulkStaffImportModal from './components/BulkStaffImportModal';
import AiRemindersModal from './components/AiRemindersModal';
import AiChatbot from './components/AiChatbot';
import GlobalQuickSearchModal from './components/GlobalQuickSearchModal';
import { toGBP, formatGBP, fetchLiveFxRates } from './utils/currency';
import { initialNominalCodes, initialExpenses } from './mockExpenses';

// Lazy load dashboard components
const CreditControlDashboard = lazy(() => import('./components/credit-control'));
const CashflowDashboard = lazy(() => import('./components/CashflowDashboard'));
const LeavesDashboard = lazy(() => import('./components/leaves'));
const CommissionsDashboard = lazy(() => import('./components/commissions'));
const PayrollDashboard = lazy(() => import('./components/payroll'));
const VendorsDashboard = lazy(() => import('./components/vendors'));
const PlacementsDashboard = lazy(() => import('./components/placements'));
const ExpensesDashboard = lazy(() => import('./components/expenses'));
const LogsDashboard = lazy(() => import('./components/LogsDashboard'));
const ReportsDashboard = lazy(() => import('./components/ReportsDashboard'));
const RBACDashboard = lazy(() => import('./components/RBACDashboard'));
const WhatsImportantDashboard = lazy(() => import('./components/WhatsImportantDashboard'));
const CrmDashboard = lazy(() => import('./components/crm/CrmDashboard'));
const KpisDashboard = lazy(() => import('./components/KpisDashboard'));

export default function App() {
  // Theme state
  const [theme, setTheme] = useState(() => {
    const localTheme = localStorage.getItem('bm-theme');
    if (localTheme) return localTheme;
    return 'dark'; // default to dark
  });

  // Default Super Admin User configuration
  // Default Super Admin User configuration
  const getDefaultAllowedModules = (role) => {
    if (role === 'admin') {
      return ['whats_important', 'dashboard', 'directory', 'staff', 'leaves', 'commissions', 'payroll', 'placements', 'credit_control', 'cashflow', 'expenses', 'vendors', 'crm', 'logs', 'reports', 'rbac'];
    }
    if (role === 'manager') {
      return ['whats_important', 'directory', 'staff', 'leaves', 'commissions', 'payroll', 'placements', 'crm', 'expenses', 'vendors', 'reports'];
    }
    return ['directory', 'staff', 'leaves', 'commissions', 'payroll', 'placements', 'expenses', 'vendors', 'crm'];
  };

  const hasViewPermission = (user, moduleKey) => {
    if (!user || !user.permissions) return false;
    const { role, allowedModules = [] } = user.permissions;
    if (role === 'admin') return true;
    return allowedModules.includes(moduleKey) || 
           allowedModules.includes(`${moduleKey}:view`) || 
           allowedModules.includes(`${moduleKey}:write`);
  };

  const hasWritePermission = (user, moduleKey) => {
    if (!user || !user.permissions) return false;
    const { role, allowedModules = [] } = user.permissions;
    if (role === 'admin') return true;
    return allowedModules.includes(moduleKey) || 
           allowedModules.includes(`${moduleKey}:write`);
  };

  const DEFAULT_ADMIN_USER = {
    id: 'super-admin',
    fullName: 'Naga Kandasamy',
    businessEmail: 'naga@humres.co.uk',
    permissions: {
      role: 'admin',
      dataScope: 'all',
      allowedModules: getDefaultAllowedModules('admin')
    }
  };

  const [currentUser, setCurrentUser] = useState(() => {
    const storedId = localStorage.getItem('bm-logged-in-user-id');
    if (storedId === 'super-admin') return DEFAULT_ADMIN_USER;
    return null;
  });

  const [scopingViewMode, setScopingViewMode] = useState('team'); // 'team' or 'self'

  // Database lists
  const companies = useBoundStore(state => state.companies);
  const staff = useBoundStore(state => state.staff);
  const leavePolicies = useBoundStore(state => state.leavePolicies);
  const holidays = useBoundStore(state => state.holidays);
  const leaveRequests = useBoundStore(state => state.leaveRequests);
  const [commissionPolicies, setCommissionPolicies] = useState([]);
  const vendors = useBoundStore(state => state.vendors);
  const contracts = useBoundStore(state => state.contracts);
  const [assetAssignments, setAssetAssignments] = useState([]);
  const placements = useBoundStore(state => state.placements);
  const expenses = useBoundStore(state => state.expenses);
  const nominalCodes = useBoundStore(state => state.nominalCodes);
  const [auditLogs, setAuditLogs] = useState([]);
  const [sentEmails, setSentEmails] = useState([]);
  const [reminderSettings, setReminderSettings] = useState({
    managementEmails: 'groupadmin@globalrecruiters.ae',
    alertManagers: true,
    alertCoworkers: false,
    sendToEmployee: true,
    alertManagementDayBefore: true,
    sendGreetingsDayOf: true
  });
  const payrollRecords = useBoundStore(state => state.payrollRecords);
  const payrollPolicies = useBoundStore(state => state.payrollPolicies);

  const [activeTab, setActiveTab] = useState('whats_important');
  const [creditControlSubTab, setCreditControlSubTab] = useState('direct');
  const [activeKpiSubTab, setActiveKpiSubTab] = useState('overview');

  const [expandedSections, setExpandedSections] = useState({
    general: true,
    hrms: true,
    crm: true,
    finance: true,
    kpis: true,
    admin: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Fallback to allowed activeTab if current tab is not permitted
  useEffect(() => {
    if (currentUser) {
      if (activeTab !== 'kpis' && activeTab !== 'rbac' && !hasViewPermission(currentUser, activeTab)) {
        const tabs = ['whats_important', 'dashboard', 'directory', 'staff', 'leaves', 'commissions', 'payroll', 'vendors', 'placements', 'crm', 'credit_control', 'cashflow', 'expenses', 'logs', 'reports'];
        const fallback = tabs.find(t => hasViewPermission(currentUser, t)) || 'staff';
        setActiveTab(fallback);
      }
    }
  }, [currentUser, activeTab]);

  const [letterTemplates, setLetterTemplates] = useState([]);
  const [fxRatesVersion, setFxRatesVersion] = useState(0);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  // Global Cmd+K / Ctrl+K keyboard shortcut listener for Quick Search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const initSubscriptions = useBoundStore(state => state.initSubscriptions);

  useEffect(() => {
    const unsubscribe = initSubscriptions({
      companies: initialCompanies,
      staff: initialStaff,
      leavePolicies: initialPolicies,
      holidays: initialHolidays,
      leaveRequests: initialLeaveRequests,
      placements: initialPlacements,
      expenses: initialExpenses,
      contracts: initialContracts,
      vendors: initialVendors,
      nominalCodes: initialNominalCodes,
      payrollPolicies: initialPayrollPolicies,
      reimbursementClaims: []
    });

    // Handle initial current user sync on load when staff loads
    const checkUser = () => {
      const storedId = localStorage.getItem('bm-logged-in-user-id');
      if (storedId === 'super-admin') {
        setCurrentUser(DEFAULT_ADMIN_USER);
      } else if (storedId && useBoundStore.getState().staff.length > 0) {
        const found = useBoundStore.getState().staff.find(s => s.id === storedId);
        if (found) {
          const isNaga = found.businessEmail?.toLowerCase() === 'naga@humres.co.uk' || found.businessEmail?.toLowerCase() === 'naga.admin@humres.co.uk';
          const role = isNaga ? 'admin' : (found.department === 'Finance' || found.jobTitle?.toLowerCase().includes('manager') ? 'manager' : 'recruiter');
          const permissions = found.permissions || {
            role,
            dataScope: role === 'admin' ? 'all' : (role === 'manager' ? 'department' : 'self'),
            allowedModules: getDefaultAllowedModules(role)
          };
          setCurrentUser({ ...found, permissions });
        }
      }
    };
    checkUser();
    
    // Listen to changes to staff in store to auto-sync user permissions
    const unsubStaffStore = useBoundStore.subscribe(
      (state) => state.staff,
      (staffList) => {
        const storedId = localStorage.getItem('bm-logged-in-user-id');
        if (storedId && storedId !== 'super-admin') {
          const found = staffList.find(s => s.id === storedId);
          if (found) {
            const isNaga = found.businessEmail?.toLowerCase() === 'naga@humres.co.uk' || found.businessEmail?.toLowerCase() === 'naga.admin@humres.co.uk';
            const role = isNaga ? 'admin' : (found.department === 'Finance' || found.jobTitle?.toLowerCase().includes('manager') ? 'manager' : 'recruiter');
            const permissions = found.permissions || {
              role,
              dataScope: role === 'admin' ? 'all' : (role === 'manager' ? 'department' : 'self'),
              allowedModules: getDefaultAllowedModules(role)
            };
            setCurrentUser({ ...found, permissions });
          }
        }
      }
    );

    return () => {
      unsubscribe();
      unsubStaffStore();
    };
  }, [initSubscriptions]);

  // Seeding for Global Recruiters (FZE) leave policy
  useEffect(() => {
    if (companies.length > 0) {
      const globalRecruitersCompany = companies.find(c => 
        c.name.toLowerCase().includes('global recruiters')
      );
      if (globalRecruitersCompany) {
        const policyExists = leavePolicies.some(p => 
          p.name.toLowerCase().includes('global recruiters')
        );
        if (!policyExists) {
          const newPolicy = {
            id: 'policy-global-recruiters',
            name: "Global Recruiters Annual Leave Policy",
            companyId: globalRecruitersCompany.id,
            annualAllowance: 20,
            sickAllowance: 15,
            description: `Global Recruiters (FZE) Annual Leave Policy Summary:
• Holiday Year: 1 Jan to 31 Dec. Forfeited at year-end. No rollover.
• Annual Leave: 20 working days base, +1 day per completed year of service, capped at 25 working days (max reached after 5 years).
• January Restriction: January is a restricted no-leave period. Urgency exceptions require CEO written approval.
• Consecutive Leave Limits: Max 2 consecutive weeks per quarter (includes Christmas/New Year holiday period).
• Minimum Team Coverage: At least 50% of the contributor team must be active.
• Approval: Must be requested in advance and approved before taking.`
          };
          firebaseService.saveLeavePolicy(newPolicy).then(() => {
            console.log("Successfully seeded Global Recruiters (FZE) leave policy.");
          }).catch(err => {
            console.error("Error seeding leave policy:", err);
          });
        }
      }
    }
  }, [companies, leavePolicies]);

  // One-time clearance of all leave policy assignments on request
  useEffect(() => {
    if (staff.length > 0) {
      const runOnce = localStorage.getItem('bm-cleared-assignments-run-once-v2');
      if (!runOnce) {
        const assigned = staff.filter(s => s.leavePolicyId);
        if (assigned.length > 0) {
          Promise.all(assigned.map(s => firebaseService.saveStaff({ ...s, leavePolicyId: '' }))).then(() => {
            localStorage.setItem('bm-cleared-assignments-run-once-v2', 'true');
            console.log("Successfully cleared all staff leave assignments on initialization.");
          }).catch(err => {
            console.error("Error clearing staff assignments:", err);
          });
        } else {
          localStorage.setItem('bm-cleared-assignments-run-once-v2', 'true');
        }
      }
    }
  }, [staff]);


  // Fetch live exchange rates on mount and trigger a re-render when finished
  useEffect(() => {
    fetchLiveFxRates().then((updated) => {
      if (updated) {
        setFxRatesVersion(v => v + 1);
      }
    });
  }, []);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Persistent Sidebar minimize state
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(() => {
    return localStorage.getItem('bm-sidebar-minimized') === 'true';
  });

  const handleToggleSidebar = () => {
    const newVal = !isSidebarMinimized;
    setIsSidebarMinimized(newVal);
    localStorage.setItem('bm-sidebar-minimized', String(newVal));
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimeForZone = (date, timeZone, label) => {
    const timeStr = date.toLocaleTimeString('en-GB', {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const dateStr = date.toLocaleDateString('en-GB', {
      timeZone,
      day: '2-digit',
      month: 'short'
    });
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 8px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        minWidth: '85px',
        height: '38px',
        lineHeight: 1.1,
        flexShrink: 0
      }}>
        <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', margin: '1px 0' }}>
          {timeStr}
        </span>
        <span style={{ fontSize: '7.5px', color: 'var(--text-muted)' }}>
          {dateStr}
        </span>
      </div>
    );
  };

  // Sync Letter Templates from database
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeLetterTemplates((updatedList) => {
      setLetterTemplates(updatedList);
    }, []);
    return () => unsubscribe();
  }, []);

  const handleSaveLetterTemplate = async (template) => {
    try {
      await firebaseService.saveLetterTemplate(template);
      handleShowToast("Saved template " + template.name + " successfully!", 'success');
    } catch (err) {
      handleShowToast("Error saving template: " + err.message, 'warning');
    }
  };

  const handleDeleteLetterTemplate = async (id) => {
    if (window.confirm("Are you sure you want to delete this template?")) {
      try {
        await firebaseService.deleteLetterTemplate(id);
        handleShowToast("Deleted template successfully.", 'info');
      } catch (err) {
        handleShowToast("Error deleting template: " + err.message, 'warning');
      }
    }
  };

  const handleExitFormalities = (e, s) => {
    e.stopPropagation();
    if (s.status === 'exited') {
      setSelectedStaff(s);
      setIsStaffDetailOpen(true);
    } else {
      setExitModalStaff(s);
      setIsExitModalOpen(true);
    }
  };

  // UI company interaction states
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [isDirectoryHelpOpen, setIsDirectoryHelpOpen] = useState(false);

  // UI staff interaction states
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isStaffDetailOpen, setIsStaffDetailOpen] = useState(false);
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffFormInitialStep, setStaffFormInitialStep] = useState(1);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [exitModalStaff, setExitModalStaff] = useState(null);
  
  // Exit notifications states
  const [exitSettings, setExitSettings] = useState({});
  const [isExitEmailTriggerOpen, setIsExitEmailTriggerOpen] = useState(false);
  const [exitEmailTriggerStaff, setExitEmailTriggerStaff] = useState(null);

  // Sync Exit Settings from database
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeExitSettings((settings) => {
      setExitSettings(settings);
    }, {});
    return () => unsubscribe();
  }, []);

  const handleSaveExitSettings = async (settings) => {
    try {
      await firebaseService.saveExitSettings(settings);
      handleShowToast("Exit settings saved successfully!", "success");
    } catch (err) {
      handleShowToast("Error saving exit settings: " + err.message, "warning");
    }
  };

  const handleConfirmStaffExit = async (updatedStaff) => {
    try {
      await firebaseService.saveStaff(updatedStaff);
      if (selectedStaff && selectedStaff.id === updatedStaff.id) {
        setSelectedStaff(updatedStaff);
      }
      handleShowToast(`Processed exit for "${updatedStaff.fullName}" successfully!`, 'success');
      logActivity("Staff", "UPDATE", `Processed exit details for staff member "${updatedStaff.fullName}"`);
      
      // Open email dispatch notification preview
      setExitEmailTriggerStaff(updatedStaff);
      setIsExitEmailTriggerOpen(true);
    } catch (err) {
      console.error("Save staff exit details error:", err);
      handleShowToast("Error saving exit details: " + err.message, 'warning');
    }
  };

  const handleSendExitEmail = async (notifications) => {
    const list = Array.isArray(notifications) ? notifications : [notifications];
    let successCount = 0;
    let failError = null;

    for (const notif of list) {
      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipient: notif.recipient,
            subject: notif.subject,
            body: notif.body
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${res.status}`);
        }

        // Successfully sent, save success state to Firestore
        await firebaseService.logEmailNotification({
          ...notif,
          delivery: {
            state: 'SUCCESS',
            endTime: new Date(),
            attempts: 1
          }
        });
        successCount++;
      } catch (err) {
        console.error("Failed to send exit email:", err);
        failError = err.message;
        
        // Log the failure to Firestore for auditing
        try {
          await firebaseService.logEmailNotification({
            ...notif,
            delivery: {
              state: 'ERROR',
              error: err.message,
              endTime: new Date(),
              attempts: 1
            }
          });
        } catch (dbErr) {
          console.error("Failed to log email error in Firestore:", dbErr);
        }
      }
    }

    setIsExitEmailTriggerOpen(false);

    if (successCount > 0) {
      handleShowToast(`Successfully sent ${successCount} exit email(s) via Microsoft 365!`, 'success');
      
      const staffId = list[0]?.staffId;
      if (staffId) {
        const matched = staff.find(s => s.id === staffId);
        if (matched) {
          setSelectedStaff(matched);
          setIsStaffDetailOpen(true);
        }
      }
    }

    if (failError) {
      handleShowToast(`Failed to send email: ${failError}`, 'warning');
    }
  };
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isAiRemindersOpen, setIsAiRemindersOpen] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [bulkDeptSelect, setBulkDeptSelect] = useState('');
  const [customBulkDept, setCustomBulkDept] = useState('');
  const [bulkPayrollSelect, setBulkPayrollSelect] = useState('');
  const [bulkCommissionSelect, setBulkCommissionSelect] = useState('');
  const [bulkLeaveSelect, setBulkLeaveSelect] = useState('');

  // Company Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [complianceFilter, setComplianceFilter] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // grid or list

  // Staff Filters
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffCompanyFilter, setStaffCompanyFilter] = useState('All');
  const [staffDeptFilter, setStaffDeptFilter] = useState('All');
  const [staffStatusFilter, setStaffStatusFilter] = useState('active');
  const [staffViewMode, setStaffViewMode] = useState('grid'); // grid or list

  // Company Sorting
  const [companySortBy, setCompanySortBy] = useState('name');
  const [companySortOrder, setCompanySortOrder] = useState('asc');

  const handleCompanyHeaderClick = (columnKey) => {
    if (companySortBy === columnKey) {
      setCompanySortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setCompanySortBy(columnKey);
      setCompanySortOrder('asc');
    }
  };

  const sortCompaniesList = (list) => {
    return [...list].sort((a, b) => {
      let valA = a[companySortBy] || '';
      let valB = b[companySortBy] || '';
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();

      if (valA < valB) return companySortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return companySortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const renderCompanySortIndicator = (columnKey) => {
    if (companySortBy !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '6px' }}>⇅</span>;
    return companySortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  // Staff Sorting
  const [staffSortBy, setStaffSortBy] = useState('fullName');
  const [staffSortOrder, setStaffSortOrder] = useState('asc');

  const handleStaffHeaderClick = (columnKey) => {
    if (staffSortBy === columnKey) {
      setStaffSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setStaffSortBy(columnKey);
      setStaffSortOrder('asc');
    }
  };

  const sortStaffList = (list) => {
    return [...list].sort((a, b) => {
      let valA = a[staffSortBy] || '';
      let valB = b[staffSortBy] || '';

      if (staffSortBy === 'salary') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return staffSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return staffSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const renderStaffSortIndicator = (columnKey) => {
    if (staffSortBy !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '6px' }}>⇅</span>;
    return staffSortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  // Toasts state for micro-interactions
  const [toasts, setToasts] = useState([]);

  // Current date anchor: June 29, 2026
  const CURRENT_DATE = new Date(); CURRENT_DATE.setHours(0, 0, 0, 0);

  // Firebase connection flag
  const isCloudConnected = firebaseService.isConfigured();

  // Get scoped lists based on currentUser permissions
  const getScopedData = () => {
    if (!currentUser) {
      return {
        scopedCompanies: [],
        scopedStaff: [],
        scopedLeaves: [],
        scopedPlacements: [],
        scopedExpenses: []
      };
    }

    const role = currentUser.permissions?.role || (currentUser.id === 'super-admin' ? 'admin' : 'recruiter');
    const scope = scopingViewMode === 'self' ? 'self' : (currentUser.permissions?.dataScope || (currentUser.id === 'super-admin' ? 'all' : 'self'));
    const dept = currentUser.department;
    const userId = currentUser.id;

    // Recursive reporting tree crawler
    const getReportingTreeStaffIds = (managerId, allStaff) => {
      const ids = new Set([managerId]);
      let prevSize = 0;
      while (ids.size > prevSize) {
        prevSize = ids.size;
        allStaff.forEach(s => {
          const mgrIds = s.reportingManagerIds || (s.reportingManagerId ? [s.reportingManagerId] : []);
          const isDirectReport = mgrIds.some(mId => ids.has(mId));
          const isDottedReport = s.dottedLineManagerIds && Array.isArray(s.dottedLineManagerIds) && s.dottedLineManagerIds.some(mId => ids.has(mId));
          
          if (isDirectReport || isDottedReport) {
            ids.add(s.id);
          }
        });
      }
      return Array.from(ids);
    };

    if (role === 'admin' || scope === 'all') {
      return {
        scopedCompanies: companies,
        scopedStaff: staff,
        scopedLeaves: leaveRequests,
        scopedPlacements: placements,
        scopedExpenses: expenses
      };
    }

    // Filter companies for non-admin/restricted users so they only see their employer company
    const filteredCompanies = companies.filter(c => c.id === currentUser.companyId);

    if (scope === 'department') {
      const deptStaffIds = staff.filter(s => s.department === dept).map(s => s.id);
      
      return {
        scopedCompanies: filteredCompanies,
        scopedStaff: staff.filter(s => s.department === dept || s.id === userId),
        scopedLeaves: leaveRequests.filter(r => deptStaffIds.includes(r.staffId)),
        scopedPlacements: placements.filter(p => p.splits && p.splits.some(sp => deptStaffIds.includes(sp.staffId))),
        scopedExpenses: expenses.filter(e => 
          e.allocationTarget === dept || 
          (Array.isArray(e.allocationTarget) && e.allocationTarget.some(t => deptStaffIds.includes(t)))
        )
      };
    }

    if (scope === 'team') {
      const teamStaffIds = getReportingTreeStaffIds(userId, staff);
      
      return {
        scopedCompanies: filteredCompanies,
        scopedStaff: staff.filter(s => teamStaffIds.includes(s.id)),
        scopedLeaves: leaveRequests.filter(r => teamStaffIds.includes(r.staffId)),
        scopedPlacements: placements.filter(p => p.splits && p.splits.some(sp => teamStaffIds.includes(sp.staffId))),
        scopedExpenses: expenses.filter(e => 
          teamStaffIds.includes(e.staffId) ||
          (e.allocationType === 'staff' && Array.isArray(e.allocationTarget) && e.allocationTarget.some(t => teamStaffIds.includes(t)))
        )
      };
    }

    // Consultant / Recruiter (scope: 'self')
    return {
      scopedCompanies: filteredCompanies,
      scopedStaff: staff.filter(s => s.id === userId),
      scopedLeaves: leaveRequests.filter(r => r.staffId === userId),
      scopedPlacements: placements.filter(p => p.splits && p.splits.some(sp => sp.staffId === userId)),
      scopedExpenses: expenses.filter(e => 
        (e.staffId === userId) ||
        (e.allocationType === 'staff' && Array.isArray(e.allocationTarget) && e.allocationTarget.includes(userId))
      )
    };
  };

  const { scopedCompanies, scopedStaff, scopedLeaves, scopedPlacements, scopedExpenses } = useMemo(() => {
    return getScopedData();
  }, [currentUser, scopingViewMode, companies, staff, leaveRequests, placements, expenses]);

  // Update selectedCompany when companies list updates
  useEffect(() => {
    if (selectedCompany) {
      const refreshed = companies.find(c => c.id === selectedCompany.id);
      console.log("[App] selectedCompany useEffect. refreshed:", refreshed ? refreshed.name : "not found", "current:", selectedCompany.name);
      if (refreshed && refreshed !== selectedCompany) {
        console.log("[App] updating selectedCompany to refreshed object reference");
        setSelectedCompany(refreshed);
      }
    }
  }, [companies, selectedCompany]);

  // Update selectedStaff when staff list updates
  useEffect(() => {
    if (selectedStaff) {
      const refreshed = staff.find(s => s.id === selectedStaff.id);
      console.log("[App] selectedStaff useEffect. refreshed:", refreshed ? refreshed.fullName : "not found", "current:", selectedStaff.fullName);
      if (refreshed && refreshed !== selectedStaff) {
        console.log("[App] updating selectedStaff to refreshed object reference");
        setSelectedStaff(refreshed);
      }
    }
  }, [staff, selectedStaff]);


  // Sync commission policies
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeCommissionPolicies((updatedList) => {
      setCommissionPolicies(updatedList);
    }, initialCommissionPolicies);
    return () => unsubscribe();
  }, []);



  // Sync asset assignments
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeAssetAssignments((updatedList) => {
      setAssetAssignments(updatedList);
    }, initialAssetAssignments);
    return () => unsubscribe();
  }, []);







  // Sync audit logs
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeAuditLogs((updatedList) => {
      setAuditLogs(updatedList);
    }, []);
    return () => unsubscribe();
  }, []);

  // Sync sent emails
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeSentEmails((updatedList) => {
      setSentEmails(updatedList);
    }, []);
    return () => unsubscribe();
  }, []);

  // Sync reminder settings
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeReminderSettings((settings) => {
      setReminderSettings(settings);
    }, {
      managementEmails: 'groupadmin@globalrecruiters.ae',
      alertManagers: true,
      alertCoworkers: false,
      sendToEmployee: true,
      alertManagementDayBefore: true,
      sendGreetingsDayOf: true
    });
    return () => unsubscribe();
  }, []);

  // Sync theme to document body class
  useEffect(() => {
    localStorage.setItem('bm-theme', theme);
    const bodyClassList = document.body.classList;
    if (theme === 'light') {
      bodyClassList.add('light-theme');
    } else {
      bodyClassList.remove('light-theme');
    }
  }, [theme]);

  // Trigger toast notification
  const handleShowToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Toggle theme
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  /* ==========================================
     COMPANY CALLBACKS
     ========================================== */
  const handleSaveCompany = async (companyData) => {
    try {
      const isNew = !companies.some(c => c.id === companyData.id);
      await firebaseService.saveCompany(companyData);
      if (selectedCompany && selectedCompany.id === companyData.id) {
        setSelectedCompany(companyData);
      }
      handleShowToast(`Saved company "${companyData.name}" details.`, 'success');
      logActivity("Companies", isNew ? "CREATE" : "UPDATE", `${isNew ? 'Registered' : 'Updated'} company entity "${companyData.name}"`);
    } catch (err) {
      console.error("Save company error:", err);
      handleShowToast(`Error saving company details: ${err.message}`, 'warning');
    }
  };

  const handleDeleteCompany = async (e, companyId, companyName) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete ${companyName}? This action is irreversible and removes all company records.`)) {
      try {
        await firebaseService.deleteCompany(companyId);
        if (selectedCompany && selectedCompany.id === companyId) {
          setIsDetailOpen(false);
        }
        handleShowToast(`Deleted "${companyName}" from group entities.`, 'info');
        logActivity("Companies", "DELETE", `Deleted company entity "${companyName}"`);
      } catch (err) {
         console.error("Delete company error:", err);
         handleShowToast(`Error deleting company: ${err.message}`, 'warning');
      }
    }
  };

  const handleOpenEdit = (e, company) => {
    e.stopPropagation();
    setEditingCompany(company);
    setIsFormOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingCompany(null);
    setIsFormOpen(true);
  };

  const handleSelectCompany = (company) => {
    setSelectedCompany(company);
    setIsDetailOpen(true);
  };

  /* ==========================================
     STAFF CALLBACKS
     ========================================== */
  const handleSaveStaff = async (staffData) => {
    try {
      const isNew = !staff.some(s => s.id === staffData.id);
      await firebaseService.saveStaff(staffData);
      if (selectedStaff && selectedStaff.id === staffData.id) {
        setSelectedStaff(staffData);
      }
      handleShowToast(`Saved staff profile for "${staffData.fullName}".`, 'success');
      logActivity("Staff", isNew ? "CREATE" : "UPDATE", `${isNew ? 'Onboarded' : 'Modified'} staff profile for "${staffData.fullName}"`);
    } catch (err) {
      console.error("Save staff error:", err);
      handleShowToast(`Error saving staff details: ${err.message}`, 'warning');
    }
  };

  const handleBulkImportStaff = async (staffProfiles) => {
    try {
      for (const profile of staffProfiles) {
        await firebaseService.saveStaff(profile);
        logActivity("Staff", "CREATE", `Bulk imported staff profile for "${profile.fullName}"`);
      }
    } catch (err) {
      console.error("Bulk import staff error:", err);
      throw err;
    }
  };

  const handleDeleteStaff = async (e, staffId, staffName) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete staff member ${staffName}?`)) {
      try {
        await firebaseService.deleteStaff(staffId);
        if (selectedStaff && selectedStaff.id === staffId) {
          setIsStaffDetailOpen(false);
        }
        handleShowToast(`Deleted "${staffName}" from staff files.`, 'info');
        logActivity("Staff", "DELETE", `Terminated/Deleted staff member profile "${staffName}"`);
      } catch (err) {
        console.error("Delete staff error:", err);
        handleShowToast(`Error deleting staff: ${err.message}`, 'warning');
      }
    }
  };

  const handleOpenStaffEdit = (e, staffMember) => {
    e.stopPropagation();
    setEditingStaff(staffMember);
    setStaffFormInitialStep(1);
    setIsStaffFormOpen(true);
  };

  const handleOpenStaffCreate = () => {
    if (companies.length === 0) {
      handleShowToast("You must register at least one company before onboarding staff.", "warning");
      return;
    }
    setEditingStaff(null);
    setStaffFormInitialStep(1);
    setIsStaffFormOpen(true);
  };

  const handleSelectStaff = (staffMember) => {
    setSelectedStaff(staffMember);
    setIsStaffDetailOpen(true);
  };

  /* ==========================================
     LEAVES & HOLIDAYS CALLBACKS
     ========================================== */
  const handleSaveLeavePolicy = async (policy) => {
    try {
      const isNew = !leavePolicies.some(p => p.id === policy.id);
      await firebaseService.saveLeavePolicy(policy);
      logActivity("Leaves", isNew ? "CREATE" : "UPDATE", `${isNew ? 'Created' : 'Updated'} leave allowance policy "${policy.name}"`);
    } catch (err) {
      console.error("Save policy error:", err);
      handleShowToast(`Error saving policy: ${err.message}`, 'warning');
    }
  };

  const handleDeleteLeavePolicy = async (policyId) => {
    try {
      const matched = leavePolicies.find(p => p.id === policyId);
      const nameStr = matched ? `"${matched.name}"` : `ID "${policyId}"`;
      await firebaseService.deleteLeavePolicy(policyId);
      logActivity("Leaves", "DELETE", `Deleted leave policy ${nameStr}`);
    } catch (err) {
      console.error("Delete policy error:", err);
      handleShowToast(`Error deleting policy: ${err.message}`, 'warning');
    }
  };

  const handleSaveHoliday = async (holiday) => {
    try {
      const isNew = !holidays.some(h => h.id === holiday.id);
      await firebaseService.saveHoliday(holiday);
      logActivity("Leaves", isNew ? "CREATE" : "UPDATE", `${isNew ? 'Added' : 'Updated'} public holiday: "${holiday.name}" on ${holiday.date}`);
    } catch (err) {
      console.error("Save holiday error:", err);
      handleShowToast(`Error saving holiday: ${err.message}`, 'warning');
    }
  };

  const handleDeleteHoliday = async (holidayId) => {
    try {
      const matched = holidays.find(h => h.id === holidayId);
      const nameStr = matched ? `"${matched.name}"` : `ID "${holidayId}"`;
      await firebaseService.deleteHoliday(holidayId);
      logActivity("Leaves", "DELETE", `Removed public holiday ${nameStr}`);
    } catch (err) {
      console.error("Delete holiday error:", err);
      handleShowToast(`Error deleting holiday: ${err.message}`, 'warning');
    }
  };

  const handleSaveLeaveRequest = async (request) => {
    try {
      const isNew = !leaveRequests.some(r => r.id === request.id);
      const staffMember = staff.find(s => s.id === request.staffId);
      const staffName = staffMember ? staffMember.fullName : `ID "${request.staffId}"`;
      await firebaseService.saveLeaveRequest(request);
      logActivity("Leaves", isNew ? "CREATE" : "UPDATE", `${isNew ? 'Booked' : 'Modified'} leave request for ${staffName} (Type: ${request.leaveType}, Days: ${request.totalDays})`);
    } catch (err) {
      console.error("Save request error:", err);
      handleShowToast(`Error saving request: ${err.message}`, 'warning');
    }
  };

  const handleUpdateLeaveRequestStatus = async (requestId, status) => {
    const request = leaveRequests.find(r => r.id === requestId);
    if (!request) return;
    const updatedRequest = { ...request, status };
    try {
      const staffMember = staff.find(s => s.id === request.staffId);
      const staffName = staffMember ? staffMember.fullName : `ID "${request.staffId}"`;
      await firebaseService.saveLeaveRequest(updatedRequest);
      logActivity("Leaves", "UPDATE", `${status === 'approved' ? 'Approved' : 'Rejected'} leave request for ${staffName} (${request.startDate} to ${request.endDate})`);
    } catch (err) {
      console.error("Update request status error:", err);
      handleShowToast(`Error updating request status: ${err.message}`, 'warning');
    }
  };

  /* ==========================================
     COMMISSION SCHEMES CALLBACKS
     ========================================== */
  const handleSaveCommissionPolicy = async (policy) => {
    try {
      const isNew = !commissionPolicies.some(p => p.id === policy.id);
      await firebaseService.saveCommissionPolicy(policy);
      logActivity("Commissions", isNew ? "CREATE" : "UPDATE", `${isNew ? 'Created' : 'Updated'} commission scheme policy "${policy.name}"`);
    } catch (err) {
      console.error("Save commission policy error:", err);
      handleShowToast(`Error saving scheme: ${err.message}`, 'warning');
    }
  };

  const handleDeleteCommissionPolicy = async (policyId) => {
    try {
      const matched = commissionPolicies.find(p => p.id === policyId);
      const nameStr = matched ? `"${matched.name}"` : `ID "${policyId}"`;
      await firebaseService.deleteCommissionPolicy(policyId);
      logActivity("Commissions", "DELETE", `Deleted commission policy scheme ${nameStr}`);
    } catch (err) {
      console.error("Delete commission policy error:", err);
      handleShowToast(`Error deleting scheme: ${err.message}`, 'warning');
    }
  };

  /* ==========================================
     VENDOR & ASSET CONTRACTS CALLBACKS
     ========================================== */
  const handleSaveVendor = async (vendor) => {
    try {
      const isNew = !vendors.some(v => v.id === vendor.id);
      await firebaseService.saveVendor(vendor);
      logActivity("Vendors", isNew ? "CREATE" : "UPDATE", `${isNew ? 'Added' : 'Updated'} vendor profile for "${vendor.name}"`);
    } catch (err) {
      console.error("Save vendor error:", err);
      handleShowToast(`Error saving vendor: ${err.message}`, 'warning');
    }
  };

  const handleDeleteVendor = async (vendorId) => {
    try {
      const matched = vendors.find(v => v.id === vendorId);
      const nameStr = matched ? `"${matched.name}"` : `ID "${vendorId}"`;
      await firebaseService.deleteVendor(vendorId);
      logActivity("Vendors", "DELETE", `Deleted vendor record ${nameStr}`);
    } catch (err) {
      console.error("Delete vendor error:", err);
      handleShowToast(`Error deleting vendor: ${err.message}`, 'warning');
    }
  };

  const handleSaveContract = async (contract) => {
    try {
      const isNew = !contracts.some(c => c.id === contract.id);
      await firebaseService.saveContract(contract);
      logActivity("Contracts", isNew ? "CREATE" : "UPDATE", `${isNew ? 'Added' : 'Updated'} asset contract package "${contract.name}" (Seats: ${contract.quantityPurchased})`);
    } catch (err) {
      console.error("Save contract error:", err);
      handleShowToast(`Error saving contract: ${err.message}`, 'warning');
    }
  };

  const handleDeleteContract = async (contractId) => {
    try {
      const matched = contracts.find(c => c.id === contractId);
      const nameStr = matched ? `"${matched.name}"` : `ID "${contractId}"`;
      await firebaseService.deleteContract(contractId);
      logActivity("Contracts", "DELETE", `Deleted contract package ${nameStr}`);
    } catch (err) {
      console.error("Delete contract error:", err);
      handleShowToast(`Error deleting contract: ${err.message}`, 'warning');
    }
  };

  const handleSaveAssetAssignment = async (assignment) => {
    try {
      await firebaseService.saveAssetAssignment(assignment);
      const staffMember = staff.find(s => s.id === assignment.staffId);
      const staffName = staffMember ? staffMember.fullName : `ID "${assignment.staffId}"`;
      const contractPkg = contracts.find(c => c.id === assignment.contractId);
      const contractTitle = contractPkg ? contractPkg.name : `ID "${assignment.contractId}"`;
      logActivity("Vendors", "CREATE", `Assigned seat under "${contractTitle}" to recruiter "${staffName}"`);
    } catch (err) {
      console.error("Save assignment error:", err);
      handleShowToast(`Error assigning asset: ${err.message}`, 'warning');
    }
  };

  const handleDeleteAssetAssignment = async (assignmentId) => {
    try {
      const assignment = assetAssignments.find(a => a.id === assignmentId);
      let logDesc = `Released assigned license seat ID "${assignmentId}" back to pool`;
      if (assignment) {
        const staffMember = staff.find(s => s.id === assignment.staffId);
        const staffName = staffMember ? staffMember.fullName : `ID "${assignment.staffId}"`;
        const contractPkg = contracts.find(c => c.id === assignment.contractId);
        const contractTitle = contractPkg ? contractPkg.name : `ID "${assignment.contractId}"`;
        logDesc = `Released "${contractTitle}" license seat assigned to recruiter "${staffName}"`;
      }
      await firebaseService.deleteAssetAssignment(assignmentId);
      logActivity("Vendors", "DELETE", logDesc);
    } catch (err) {
      console.error("Delete assignment error:", err);
      handleShowToast(`Error releasing asset: ${err.message}`, 'warning');
    }
  };

  /* ==========================================
     PLACEMENTS CALLBACKS
     ========================================== */
  const handleSavePlacement = async (placement) => {
    try {
      const isNew = !placements.some(p => p.id === placement.id);
      await firebaseService.savePlacement(placement);
      logActivity("Placements", isNew ? "CREATE" : "UPDATE", `${isNew ? 'Logged' : 'Modified'} placement ID "${placement.placementId}" for candidate "${placement.candidateName}" with client "${placement.clientCompany}"`);

      // Auto-register or update candidate inside CRM talent pool if synced
      if (placement.candidateName) {
        const crmCandidates = useBoundStore.getState().crmCandidates || [];
        const existingCand = crmCandidates.find(c => c.name.toLowerCase() === placement.candidateName.toLowerCase());

        // Fetch CV from Recruitly and upload it to Firebase Storage
        let cvUrl = '';
        let cvName = '';
        if (placement.crmCandidateHasCv && placement.crmCandidateId && placement.crmApiKey) {
          try {
            const cvRes = await fetch(`/api/recruitly-cv?candidateId=${placement.crmCandidateId}&apiKey=${placement.crmApiKey}`);
            if (cvRes.ok) {
              const blob = await cvRes.blob();
              const file = new File([blob], "Curriculum_Vitae.pdf", { type: blob.type || "application/pdf" });
              const storageUrl = await firebaseService.uploadCandidateCv(placement.crmCandidateId, file);
              cvUrl = storageUrl;
              cvName = 'Recruitly CV';
              console.log("Successfully uploaded CV from CRM to Firebase Storage:", cvUrl);
            }
          } catch (err) {
            console.error("Failed to download/upload CV from CRM:", err);
          }
        }

        if (!existingCand) {
          const newCandidate = {
            id: `cand-${Date.now()}`,
            name: placement.candidateName,
            email: placement.crmCandidateEmail || '',
            phone: placement.crmCandidateMobile || '',
            jobTitle: placement.crmJobTitle || '',
            status: 'placed',
            cvUrl: cvUrl || '',
            cvName: cvName || '',
            notes: `Automatically registered via CRM Placement sync (ID: ${placement.placementId}).`,
            // Custom timeline and resume fields
            location: placement.crmCandidateLocation || '',
            skills: placement.crmCandidateSkills ? placement.crmCandidateSkills.join(', ') : '',
            crmCandidateId: placement.crmCandidateId || '',
            employmentHistory: placement.crmCandidateEmploymentHistory || [],
            educationHistory: placement.crmCandidateEducationHistory || []
          };
          await firebaseService.saveCrmCandidate(newCandidate);
        } else {
          // Merge and update existing candidate (prioritizing new synced values!)
          const updatedCandidate = {
            ...existingCand,
            email: placement.crmCandidateEmail || existingCand.email || '',
            phone: placement.crmCandidateMobile || existingCand.phone || '',
            jobTitle: placement.crmJobTitle || existingCand.jobTitle || '',
            cvUrl: cvUrl || existingCand.cvUrl || '',
            cvName: cvName || existingCand.cvName || '',
            location: placement.crmCandidateLocation || existingCand.location || '',
            skills: (placement.crmCandidateSkills ? placement.crmCandidateSkills.join(', ') : '') || existingCand.skills || '',
            crmCandidateId: placement.crmCandidateId || existingCand.crmCandidateId || '',
            employmentHistory: (placement.crmCandidateEmploymentHistory && placement.crmCandidateEmploymentHistory.length) ? placement.crmCandidateEmploymentHistory : (existingCand.employmentHistory || []),
            educationHistory: (placement.crmCandidateEducationHistory && placement.crmCandidateEducationHistory.length) ? placement.crmCandidateEducationHistory : (existingCand.educationHistory || [])
          };
          await firebaseService.saveCrmCandidate(updatedCandidate);
        }
      }

      // Auto-register or update company inside CRM client directory if synced
      if (placement.clientCompany) {
        const crmClientCompanies = useBoundStore.getState().crmClientCompanies || [];
        const existingClient = crmClientCompanies.find(c => c.name.toLowerCase() === placement.clientCompany.toLowerCase());
        if (!existingClient) {
          const newClient = {
            id: `crm-comp-${Date.now()}`,
            name: placement.clientCompany,
            regNumber: '',
            address: placement.crmCompanyAddress || '',
            contactName: placement.crmJobContactName || '',
            contactEmail: placement.crmJobContactEmail || '',
            accountsContactName: placement.crmJobContactName || '',
            accountsContactEmail: placement.crmJobContactEmail || '',
            phone: placement.crmCompanyPhone || placement.crmJobContactPhone || '',
            website: placement.crmCompanyWebsite || '',
            notes: `Automatically registered via CRM Placement sync (ID: ${placement.placementId}).`
          };
          await firebaseService.saveCrmClientCompany(newClient);
        } else {
          // Merge and update existing client (prioritizing new synced values!)
          const updatedClient = {
            ...existingClient,
            address: placement.crmCompanyAddress || existingClient.address || '',
            contactName: placement.crmJobContactName || existingClient.contactName || '',
            contactEmail: placement.crmJobContactEmail || existingClient.contactEmail || '',
            phone: placement.crmCompanyPhone || placement.crmJobContactPhone || existingClient.phone || '',
            website: placement.crmCompanyWebsite || existingClient.website || ''
          };
          await firebaseService.saveCrmClientCompany(updatedClient);
        }
      }
    } catch (err) {
      console.error("Save placement error:", err);
      handleShowToast(`Error saving placement: ${err.message}`, 'warning');
    }
  };

  const handleDeletePlacement = async (id) => {
    try {
      const matched = placements.find(p => p.id === id);
      const nameStr = matched ? `"${matched.placementId}"` : `ID "${id}"`;
      await firebaseService.deletePlacement(id);
      logActivity("Placements", "DELETE", `Deleted candidate placement ${nameStr}`);
    } catch (err) {
      console.error("Delete placement error:", err);
      handleShowToast(`Error deleting placement: ${err.message}`, 'warning');
    }
  };

  const handleSavePlacementsBatch = async (placementsList) => {
    try {
      await firebaseService.savePlacementsBatch(placementsList);
      logActivity("Placements", "CREATE", `Bulk imported ${placementsList.length} candidate placements via CRM statement upload`);
    } catch (err) {
      console.error("Save batch error:", err);
      handleShowToast(`Error importing placements: ${err.message}`, 'warning');
    }
  };

  const handleClearAllPlacements = async () => {
    if (!window.confirm("WARNING: This will permanently delete ALL placement sales records from the database. This action cannot be undone.\n\nAre you absolutely sure?")) {
      return;
    }
    const entered = window.prompt("Type 'DELETE' in all capital letters to confirm database purge:");
    if (entered !== 'DELETE') {
      handleShowToast("Database clear aborted. Confirmation mismatch.", "warning");
      return;
    }

    try {
      await firebaseService.clearPlacements(placements);
      logActivity("System", "DELETE", `Purged placement database containing ${placements.length} sales records.`);
      handleShowToast("Successfully deleted all placement records!", "success");
    } catch (err) {
      console.error("Clear placements error:", err);
      handleShowToast(`Error clearing placements: ${err.message}`, "warning");
    }
  };

  const handleClearAllStaff = async () => {
    if (!window.confirm("WARNING: This will permanently delete ALL staff records from the database. This action cannot be undone.\n\nAre you absolutely sure?")) {
      return;
    }
    const entered = window.prompt("Type 'DELETE' in all capital letters to confirm database purge:");
    if (entered !== 'DELETE') {
      handleShowToast("Database clear aborted. Confirmation mismatch.", "warning");
      return;
    }

    try {
      await firebaseService.clearStaff(staff);
      logActivity("System", "DELETE", `Purged staff directory database containing ${staff.length} staff records.`);
      handleShowToast("Successfully deleted all staff records!", "success");
    } catch (err) {
      console.error("Clear staff error:", err);
      handleShowToast(`Error clearing staff: ${err.message}`, "warning");
    }
  };

  const handleBulkAssignDepartment = async () => {
    const finalDept = bulkDeptSelect === 'NEW_DEPT' ? customBulkDept : bulkDeptSelect;
    if (!finalDept) return;

    if (!window.confirm(`Are you sure you want to assign the department "${finalDept}" to the ${selectedStaffIds.length} selected staff profiles?`)) {
      return;
    }

    try {
      // Loop and update each selected staff member in Firestore/LocalStorage
      for (const id of selectedStaffIds) {
        const member = staff.find(s => s.id === id);
        if (member) {
          const updatedMember = {
            ...member,
            department: finalDept
          };
          await firebaseService.saveStaff(updatedMember);
        }
      }
      
      logActivity("Staff", "UPDATE", `Bulk assigned department "${finalDept}" to ${selectedStaffIds.length} staff profiles.`);
      handleShowToast(`Successfully updated department to "${finalDept}" for ${selectedStaffIds.length} profiles!`, "success");
      
      // Reset states
      setSelectedStaffIds([]);
      setBulkDeptSelect('');
      setCustomBulkDept('');
    } catch (err) {
      console.error("Bulk assign department error:", err);
      handleShowToast(`Error updating departments: ${err.message}`, "warning");
    }
  };

  const handleBulkAssignPayrollPolicy = async () => {
    if (!bulkPayrollSelect) return;
    const isClear = bulkPayrollSelect === 'CLEAR_POLICY';
    const policyVal = isClear ? '' : bulkPayrollSelect;
    const policy = payrollPolicies.find(p => p.id === policyVal);
    const policyLabel = isClear ? 'No Policy (Salaried)' : (policy ? policy.name : 'Unknown Policy');

    if (!window.confirm(`Are you sure you want to assign the payroll template "${policyLabel}" to the ${selectedStaffIds.length} selected staff profiles?`)) {
      return;
    }

    try {
      for (const id of selectedStaffIds) {
        const member = staff.find(s => s.id === id);
        if (member) {
          await firebaseService.saveStaff({
            ...member,
            payrollPolicyId: policyVal
          });
        }
      }
      logActivity("Staff", "UPDATE", `Bulk assigned payroll policy "${policyLabel}" to ${selectedStaffIds.length} staff profiles.`);
      handleShowToast(`Successfully updated payroll template to "${policyLabel}" for ${selectedStaffIds.length} profiles!`, "success");
      setSelectedStaffIds([]);
      setBulkPayrollSelect('');
    } catch (err) {
      console.error("Bulk assign payroll error:", err);
      handleShowToast(`Error updating payroll templates: ${err.message}`, "warning");
    }
  };

  const handleBulkAssignCommissionPolicy = async () => {
    if (!bulkCommissionSelect) return;
    const isClear = bulkCommissionSelect === 'CLEAR_POLICY';
    const policyVal = isClear ? '' : bulkCommissionSelect;
    const policy = commissionPolicies.find(p => p.id === policyVal);
    const policyLabel = isClear ? 'No Commission Scheme' : (policy ? policy.name : 'Unknown Scheme');

    if (!window.confirm(`Are you sure you want to assign the commission scheme "${policyLabel}" to the ${selectedStaffIds.length} selected staff profiles?`)) {
      return;
    }

    try {
      for (const id of selectedStaffIds) {
        const member = staff.find(s => s.id === id);
        if (member) {
          await firebaseService.saveStaff({
            ...member,
            commissionPolicyId: policyVal
          });
        }
      }
      logActivity("Staff", "UPDATE", `Bulk assigned commission policy "${policyLabel}" to ${selectedStaffIds.length} staff profiles.`);
      handleShowToast(`Successfully updated commission scheme to "${policyLabel}" for ${selectedStaffIds.length} profiles!`, "success");
      setSelectedStaffIds([]);
      setBulkCommissionSelect('');
    } catch (err) {
      console.error("Bulk assign commission error:", err);
      handleShowToast(`Error updating commission schemes: ${err.message}`, "warning");
    }
  };

  const handleBulkAssignLeavePolicy = async () => {
    if (!bulkLeaveSelect) return;
    const isClear = bulkLeaveSelect === 'CLEAR_POLICY';
    const policyVal = isClear ? '' : bulkLeaveSelect;
    const policy = leavePolicies.find(p => p.id === policyVal);
    const policyLabel = isClear ? 'No Leave Policy' : (policy ? policy.name : 'Unknown Policy');

    if (!window.confirm(`Are you sure you want to assign the leave policy "${policyLabel}" to the ${selectedStaffIds.length} selected staff profiles?`)) {
      return;
    }

    try {
      for (const id of selectedStaffIds) {
        const member = staff.find(s => s.id === id);
        if (member) {
          await firebaseService.saveStaff({
            ...member,
            leavePolicyId: policyVal
          });
        }
      }
      logActivity("Staff", "UPDATE", `Bulk assigned leave policy "${policyLabel}" to ${selectedStaffIds.length} staff profiles.`);
      handleShowToast(`Successfully updated leave policy to "${policyLabel}" for ${selectedStaffIds.length} profiles!`, "success");
      setSelectedStaffIds([]);
      setBulkLeaveSelect('');
    } catch (err) {
      console.error("Bulk assign leave error:", err);
      handleShowToast(`Error updating leave policies: ${err.message}`, "warning");
    }
  };

  /* ==========================================
     EXPENSES CALLBACKS
     ========================================== */
  const handleSaveExpense = async (expense) => {
    try {
      const isNew = !expenses.some(e => e.id === expense.id);
      await firebaseService.saveExpense(expense);
      logActivity("Expenses", isNew ? "CREATE" : "UPDATE", `${isNew ? 'Logged' : 'Modified'} expense payee "${expense.payee}" for Nominal "${expense.nominalCode}" (Amount: £${expense.amount.toLocaleString()})`);
    } catch (err) {
      console.error("Save expense error:", err);
      handleShowToast(`Error saving transaction: ${err.message}`, 'warning');
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      const matched = expenses.find(e => e.id === id);
      const payeeStr = matched ? `"${matched.payee}" for "${matched.nominalCode}"` : `ID "${id}"`;
      await firebaseService.deleteExpense(id);
      logActivity("Expenses", "DELETE", `Deleted expense transaction ${payeeStr}`);
    } catch (err) {
      console.error("Delete expense error:", err);
      handleShowToast(`Error deleting transaction: ${err.message}`, 'warning');
    }
  };

  const handleSaveNominalCode = async (codeObj) => {
    try {
      await firebaseService.saveNominalCode(codeObj);
      logActivity("Expenses", "CREATE", `Created nominal ledger code category: "${codeObj.code}"`);
    } catch (err) {
      console.error("Save nominal error:", err);
      handleShowToast(`Error saving nominal category: ${err.message}`, 'warning');
    }
  };

  const handleDeleteNominalCode = async (id) => {
    try {
      const matched = nominalCodes.find(c => c.id === id);
      const codeStr = matched ? `"${matched.code}"` : `key "${id}"`;
      await firebaseService.deleteNominalCode(id);
      logActivity("Expenses", "DELETE", `Deleted nominal ledger category ${codeStr}`);
    } catch (err) {
      console.error("Delete nominal error:", err);
      handleShowToast(`Error deleting nominal category: ${err.message}`, 'warning');
    }
  };

  const handleSavePayrollRecord = async (record) => {
    try {
      await firebaseService.savePayrollRecord(record);
      logActivity("Payroll", "UPDATE", `Updated payroll overrides for staff member ID ${record.staffId} in month ${record.month}`);
    } catch (err) {
      console.error("Save payroll record error:", err);
      handleShowToast(`Error saving payroll override: ${err.message}`, 'warning');
    }
  };

  /* ==========================================
     AUDIT LOGS CALLBACKS
     ========================================== */
  const logActivity = async (module, action, description) => {
    try {
      const log = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        module,
        action,
        description,
        user: currentUser?.fullName || "Admin"
      };
      await firebaseService.saveAuditLog(log);
    } catch (err) {
      console.error("Error logging activity:", err);
    }
  };

  const handleClearAuditLogs = async () => {
    try {
      localStorage.setItem('bm-audit-logs', JSON.stringify([]));
      setAuditLogs([]);
    } catch (err) {
      console.error("Error clearing logs:", err);
    }
  };

  const handleSaveReminderSettings = async (settings) => {
    try {
      await firebaseService.saveReminderSettings(settings);
      setReminderSettings(settings);
      handleShowToast("Reminder settings saved successfully!", "success");
    } catch (err) {
      console.error("Error saving reminder settings:", err);
      handleShowToast("Failed to save reminder settings.", "error");
    }
  };

  /* ==========================================
     BUSINESS RULES / FILTERS
     ========================================== */
  const checkCompanyCompliance = (c) => {
    const hasRegDoc = c.documents ? c.documents.some(d => d.type === 'registration') : false;
    const hasTaxDoc = c.vatNumber ? (c.documents ? c.documents.some(d => d.type === 'vat') : false) : true;
    const hasInsDetails = c.hasInsurance && c.insurance;
    const hasInsDoc = hasInsDetails ? (c.documents ? c.documents.some(d => d.type === 'insurance') : false) : false;
    
    let isInsExpired = false;
    let isInsExpiringSoon = false;
    
    if (hasInsDetails) {
      const expiry = new Date(c.insurance.expiryDate);
      const diffDays = Math.ceil((expiry - CURRENT_DATE) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        isInsExpired = true;
      } else if (diffDays <= 90) {
        isInsExpiringSoon = true;
      }
    }

    const pendingTasks = c.complianceTasks ? c.complianceTasks.filter(t => t.status === 'pending') : [];
    const hasOverdueTasks = pendingTasks.some(t => {
      const due = new Date(t.dueDate);
      return (due - CURRENT_DATE) < 0;
    });
    
    const hasDueSoonTasks = pendingTasks.some(t => {
      const due = new Date(t.dueDate);
      const diffDays = Math.ceil((due - CURRENT_DATE) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    });

    if (!hasRegDoc || isInsExpired || hasOverdueTasks) {
      return { status: 'critical', color: 'danger', text: 'Critical Risk' };
    }
    
    if (!hasTaxDoc || !hasInsDetails || !hasInsDoc || isInsExpiringSoon || hasDueSoonTasks) {
      return { status: 'warning', color: 'warning', text: 'Warning / Action Required' };
    }

    return { status: 'good', color: 'success', text: 'Compliant' };
  };

  // Companies filter logic
  const filteredCompanies = scopedCompanies.filter(c => {
    const matchesSearch = 
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.legalName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.registrationNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.pointOfContact && c.pointOfContact.name && c.pointOfContact.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCountry = countryFilter === 'All' || c.country === countryFilter;

    const compliance = checkCompanyCompliance(c);
    const matchesCompliance = complianceFilter === 'All' || 
      (complianceFilter === 'Compliant' && compliance.status === 'good') ||
      (complianceFilter === 'Warning' && compliance.status === 'warning') ||
      (complianceFilter === 'Critical' && compliance.status === 'critical');

    return matchesSearch && matchesCountry && matchesCompliance;
  });

  const sortedCompanies = sortCompaniesList(filteredCompanies);

  // Compile list of unique departments from both company profiles and active staff records
  const allAvailableDepts = (() => {
    const depts = [];
    // Add from company profiles
    scopedCompanies.forEach(c => {
      (c.departments || []).forEach(d => {
        const name = d.name || d;
        if (name && !depts.includes(name)) depts.push(name);
      });
    });
    // Add from staff profiles
    staff.forEach(s => {
      if (s.department && !depts.includes(s.department)) {
        depts.push(s.department);
      }
    });
    return depts.sort();
  })();

  // Staff filter logic
  const filteredStaff = scopedStaff.filter(s => {
    const matchesSearch = 
      (s.fullName || '').toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      (s.jobTitle || '').toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      (s.personalEmail || '').toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      (s.businessEmail || '').toLowerCase().includes(staffSearchQuery.toLowerCase());

    const matchesCompany = staffCompanyFilter === 'All' || s.companyId === staffCompanyFilter;
    const matchesDept = staffDeptFilter === 'All' || s.department === staffDeptFilter;

    let matchesStatus = true;
    if (staffStatusFilter === 'active') {
      matchesStatus = s.status !== 'exited';
    } else if (staffStatusFilter === 'exited') {
      matchesStatus = s.status === 'exited';
    }

    let matchesCountry = true;
    if (staffCompanyFilter === 'All' && countryFilter !== 'All') {
      const parentComp = companies.find(c => c.id === s.companyId);
      matchesCountry = parentComp && parentComp.country === countryFilter; // respects global country if set, or we filter locally
    }

    return matchesSearch && matchesCompany && matchesDept && matchesStatus && matchesCountry;
  });

  const sortedStaff = sortStaffList(filteredStaff);

  /* ==========================================
     STAFF DASHBOARD METRICS CALCULATION
     ========================================== */
  const totalStaffCount = scopedStaff.length;
  
  // Recruitment Consultants count
  const consultantsCount = scopedStaff.filter(s => s.department === 'Recruitment' || (s.jobTitle || '').toLowerCase().includes('consultant')).length;

  // Audit missing contracts
  const missingContractsCount = scopedStaff.filter(s => 
    !s.documents || !s.documents.some(d => d.type === 'appointment')
  ).length;

  // Payroll Cost summary normalized to GBP
  const getPayrollSummaryStr = () => {
    const totalGBP = scopedStaff.reduce((sum, s) => {
      return sum + toGBP(s.salary, s.currency);
    }, 0);
    return formatGBP(totalGBP);
  };

  if (!currentUser) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-secondary)',
        backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(99, 102, 241, 0.03) 0%, transparent 40%)',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '400px',
          padding: '40px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 700,
              marginBottom: '16px'
            }}>H</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>Humres Group</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Business Management Suite</p>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const email = e.target.email.value.trim().toLowerCase();
            const password = e.target.password.value;

            // 1. Check Super Admin
            if ((email === DEFAULT_ADMIN_USER.businessEmail.toLowerCase() || email === 'naga@gloablrecruiters.ae' || email === 'naga@globalrecruiters.ae') && (password === 'admin123' || password === 'Welcome123')) {
              setCurrentUser(DEFAULT_ADMIN_USER);
              localStorage.setItem('bm-logged-in-user-id', 'super-admin');
              handleShowToast("Welcome back, Super Admin!", "success");
              return;
            }

            // 2. Check Staff list
            const foundStaff = staff.find(s => s.businessEmail?.toLowerCase() === email || s.personalEmail?.toLowerCase() === email);
            if (foundStaff) {
              const correctPassword = foundStaff.password || 'Welcome123';
              if (correctPassword === password) {
                const isNaga = foundStaff.businessEmail?.toLowerCase() === 'naga@humres.co.uk' || foundStaff.businessEmail?.toLowerCase() === 'naga.admin@humres.co.uk';
                const role = isNaga ? 'admin' : (foundStaff.department === 'Finance' || foundStaff.jobTitle?.toLowerCase().includes('manager') ? 'manager' : 'recruiter');
                const updatedPermissions = foundStaff.permissions || {
                  role,
                  dataScope: role === 'admin' ? 'all' : (foundStaff.department === 'Finance' || foundStaff.jobTitle?.toLowerCase().includes('manager') ? 'department' : 'self'),
                  allowedModules: getDefaultAllowedModules(role)
                };
                setCurrentUser({
                  ...foundStaff,
                  permissions: updatedPermissions
                });
                localStorage.setItem('bm-logged-in-user-id', foundStaff.id);
                handleShowToast(`Welcome back, ${foundStaff.fullName}!`, "success");
                return;
              }
            }

            handleShowToast("Invalid email or password. Please try again.", "warning");
          }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Business Email</label>
              <input 
                name="email"
                type="email" 
                className="form-input" 
                placeholder="name@globalrecruiters.ae"
                required
                autoComplete="username email"
                style={{ padding: '12px' }}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>Password</label>
              </div>
              <input 
                name="password"
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ padding: '12px' }}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '8px', fontSize: '14px', fontWeight: 600 }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isSidebarMinimized ? 'minimized' : ''}`}>
        <div>
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarMinimized ? 'center' : 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="logo-icon">H</div>
              {!isSidebarMinimized && (
                <div className="logo-text-block" style={{ animation: 'fadeIn var(--transition-fast)' }}>
                  <div className="logo-text">Humres Group</div>
                  <div className="logo-subtitle">Management Suite</div>
                </div>
              )}
            </div>
            <button 
              onClick={handleToggleSidebar}
              className="sidebar-toggle-btn"
              title={isSidebarMinimized ? "Expand Sidebar" : "Minimize Sidebar"}
              style={{ marginLeft: isSidebarMinimized ? '0' : '8px' }}
            >
              {isSidebarMinimized ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
          
          <nav style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            <ul className="nav-links">
              {isSidebarMinimized ? (
                <>
                  {hasViewPermission(currentUser, 'whats_important') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'whats_important' ? 'active' : ''}`} onClick={() => setActiveTab('whats_important')} title="What's Important">
                        <Bell size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'dashboard') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')} title="Group Dashboard">
                        <LayoutDashboard size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'directory') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'directory' ? 'active' : ''}`} onClick={() => setActiveTab('directory')} title="Company Directory">
                        <Building2 size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'staff') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')} title={currentUser.permissions.role === 'recruiter' ? 'My Staff Profile' : 'Staff & Consultants'}>
                        <Users size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'leaves') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'leaves' ? 'active' : ''}`} onClick={() => setActiveTab('leaves')} title="Leaves & Holidays">
                        <Calendar size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'commissions') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'commissions' ? 'active' : ''}`} onClick={() => setActiveTab('commissions')} title="Commission Plans">
                        <TrendingUp size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'payroll') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => setActiveTab('payroll')} title={currentUser.permissions.role === 'recruiter' ? 'My Payroll' : 'Group Payroll'}>
                        <Wallet size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'vendors') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'vendors' ? 'active' : ''}`} onClick={() => setActiveTab('vendors')} title="Vendors & Assets">
                        <Laptop size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'placements') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'placements' ? 'active' : ''}`} onClick={() => setActiveTab('placements')} title={currentUser.permissions.role === 'recruiter' ? 'My Placements' : 'Sales & Placements'}>
                        <TrendingUp size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'crm') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'crm' ? 'active' : ''}`} onClick={() => setActiveTab('crm')} title="CRM Recruiting">
                        <Briefcase size={18} />
                      </div>
                    </li>
                  )}
                  <li>
                    <div className={`nav-item ${activeTab === 'kpis' ? 'active' : ''}`} onClick={() => setActiveTab('kpis')} title="KPIs">
                      <BarChart2 size={18} />
                    </div>
                  </li>
                  {hasViewPermission(currentUser, 'credit_control') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'credit_control' ? 'active' : ''}`} onClick={() => setActiveTab('credit_control')} title="Credit Control">
                        <FileText size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'cashflow') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'cashflow' ? 'active' : ''}`} onClick={() => setActiveTab('cashflow')} title="Cashflow Forecast">
                        <TrendingUp size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'expenses') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')} title={currentUser.permissions.role === 'recruiter' ? 'My Expense Claims' : 'Expense Ledger'}>
                        <Receipt size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'logs') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')} title="Audit Trail Logs">
                        <History size={18} />
                      </div>
                    </li>
                  )}
                  {hasViewPermission(currentUser, 'reports') && (
                    <li>
                      <div className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')} title="Profit & Loss / Reports">
                        <PieChart size={18} />
                      </div>
                    </li>
                  )}
                  {currentUser.permissions.role === 'admin' && (
                    <li>
                      <div className={`nav-item ${activeTab === 'rbac' ? 'active' : ''}`} onClick={() => setActiveTab('rbac')} title="User Access & Roles">
                        <Key size={18} />
                      </div>
                    </li>
                  )}
                </>
              ) : (
                <>
                  {/* Category: General / Dashboards */}
                  <div 
                    onClick={() => toggleSection('general')} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px 6px 12px',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginTop: '8px',
                      userSelect: 'none'
                    }}
                  >
                    <span>📊 Dashboards & Entity</span>
                    {expandedSections.general ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </div>
                  
                  {expandedSections.general && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
                      {hasViewPermission(currentUser, 'whats_important') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'whats_important' ? 'active' : ''}`} onClick={() => setActiveTab('whats_important')}>
                            <Bell size={18} />
                            <span>What's Important</span>
                          </div>
                        </li>
                      )}
                      {hasViewPermission(currentUser, 'dashboard') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                            <LayoutDashboard size={18} />
                            <span>Group Dashboard</span>
                          </div>
                        </li>
                      )}
                      {hasViewPermission(currentUser, 'directory') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'directory' ? 'active' : ''}`} onClick={() => setActiveTab('directory')}>
                            <Building2 size={18} />
                            <span>Company Directory</span>
                          </div>
                        </li>
                      )}
                    </div>
                  )}
 
                  {/* Category: HRMS (HR Management) */}
                  <div 
                    onClick={() => toggleSection('hrms')} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px 6px 12px',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginTop: '8px',
                      userSelect: 'none'
                    }}
                  >
                    <span>👥 HR Management (HRMS)</span>
                    {expandedSections.hrms ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </div>
 
                  {expandedSections.hrms && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
                      {hasViewPermission(currentUser, 'staff') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'staff' ? 'active' : ''}`} onClick={() => setActiveTab('staff')}>
                            <Users size={18} />
                            <span>{currentUser.permissions.role === 'recruiter' ? 'My Staff Profile' : 'Staff & Consultants'}</span>
                          </div>
                        </li>
                      )}
                      {hasViewPermission(currentUser, 'leaves') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'leaves' ? 'active' : ''}`} onClick={() => setActiveTab('leaves')}>
                            <Calendar size={18} />
                            <span>Leaves & Holidays</span>
                            {currentUser.permissions.role !== 'recruiter' && leaveRequests.filter(r => r.status === 'pending').length > 0 && (
                              <span style={{ 
                                marginLeft: 'auto', 
                                background: 'var(--warning)', 
                                color: '#000', 
                                fontSize: '10px', 
                                padding: '2px 6px', 
                                borderRadius: '8px',
                                fontWeight: 700
                              }}>
                                {leaveRequests.filter(r => r.status === 'pending').length}
                              </span>
                            )}
                          </div>
                        </li>
                      )}
                      {hasViewPermission(currentUser, 'commissions') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'commissions' ? 'active' : ''}`} onClick={() => setActiveTab('commissions')}>
                            <TrendingUp size={18} />
                            <span>Commission Plans</span>
                          </div>
                        </li>
                      )}
                      {hasViewPermission(currentUser, 'payroll') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => setActiveTab('payroll')}>
                            <Wallet size={18} />
                            <span>{currentUser.permissions.role === 'recruiter' ? 'My Payroll' : 'Group Payroll'}</span>
                          </div>
                        </li>
                      )}
                    </div>
                  )}
 
                  {/* Category: CRM & Sales */}
                  <div 
                    onClick={() => toggleSection('crm')} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px 6px 12px',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginTop: '8px',
                      userSelect: 'none'
                    }}
                  >
                    <span>💼 CRM & Recruiting</span>
                    {expandedSections.crm ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </div>
 
                  {expandedSections.crm && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
                      {hasViewPermission(currentUser, 'crm') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'crm' ? 'active' : ''}`} onClick={() => setActiveTab('crm')}>
                            <Briefcase size={18} />
                            <span>CRM Recruiting Desk</span>
                          </div>
                        </li>
                      )}
                      {hasViewPermission(currentUser, 'placements') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'placements' ? 'active' : ''}`} onClick={() => setActiveTab('placements')}>
                            <TrendingUp size={18} />
                            <span>{currentUser.permissions.role === 'recruiter' ? 'My Placements' : 'Sales & Placements'}</span>
                          </div>
                        </li>
                      )}
                    </div>
                  )}
 
                  {/* Category: Finance */}
                  <div 
                    onClick={() => toggleSection('finance')} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px 6px 12px',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginTop: '8px',
                      userSelect: 'none'
                    }}
                  >
                    <span>💵 Finance & Ledger</span>
                    {expandedSections.finance ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </div>
 
                  {expandedSections.finance && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
                      {hasViewPermission(currentUser, 'credit_control') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'credit_control' ? 'active' : ''}`} onClick={() => setActiveTab('credit_control')}>
                            <FileText size={18} />
                            <span>Accounts Receivable</span>
                          </div>
                          {activeTab === 'credit_control' && (
                            <ul style={{ listStyle: 'none', paddingLeft: '24px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <li>
                                <div
                                  className={`nav-item sub-nav-item ${creditControlSubTab === 'direct' ? 'active' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); setCreditControlSubTab('direct'); }}
                                  style={{
                                    fontSize: '12px',
                                    padding: '6px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: creditControlSubTab === 'direct' ? 'var(--primary-color)' : 'var(--text-secondary)'
                                  }}
                                >
                                  <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: creditControlSubTab === 'direct' ? 'var(--primary-color)' : 'transparent',
                                    border: '1px solid var(--text-secondary)'
                                  }}></span>
                                  <span>Direct Invoices</span>
                                </div>
                              </li>
                              <li>
                                <div
                                  className={`nav-item sub-nav-item ${creditControlSubTab === 'simplicity' ? 'active' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); setCreditControlSubTab('simplicity'); }}
                                  style={{
                                    fontSize: '12px',
                                    padding: '6px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: creditControlSubTab === 'simplicity' ? 'var(--primary-color)' : 'var(--text-secondary)'
                                  }}
                                >
                                  <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: creditControlSubTab === 'simplicity' ? 'var(--primary-color)' : 'transparent',
                                    border: '1px solid var(--text-secondary)'
                                  }}></span>
                                  <span>Simplicity Invoices</span>
                                </div>
                              </li>
                            </ul>
                          )}
                        </li>
                      )}
                      {hasViewPermission(currentUser, 'vendors') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'vendors' ? 'active' : ''}`} onClick={() => setActiveTab('vendors')}>
                            <Laptop size={18} />
                            <span>Vendors & Assets</span>
                          </div>
                        </li>
                      )}
                      {hasViewPermission(currentUser, 'expenses') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'expenses' ? 'active' : ''}`} onClick={() => setActiveTab('expenses')}>
                            <Receipt size={18} />
                            <span>{currentUser.permissions.role === 'recruiter' ? 'My Expense Claims' : 'Expense Ledger'}</span>
                          </div>
                        </li>
                      )}
                      {hasViewPermission(currentUser, 'cashflow') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'cashflow' ? 'active' : ''}`} onClick={() => setActiveTab('cashflow')}>
                            <TrendingUp size={18} />
                            <span>Cashflow Forecast</span>
                          </div>
                        </li>
                      )}
                      {hasViewPermission(currentUser, 'reports') && (
                        <li>
                          <div className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
                            <PieChart size={18} />
                            <span>Profit & Loss / Reports</span>
                          </div>
                        </li>
                      )}
                    </div>
                  )}
 
                  {/* Category: KPIs */}
                  <div 
                    onClick={() => toggleSection('kpis')} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px 6px 12px',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginTop: '8px',
                      userSelect: 'none'
                    }}
                  >
                    <span>📈 KPI Performance</span>
                    {expandedSections.kpis ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </div>
 
                  {expandedSections.kpis && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
                      <li>
                        <div 
                          className={`nav-item ${activeTab === 'kpis' && activeKpiSubTab === 'overview' ? 'active' : ''}`} 
                          onClick={() => { setActiveTab('kpis'); setActiveKpiSubTab('overview'); }}
                        >
                          <BarChart2 size={18} />
                          <span>Recruiter Overview</span>
                        </div>
                      </li>
                      <li>
                        <div 
                          className={`nav-item ${activeTab === 'kpis' && activeKpiSubTab === 'performance' ? 'active' : ''}`} 
                          onClick={() => { setActiveTab('kpis'); setActiveKpiSubTab('performance'); }}
                        >
                          <TrendingUp size={18} />
                          <span>Performance Scorecard</span>
                        </div>
                      </li>
                      <li>
                        <div 
                          className={`nav-item ${activeTab === 'kpis' && activeKpiSubTab === 'calls' ? 'active' : ''}`} 
                          onClick={() => { setActiveTab('kpis'); setActiveKpiSubTab('calls'); }}
                        >
                          <Phone size={18} />
                          <span>Dialpad Call Logs</span>
                        </div>
                      </li>
                      <li>
                        <div 
                          className={`nav-item ${activeTab === 'kpis' && activeKpiSubTab === 'qandle' ? 'active' : ''}`} 
                          onClick={() => { setActiveTab('kpis'); setActiveKpiSubTab('qandle'); }}
                        >
                          <Clock size={18} />
                          <span>Qandle Attendance</span>
                        </div>
                      </li>
                      <li>
                        <div 
                          className={`nav-item ${activeTab === 'kpis' && activeKpiSubTab === 'crm_activities' ? 'active' : ''}`} 
                          onClick={() => { setActiveTab('kpis'); setActiveKpiSubTab('crm_activities'); }}
                        >
                          <Briefcase size={18} />
                          <span>CRM Activities</span>
                        </div>
                      </li>
                      <li>
                        <div 
                          className={`nav-item ${activeTab === 'kpis' && activeKpiSubTab === 'mapping' ? 'active' : ''}`} 
                          onClick={() => { setActiveTab('kpis'); setActiveKpiSubTab('mapping'); }}
                        >
                          <Link2 size={18} />
                          <span>Recruiter & Dialpad Mapping</span>
                        </div>
                      </li>
                      <li>
                        <div 
                          className={`nav-item ${activeTab === 'kpis' && activeKpiSubTab === 'settings' ? 'active' : ''}`} 
                          onClick={() => { setActiveTab('kpis'); setActiveKpiSubTab('settings'); }}
                        >
                          <Settings size={18} />
                          <span>KPI Target Settings</span>
                        </div>
                      </li>
                      <li>
                        <div 
                          className={`nav-item ${activeTab === 'kpis' && activeKpiSubTab === 'webhook_logs' ? 'active' : ''}`} 
                          onClick={() => { setActiveTab('kpis'); setActiveKpiSubTab('webhook_logs'); }}
                        >
                          <Radio size={18} />
                          <span>Webhook Logs</span>
                        </div>
                      </li>
                      {currentUser.permissions.role === 'admin' && (
                        <li>
                          <div 
                            className={`nav-item ${activeTab === 'kpis' && activeKpiSubTab === 'import_data' ? 'active' : ''}`} 
                            onClick={() => { setActiveTab('kpis'); setActiveKpiSubTab('import_data'); }}
                          >
                            <FileSpreadsheet size={18} />
                            <span>Import Data</span>
                          </div>
                        </li>
                      )}
                    </div>
                  )}
 
                  {/* Category: Administration */}
                  {(currentUser.permissions.role === 'admin' || hasViewPermission(currentUser, 'logs')) && (
                    <>
                      <div 
                        onClick={() => toggleSection('admin')} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px 6px 12px',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginTop: '8px',
                          userSelect: 'none'
                        }}
                      >
                        <span>⚙️ Administration</span>
                        {expandedSections.admin ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </div>
 
                      {expandedSections.admin && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px' }}>
                          {currentUser.permissions.role === 'admin' && (
                            <li>
                              <div className={`nav-item ${activeTab === 'rbac' ? 'active' : ''}`} onClick={() => setActiveTab('rbac')}>
                                <Key size={18} />
                                <span>User Access & Roles</span>
                              </div>
                            </li>
                          )}
                          {hasViewPermission(currentUser, 'logs') && (
                            <li>
                              <div className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
                                <History size={18} />
                                <span>Audit Trail Logs</span>
                              </div>
                            </li>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </ul>
          </nav>
        </div>

        {/* Connection status and Profile */}
        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Cloud Sync State */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '11px', 
            color: '#94a3b8',
            padding: '8px 12px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: isCloudConnected ? 'var(--success)' : 'var(--warning)',
              boxShadow: isCloudConnected ? '0 0 6px var(--success)' : '0 0 6px var(--warning)'
            }} />
            <span style={{ fontWeight: 500, letterSpacing: '0.2px' }}>
              {isCloudConnected ? 'Cloud Sync Enabled' : 'Demo Mode (LocalStorage)'}
            </span>
          </div>

          <div className="user-profile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="avatar">
                {currentUser.fullName ? currentUser.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'SU'}
              </div>
              <div>
                <div className="username" style={{ fontSize: '13px', fontWeight: 600 }}>{currentUser.fullName}</div>
                <div className="user-role" style={{ textTransform: 'capitalize', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {currentUser.permissions?.role || 'User'}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setCurrentUser(null);
                localStorage.removeItem('bm-logged-in-user-id');
                handleShowToast("Signed out successfully.", "info");
              }}
              style={{
                background: 'none',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--danger)',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                transition: 'all 0.2s',
                textTransform: 'uppercase'
              }}
              title="Sign Out of Suite"
            >
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Main Canvas */}
      <main className={`main-canvas ${isSidebarMinimized ? 'sidebar-minimized' : ''}`}>
        
        {/* Top Header */}
        <header className="top-header">
          <div className="page-title">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Briefcase size={24} style={{ color: 'var(--primary)' }} />
              {activeTab === 'whats_important' ? "What's Important Dashboard" :
               activeTab === 'dashboard' ? 'Group Dashboard' : 
               activeTab === 'directory' ? 'Entity Management Directory' : 
               activeTab === 'staff' ? 'Staff & Personnel Directory' : 
               activeTab === 'leaves' ? 'Leaves & Holidays Dashboard' : 
               activeTab === 'commissions' ? 'Incentive Commission Plans' : 
               activeTab === 'payroll' ? 'Group Payroll & Projections' : 
               activeTab === 'expenses' ? 'Expenses & Bank Statement Categorizer' :
               activeTab === 'logs' ? 'System Audit Trail Logs' :
               activeTab === 'reports' ? 'Profit & Loss / Group Reports' :
               activeTab === 'rbac' ? 'User Access & Roles Control' :
               activeTab === 'placements' ? 'Sales & Placements Dashboard' :
               activeTab === 'crm' ? 'CRM Recruiting Desk' :
               activeTab === 'kpis' ? 'KPI Monitoring Dashboard' :
               activeTab === 'credit_control' ? 'Credit Control & Invoices Ledger' :
               activeTab === 'cashflow' ? 'Cashflow Projections & Ledger' : 'Vendors & Asset Management'}
            </h1>
          </div>
          
          <div className="header-actions">
            {/* Quick Search Trigger Button */}
            <button
              type="button"
              onClick={() => setIsQuickSearchOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                marginRight: '8px',
                transition: 'all 0.15s ease'
              }}
              title="Quick Search Records (Cmd + K)"
            >
              <Search size={14} style={{ color: 'var(--primary)' }} />
              <span>Search...</span>
              <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: 'var(--bg-card)', padding: '2px 5px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                ⌘K
              </span>
            </button>

            {/* Unmapped Expenses Top Header Shortcut */}
            {(() => {
              const unmappedHeaderCount = (expenses || []).filter(e => (!e.recipientType || e.recipientType === 'other' || !e.nominalCode) && e.status !== 'dns' && e.status !== 'cancelled').length;
              if (unmappedHeaderCount === 0) return null;
              return (
                <button
                  type="button"
                  onClick={() => setActiveTab('expenses')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '8px',
                    color: 'var(--warning)',
                    cursor: 'pointer',
                    marginRight: '12px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Click to categorize unmapped expense transactions"
                >
                  ⚠️ Unmapped ({unmappedHeaderCount})
                </button>
              );
            })()}

            {/* Live GMT/SAST/IST Office Clocks Widget */}
            <div style={{ display: 'flex', gap: '8px', marginRight: '16px', alignItems: 'center' }}>
              {formatTimeForZone(currentTime, 'Europe/London', 'UK (London)')}
              {formatTimeForZone(currentTime, 'Africa/Johannesburg', 'S. Africa')}
              {formatTimeForZone(currentTime, 'Asia/Kolkata', 'India (IST)')}
            </div>
            {/* Active User Switcher Dropdown (Admin Impersonation Feature) */}
            {currentUser.permissions?.role === 'admin' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Active Impersonation:</span>
                <select
                  className="select-filter"
                  value={currentUser.id}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'super-admin') {
                      setCurrentUser(DEFAULT_ADMIN_USER);
                      localStorage.setItem('bm-logged-in-user-id', 'super-admin');
                      setActiveTab('dashboard');
                      setScopingViewMode('team');
                    } else {
                      const selectedMember = staff.find(st => st.id === val);
                      if (selectedMember) {
                        const isNaga = selectedMember.businessEmail?.toLowerCase() === 'naga@humres.co.uk' || selectedMember.businessEmail?.toLowerCase() === 'naga.admin@humres.co.uk';
                        const role = isNaga ? 'admin' : (selectedMember.department === 'Finance' || selectedMember.jobTitle?.toLowerCase().includes('manager') ? 'manager' : 'recruiter');
                        const updatedPermissions = selectedMember.permissions || {
                          role,
                          dataScope: role === 'admin' ? 'all' : (role === 'manager' ? 'department' : 'self'),
                          allowedModules: getDefaultAllowedModules(role)
                        };
                        setCurrentUser({
                          ...selectedMember,
                          permissions: updatedPermissions
                        });
                        localStorage.setItem('bm-logged-in-user-id', selectedMember.id);
                        setActiveTab('dashboard');
                        setScopingViewMode('team');
                      }
                    }
                  }}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '12px', 
                    minWidth: '180px', 
                    backgroundColor: 'var(--bg-secondary)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-md)', 
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  <option value="super-admin">Super Admin (All Access)</option>
                  {staff.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.permissions?.role || 'Recruiter'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentUser && ['admin', 'director', 'manager'].includes(currentUser.permissions?.role) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>View Mode:</span>
                <div style={{ 
                  display: 'flex', 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '2px',
                  alignItems: 'center' 
                }}>
                  <button
                    type="button"
                    onClick={() => setScopingViewMode('team')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: scopingViewMode === 'team' ? 'var(--primary)' : 'transparent',
                      color: scopingViewMode === 'team' ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Team View
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopingViewMode('self')}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: scopingViewMode === 'self' ? 'var(--primary)' : 'transparent',
                      color: scopingViewMode === 'self' ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    My Profile
                  </button>
                </div>
              </div>
            )}

            <button 
              className="btn-theme-toggle" 
              onClick={toggleTheme} 
              title={theme === 'dark' ? 'Toggle Light Theme' : 'Toggle Dark Theme'}
              aria-label="Theme toggle"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

             {activeTab === 'staff' ? (
               <div style={{ display: 'flex', gap: '8px' }}>
                 {hasWritePermission(currentUser, 'staff') && (
                   <button 
                     className="btn-danger" 
                     onClick={handleClearAllStaff}
                     style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px' }}
                   >
                     <Trash2 size={14} /> Clear Directory
                   </button>
                 )}
                 {(currentUser.permissions?.role === 'admin' || currentUser.permissions?.role === 'manager') && (
                   <button 
                     className="btn-secondary" 
                     onClick={() => setIsAiRemindersOpen(true)}
                     style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.3)' }}
                   >
                     <Sparkles size={14} style={{ color: '#fbbf24' }} /> AI Reminders
                   </button>
                 )}
                 {hasWritePermission(currentUser, 'staff') && (
                   <button 
                     className="btn-secondary" 
                     onClick={() => setIsBulkImportOpen(true)}
                     style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px' }}
                   >
                     <Upload size={14} /> Bulk Import (Excel/CSV)
                   </button>
                 )}
                 {hasWritePermission(currentUser, 'staff') && (
                   <button className="btn-primary" onClick={handleOpenStaffCreate}>
                     <Plus size={16} /> Onboard Staff
                   </button>
                 )}
               </div>
             ) : activeTab === 'directory' || activeTab === 'dashboard' ? (
               <div style={{ display: 'flex', gap: '8px' }}>
                 {activeTab === 'directory' && (
                   <button 
                     type="button" 
                     className="btn-secondary" 
                     onClick={() => setIsDirectoryHelpOpen(true)}
                     style={{
                       display: 'flex',
                       alignItems: 'center',
                       gap: '6px',
                       padding: '8px 16px',
                       fontSize: '12px',
                       fontWeight: 600,
                       borderRadius: '8px',
                       cursor: 'pointer'
                     }}
                   >
                     <HelpCircle size={14} style={{ color: 'var(--primary)' }} />
                     <span>Help</span>
                   </button>
                 )}
                 {hasWritePermission(currentUser, 'directory') && (
                   <button className="btn-primary" onClick={handleOpenCreate}>
                     <Plus size={16} /> Register Entity
                   </button>
                 )}
               </div>
             ) : null}
          </div>
        </header>

        {/* Content canvas */}
        <div className="content-wrapper">
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              ⏳ Loading Dashboard View...
            </div>
          }>
          
          {/* TAB 0: What's Important */}
          {activeTab === 'whats_important' && (
            <WhatsImportantDashboard 
              companies={scopedCompanies} 
              staff={scopedStaff}
              leaveRequests={scopedLeaves}
              holidays={holidays}
              contracts={contracts}
              vendors={vendors}
              placements={placements}
              expenses={scopedExpenses}
              setActiveTab={setActiveTab}
              setSelectedCompany={setSelectedCompany}
              setSelectedStaff={setSelectedStaff}
            />
          )}

          {/* TAB 1: Dashboard */}
          {activeTab === 'dashboard' && (
            <Dashboard 
              companies={scopedCompanies} 
              onSelectCompany={handleSelectCompany} 
              staff={scopedStaff}
              leaveRequests={scopedLeaves}
              holidays={holidays}
              contracts={contracts}
              vendors={vendors}
              placements={scopedPlacements}
              expenses={scopedExpenses}
            />
          )}

          {/* TAB 2: Company Directory */}
          {activeTab === 'directory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Directory Filter controls */}
              <div className="controls-row">
                <div className="search-filter-group">
                  <div className="search-input-wrapper">
                    <Search size={16} className="search-icon" />
                    <input 
                      type="text" 
                      placeholder="Search company, registration, POC..." 
                      className="search-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <select 
                    className="select-filter"
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                  >
                    <option value="All">All Countries</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United States">United States</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                    <option value="India">India</option>
                  </select>

                  <select 
                    className="select-filter"
                    value={complianceFilter}
                    onChange={(e) => setComplianceFilter(e.target.value)}
                  >
                    <option value="All">All Compliance States</option>
                    <option value="Compliant">Compliant</option>
                    <option value="Warning">Warning / Incomplete</option>
                    <option value="Critical">Critical Risk</option>
                  </select>
                </div>

                <div className="view-toggle-group">
                  <button 
                    className={`btn-view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    <Grid size={16} />
                  </button>
                  <button 
                    className={`btn-view-toggle ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List View"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>

              {/* Company list visual rendering */}
              {filteredCompanies.length === 0 ? (
                <div className="empty-state">
                  <Building2 size={64} className="empty-state-icon" />
                  <h2>No Group Entities Found</h2>
                  <p>Try refining your search queries or register a new company.</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="entities-grid">
                  {sortedCompanies.map(c => {
                    const compCompliance = checkCompanyCompliance(c);
                    return (
                      <div 
                        key={c.id} 
                        className="entity-card" 
                        onClick={() => handleSelectCompany(c)}
                      >
                        <div className="entity-card-header">
                          <div className="entity-title-group">
                            <span className="entity-name">{c.name}</span>
                            <span className="entity-legal-name">{c.legalName}</span>
                          </div>
                          <span className={`country-badge country-${c.country.toLowerCase().replace(/[^a-z]/g, '')}`}>
                            {c.country}
                          </span>
                        </div>

                        <div className="entity-meta-list">
                          <div className="entity-meta-item">
                            <span className="meta-label">Reg Number:</span>
                            <span style={{ fontWeight: 500 }}>{c.registrationNumber}</span>
                          </div>
                          <div className="entity-meta-item">
                            <span className="meta-label">Tax / VAT ID:</span>
                            <span>{c.vatNumber || <em style={{ color: 'var(--text-muted)' }}>Missing</em>}</span>
                          </div>
                          <div className="entity-meta-item">
                            <span className="meta-label">Business Units:</span>
                            <span>{c.departments ? c.departments.length : 0} Departments</span>
                          </div>
                        </div>

                        <div className="entity-card-footer">
                          <div className="compliance-status">
                            <div className={`status-indicator ${compCompliance.status}`} />
                            <span style={{ fontSize: '11px', color: `var(--text-secondary)` }}>{compCompliance.text}</span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn-icon" 
                              title="Edit details" 
                              onClick={(e) => handleOpenEdit(e, c)}
                            >
                              <Edit3 size={12} />
                            </button>
                            <button 
                              className="btn-icon delete" 
                              title="Delete Entity" 
                              onClick={(e) => handleDeleteCompany(e, c.id, c.name)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="table-container">
                  <table className="entity-table dense">
                    <thead>
                      <tr>
                        <th onClick={() => handleCompanyHeaderClick('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Company Name {renderCompanySortIndicator('name')}
                        </th>
                        <th onClick={() => handleCompanyHeaderClick('legalName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Legal Incorporation Name {renderCompanySortIndicator('legalName')}
                        </th>
                        <th onClick={() => handleCompanyHeaderClick('country')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Country {renderCompanySortIndicator('country')}
                        </th>
                        <th onClick={() => handleCompanyHeaderClick('registrationNumber')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Registration # {renderCompanySortIndicator('registrationNumber')}
                        </th>
                        <th>Tax / VAT ID</th>
                        <th>Departments</th>
                        <th>Compliance Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCompanies.map(c => {
                        const compCompliance = checkCompanyCompliance(c);
                        return (
                          <tr key={c.id} onClick={() => handleSelectCompany(c)}>
                            <td className="entity-table-name">{c.name}</td>
                            <td>{c.legalName}</td>
                            <td>
                              <span className={`country-badge country-${c.country.toLowerCase().replace(/[^a-z]/g, '')}`} style={{ padding: '4px 8px' }}>
                                {c.country}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace' }}>{c.registrationNumber}</td>
                            <td>{c.vatNumber || <em style={{ color: 'var(--text-muted)' }}>Missing</em>}</td>
                            <td>{c.departments ? c.departments.map(d => d.name || d).join(', ') : <em style={{ color: 'var(--text-muted)' }}>None</em>}</td>
                            <td>
                              <div className="compliance-status">
                                <div className={`status-indicator ${compCompliance.status}`} />
                                <span>{compCompliance.text}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button 
                                  className="btn-icon" 
                                  title="Edit details" 
                                  onClick={(e) => handleOpenEdit(e, c)}
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button 
                                  className="btn-icon delete" 
                                  title="Delete Entity" 
                                  onClick={(e) => handleDeleteCompany(e, c.id, c.name)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: Staff & Consultants Directory */}
          {activeTab === 'staff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Staff metrics overview cards */}
              <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                
                <div className="metric-card" style={{ '--card-accent': 'var(--primary)', '--card-accent-light': 'var(--primary-light)' }}>
                  <div className="metric-info">
                    <h3>Group Headcount</h3>
                    <div className="metric-value">{totalStaffCount}</div>
                    <div className="metric-trend trend-neutral">
                      Total staff rostered
                    </div>
                  </div>
                  <div className="metric-icon-wrapper">
                    <Users size={20} />
                  </div>
                </div>

                <div className="metric-card" style={{ '--card-accent': 'var(--accent)', '--card-accent-light': 'rgba(14, 165, 233, 0.15)' }}>
                  <div className="metric-info">
                    <h3>Consultants</h3>
                    <div className="metric-value">{consultantsCount}</div>
                    <div className="metric-trend trend-neutral">
                      Recruiters / Sourcing specialists
                    </div>
                  </div>
                  <div className="metric-icon-wrapper">
                    <Briefcase size={20} />
                  </div>
                </div>

                <div className="metric-card" style={{ '--card-accent': 'var(--success)', '--card-accent-light': 'var(--success-light)' }}>
                  <div className="metric-info">
                    <h3>Annual Base Payroll</h3>
                    <div className="metric-value" style={{ fontSize: '18px', marginTop: '12px', fontWeight: 700 }}>
                      {getPayrollSummaryStr()}
                    </div>
                    <div className="metric-trend trend-neutral" style={{ marginTop: '12px' }}>
                      Payroll cost grouped by currency
                    </div>
                  </div>
                  <div className="metric-icon-wrapper">
                    <Wallet size={20} />
                  </div>
                </div>

                <div className="metric-card" style={{ '--card-accent': 'var(--danger)', '--card-accent-light': 'var(--danger-light)' }}>
                  <div className="metric-info">
                    <h3>Missing Contracts</h3>
                    <div className="metric-value">{missingContractsCount}</div>
                    <div className="metric-trend" style={{ color: missingContractsCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      No Appointment Orders attached
                    </div>
                  </div>
                  <div className="metric-icon-wrapper">
                    <AlertTriangle size={20} />
                  </div>
                </div>

              </div>

              {/* Staff filter row controls */}
              <div className="controls-row">
                <div className="search-filter-group">
                  <div className="search-input-wrapper">
                    <Search size={16} className="search-icon" />
                    <input 
                      type="text" 
                      placeholder="Search name, job title, email..." 
                      className="search-input"
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                    />
                  </div>

                  <select 
                    className="select-filter"
                    value={staffCompanyFilter}
                    onChange={(e) => setStaffCompanyFilter(e.target.value)}
                  >
                    <option value="All">All Companies</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select 
                    className="select-filter"
                    value={staffDeptFilter}
                    onChange={(e) => setStaffDeptFilter(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {allAvailableDepts.map((d, index) => (
                      <option key={index} value={d}>{d}</option>
                    ))}
                  </select>

                  <select 
                    className="select-filter"
                    value={staffStatusFilter}
                    onChange={(e) => setStaffStatusFilter(e.target.value)}
                    style={{ minWidth: '130px' }}
                  >
                    <option value="active">Active Status</option>
                    <option value="exited">Exited Status</option>
                    <option value="all">All Statuses</option>
                  </select>
                </div>

                <div className="view-toggle-group">
                  <button 
                    className={`btn-view-toggle ${staffViewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setStaffViewMode('grid')}
                    title="Grid View"
                  >
                    <Grid size={16} />
                  </button>
                  <button 
                    className={`btn-view-toggle ${staffViewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list') /* fallback to directory viewMode or keep locally */ || setStaffViewMode('list')}
                    title="List View"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>

              {/* Bulk actions policy assignment toolbar */}
              {selectedStaffIds.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  marginBottom: '16px',
                  animation: 'fadeIn var(--transition-fast)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(99,102,241,0.15)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                        👥 Bulk Manage Selected: {selectedStaffIds.length} {selectedStaffIds.length === 1 ? 'profile' : 'profiles'}
                      </span>
                      <button 
                        type="button"
                        className="btn-secondary" 
                        onClick={() => setSelectedStaffIds([])}
                        style={{ padding: '4px 8px', fontSize: '11px', height: '24px' }}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    
                    {/* Action 1: Department */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Dept:</span>
                      <select 
                        className="select-filter"
                        value={bulkDeptSelect}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBulkDeptSelect(val);
                          if (val === 'NEW_DEPT') {
                            const custom = window.prompt("Enter new department name:");
                            if (custom && custom.trim() !== '') {
                              setCustomBulkDept(custom.trim());
                              setBulkDeptSelect('NEW_DEPT');
                            } else {
                              setBulkDeptSelect('');
                            }
                          }
                        }}
                        style={{ padding: '4px 8px', fontSize: '11px', minWidth: '130px', height: '28px' }}
                      >
                        <option value="">-- Choose Dept --</option>
                        {allAvailableDepts.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                        <option value="NEW_DEPT">+ Add Custom...</option>
                      </select>
                      {bulkDeptSelect === 'NEW_DEPT' && customBulkDept && (
                        <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>"{customBulkDept}"</span>
                      )}
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!bulkDeptSelect || (bulkDeptSelect === 'NEW_DEPT' && !customBulkDept)}
                        onClick={handleBulkAssignDepartment}
                        style={{ padding: '4px 10px', fontSize: '11px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        Apply
                      </button>
                    </div>

                    {/* Action 2: Payroll Template */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Payroll:</span>
                      <select 
                        className="select-filter"
                        value={bulkPayrollSelect}
                        onChange={(e) => setBulkPayrollSelect(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '11px', minWidth: '135px', height: '28px' }}
                      >
                        <option value="">-- Choose Template --</option>
                        <option value="CLEAR_POLICY">-- No Policy (Salaried) --</option>
                        {payrollPolicies.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!bulkPayrollSelect}
                        onClick={handleBulkAssignPayrollPolicy}
                        style={{ padding: '4px 10px', fontSize: '11px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        Apply
                      </button>
                    </div>

                    {/* Action 3: Commission Scheme */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Commission:</span>
                      <select 
                        className="select-filter"
                        value={bulkCommissionSelect}
                        onChange={(e) => setBulkCommissionSelect(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '11px', minWidth: '135px', height: '28px' }}
                      >
                        <option value="">-- Choose Scheme --</option>
                        <option value="CLEAR_POLICY">-- No Scheme --</option>
                        {commissionPolicies.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!bulkCommissionSelect}
                        onClick={handleBulkAssignCommissionPolicy}
                        style={{ padding: '4px 10px', fontSize: '11px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        Apply
                      </button>
                    </div>

                    {/* Action 4: Leave Policy */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Leave:</span>
                      <select 
                        className="select-filter"
                        value={bulkLeaveSelect}
                        onChange={(e) => setBulkLeaveSelect(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '11px', minWidth: '135px', height: '28px' }}
                      >
                        <option value="">-- Choose Policy --</option>
                        <option value="CLEAR_POLICY">-- No Policy --</option>
                        {leavePolicies.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!bulkLeaveSelect}
                        onClick={handleBulkAssignLeavePolicy}
                        style={{ padding: '4px 10px', fontSize: '11px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        Apply
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* Staff list cards visual rendering */}
              {filteredStaff.length === 0 ? (
                <div className="empty-state">
                  <Users size={64} className="empty-state-icon" />
                  <h2>No Staff Profiles Found</h2>
                  <p>Try resetting filters or onboard a new employee.</p>
                </div>
              ) : staffViewMode === 'grid' ? (
                <div className="entities-grid">
                  {sortedStaff.map(s => {
                    const employer = companies.find(c => c.id === s.companyId);
                    const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };
                    const compSymbol = symbolMap[s.currency] || '';
                    
                    const hasAppointmentDoc = s.documents && s.documents.some(d => d.type === 'appointment');

                    return (
                      <div 
                        key={s.id} 
                        className="entity-card" 
                        onClick={() => handleSelectStaff(s)}
                        style={{ minHeight: '260px', height: 'auto' }}
                      >
                        <div className="entity-card-header">
                          <div className="entity-title-group" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div 
                              onClick={(e) => e.stopPropagation()} 
                              style={{ display: 'flex', alignItems: 'center' }}
                            >
                              <input 
                                type="checkbox" 
                                checked={selectedStaffIds.includes(s.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStaffIds(prev => [...prev, s.id]);
                                  } else {
                                    setSelectedStaffIds(prev => prev.filter(id => id !== s.id));
                                  }
                                }}
                                style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="entity-name">{s.fullName}</span>
                                {s.status === 'exited' && (
                                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                    Exited
                                  </span>
                                )}
                              </div>
                              <span className="entity-legal-name">{s.jobTitle}</span>
                            </div>
                          </div>
                          <span className={`country-badge country-${employer ? employer.country.toLowerCase().replace(/[^a-z]/g, '') : 'uk'}`}>
                            {s.department}
                          </span>
                        </div>

                        <div className="entity-meta-list">
                          <div className="entity-meta-item">
                            <span className="meta-label">Company:</span>
                            <span style={{ fontWeight: 500 }}>{employer ? employer.name : 'Unknown'}</span>
                          </div>
                          <div className="entity-meta-item">
                            <span className="meta-label">Annual Pay:</span>
                            <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                              {s.currency === 'GBP' ? (
                                `£${Number(s.salary).toLocaleString()}`
                              ) : (
                                `£${Math.round(toGBP(s.salary, s.currency)).toLocaleString()} (${compSymbol}${Number(s.salary).toLocaleString()} ${s.currency})`
                              )}
                            </span>
                          </div>
                          <div className="entity-meta-item">
                            <span className="meta-label">Work Email:</span>
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{s.businessEmail}</span>
                          </div>
                          {s.status === 'exited' && (
                            <div className="entity-meta-item">
                              <span className="meta-label" style={{ color: 'var(--danger)' }}>Exit Date:</span>
                              <span style={{ fontWeight: 600, color: 'var(--danger)' }}>
                                {s.exitDate} {s.noticePeriod ? `(${s.noticePeriod})` : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="entity-card-footer">
                          <div className="compliance-status">
                            <div className={`status-indicator ${hasAppointmentDoc ? 'good' : 'danger'}`} />
                            <span style={{ fontSize: '11px' }}>
                              {hasAppointmentDoc ? 'Contract Active' : 'Contract Document Missing'}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn-icon" 
                              title="Edit profile" 
                              onClick={(e) => handleOpenStaffEdit(e, s)}
                            >
                              <Edit3 size={12} />
                            </button>
                            <button 
                              className="btn-icon" 
                              title="Exit Formalities & IT Clearance" 
                              onClick={(e) => handleExitFormalities(e, s)}
                              style={{ color: s.status === 'exited' ? 'var(--danger)' : 'var(--text-secondary)' }}
                            >
                              <LogOut size={12} />
                            </button>
                            <button 
                              className="btn-icon delete" 
                              title="Delete Profile" 
                              onClick={(e) => handleDeleteStaff(e, s.id, s.fullName)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="table-container">
                  <table className="entity-table dense">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', paddingLeft: '12px' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedStaffIds.length === sortedStaff.length && sortedStaff.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStaffIds(sortedStaff.map(s => s.id));
                              } else {
                                setSelectedStaffIds([]);
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                        <th onClick={() => handleStaffHeaderClick('fullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Staff Full Name {renderStaffSortIndicator('fullName')}
                        </th>
                        <th onClick={() => handleStaffHeaderClick('jobTitle')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Job Title / Designation {renderStaffSortIndicator('jobTitle')}
                        </th>
                        <th>Employer Company</th>
                        <th onClick={() => handleStaffHeaderClick('department')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Department {renderStaffSortIndicator('department')}
                        </th>
                        <th onClick={() => handleStaffHeaderClick('salary')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Salary Package {renderStaffSortIndicator('salary')}
                        </th>
                        <th>Business Email</th>
                        <th>Business Phone</th>
                        <th>Contract Doc</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStaff.map(s => {
                        const employer = companies.find(c => c.id === s.companyId);
                        const symbolMap = { GBP: '£', USD: '$', AED: 'AED ', INR: '₹', ZAR: 'R' };
                        const compSymbol = symbolMap[s.currency] || '';
                        const hasAppointmentDoc = s.documents && s.documents.some(d => d.type === 'appointment');
                        
                        return (
                          <tr key={s.id} onClick={() => handleSelectStaff(s)}>
                            <td onClick={(e) => e.stopPropagation()} style={{ paddingLeft: '12px' }}>
                              <input 
                                type="checkbox" 
                                checked={selectedStaffIds.includes(s.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStaffIds(prev => [...prev, s.id]);
                                  } else {
                                    setSelectedStaffIds(prev => prev.filter(id => id !== s.id));
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td className="entity-table-name" style={{ fontWeight: 600 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {s.fullName}
                                {s.status === 'exited' && (
                                  <span style={{ fontSize: '8px', fontWeight: 700, color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                                    Exited
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>{s.jobTitle}</td>
                            <td>{employer ? employer.name : 'Unknown'}</td>
                            <td>{s.department}</td>
                            <td style={{ fontWeight: 600, color: 'var(--success)' }}>
                              {s.currency === 'GBP' ? (
                                `£${Number(s.salary).toLocaleString()}`
                              ) : (
                                `£${Math.round(toGBP(s.salary, s.currency)).toLocaleString()} (${compSymbol}${Number(s.salary).toLocaleString()} ${s.currency})`
                              )}
                            </td>
                            <td>{s.businessEmail}</td>
                            <td>{s.businessPhone}</td>
                            <td>
                              <div className="compliance-status">
                                <div className={`status-indicator ${hasAppointmentDoc ? 'good' : 'danger'}`} />
                                <span>{hasAppointmentDoc ? 'Attached' : 'Missing'}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button 
                                  className="btn-icon" 
                                  title="Edit details" 
                                  onClick={(e) => handleOpenStaffEdit(e, s)}
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button 
                                  className="btn-icon" 
                                  title="Exit Formalities & IT Clearance" 
                                  onClick={(e) => handleExitFormalities(e, s)}
                                  style={{ color: s.status === 'exited' ? 'var(--danger)' : 'var(--text-secondary)' }}
                                >
                                  <LogOut size={12} />
                                </button>
                                <button 
                                  className="btn-icon delete" 
                                  title="Delete Profile" 
                                  onClick={(e) => handleDeleteStaff(e, s.id, s.fullName)}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: Leaves & Holidays Dashboard */}
          {activeTab === 'leaves' && (
            <LeavesDashboard 
              companies={companies}
              staff={scopedStaff}
              leavePolicies={leavePolicies}
              leaveRequests={scopedLeaves}
              holidays={holidays}
              onSavePolicy={handleSaveLeavePolicy}
              onDeletePolicy={handleDeleteLeavePolicy}
              onSaveHoliday={handleSaveHoliday}
              onDeleteHoliday={handleDeleteHoliday}
              onSaveLeaveRequest={handleSaveLeaveRequest}
              onUpdateLeaveRequestStatus={handleUpdateLeaveRequestStatus}
              onUpdateStaff={handleSaveStaff}
              onShowToast={handleShowToast}
              currentUser={currentUser}
            />
          )}

          {/* TAB 5: Commissions Dashboard */}
          {activeTab === 'commissions' && (
            <CommissionsDashboard 
              companies={companies}
              staff={scopedStaff}
              commissionPolicies={commissionPolicies}
              placements={scopedPlacements}
              onSavePolicy={handleSaveCommissionPolicy}
              onDeletePolicy={handleDeleteCommissionPolicy}
              onUpdateStaff={handleSaveStaff}
              onSavePlacement={handleSavePlacement}
              onShowToast={handleShowToast}
              currentUser={currentUser}
            />
          )}

          {/* TAB 5.5: Payroll Dashboard */}
          {activeTab === 'payroll' && (
            <PayrollDashboard 
              companies={companies}
              staff={scopedStaff}
              commissionPolicies={commissionPolicies}
              placements={scopedPlacements}
              payrollRecords={payrollRecords}
              payrollPolicies={payrollPolicies}
              leaveRequests={scopedLeaves}
              leavePolicies={leavePolicies}
              holidays={holidays}
              expenses={expenses}
              nominalCodes={nominalCodes}
              onSavePayrollRecord={handleSavePayrollRecord}
              onSavePayrollPolicy={firebaseService.savePayrollPolicy}
              onDeletePayrollPolicy={firebaseService.deletePayrollPolicy}
              onUpdateStaff={handleSaveStaff}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={handleDeleteExpense}
              onShowToast={handleShowToast}
              currentUser={currentUser}
            />
          )}

          {/* TAB 6: Vendors & Assets Dashboard */}
          {activeTab === 'vendors' && (
            <VendorsDashboard 
              companies={scopedCompanies}
              staff={scopedStaff}
              vendors={vendors}
              contracts={contracts}
              assetAssignments={assetAssignments}
              expenses={scopedExpenses}
              nominalCodes={nominalCodes}
              onSaveExpense={handleSaveExpense}
              onSaveVendor={handleSaveVendor}
              onDeleteVendor={handleDeleteVendor}
              onSaveContract={handleSaveContract}
              onDeleteContract={handleDeleteContract}
              onSaveAssetAssignment={handleSaveAssetAssignment}
              onDeleteAssetAssignment={handleDeleteAssetAssignment}
              onShowToast={handleShowToast}
              currentUser={currentUser}
            />
          )}

          {/* TAB 7: Sales & Placements Dashboard */}
          {activeTab === 'placements' && (
            <PlacementsDashboard 
              companies={scopedCompanies}
              staff={scopedStaff}
              placements={scopedPlacements}
              onSavePlacement={handleSavePlacement}
              onDeletePlacement={handleDeletePlacement}
              onSavePlacementsBatch={handleSavePlacementsBatch}
              onClearAllPlacements={handleClearAllPlacements}
              onShowToast={handleShowToast}
              currentUser={currentUser}
            />
          )}

          {/* TAB 7.5: Credit Control Invoices */}
          {activeTab === 'credit_control' && (
            <CreditControlDashboard 
              placements={scopedPlacements}
              companies={scopedCompanies}
              staff={scopedStaff}
              currentUser={currentUser}
              onUpdatePlacement={handleSavePlacement}
              onShowToast={handleShowToast}
              defaultSubTab={creditControlSubTab}
              onChangeSubTab={setCreditControlSubTab}
            />
          )}

          {/* TAB 7.5.5: CRM Recruiting Desk */}
          {activeTab === 'crm' && (
            <CrmDashboard onShowToast={handleShowToast} />
          )}

          {/* TAB 7.6: Cashflow Forecast */}
          {activeTab === 'cashflow' && (
            <CashflowDashboard 
              placements={scopedPlacements}
              contracts={contracts}
              vendors={vendors}
              companies={companies}
              staff={scopedStaff}
              payrollPolicies={payrollPolicies}
              expenses={scopedExpenses}
              onUpdateCompany={handleSaveCompany}
            />
          )}

          {/* TAB 8: Expenses Ledger & Bank Categorizer */}
          {activeTab === 'expenses' && (
            <ExpensesDashboard 
              companies={scopedCompanies}
              staff={scopedStaff}
              placements={scopedPlacements}
              expenses={scopedExpenses}
              nominalCodes={nominalCodes}
              vendors={vendors}
              onSaveVendor={handleSaveVendor}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={handleDeleteExpense}
              onSaveNominalCode={handleSaveNominalCode}
              onDeleteNominalCode={handleDeleteNominalCode}
              onSavePlacement={handleSavePlacement}
              onSavePayrollRecord={handleSavePayrollRecord}
              payrollRecords={payrollRecords}
              onShowToast={handleShowToast}
              currentUser={currentUser}
            />
          )}

          {/* TAB 9: System Audit Trail Logs */}
          {activeTab === 'logs' && (
            <LogsDashboard 
              auditLogs={auditLogs}
              onClearLogs={handleClearAuditLogs}
              onShowToast={handleShowToast}
              sentEmails={sentEmails}
              reminderSettings={reminderSettings}
              onSaveReminderSettings={handleSaveReminderSettings}
              staff={staff}
            />
          )}

          {/* TAB 10: Profit & Loss / Group Reports */}
          {activeTab === 'reports' && (
            <ReportsDashboard 
              companies={companies}
              staff={staff}
              placements={placements}
              expenses={expenses}
              commissionPolicies={commissionPolicies}
              payrollRecords={currentUser?.permissions?.role === 'admin' 
                ? payrollRecords 
                : payrollRecords.filter(rec => staff.some(s => s.companyId === currentUser.companyId && s.id === rec.staffId))
              }
              payrollPolicies={payrollPolicies}
              leaveRequests={leaveRequests}
              leavePolicies={leavePolicies}
              holidays={holidays}
              nominalCodes={nominalCodes}
              vendors={vendors}
              contracts={contracts}
              assetAssignments={assetAssignments}
              onShowToast={handleShowToast}
              currentUser={currentUser}
            />
          )}

          {/* TAB 11: User Access & Roles Control Panel */}
          {activeTab === 'rbac' && currentUser.permissions.role === 'admin' && (
            <RBACDashboard 
              staff={staff}
              companies={companies}
              onUpdateStaff={handleSaveStaff}
              onShowToast={handleShowToast}
              letterTemplates={letterTemplates}
              onSaveLetterTemplate={handleSaveLetterTemplate}
              onDeleteLetterTemplate={handleDeleteLetterTemplate}
              onUpdateCompany={handleSaveCompany}
              exitSettings={exitSettings}
              onSaveExitSettings={handleSaveExitSettings}
            />
          )}

          {/* TAB 12: KPI Monitoring Dashboard */}
          {activeTab === 'kpis' && (
            <KpisDashboard 
              staff={scopedStaff}
              companies={scopedCompanies}
              currentUser={currentUser}
              onShowToast={handleShowToast}
              placements={scopedPlacements}
              activeSubTabProp={activeKpiSubTab}
              setActiveSubTabProp={setActiveKpiSubTab}
            />
          )}
          </Suspense>
        </div>

      </main>

      {/* Side Profile detail panel */}
      <CompanyDetail 
        company={selectedCompany}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onUpdateCompany={handleSaveCompany}
        onShowToast={handleShowToast}
        staff={staff}
        placements={placements}
        expenses={expenses}
      />

      {/* Register/Edit Multi-step Wizard */}
      <CompanyForm 
        company={editingCompany}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveCompany}
        onShowToast={handleShowToast}
      />

      {/* Staff Detail Side Profile */}
      <StaffDetail 
        staffMember={selectedStaff}
        companies={companies}
        isOpen={isStaffDetailOpen}
        onClose={() => setIsStaffDetailOpen(false)}
        onUpdateStaff={handleSaveStaff}
        onShowToast={handleShowToast}
        staffList={staff}
        onSelectStaff={handleSelectStaff}
        leavePolicies={leavePolicies}
        leaveRequests={leaveRequests}
        onSaveLeaveRequest={handleSaveLeaveRequest}
        commissionPolicies={commissionPolicies}
        contracts={contracts}
        assetAssignments={assetAssignments}
        onSaveAssetAssignment={handleSaveAssetAssignment}
        onDeleteAssetAssignment={handleDeleteAssetAssignment}
        placements={placements}
        letterTemplates={letterTemplates}
      />

      {/* Onboard / Edit Staff Wizard */}
      <StaffForm 
        staffMember={editingStaff}
        companies={companies}
        isOpen={isStaffFormOpen}
        onClose={() => setIsStaffFormOpen(false)}
        onSave={handleSaveStaff}
        onShowToast={handleShowToast}
        staffList={staff}
        leavePolicies={leavePolicies}
        commissionPolicies={commissionPolicies}
        payrollPolicies={payrollPolicies}
        initialStep={staffFormInitialStep}
      />

      {/* Bulk Staff Import Wizard */}
      <BulkStaffImportModal 
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImportComplete={handleBulkImportStaff}
        companies={companies}
        leavePolicies={leavePolicies}
        onShowToast={handleShowToast}
      />

      {/* Staff Exit Processing Modal */}
      <StaffExitModal 
        isOpen={isExitModalOpen}
        onClose={() => {
          setIsExitModalOpen(false);
          setExitModalStaff(null);
        }}
        staffMember={exitModalStaff}
        onSave={handleConfirmStaffExit}
        companies={companies}
      />

      {/* Exit Email Dispatch trigger modal */}
      <ExitEmailTriggerModal 
        isOpen={isExitEmailTriggerOpen}
        onClose={() => {
          setIsExitEmailTriggerOpen(false);
          setExitEmailTriggerStaff(null);
        }}
        staffMember={exitEmailTriggerStaff}
        exitSettings={exitSettings}
        companies={companies}
        staff={staff}
        assetAssignments={assetAssignments}
        commissionPolicies={commissionPolicies}
        placements={placements}
        contracts={contracts}
        holidays={holidays}
        onSend={handleSendExitEmail}
      />

      {/* AI Birthday & Anniversary Reminders Modal */}
      <AiRemindersModal 
        isOpen={isAiRemindersOpen}
        onClose={() => setIsAiRemindersOpen(false)}
        staff={staff}
        companies={companies}
        onShowToast={handleShowToast}
      />

      {/* Global Quick Search Modal (Cmd + K) */}
      <GlobalQuickSearchModal 
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        staff={staff}
        companies={companies}
        placements={placements}
        contracts={contracts}
        vendors={vendors}
        expenses={expenses}
        setActiveTab={setActiveTab}
        setSelectedCompany={setSelectedCompany}
        setSelectedStaff={setSelectedStaff}
      />

      {/* Directory Help Drawer */}
      <div className={`slide-over-overlay ${isDirectoryHelpOpen ? 'active' : ''}`} onClick={() => setIsDirectoryHelpOpen(false)}>
        <div className="slide-over-panel" onClick={(e) => e.stopPropagation()} style={{ width: '480px', maxWidth: '90vw' }}>
          
          {/* Panel Header */}
          <div className="panel-header" style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={20} style={{ color: 'var(--primary)' }} />
              <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Company Directory Help</h2>
            </div>
            <button className="btn-close" onClick={() => setIsDirectoryHelpOpen(false)} aria-label="Close Help" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>

          {/* Panel Body */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1, height: 'calc(100% - 70px)' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>Overview</h3>
              <p style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)', margin: 0 }}>
                The Company Directory manages all legal entities, subsidiaries, and joint ventures under the group structure. You can track incorporation details, regulatory compliance states, and active corporate insurance.
              </p>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>Core Management Actions</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>1. Registering an Entity</div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '8px', borderLeft: '2px solid var(--primary)' }}>
                  Click <strong>"Register Entity"</strong> at the top right of the directory. Complete the 5-step wizard covering Corporate Identity, Tax IDs, Point of Contact details, Insurance limits, and mock-uploading critical PDF documents (Incorporation Certificate, VAT cert, etc.).
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>2. Modifying Details</div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '8px', borderLeft: '2px solid var(--primary)' }}>
                  Click the <strong>Edit icon</strong> on any card or list row. The multi-step wizard will open containing current database details, allowing you to update specific fields or add documents.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>3. Removing/Deleting Entities</div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '8px', borderLeft: '2px solid var(--primary)' }}>
                  Click the <strong>Delete icon (trash)</strong> on any card or list row. You will be prompted to confirm deletion. Only master admins or directory write-privileged users can delete entities.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>4. AI Chatbot Integration</div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '8px', borderLeft: '2px solid var(--primary)' }}>
                  Open the floating AI Chatbot on the bottom right of the screen. You can say: <em>"Register a company named Acme Services in the UK, registration 123456"</em>. The AI chatbot will present a dedicated card with a <strong>"Register Entity"</strong> button to let you directly add the company to the database with a single click.
                </p>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>Compliance Reminders</h3>
              <p style={{ fontSize: '12px', lineHeight: '1.4', color: 'var(--text-secondary)', margin: 0 }}>
                Statutory filing compliance (VAT quarterly runs, annual returns) is tracked per entity. Incomplete records, expired insurance, or overdue VAT tasks will trigger warning/critical indicators on the card profiles automatically.
              </p>
            </div>
            
          </div>
        </div>
      </div>

      {/* Super Admin AI Chatbot Widget */}
      {(currentUser?.id === 'super-admin' || currentUser?.permissions?.role === 'admin') && (
        <AiChatbot assetAssignments={assetAssignments} onShowToast={handleShowToast} />
      )}

      {/* Micro-interaction Toasts list */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast" style={{ borderLeftColor: t.type === 'success' ? 'var(--success)' : t.type === 'warning' ? 'var(--warning)' : 'var(--info)' }}>
            {t.type === 'success' ? (
              <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
            ) : t.type === 'warning' ? (
              <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
            ) : (
              <Info size={18} style={{ color: 'var(--info)' }} />
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
