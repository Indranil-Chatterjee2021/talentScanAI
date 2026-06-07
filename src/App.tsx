import React, { useState, useEffect } from 'react';
import TalentScanManager from './TalentScanManager';
import JDResumeInput from './JDResumeInput';
import { AIResumeParser } from './aiResumeParser';
import { TokenUsage } from './agents/types';
import {
  JDState,
  Candidate,
  RecommendationType,
  SearchResultItem,
  ReportSummary,
  ProcessingProgress,
} from './interfaces';
import './App.css';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import 'pdfjs-dist/build/pdf.worker.entry';
import * as XLSX from 'xlsx';

const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
const MAX_RESUME_CONCURRENCY = 4;
const MONGO_LS_KEY = 'talentscan_mongo_uri';

// Fixed app-level key for localStorage obfuscation (AES-GCM via Web Crypto)
const APP_KEY_MATERIAL = 'talentscan-storage-v1-key-material';

async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const raw = enc.encode(APP_KEY_MATERIAL.padEnd(32, '0').slice(0, 32));
  return window.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptForStorage(plain: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decryptFromStorage(stored: string): Promise<string> {
  const key = await getCryptoKey();
  const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plain);
}

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

function normalizeRecommendation(value: unknown): RecommendationType {
  if (value === 'approve' || value === 'hold' || value === 'reject') return value;
  return 'hold';
}

function mapDbCandidateToUi(input: any): Candidate {
  return {
    id: typeof input.id === 'string' ? input.id : (input.candidateId || input.candidate_id || Date.now().toString() + Math.random()),
    candidateId: input.candidateId || input.candidate_id,
    name: input.name || 'Unknown Candidate',
    location: input.location || 'Location not specified',
    currentRole: input.currentRole || input.current_role || 'Professional',
    currentCompany: input.currentCompany || input.current_company || 'Company not specified',
    score: typeof input.score === 'number' ? input.score : Number(input.score || 0),
    experiences: Array.isArray(input.experiences) ? input.experiences : [],
    strengths: Array.isArray(input.strengths) ? input.strengths : [],
    weaknesses: Array.isArray(input.weaknesses) ? input.weaknesses : [],
    recommendation: normalizeRecommendation(input.recommendation),
  };
}

