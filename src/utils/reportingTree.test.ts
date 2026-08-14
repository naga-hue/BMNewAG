import { describe, it, expect } from 'vitest';

const getReportingTreeStaffIds = (managerId: string, allStaff: any[]): string[] => {
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

describe('Dotted Line Reporting Tree Crawler', () => {
  const mockStaff = [
    { id: 'naga', fullName: 'Naga' },
    { id: 'alex', fullName: 'Alex Herzenberg', reportingManagerId: 'naga' },
    { id: 'will', fullName: 'Will Samkin' },
    // Civils reporting directly to Alex
    { id: 'civil-1', fullName: 'Civils Recruiter 1', reportingManagerId: 'alex' },
    { id: 'civil-2', fullName: 'Civils Recruiter 2', reportingManagerId: 'alex' },
    // M&E staff reporting directly to Will, but dotted line to Alex
    { id: 'me-1', fullName: 'Genene Smit', reportingManagerId: 'will', dottedLineManagerIds: ['alex'] },
    { id: 'me-2', fullName: 'Kim Freese', reportingManagerId: 'will', dottedLineManagerIds: ['alex'] },
    // Independent staff
    { id: 'indie', fullName: 'Other Consultant' }
  ];

  it('should crawl reporting tree including direct and dotted line relationships', () => {
    const alexTree = getReportingTreeStaffIds('alex', mockStaff);
    
    // Should contain Alex himself
    expect(alexTree).toContain('alex');
    // Should contain his direct reports
    expect(alexTree).toContain('civil-1');
    expect(alexTree).toContain('civil-2');
    // Should contain his dotted-line reports
    expect(alexTree).toContain('me-1');
    expect(alexTree).toContain('me-2');
    // Should NOT contain Will, Naga, or independent staff
    expect(alexTree).not.toContain('will');
    expect(alexTree).not.toContain('naga');
    expect(alexTree).not.toContain('indie');
  });

  it('should support nesting recursive reporting lines', () => {
    const nestedStaff = [
      { id: 'alex', fullName: 'Alex' },
      { id: 'lead', fullName: 'Team Lead', reportingManagerId: 'alex' },
      { id: 'junior', fullName: 'Junior Recruiter', reportingManagerId: 'lead' }
    ];
    
    const alexTree = getReportingTreeStaffIds('alex', nestedStaff);
    expect(alexTree).toContain('alex');
    expect(alexTree).toContain('lead');
    expect(alexTree).toContain('junior');
  });
  it('should support multiple reporting managers via reportingManagerIds', () => {
    const multiStaff = [
      { id: 'alex', fullName: 'Alex' },
      { id: 'will', fullName: 'Will' },
      { id: 'staff-1', fullName: 'Staff 1', reportingManagerIds: ['alex', 'will'] }
    ];

    const alexTree = getReportingTreeStaffIds('alex', multiStaff);
    const willTree = getReportingTreeStaffIds('will', multiStaff);

    expect(alexTree).toContain('alex');
    expect(alexTree).toContain('staff-1');

    expect(willTree).toContain('will');
    expect(willTree).toContain('staff-1');
  });
});
