export interface PipelineJD {
  mustHave: string;
  niceToHave: string;
}

export interface ExtractionResult {
  name: string;
  location: string;
  currentRole: string;
  currentCompany: string;
  experiences: Array<{ role: string; company: string; period: string }>;
  skills: string[];
}

export interface SkillsMatchResult {
  matchedMustHave: string[];
  missingMustHave: string[];
  matchedNiceToHave: string[];
  missingNiceToHave: string[];
  matchRatio: number;
}

export interface ScoringResult {
  score: number;
  recommendation: 'approve' | 'hold' | 'reject';
  rationale: string;
}

export interface NarrativeResult {
  strengths: string[];
  weaknesses: string[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}