async function saveCandidatesToDb(candidates: Candidate[], mongoUri: string): Promise<Candidate[]> {
  const res = await fetch('/api/candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-mongo-uri': mongoUri },
    body: JSON.stringify({
      candidates: candidates.map(c => ({
        candidateId: c.candidateId,
        name: c.name,
        location: c.location,
        currentRole: c.currentRole,
        currentCompany: c.currentCompany,
        score: c.score,
        recommendation: c.recommendation,
        experiences: c.experiences,
        strengths: c.strengths,
        weaknesses: c.weaknesses,
        source: 'ai_scan',
      })),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const body = await res.json();
  const rows = Array.isArray(body.data) ? body.data : [];
  return rows.map(mapDbCandidateToUi);
}

async function loadReportSummaryFromDb(mongoUri: string): Promise<ReportSummary | null> {
  const res = await fetch('/api/reports', { headers: { 'x-mongo-uri': mongoUri } });
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  if (!body?.data) return null;
  return body.data as ReportSummary;
}

function parseExcelRows(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve(Array.isArray(rows) ? rows : []);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Invalid Excel file'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += (content.items as { str?: string }[]).map(item => item.str || '').join(' ') + '\n';
    }
    return text;
  }
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  ) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value;
    } catch {
      return file.text();
    }
  }
  return file.text();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const workerCount = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) break;
      results[idx] = await mapper(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function App() {
  const [jd, setJD] = useState<JDState>({ mustHave: '', niceToHave: '' });
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jdSubmitted, setJDSubmitted] = useState(false);
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [editingJD, setEditingJD] = useState(false);
  const [jdChangedSinceScan, setJDChangedSinceScan] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>(ZERO_USAGE);
  const [apiError, setApiError] = useState<string | undefined>();
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [provider, setProvider] = useState<'anthropic' | 'gemini'>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [mongoUri, setMongoUri] = useState('');
  const [mongoUriInput, setMongoUriInput] = useState('');
  const [showMongoModal, setShowMongoModal] = useState(false);
  const [mongoError, setMongoError] = useState<string | null>(null);
  const [mongoSaving, setMongoSaving] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Load MongoDB URI from localStorage, then load AI settings from user's DB
  useEffect(() => {
    (async () => {
      const stored = localStorage.getItem(MONGO_LS_KEY);
      if (!stored) {
        setShowMongoModal(true);
        setSettingsLoaded(true);
        return;
      }
      let uri = '';
      try {
        uri = await decryptFromStorage(stored);
      } catch {
        setShowMongoModal(true);
        setSettingsLoaded(true);
        return;
      }
      setMongoUri(uri);
      fetch('/api/settings', { headers: { 'x-mongo-uri': uri } })
        .then(r => r.json())
        .then(body => {
          const s = body.data || {};
          if (s.ai_provider) setProvider(s.ai_provider as 'anthropic' | 'gemini');
          if (s.ai_model) setModel(s.ai_model);
          if (s.ai_api_key) setApiKey(s.ai_api_key);
          setShowConfigModal(!s.ai_configured);
        })
        .catch(() => setShowConfigModal(true))
        .finally(() => setSettingsLoaded(true));
    })();
  }, []);

  const handleSaveMongoUri = async () => {
    const uri = mongoUriInput.trim();
    if (!uri) return;
    setMongoError(null);
    setMongoSaving(true);
    try {
      const res = await fetch('/api/settings', { headers: { 'x-mongo-uri': uri } });
      const body = await res.json().catch(() => ({})) as { error?: string; data?: any };
      // A connection error (not just missing settings) means the URI is bad
      if (!res.ok && body.error && !body.error.includes('configured')) {
        throw new Error(body.error);
      }
      const encrypted = await encryptForStorage(uri);
      localStorage.setItem(MONGO_LS_KEY, encrypted);
      setMongoUri(uri);
      setShowMongoModal(false);
      const s = body.data || {};
      if (s.ai_provider) setProvider(s.ai_provider as 'anthropic' | 'gemini');
      if (s.ai_model) setModel(s.ai_model);
      if (s.ai_api_key) setApiKey(s.ai_api_key);
      setShowConfigModal(!s.ai_configured);
    } catch (err) {
      setMongoError((err as Error).message || 'Could not connect to MongoDB. Please check your URI.');
    } finally {
      setMongoSaving(false);
    }
  };

  const handleRecommendationChange = (candidateId: string, recommendation: RecommendationType) => {
    setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, recommendation } : c));
    const target = candidates.find(c => c.id === candidateId);
    if (target?.candidateId && mongoUri) {
      fetch('/api/candidates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-mongo-uri': mongoUri },
        body: JSON.stringify({ candidateId: target.candidateId, recommendation }),
      }).catch(() => undefined);
    }
  };

  const handleJDSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJDSubmitted(true);
    setEditingJD(false);
    setShowToast(true);
    setJDChangedSinceScan(false);
    setTimeout(() => setShowToast(false), 3000);
    if (resumeFiles.length > 0) await handleResumeUpload(resumeFiles);
  };

  const handleEditJD = () => setEditingJD(true);

  const handleJDChange = (newJD: JDState) => {
    setJD(newJD);
    if (jdSubmitted) setJDChangedSinceScan(true);
  };

  const handleResumeUpload = async (files: File[]) => {
    setResumeFiles(files);
    if (!jdSubmitted || files.length === 0) return;

    const aiParser = AIResumeParser.getInstance();
    let completed = 0;
    const activeFiles = new Set<string>();

    setProcessingProgress({ completed: 0, total: files.length, activeFiles: [] });

    const results = await mapWithConcurrency(
      files,
      MAX_RESUME_CONCURRENCY,
      async (file) => {
        const shortName = file.name.replace(/\.[^.]+$/, '');
        activeFiles.add(shortName);
        setProcessingProgress({ completed, total: files.length, activeFiles: Array.from(activeFiles) });
        try {
          const text = await extractTextFromFile(file);
          const result = await aiParser.parseResume(file.name, text, jd, { provider, apiKey, model });
          activeFiles.delete(shortName);
          completed += 1;
          setProcessingProgress({ completed, total: files.length, activeFiles: Array.from(activeFiles) });
          return result;
        } catch {
          activeFiles.delete(shortName);
          completed += 1;
          setProcessingProgress({ completed, total: files.length, activeFiles: Array.from(activeFiles) });
          return {
            candidate: {
              id: Date.now().toString() + Math.random(),
              name: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
              location: 'Location not specified',
              currentRole: 'Professional',
              currentCompany: 'Company not specified',
              score: 5.0,
              experiences: [{ role: 'Professional', company: 'Previous Company', period: '2022 - Present' }],
              strengths: ['Resume uploaded successfully'],
              weaknesses: ['Parsing failed — manual review needed'],
              recommendation: 'hold' as RecommendationType,
            },
            usage: ZERO_USAGE,
          };
        }
      }
    );

    setProcessingProgress(null);

    const totalUsage = results.reduce((acc, r) => addUsage(acc, r.usage), ZERO_USAGE);
    setTokenUsage(prev => addUsage(prev, totalUsage));
    const firstError = results.find(r => r.error)?.error;
    setApiError(firstError);

    const parsed = results.map(r => r.candidate);
    let persisted = parsed;
    try {
      persisted = await saveCandidatesToDb(parsed, mongoUri);
      const freshSummary = await loadReportSummaryFromDb(mongoUri);
      setReportSummary(freshSummary);
    } catch (err) {
      console.warn('[db] Candidate persistence skipped:', err);
    }

    setCandidates(prev => {
      const updated = [...prev];
      persisted.forEach(newCand => {
        const idx = updated.findIndex(c => c.name === newCand.name);
        if (idx !== -1) updated[idx] = { ...updated[idx], ...newCand };
        else updated.push(newCand);
      });
      return updated;
    });

    setJDChangedSinceScan(false);
  };

  const handleRescanCandidates = async () => {
    if (resumeFiles.length > 0) await handleResumeUpload(resumeFiles);
    setEditingJD(false);
  };

  const handleSearchCandidates = async (query: string, mode: 'name' | 'id') => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      if (mode === 'id') params.set('candidateId', query.trim());
      else params.set('q', query.trim());
      params.set('limit', '30');

      const res = await fetch(`/api/candidates?${params.toString()}`, { headers: { 'x-mongo-uri': mongoUri } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const rows = Array.isArray(body.data) ? body.data : [];
      setSearchResults(rows.map((r: any) => ({
        candidateId: r.candidateId || r.candidate_id,
        name: r.name,
        recommendation: normalizeRecommendation(r.recommendation),
        score: typeof r.score === 'number' ? r.score : Number(r.score || 0),
        createdAt: r.createdAt || r.created_at,
      })));
    } catch (err) {
      console.warn('[db] Candidate search failed:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleExcelImport = async (file: File) => {
    const rows = await parseExcelRows(file);
    const importedCandidates: Candidate[] = rows.map((row: any, idx: number) => ({
      id: `excel-${Date.now()}-${idx}`,
      candidateId: String(row.candidate_id || row.candidateId || '').trim() || undefined,
      name: String(row.name || row.candidate_name || 'Unknown Candidate').trim(),
      location: String(row.location || 'Location not specified').trim(),
      currentRole: String(row.current_role || row.currentRole || 'Professional').trim(),
      currentCompany: String(row.current_company || row.currentCompany || 'Company not specified').trim(),
      score: Number(row.score || 0),
      recommendation: normalizeRecommendation(String(row.recommendation || 'hold').toLowerCase()),
      experiences: [],
      strengths: [],
      weaknesses: [],
    }));

    const persisted = await saveCandidatesToDb(importedCandidates, mongoUri);
    setCandidates(prev => {
      const updated = [...prev];
      persisted.forEach(newCand => {
        const idx = updated.findIndex(c => (c.candidateId && newCand.candidateId && c.candidateId === newCand.candidateId) || c.name === newCand.name);
        if (idx !== -1) updated[idx] = { ...updated[idx], ...newCand };
        else updated.push(newCand);
      });
      return updated;
    });
    const freshSummary = await loadReportSummaryFromDb(mongoUri);
    setReportSummary(freshSummary);
  };

  useEffect(() => {
    if (mongoUri) loadReportSummaryFromDb(mongoUri).then(setReportSummary).catch(() => setReportSummary(null));
  }, [mongoUri]);

  const version = process.env.REACT_APP_VERSION || '1.0.0';

  const handleSaveConfig = async () => {
    if (apiKey && model) {
      setConfigError(null);
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mongo-uri': mongoUri },
          body: JSON.stringify({ ai_configured: true, ai_provider: provider, ai_model: model, ai_api_key: apiKey }),
        });
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setConfigError(data.error || 'Failed to save settings.');
          return;
        }
        setShowConfigModal(false);
      } catch {
        setConfigError('Network error. Could not save settings.');
      }
    }
  };

  const handleOpenSettings = () => {
    setConfigError(null);
    setShowConfigModal(true);
  };

  // Set default model when provider changes
  useEffect(() => {
    if (!model || !getModelsForProvider(provider).includes(model)) {
      setModel(getModelsForProvider(provider)[0]);
    }
  }, [provider]);

  const getModelsForProvider = (prov: 'anthropic' | 'gemini'): string[] => {
    if (prov === 'anthropic') {
      return [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-haiku-4-5',
        'claude-sonnet-4-5',
        'claude-sonnet-4-6',
      ];
    } else {
      return [
        'gemini-1.5-pro-latest',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-8b-latest',
        'gemini-1.0-pro-latest',
        'gemini-pro'
      ];
    }
  };

  return (
    <div className="App">
      {showToast && <div className="toast-success">JD submitted successfully!</div>}

      {/* MongoDB URI Setup Modal */}
      {showMongoModal && (
        <>
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)', zIndex: 9998
            }}
          />
          <div
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)', zIndex: 9999,
              minWidth: '500px', maxWidth: '90vw', border: '1px solid var(--border)'
            }}
          >
            <h2 style={{
              fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0',
              background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', textAlign: 'center'
            }}>
              Connect Your Database
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center' }}>
              Enter your MongoDB connection URI. Your data stays in your own database — never shared.
            </p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                MongoDB URI
              </label>
              <input
                type="password"
                value={mongoUriInput}
                onChange={e => setMongoUriInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !mongoSaving && mongoUriInput.trim() && handleSaveMongoUri()}
                placeholder="mongodb+srv://user:pass@cluster.mongodb.net/"
                style={{
                  width: '100%', padding: 12, fontSize: 13, borderRadius: 8,
                  border: `2px solid ${mongoUriInput ? '#10b981' : 'var(--border)'}`,
                  fontFamily: 'monospace', background: 'var(--input-bg)', color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Get a free cluster at{' '}
              <a href="https://www.mongodb.com/atlas" target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', fontWeight: 600 }}>
                mongodb.com/atlas
              </a>. Make sure to whitelist <strong>0.0.0.0/0</strong> in Network Access so Vercel can connect.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 8 }}>
              <button
                onClick={handleSaveMongoUri}
                disabled={!mongoUriInput.trim() || mongoSaving}
                style={{
                  padding: '12px 32px', borderRadius: 8, border: 'none',
                  background: (mongoUriInput.trim() && !mongoSaving) ? 'linear-gradient(135deg, #0ea5e9, #8b5cf6)' : '#ccc',
                  color: 'white', cursor: (mongoUriInput.trim() && !mongoSaving) ? 'pointer' : 'not-allowed',
                  fontSize: 15, fontWeight: 700,
                  boxShadow: (mongoUriInput.trim() && !mongoSaving) ? '0 4px 12px rgba(14, 165, 233, 0.3)' : 'none'
                }}
              >
                {mongoSaving ? 'Connecting…' : 'Connect & Continue'}
              </button>
              {mongoError && (
                <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, textAlign: 'center', margin: '10px 0 0 0' }}>
                  {mongoError}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* AI Provider Configuration Modal */}
      {showConfigModal && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(8px)',
              zIndex: 9998
            }}
            onClick={() => setShowConfigModal(false)}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--bg-card)',
              padding: '32px',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              zIndex: 9999,
              minWidth: '500px',
              maxWidth: '90vw',
              border: '1px solid var(--border)'
            }}
          >
            <h2 style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 8px 0',
              background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textAlign: 'center'
            }}>
              AI Provider Configuration
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center' }}>
              Choose your AI provider and enter your API key to get started
            </p>

            {/* Provider Dropdown */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                Provider
              </label>
              <select
                value={provider}
                onChange={e => setProvider(e.target.value as 'anthropic' | 'gemini')}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 14,
                  borderRadius: 8,
                  border: '2px solid var(--border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <option value="anthropic">Anthropic Claude</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>

            {/* Model Selection */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                Model
              </label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 14,
                  borderRadius: 8,
                  border: '2px solid var(--border)',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                {getModelsForProvider(provider).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* API Key Input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={provider === 'anthropic' ? 'sk-ant-api03-...' : 'AIza...'}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 14,
                  borderRadius: 8,
                  border: `2px solid ${apiKey ? '#10b981' : 'var(--border)'}`,
                  fontFamily: 'monospace',
                  background: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Get your free key at{' '}
              {provider === 'anthropic' ? (
                <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', fontWeight: 600 }}>
                  console.anthropic.com
                </a>
              ) : (
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', fontWeight: 600 }}>
                  aistudio.google.com/app/apikey
                </a>
              )}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 8 }}>
              <button
                onClick={handleSaveConfig}
                disabled={!apiKey || !model}
                style={{
                  padding: '12px 32px',
                  borderRadius: 8,
                  border: 'none',
                  background: (apiKey && model) ? 'linear-gradient(135deg, #0ea5e9, #8b5cf6)' : '#ccc',
                  color: 'white',
                  cursor: (apiKey && model) ? 'pointer' : 'not-allowed',
                  fontSize: 15,
                  fontWeight: 700,
                  boxShadow: (apiKey && model) ? '0 4px 12px rgba(14, 165, 233, 0.3)' : 'none'
                }}
              >
                Save & Continue
              </button>
              {configError && (
                <p style={{ color: '#ef4444', fontSize: 20, fontWeight: 700, textAlign: 'center', margin: '10px 0 0 0' }}>
                  {configError}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="main-content">
        <TalentScanManager
          candidates={candidates}
          onRecommendationChange={handleRecommendationChange}
          onResumeUpload={handleResumeUpload}
          tokenUsage={tokenUsage}
          apiError={apiError}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode(d => !d)}
          onOpenSettings={handleOpenSettings}
          processingProgress={processingProgress}
          onExcelImport={handleExcelImport}
          onSearchCandidates={handleSearchCandidates}
          searchResults={searchResults}
          searchLoading={searchLoading}
          reportSummary={reportSummary}
          jdResumeSection={
            <JDResumeInput
              jd={jd}
              setJD={handleJDChange}
              onSubmit={handleJDSubmit}
              readonly={jdSubmitted && !editingJD}
              onEdit={handleEditJD}
              showRescan={jdChangedSinceScan && resumeFiles.length > 0}
              onRescan={handleRescanCandidates}
            />
          }
        />
      </div>
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-info">
            <span className="version">v{version}</span>
            <span className="separator">•</span>
            <span className="developer">Developed by Indranil Chatterjee</span>
            <span className="separator">•</span>
            <span className="footer-description">TalentScan — AI Candidate Intelligence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
