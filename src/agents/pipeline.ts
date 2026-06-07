import { Candidate, RecommendationType } from '../interfaces';
import { NarrativeResult, PipelineJD, ScoringResult, SkillsMatchResult, TokenUsage } from './types';
import { extractionAgent } from './extractionAgent';
import { narrativeAgent } from './narrativeAgent';

// Accumulates token usage for one runPipeline invocation. Reset at the start of each call.
let _runUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
let _config: { provider: 'anthropic' | 'gemini'; apiKey: string; model: string } | undefined;

interface CallAIOptions {
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// AI call — routed through the local proxy server (avoids browser CORS)
// ---------------------------------------------------------------------------

function parseJsonResponse(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1));
    }
    throw new Error(`Agent returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}

export async function callAI<T>(system: string, user: string, options: CallAIOptions = {}): Promise<T> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      user,
      provider: _config?.provider || 'anthropic',
      apiKey: _config?.apiKey,
      model: _config?.model,
      maxTokens: options.maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const data = await res.json() as {
    content: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens: number;
      cache_creation_input_tokens: number;
    };
  };

  _runUsage.inputTokens     += data.usage.input_tokens;
  _runUsage.outputTokens    += data.usage.output_tokens;
  _runUsage.cacheReadTokens  += data.usage.cache_read_input_tokens  ?? 0;
  _runUsage.cacheWriteTokens += data.usage.cache_creation_input_tokens ?? 0;

  return parseJsonResponse(data.content) as T;
}

function selectResumeContext(text: string, maxChars = 3200): string {
  if (text.length <= maxChars) return text;

  const sectionHeader = /^(summary|profile|experience|work experience|employment|skills|technical skills|projects|education|certifications)\b/i;
  const signalLine = /(skills?|experience|projects?|technologies|stack|years?|worked|engineer|developer|manager|lead|architect)/i;
  const contactLine = /(@|linkedin|github|phone|\+\d|\b[a-z]{2,}\s*,\s*[a-z]{2,}\b)/i;
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);

  const picked: string[] = [];
  let budget = maxChars;
  const push = (line: string) => {
    if (!line || budget <= 0) return;
    const chunk = line.length > 240 ? line.slice(0, 240) : line;
    const cost = chunk.length + 1;
    if (cost <= budget) {
      picked.push(chunk);
      budget -= cost;
    }
  };

  // Keep top lines for identity/contact.
  lines.slice(0, 20).forEach(line => {
    if (contactLine.test(line) || picked.length < 8) push(line);
  });

  // Prefer lines under key section headers.
  let includeSection = false;
  for (const line of lines) {
    if (sectionHeader.test(line)) {
      includeSection = true;
      push(line);
      continue;
    }
    if (includeSection && signalLine.test(line)) push(line);
    if (budget <= 0) break;
  }

  if (picked.length === 0) return text.slice(0, maxChars);
  return picked.join('\n').slice(0, maxChars);
}

// ---------------------------------------------------------------------------
// Local fallbacks (used when an agent call fails)
// ---------------------------------------------------------------------------

function localSkillsMatch(skills: string[], jd: PipelineJD): SkillsMatchResult {
  const mustHave = jd.mustHave.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const niceToHave = jd.niceToHave.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const lower = skills.map(s => s.toLowerCase().trim());

  const aliases: Record<string, string[]> = {
    react: ['react', 'react.js', 'reactjs'],
    javascript: ['javascript', 'js', 'ecmascript'],
    typescript: ['typescript', 'ts'],
    node: ['node', 'node.js', 'nodejs'],
    python: ['python', 'python3', 'py'],
    aws: ['aws', 'amazon web services'],
    postgresql: ['postgresql', 'postgres', 'psql'],
    mongodb: ['mongodb', 'mongo', 'mongo db'],
  };

  const tokenized = lower.flatMap(s => s.split(/[\s,/|]+/).filter(Boolean));
  const hasSkill = (required: string) => {
    const norm = required.trim().toLowerCase();
    const options = aliases[norm] || [norm];
    return options.some(opt => lower.some(sk => sk.includes(opt) || opt.includes(sk)))
      || options.some(opt => tokenized.includes(opt));
  };

  const matches = (list: string[]) => list.filter(hasSkill);
  const missing = (list: string[]) => list.filter(s => !hasSkill(s));

  const matchedMustHave = matches(mustHave);
  return {
    matchedMustHave,
    missingMustHave:  missing(mustHave),
    matchedNiceToHave: matches(niceToHave),
    missingNiceToHave: missing(niceToHave),
    matchRatio: mustHave.length > 0 ? matchedMustHave.length / mustHave.length : 0,
  };
}

function localScore(sm: SkillsMatchResult): ScoringResult {
  const niceTotal = sm.matchedNiceToHave.length + sm.missingNiceToHave.length;
  const niceRatio = niceTotal > 0 ? sm.matchedNiceToHave.length / niceTotal : 0;
  const score = Math.max(4, Math.min(10, Math.round((sm.matchRatio * 7 + niceRatio * 3) * 10) / 10));

  const recommendation: 'approve' | 'hold' | 'reject' =
    score >= 8.0 && sm.missingMustHave.length <= 1 ? 'approve' :
    score <  6.0 || sm.missingMustHave.length >  2 ? 'reject' : 'hold';

  return { score, recommendation, rationale: 'Computed from skills match ratio' };
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function runPipeline(
  filename: string,
  text: string,
  jd: PipelineJD,
  config: { provider: 'anthropic' | 'gemini'; apiKey: string; model: string }
): Promise<{ candidate: Candidate; usage: TokenUsage }> {
  _runUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  _config = config;

  // Agent 1 — hard fallback handled by caller (aiResumeParser.ts)
  const extractionInput = selectResumeContext(text, 3200);
  const extraction = await extractionAgent(extractionInput, filename);

  // Step 2 — deterministic local skills matching (no AI call)
  const skillsMatch = localSkillsMatch(extraction.skills, jd);

  // Step 3 — deterministic local scoring (no AI call)
  const scoring = localScore(skillsMatch);

  // Agent 4 — optional AI narrative with local fallback
  let narrative: NarrativeResult;
  try {
    narrative = await narrativeAgent(extraction, skillsMatch, scoring);
  } catch {
    narrative = {
      strengths: [
        skillsMatch.matchedMustHave.length > 0
          ? `Matches key skills: ${skillsMatch.matchedMustHave.slice(0, 3).join(', ')}`
          : 'Relevant technical experience',
      ],
      weaknesses: [
        skillsMatch.missingMustHave.length > 0
          ? `Missing: ${skillsMatch.missingMustHave.slice(0, 3).join(', ')}`
          : 'Review manually',
      ],
    };
  }

  const candidate: Candidate = {
    id: Date.now().toString() + Math.random(),
    name: extraction.name,
    location: extraction.location,
    currentRole: extraction.currentRole,
    currentCompany: extraction.currentCompany,
    experiences: extraction.experiences.length > 0
      ? extraction.experiences
      : [{ role: extraction.currentRole, company: extraction.currentCompany, period: '2022 - Present' }],
    score: scoring.score,
    recommendation: scoring.recommendation as RecommendationType,
    strengths: narrative.strengths,
    weaknesses: narrative.weaknesses,
  };

  return { candidate, usage: { ..._runUsage } };
}
