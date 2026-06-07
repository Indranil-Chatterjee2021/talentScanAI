import { callAI } from './pipeline';
import { ExtractionResult, NarrativeResult, ScoringResult, SkillsMatchResult } from './types';
import { parseNarrativeResult } from './schemaParsers';

const SYSTEM = `Write concise hiring bullets. Return JSON only.
Rules:
- strengths: 3-5 bullets
- weaknesses: 2-3 bullets
- each bullet <= 15 words
- concrete and evidence-based; avoid generic wording
- no markdown, no extra keys, no ending periods
Required JSON shape:
{"strengths":[""],"weaknesses":[""]}`;


export async function narrativeAgent(
  extraction: ExtractionResult,
  skillsMatch: SkillsMatchResult,
  scoring: ScoringResult
): Promise<NarrativeResult> {
  const user = `Write strengths and weaknesses for this candidate. Return a JSON object with exactly this shape:
{ "strengths": ["specific point 1", "specific point 2", "specific point 3"], "weaknesses": ["gap 1", "gap 2"] }

Rules: 3-5 strengths specific to this candidate, 2-3 weaknesses on relevant gaps, each bullet under 15 words.
Return ONLY the JSON object.

CANDIDATE: ${extraction.name} — ${extraction.currentRole} at ${extraction.currentCompany}
MATCHED: ${skillsMatch.matchedMustHave.join(', ') || 'none'}
MISSING: ${skillsMatch.missingMustHave.join(', ') || 'none'}
SCORE: ${scoring.score}/10 (${scoring.recommendation}) — ${scoring.rationale}`;

  const raw = await callAI<unknown>(SYSTEM, user, { maxTokens: 240 });
  return parseNarrativeResult(raw);
}
