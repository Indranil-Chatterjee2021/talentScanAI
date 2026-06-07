import React, { useState, useEffect } from 'react';
import { TokenUsage } from './agents/types';
import {
  Candidate,
  RecommendationType,
  TalentScanManagerProps,
  SearchResultItem,
  ReportSummary,
} from './interfaces';
import ReportsPage from './ReportsPage';
import './TalentScanManager.css';

const TalentScanManager: React.FC<TalentScanManagerProps> = ({
  candidates,
  onRecommendationChange,
  onResumeUpload,
  jdResumeSection,
  tokenUsage,
  apiError,
  darkMode,
  onToggleTheme,
  onOpenSettings,
  processingProgress,
  onExcelImport,
  reportSummary,
}) => {
  const [activePage, setActivePage] = useState<'dashboard' | 'reports' | 'about'>('dashboard');
  const [isUploading, setIsUploading] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 10; // Number of candidates to show per page
  const totalPages = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedCandidates = candidates.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [candidates.length]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  };
  const getScoreColor = (score: number): string => {
    if (score >= 8.5) return '#4CAF50';
    if (score >= 7.5) return '#FF9800';
    return '#F44336';
  };

  const renderCircularScore = (score: number) => {
    const color = getScoreColor(score);
    const strokeDasharray = `${score * 25.1}, 251.2`;

    return (
      <div className="score-circle">
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="35"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="8"
          />
          <circle
            cx="40"
            cy="40"
            r="35"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset="0"
            transform="rotate(-90 40 40)"
            className="score-progress"
          />
        </svg>
        <div className="score-text">{score}</div>
      </div>
    );
  };

  const handleBulkFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setIsUploading(true);
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      const validFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (allowedTypes.includes(file.type)) {
          validFiles.push(file);
        } else {
          alert(`Please upload valid resume files (PDF, DOC, DOCX, or TXT). Skipped: ${file.name}`);
        }
      }
      if (validFiles.length > 0) {
        try {
          await onResumeUpload(validFiles);
        } catch (error) {
          alert(`Error processing resumes: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const renderUploadSection = () => {
    const prog = processingProgress;
    const pct = prog ? Math.round((prog.completed / prog.total) * 100) : 0;

    return (
      <div className="upload-section">
        <div className="upload-header">
          <h2>📄 Resume Upload & Analysis</h2>
          <p>Upload candidate resumes to automatically extract and analyze candidate information</p>
        </div>
        <div className="upload-form">
          <input
            type="file"
            id="bulk-resume-upload"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleBulkFileUpload}
            style={{ display: 'none' }}
            multiple
            disabled={isUploading}
          />
          <label htmlFor="bulk-resume-upload" className={`bulk-upload-button ${isUploading ? 'uploading' : ''}`}>
            {isUploading ? <>⏳ Processing Resumes...</> : <>🤖 Upload & Scan Resumes</>}
          </label>

          {/* Progress bar — visible only while processing */}
          {prog && (
            <div style={{ marginTop: 14, width: '100%' }}>
              {/* Bar */}
              <div style={{
                height: 8,
                borderRadius: 8,
                background: 'var(--border, #e5e7eb)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #0ea5e9, #8b5cf6)',
                  borderRadius: 8,
                  transition: 'width 0.4s ease',
                }} />
              </div>

              {/* Count + active filenames */}
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {prog.completed}/{prog.total} done
                </span>
                {prog.activeFiles.map(name => (
                  <span key={name} style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(139,92,246,0.15))',
                    border: '1px solid rgba(14,165,233,0.3)',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9', animation: 'pulse 1.2s infinite' }} />
                    {name.length > 24 ? name.slice(0, 22) + '…' : name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="upload-info">
            <span>✨ AI-powered parsing • Automatic scoring • Smart recommendations</span>
            <br />
            <small>Supported formats: PDF, DOC, DOCX, TXT</small>
          </div>
        </div>
      </div>
    );
  };

  const renderRecommendationButtons = (candidateId: string, currentRecommendation: string) => (
    <div className="recommendation-buttons">
      <button
        className={`btn-approve ${currentRecommendation === 'approve' ? 'active' : ''}`}
        onClick={() => onRecommendationChange(candidateId, 'approve')}
      >
        Approve
      </button>
      <button
        className={`btn-hold ${currentRecommendation === 'hold' ? 'active' : ''}`}
        onClick={() => onRecommendationChange(candidateId, 'hold')}
      >
        Hold
      </button>
      <button
        className={`btn-reject ${currentRecommendation === 'reject' ? 'active' : ''}`}
        onClick={() => onRecommendationChange(candidateId, 'reject')}
      >
        Reject
      </button>
    </div>
  );

  const localSummary = {
    total: candidates.length,
    approve: candidates.filter(c => c.recommendation === 'approve').length,
    hold: candidates.filter(c => c.recommendation === 'hold').length,
    reject: candidates.filter(c => c.recommendation === 'reject').length,
    approvalRate: candidates.length > 0
      ? (candidates.filter(c => c.recommendation === 'approve').length / candidates.length) * 100
      : 0,
    averageScore: candidates.length > 0
      ? candidates.reduce((sum, c) => sum + c.score, 0) / candidates.length
      : 0,
  };

  const summary = reportSummary || localSummary;

  const renderReportSection = () => (
    <div className="report-section">
      <div className="report-header">
        <h2>Report Summary</h2>
      </div>
      <div className="report-grid">
        <div className="report-card"><span>Total</span><strong>{summary.total}</strong></div>
        <div className="report-card"><span>Approve</span><strong>{summary.approve}</strong></div>
        <div className="report-card"><span>Hold</span><strong>{summary.hold}</strong></div>
        <div className="report-card"><span>Reject</span><strong>{summary.reject}</strong></div>
        <div className="report-card"><span>Approval Rate</span><strong>{summary.approvalRate.toFixed(1)}%</strong></div>
        <div className="report-card"><span>Average Score</span><strong>{summary.averageScore.toFixed(2)}</strong></div>
      </div>
    </div>
  );

  const renderPaginationControls = () => {
    if (candidates.length <= PAGE_SIZE) return null;

    const pagesToShow = 5;
    const start = Math.max(1, currentPage - Math.floor(pagesToShow / 2));
    const end = Math.min(totalPages, start + pagesToShow - 1);
    const adjustedStart = Math.max(1, end - pagesToShow + 1);
    const pageNumbers = Array.from({ length: end - adjustedStart + 1 }, (_, i) => adjustedStart + i);

    return (
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>

        <div className="pagination-pages">
          {pageNumbers.map((page) => (
            <button
              key={page}
              className={`pagination-page-btn ${page === currentPage ? 'active' : ''}`}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          className="pagination-btn"
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          Next
        </button>

        <span className="pagination-meta">
          Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, candidates.length)} of {candidates.length}
        </span>
      </div>
    );
  };

  return (
    <div className="talent-scan-manager">
      <header className="header">
        <div className="header-left">
          <div className="logo">🎯</div>
          <h1>TalentScan AI</h1>
        </div>
        <div className="header-right">
          <div className="datetime">
            <span className="datetime-label">Date and Time:</span>
            <span className="datetime-value">{formatDateTime(currentDateTime)}</span>
          </div>
          {onOpenSettings && (
            <button className="theme-toggle" onClick={onOpenSettings} title="AI Settings" style={{ marginRight: 8 }}>
              ⚙️
            </button>
          )}
          <button className="theme-toggle" onClick={onToggleTheme} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Page navigation tabs */}
      <nav style={{ display: 'flex', justifyContent: 'center', borderBottom: '2px solid var(--border)', background: 'var(--bg-card)' }}>
        {([
          { key: 'dashboard', label: '📊 Dashboard' },
          { key: 'reports',   label: '📋 Reports' },
          { key: 'about',     label: 'ℹ️ About' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActivePage(key)}
            style={{
              padding: '12px 32px',
              border: 'none',
              borderBottom: activePage === key ? '3px solid #22c55e' : '3px solid transparent',
              background: 'transparent',
              color: activePage === key ? '#22c55e' : '#3b82f6',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              marginBottom: -2,
              transition: 'color 0.2s',
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="content">
        {activePage === 'reports' ? (
          <ReportsPage />
        ) : activePage === 'about' ? (
          <div className="upload-section" style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Centred hero */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 64 }}>🎯</div>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  TalentScan AI
                </h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15, fontWeight: 500 }}>
                  AI-powered candidate intelligence &amp; resume shortlisting
                </p>
              </div>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Version',      value: process.env.REACT_APP_VERSION || '1.1.0' },
                  { label: 'Developed by', value: 'Indranil Chatterjee' },
                  { label: 'AI Providers', value: 'Anthropic Claude · Google Gemini' },
                  { label: 'Database',     value: 'MongoDB Atlas' },
                  { label: 'Frontend',     value: 'React 18 · TypeScript 6' },
                  { label: 'Deployment',   value: 'Vercel' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.06), rgba(139,92,246,0.04))', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  'TalentScan AI automates resume parsing, candidate scoring, and shortlisting using a multi-agent AI pipeline — no manual screening needed.',
                  'Upload resumes in PDF, DOCX, or TXT format. Define your job description with must-have and nice-to-have skills, and let AI extract, match, and rank every candidate by fit.',
                  'Candidates are scored out of 10 and assigned a recommendation (Approve / Hold / Reject) based on skills match, experience, and role alignment.',
                  'All candidate data is persisted to MongoDB Atlas. Search by name or ID, review full profiles, and export polished reports as Excel or PDF with one click.',
                  'Supports both Anthropic Claude and Google Gemini as AI providers — switch anytime from the settings panel without restarting the app.',
                ].map((line, i) => (
                  <p key={i} style={{ margin: 0, fontSize: 15, color: 'var(--text-primary)', fontWeight: 600, fontStyle: 'italic', lineHeight: 1.7 }}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
        {jdResumeSection}
        {renderUploadSection()}
        {renderReportSection()}

        {candidates.length > 0 && tokenUsage && (
          <div className="token-stats">
            <span className="token-stats-title">📊 Token Usage</span>
            {tokenUsage.inputTokens === 0 && tokenUsage.cacheReadTokens === 0 ? (
              <span className="token-stat-fallback">
                {apiError ? `⚠️ AI error: ${apiError}` : 'Fallback mode — no API key configured'}
              </span>
            ) : (
              <>
                <span className="token-stat">Input <strong>{tokenUsage.inputTokens.toLocaleString()}</strong></span>
                <span className="token-stat">Output <strong>{tokenUsage.outputTokens.toLocaleString()}</strong></span>
                <span className="token-stat token-stat-cache">Cache writes <strong>{tokenUsage.cacheWriteTokens.toLocaleString()}</strong></span>
                <span className="token-stat token-stat-cache">Cache reads <strong>{tokenUsage.cacheReadTokens.toLocaleString()}</strong></span>
                {tokenUsage.cacheReadTokens > 0 && (
                  <span className="token-stat-saved">
                    ~{Math.round((tokenUsage.cacheReadTokens / Math.max(1, tokenUsage.inputTokens + tokenUsage.cacheReadTokens)) * 90)}% cost saved via cache
                  </span>
                )}
              </>
            )}
          </div>
        )}

        <div className="section-headers">
          <div className="section-header">Candidates</div>
          <div className="section-header">Score</div>
          <div className="section-header">Experience</div>
          <div className="section-header">Details</div>
          <div className="section-header">
            <div style={{textAlign: 'center'}}>Shortlist Recommendation</div>
            <div style={{textAlign: 'center', fontSize: '0.9em', marginTop: '2px'}}>(Yes/No)</div>
          </div>
        </div>

        <div className="candidates-list">
          {paginatedCandidates.map((candidate) => (
            <div key={candidate.id} className="candidate-row">
              {/* Candidate Info */}
              <div className="candidate-info">
                <div className="candidate-basic">
                  <h3 className="candidate-name">{candidate.name}</h3>
                  <div className="candidate-location">📍 {candidate.location}</div>
                  <div className="candidate-role">
                    👤 {candidate.currentRole}
                  </div>
                  <div className="candidate-company">
                    🏢 {candidate.currentCompany}
                  </div>
                </div>
              </div>
              {/* Score Column */}
              <div className="candidate-score">
                {renderCircularScore(candidate.score)}
              </div>

              {/* Experience Column */}
              <div className="candidate-experience">
                {candidate.experiences.map((exp, index) => (
                  <div key={index} className="experience-item">
                    <div className="experience-icon">🏢</div>
                    <div className="experience-details">
                      <div className="experience-role">{exp.role}</div>
                      <div className="experience-company">{exp.company}</div>
                      <div className="experience-period">{exp.period}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div className="candidate-details">
                <div className="strengths">
                  <div className="detail-section-title">🟢 Strengths</div>
                  <ul>
                    {candidate.strengths.map((strength, index) => (
                      <li key={index}>{strength}</li>
                    ))}
                  </ul>
                </div>
                <div className="weaknesses">
                  <div className="detail-section-title">🔴 Weakness</div>
                  <ul>
                    {candidate.weaknesses.map((weakness, index) => (
                      <li key={index}>{weakness}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommendation */}
              <div className="candidate-recommendation">
                {renderRecommendationButtons(candidate.id, candidate.recommendation)}
              </div>
            </div>
          ))}
        </div>

        {renderPaginationControls()}
          </>
        )}
      </div>
    </div>
  );
};

export default TalentScanManager;