import React, { useState, useEffect } from 'react';
import { ReportsPageProps, ReportRow, RecommendationType } from './interfaces';

// ─── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 8.5) return '#16a34a';
  if (score >= 7.5) return '#d97706';
  return '#dc2626';
}

function recoBadgeStyle(rec: RecommendationType): React.CSSProperties {
  const map: Record<RecommendationType, { bg: string; color: string }> = {
    approve: { bg: '#dcfce7', color: '#166534' },
    hold:    { bg: '#fef9c3', color: '#854d0e' },
    reject:  { bg: '#fee2e2', color: '#991b1b' },
  };
  const s = map[rec] || map.hold;
  return {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
    background: s.bg,
    color: s.color,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
}

function formatDate(raw: string): string {
  if (!raw) return '—';
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Excel export ─────────────────────────────────────────────────────────

async function exportExcel(rows: ReportRow[]) {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TalentScan AI';
  const ws = wb.addWorksheet('Candidates');

  const columns = [
    { header: 'Candidate ID',   key: 'candidateId',   width: 22 },
    { header: 'Name',           key: 'name',           width: 26 },
    { header: 'Current Role',   key: 'currentRole',    width: 26 },
    { header: 'Company',        key: 'currentCompany', width: 26 },
    { header: 'Location',       key: 'location',       width: 22 },
    { header: 'Score',          key: 'score',          width: 10 },
    { header: 'Recommendation', key: 'recommendation', width: 18 },
  ];
  ws.columns = columns;

  // Title row
  ws.insertRow(1, ['TalentScan — Candidate Report']);
  const titleRow = ws.getRow(1);
  ws.mergeCells('A1:G1');
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF1E3A5F' } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  titleRow.height = 28;

  // Generated timestamp row
  ws.insertRow(2, [`Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`]);
  const timestampRow = ws.getRow(2);
  ws.mergeCells('A2:G2');
  timestampRow.getCell(1).font = { size: 10, color: { argb: 'FF787878' } };
  timestampRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  timestampRow.height = 18;

  // Empty row for spacing
  ws.insertRow(3, []);
  ws.getRow(3).height = 8;

  // Header row style
  const headerRow = ws.getRow(4);
  headerRow.values = ['Candidate ID', 'Name', 'Current Role', 'Company', 'Location', 'Score', 'Recommendation'];
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FFAAAAAA' } },
      bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
      left:   { style: 'thin', color: { argb: 'FFAAAAAA' } },
      right:  { style: 'thin', color: { argb: 'FFAAAAAA' } },
    };
  });
  headerRow.height = 22;

  // Data rows
  rows.forEach((row, i) => {
    const r = ws.addRow({
      candidateId: row.candidateId,
      name: row.name,
      currentRole: row.currentRole,
      currentCompany: row.currentCompany,
      location: row.location,
      score: row.score,
      recommendation: row.recommendation,
    });
    const fillColor = i % 2 === 0 ? 'FFFAFAFA' : 'FFEFEFEF';
    r.eachCell(cell => {
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right:  { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });
    r.height = 18;
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `candidates-report-${todayStr()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF export ───────────────────────────────────────────────────────────

async function exportPdf(rows: ReportRow[]) {
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setTextColor(30, 58, 95);
  doc.text('TalentScan — Candidate Report', pageWidth / 2, 16, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, pageWidth / 2, 22, { align: 'center' });

  const headers = [['Candidate ID', 'Name', 'Current Role', 'Company', 'Location', 'Score', 'Recommendation']];
  const body = rows.map(r => [
    r.candidateId,
    r.name,
    r.currentRole,
    r.currentCompany,
    r.location,
    r.score.toFixed(1),
    r.recommendation.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: 27,
    head: headers,
    body,
    styles: {
      fontSize: 9,
      halign: 'center',
      valign: 'middle',
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [240, 244, 248],
    },
    tableLineColor: [180, 180, 180],
    tableLineWidth: 0.2,
  });

  doc.save(`candidates-report-${todayStr()}.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────

const ReportsPage: React.FC<ReportsPageProps> = () => {
  const [allRows, setAllRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [searchMode, setSearchMode] = useState<'name' | 'id'>('name');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50; // Number of candidates to show per page

  useEffect(() => {
    fetch('/api/candidates?limit=1000')
      .then(r => r.json())
      .then(body => {
        const rows: ReportRow[] = (body.data || []).map((r: any) => ({
          candidateId:    r.candidateId || r.candidate_id || '—',
          name:           r.name || '—',
          currentRole:    r.currentRole || r.current_role || '—',
          currentCompany: r.currentCompany || r.current_company || '—',
          location:       r.location || '—',
          score:          typeof r.score === 'number' ? r.score : Number(r.score || 0),
          recommendation: r.recommendation || 'hold',
          createdAt:      r.createdAt || r.created_at || '',
        }));
        setAllRows(rows);
      })
      .catch(() => setAllRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = allRows.filter(row => {
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return searchMode === 'id'
      ? row.candidateId.toLowerCase().includes(q)
      : row.name.toLowerCase().includes(q);
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, searchMode]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExporting(type);
    try {
      if (type === 'excel') await exportExcel(filtered);
      else await exportPdf(filtered);
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="upload-section">
      <div className="upload-header">
        <h2>📋 Candidate Reports</h2>
        <p>Search, review and export all candidate records</p>
      </div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* Search */}
        <select
          value={searchMode}
          onChange={e => setSearchMode(e.target.value as 'name' | 'id')}
          style={{
            padding: '8px 12px', borderRadius: 8, border: '2px solid var(--border)',
            background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 13,
          }}
        >
          <option value="name">Search by Name</option>
          <option value="id">Search by Candidate ID</option>
        </select>
        <input
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder={searchMode === 'name' ? 'Enter name…' : 'Enter candidate ID…'}
          style={{
            flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8,
            border: '2px solid var(--border)', background: 'var(--input-bg)',
            color: 'var(--text-primary)', fontSize: 13,
          }}
        />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          {filtered.length} / {allRows.length} records
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Export Excel */}
        <button
          onClick={() => handleExport('excel')}
          disabled={exporting !== null || filtered.length === 0}
          style={actionBtnStyle('#ffffff', '#16a34a', 'none')}
        >
          {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
        </button>

        {/* Export PDF */}
        <button
          onClick={() => handleExport('pdf')}
          disabled={exporting !== null || filtered.length === 0}
          style={actionBtnStyle('#ffffff', '#1e3a5f', 'none')}
        >
          {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading candidates…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No candidates found.</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['Candidate ID', 'Name', 'Current Role', 'Company', 'Location', 'Score', 'Recommendation'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, i) => (
                  <tr
                    key={row.candidateId + i}
                    style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-section, rgba(0,0,0,0.02))' }}
                  >
                    <td style={tdStyle}><code style={{ fontSize: 11 }}>{row.candidateId}</code></td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{row.name}</td>
                    <td style={tdStyle}>{row.currentRole}</td>
                    <td style={tdStyle}>{row.currentCompany}</td>
                    <td style={tdStyle}>{row.location}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: scoreColor(row.score) }}>{row.score.toFixed(1)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span style={recoBadgeStyle(row.recommendation as RecommendationType)}>
                        {row.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '2px solid var(--border)',
                  background: currentPage === 1 ? 'var(--bg-section)' : 'var(--bg-card)',
                  color: currentPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Previous
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {(() => {
                  const pagesToShow = 5;
                  const start = Math.max(1, currentPage - Math.floor(pagesToShow / 2));
                  const end = Math.min(totalPages, start + pagesToShow - 1);
                  const adjustedStart = Math.max(1, end - pagesToShow + 1);
                  const pageNumbers = Array.from({ length: end - adjustedStart + 1 }, (_, i) => adjustedStart + i);

                  return pageNumbers.map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: page === currentPage ? '2px solid #1e3a5f' : '2px solid var(--border)',
                        background: page === currentPage ? '#1e3a5f' : 'var(--bg-card)',
                        color: page === currentPage ? '#ffffff' : 'var(--text-primary)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        minWidth: 36,
                      }}
                    >
                      {page}
                    </button>
                  ));
                })()}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '2px solid var(--border)',
                  background: currentPage === totalPages ? 'var(--bg-section)' : 'var(--bg-card)',
                  color: currentPage === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next
              </button>

              <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 8 }}>
                Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Style helpers ────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'center',
  color: '#ffffff',
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: '0.4px',
  whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,0.15)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
  verticalAlign: 'middle',
  color: 'var(--text-primary)',
};

function actionBtnStyle(color: string, bg: string, border: string): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    border,
    background: bg,
    color,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

export default ReportsPage;
