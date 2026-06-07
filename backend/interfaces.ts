export type Recommendation = 'approve' | 'hold' | 'reject';

export interface AiRequestBody {
  system: string;
  user: string;
  provider?: string;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

export interface ApiSettings {
  ai_configured: boolean;
  ai_provider: string;
  ai_model: string;
  ai_api_key: string;
}

export interface AppSettings {
  _id: string;
  apiSettings: ApiSettings;
  createdTime?: Date;
  updatedTime?: Date;
}

export interface Candidate {
  candidateId: string;
  name: string;
  location: string;
  currentRole: string;
  currentCompany: string;
  score: number;
  recommendation: Recommendation;
  experiences: unknown[];
  strengths: unknown[];
  weaknesses: unknown[];
  source?: string;
  createdDate?: Date;
  updatedDate?: Date;
}

export interface ReportSummary {
  total: number;
  approve: number;
  hold: number;
  reject: number;
  approvalRate: number;
  averageScore: number;
}