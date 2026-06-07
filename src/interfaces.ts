import { TokenUsage } from './agents/types';

export interface JDState {
  mustHave: string;
  niceToHave: string;
}

export interface Experience {
  role: string;
  company: string;
  period: string;
  logo?: string;
}

export type RecommendationType = 'approve' | 'hold' | 'reject';

export interface Candidate {
  id: string;
  candidateId?: string;
  name: string;
  location: string;
  currentRole: string;
  currentCompany: string;
  score: number;
  experiences: Experience[];
  strengths: string[];
  weaknesses: string[];
  recommendation: RecommendationType;
  resumeFile?: File;
  resumeFileName?: string;
}

export interface SearchResultItem {
  candidateId: string;
  name: string;
  recommendation: RecommendationType;
  score: number;
  createdAt?: string;
}

export interface ReportSummary {
  total: number;
  approve: number;
  hold: number;
  reject: number;
  approvalRate: number;
  averageScore: number;
}

export interface ProcessingProgress {
  completed: number;
  total: number;
  activeFiles: string[];
}

export interface TalentScanManagerProps {
  candidates: Candidate[];
  onRecommendationChange: (candidateId: string, recommendation: RecommendationType) => void;
  onResumeUpload: (files: File[]) => Promise<void>;
  jdResumeSection?: React.ReactNode;
  tokenUsage?: TokenUsage;
  apiError?: string;
  darkMode?: boolean;
  onToggleTheme?: () => void;
  onOpenSettings?: () => void;
  processingProgress?: ProcessingProgress | null;
  onExcelImport?: (file: File) => Promise<void>;
  onSearchCandidates?: (query: string, mode: 'name' | 'id') => Promise<void>;
  searchResults?: SearchResultItem[];
  searchLoading?: boolean;
  reportSummary?: ReportSummary | null;
}

export interface ReportsPageProps {}

export interface ReportRow {
  candidateId: string;
  name: string;
  currentRole: string;
  currentCompany: string;
  location: string;
  score: number;
  recommendation: RecommendationType;
  createdAt: string;
}

export interface JDResumeInputProps {
  jd: JDState;
  setJD: (jd: JDState) => void;
  onSubmit: (e: React.FormEvent) => void;
  readonly: boolean;
  onEdit: () => void;
  onRescan?: () => void;
  showRescan?: boolean;
}
