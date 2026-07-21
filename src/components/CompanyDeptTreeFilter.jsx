import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Check, Search, Building2, FolderTree, X } from 'lucide-react';

export default function CompanyDeptTreeFilter({
  companies = [],
  staff = [],
  selectedCompanyIds = ['all'],
  selectedDepartments = ['all'],
  onChange,
  placeholder = "Select Entity / Department"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCompanies, setExpandedCompanies] = useState({});
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build company-to-departments tree data
  const companyTree = useMemo(() => {
    return companies.map(c => {
      // Collect unique departments for this company from c.departments & staff array
      const deptSet = new Set();
      if (Array.isArray(c.departments)) {
        c.departments.forEach(d => {
          if (!d) return;
          const name = typeof d === 'object' ? d.name : d;
          if (name && typeof name === 'string') deptSet.add(name);
        });
      }
      staff.forEach(s => {
        if (s.companyId === c.id && s.department) {
          const name = typeof s.department === 'object' ? s.department.name : s.department;
          if (name && typeof name === 'string') {
            deptSet.add(name);
          }
        }
      });

      const depts = Array.from(deptSet).sort();
      return {
        id: c.id,
        name: c.name,
        departments: depts
      };
    });
  }, [companies, staff]);

  // Filtered tree based on search term
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return companyTree;
    const term = searchTerm.toLowerCase();
    return companyTree.map(c => {
      const matchComp = c.name.toLowerCase().includes(term);
      const matchingDepts = c.departments.filter(d => d.toLowerCase().includes(term));
      if (matchComp || matchingDepts.length > 0) {
        return {
          ...c,
          departments: matchComp ? c.departments : matchingDepts
        };
      }
      return null;
    }).filter(Boolean);
  }, [companyTree, searchTerm]);

  // Expand all companies when searching
  useEffect(() => {
    if (searchTerm.trim()) {
      const exp = {};
      companyTree.forEach(c => exp[c.id] = true);
      setExpandedCompanies(exp);
    }
  }, [searchTerm, companyTree]);

  const toggleExpand = (compId, e) => {
    e.stopPropagation();
    setExpandedCompanies(prev => ({
      ...prev,
      [compId]: !prev[compId]
    }));
  };

  const isAllCompanies = selectedCompanyIds.includes('all');
  const isAllDepartments = selectedDepartments.includes('all');

  const handleSelectAll = () => {
    onChange({ companyIds: ['all'], departments: ['all'] });
  };

  const handleReset = () => {
    onChange({ companyIds: ['all'], departments: ['all'] });
  };

  const isCompanySelected = (compId) => {
    if (isAllCompanies) return true;
    return selectedCompanyIds.includes(compId);
  };

  const isDeptSelected = (deptName) => {
    if (isAllDepartments) return true;
    return selectedDepartments.includes(deptName);
  };

  const handleToggleCompany = (compId, depts) => {
    let newCompIds = [...selectedCompanyIds];
    let newDepts = [...selectedDepartments];

    // If currently 'all', expand to actual explicit lists first
    if (newCompIds.includes('all')) {
      newCompIds = companies.map(c => c.id);
    }
    if (newDepts.includes('all')) {
      const allDepts = Array.from(new Set(companyTree.flatMap(c => c.departments)));
      newDepts = allDepts;
    }

    if (newCompIds.includes(compId)) {
      // Unselect company
      newCompIds = newCompIds.filter(id => id !== compId);
      // Also unselect its departments if not shared by another selected company
      const otherSelectedCompDepts = new Set(
        companyTree
          .filter(c => newCompIds.includes(c.id))
          .flatMap(c => c.departments)
      );
      newDepts = newDepts.filter(d => depts.includes(d) ? otherSelectedCompDepts.has(d) : true);
    } else {
      // Select company
      newCompIds.push(compId);
      // Select all departments of this company
      depts.forEach(d => {
        if (!newDepts.includes(d)) newDepts.push(d);
      });
    }

    // Check if everything selected -> reset to ['all']
    if (newCompIds.length === companies.length) newCompIds = ['all'];
    const allUniqueDepts = Array.from(new Set(companyTree.flatMap(c => c.departments)));
    if (newDepts.length === allUniqueDepts.length) newDepts = ['all'];

    onChange({ companyIds: newCompIds, departments: newDepts });
  };

  const handleToggleDept = (deptName) => {
    let newDepts = [...selectedDepartments];
    let newCompIds = [...selectedCompanyIds];

    if (newDepts.includes('all')) {
      const allDepts = Array.from(new Set(companyTree.flatMap(c => c.departments)));
      newDepts = allDepts;
    }

    if (newDepts.includes(deptName)) {
      newDepts = newDepts.filter(d => d !== deptName);
    } else {
      newDepts.push(deptName);
    }

    const allUniqueDepts = Array.from(new Set(companyTree.flatMap(c => c.departments)));
    if (newDepts.length === allUniqueDepts.length) newDepts = ['all'];

    onChange({ companyIds: newCompIds, departments: newDepts });
  };

  // Button Trigger Label summary calculation
  const getButtonLabel = () => {
    if (isAllCompanies && isAllDepartments) {
      return "All Companies & Departments (Consolidated)";
    }
    const selectedCompsCount = isAllCompanies ? companies.length : selectedCompanyIds.length;
    const selectedDeptsCount = isAllDepartments 
      ? Array.from(new Set(companyTree.flatMap(c => c.departments))).length 
      : selectedDepartments.length;

    if (selectedCompsCount === 1 && !isAllCompanies) {
      const compObj = companies.find(c => c.id === selectedCompanyIds[0]);
      if (compObj) {
        if (isAllDepartments) return `${compObj.name} (All Depts)`;
        return `${compObj.name} (${selectedDeptsCount} Depts)`;
      }
    }

    return `${selectedCompsCount} Companies, ${selectedDeptsCount} Departments`;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '320px' }}>
      {/* Filter Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: '12px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          <Building2 size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getButtonLabel()}
          </span>
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '380px',
            maxHeight: '440px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header Controls & Search */}
          <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(148, 163, 184, 0.15)',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Reset
                </button>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {filteredTree.length} Companies
              </span>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={12} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search company or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 26px',
                  fontSize: '11px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)'
                }}
              />
              {searchTerm && (
                <X 
                  size={12} 
                  onClick={() => setSearchTerm('')} 
                  style={{ position: 'absolute', right: '8px', cursor: 'pointer', color: 'var(--text-muted)' }} 
                />
              )}
            </div>
          </div>

          {/* Tree View Item List */}
          <div style={{ padding: '8px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Global Consolidated Option */}
            <div
              onClick={handleSelectAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: (isAllCompanies && isAllDepartments) ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                fontWeight: 600,
                fontSize: '12px',
                color: (isAllCompanies && isAllDepartments) ? 'var(--primary)' : 'var(--text-primary)',
                borderBottom: '1px dashed var(--border-color)',
                marginBottom: '4px'
              }}
            >
              <input
                type="checkbox"
                checked={isAllCompanies && isAllDepartments}
                onChange={() => {}}
                style={{ cursor: 'pointer' }}
              />
              <FolderTree size={14} style={{ color: 'var(--primary)' }} />
              <span>All Companies & Departments (Consolidated)</span>
            </div>

            {/* Companies & Sub-Departments */}
            {filteredTree.map(comp => {
              const compSelected = isCompanySelected(comp.id);
              const isExpanded = !!expandedCompanies[comp.id];

              return (
                <div key={comp.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Company Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 6px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: compSelected ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    {/* Expand/Collapse Arrow */}
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(comp.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: '2px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {comp.departments.length > 0 ? (
                        isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                      ) : (
                        <div style={{ width: 14 }} />
                      )}
                    </button>

                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={compSelected}
                      onChange={() => handleToggleCompany(comp.id, comp.departments)}
                      style={{ cursor: 'pointer' }}
                    />

                    {/* Company Name */}
                    <span 
                      onClick={() => handleToggleCompany(comp.id, comp.departments)}
                      style={{ 
                        flex: 1, 
                        fontSize: '12px', 
                        fontWeight: 600, 
                        color: compSelected ? 'var(--text-primary)' : 'var(--text-secondary)' 
                      }}
                    >
                      🏢 {comp.name}
                    </span>

                    {/* Sub-badge count */}
                    {comp.departments.length > 0 && (
                      <span 
                        onClick={(e) => toggleExpand(comp.id, e)}
                        style={{ 
                          fontSize: '10px', 
                          padding: '1px 6px', 
                          borderRadius: '10px', 
                          backgroundColor: 'rgba(255,255,255,0.06)', 
                          color: 'var(--text-muted)' 
                        }}
                      >
                        {comp.departments.length} depts
                      </span>
                    )}
                  </div>

                  {/* Expanded Sub-Departments */}
                  {isExpanded && comp.departments.length > 0 && (
                    <div style={{ paddingLeft: '28px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', marginBottom: '4px' }}>
                      {comp.departments.map(dept => {
                        const deptSel = isDeptSelected(dept);
                        return (
                          <div
                            key={dept}
                            onClick={() => handleToggleDept(dept)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              backgroundColor: deptSel ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                              fontSize: '11px'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={deptSel}
                              onChange={() => {}}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ color: deptSel ? 'var(--primary)' : 'var(--text-secondary)' }}>
                              📁 {typeof dept === 'object' ? (dept.name || String(dept)) : String(dept)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredTree.length === 0 && (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                No matching company or department found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
