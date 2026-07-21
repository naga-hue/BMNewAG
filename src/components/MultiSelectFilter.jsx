import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Square, CheckSquare } from 'lucide-react';

export default function MultiSelectFilter({
  options = [],
  selectedValues = ['all'],
  onChange,
  placeholder = 'Select options...',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear search on close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Format display text on trigger button
  const getDisplayText = () => {
    if (selectedValues.includes('all') || selectedValues.length === 0) {
      // Find "all" option label if exists, else default to "All"
      const allOpt = options.find(o => o.value === 'all');
      return allOpt ? allOpt.label : placeholder;
    }
    if (selectedValues.length === 1) {
      const opt = options.find(o => o.value === selectedValues[0]);
      return opt ? opt.label : selectedValues[0];
    }
    return `${selectedValues.length} Selected`;
  };

  const handleToggleOption = (val) => {
    if (val === 'all') {
      onChange(['all']);
      return;
    }

    let next = [...selectedValues].filter(v => v !== 'all');
    if (next.includes(val)) {
      next = next.filter(v => v !== val);
    } else {
      next.push(val);
    }

    // If nothing is selected, default back to 'all'
    if (next.length === 0) {
      onChange(['all']);
    } else {
      // If all specific options are selected, normalize to 'all'
      const specificOpts = options.filter(o => o.value !== 'all');
      if (next.length === specificOpts.length) {
        onChange(['all']);
      } else {
        onChange(next);
      }
    }
  };

  const handleSelectAll = () => {
    onChange(['all']);
  };

  const handleClearAll = () => {
    onChange(['all']);
  };

  const filteredOptions = options.filter(opt =>
    opt.value !== 'all' &&
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasAllOption = options.some(o => o.value === 'all');
  const isAllChecked = selectedValues.includes('all') || selectedValues.length === 0;

  return (
    <div 
      ref={containerRef} 
      className="multi-select-container" 
      style={{ 
        position: 'relative', 
        width: '100%', 
        maxWidth: '240px',
        display: 'inline-block',
        zIndex: isOpen ? 1000 : 1,
        ...style 
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: '13px',
          fontWeight: 500,
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.2s',
          minHeight: '36px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-light)';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }
        }}
      >
        <span style={{ 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          paddingRight: '8px' 
        }}>
          {getDisplayText()}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '220px',
            backdropFilter: 'blur(16px)',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          {/* Search bar */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search 
              size={12} 
              style={{ 
                position: 'absolute', 
                left: '8px', 
                color: 'var(--text-muted)' 
              }} 
            />
            <input
              autoFocus
              type="text"
              className="form-input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px 6px 26px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'rgba(255,255,255,0.02)'
              }}
            />
          </div>

          {/* Quick buttons */}
          <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                flex: 1,
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 6px',
                backgroundColor: 'rgba(99,102,241,0.08)',
                color: 'var(--accent)',
                border: '1px solid rgba(99,102,241,0.15)',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                flex: 1,
                fontSize: '10px',
                fontWeight: 700,
                padding: '3px 6px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>

          {/* Options list */}
          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              paddingRight: '2px'
            }}
          >
            {/* "All" Option */}
            {hasAllOption && !searchQuery && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: isAllChecked ? 600 : 400,
                  backgroundColor: isAllChecked ? 'rgba(99,102,241,0.04)' : 'transparent',
                  color: isAllChecked ? 'var(--accent)' : 'var(--text-primary)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isAllChecked ? 'rgba(99,102,241,0.04)' : 'transparent'}
                onClick={() => handleToggleOption('all')}
              >
                {isAllChecked ? (
                  <CheckSquare size={14} style={{ color: 'var(--accent)' }} />
                ) : (
                  <Square size={14} style={{ color: 'var(--text-muted)' }} />
                )}
                <span>{options.find(o => o.value === 'all').label}</span>
              </label>
            )}

            {/* Specific filtered options */}
            {filteredOptions.map(opt => {
              const isChecked = selectedValues.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: isChecked ? 600 : 400,
                    backgroundColor: isChecked ? 'rgba(99,102,241,0.04)' : 'transparent',
                    color: isChecked ? 'var(--accent)' : 'var(--text-primary)',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isChecked ? 'rgba(99,102,241,0.04)' : 'transparent'}
                  onClick={() => handleToggleOption(opt.value)}
                >
                  {isChecked ? (
                    <CheckSquare size={14} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <Square size={14} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span style={{ 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}>
                    {opt.label}
                  </span>
                </label>
              );
            })}

            {filteredOptions.length === 0 && searchQuery && (
              <div style={{ 
                fontSize: '11px', 
                color: 'var(--text-muted)', 
                textAlign: 'center', 
                padding: '12px 0' 
              }}>
                No matches found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
