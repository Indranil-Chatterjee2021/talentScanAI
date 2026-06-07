import { callAI } from "./pipeline";
import { ExtractionResult } from "./types";
import { parseExtractionResult } from './schemaParsers';

const SYSTEM = `Extract structured resume data. Return JSON only.
Rules:
- Use only facts from input text.
- No markdown, no comments, no extra keys.
- If unknown use defaults:
  name: filename without extension
  location: "Location not specified"
  currentRole: "Professional"
  currentCompany: "Company not specified"
  experiences: []
  skills: []
- experiences: max 5, most recent first, each item {role, company, period}.
- skills: deduplicated array of concrete skill names.
Required JSON shape:
{"name":"","location":"","currentRole":"","currentCompany":"","experiences":[{"role":"","company":"","period":""}],"skills":[""]}`;


export async function extractionAgent(
  resumeText: string,
  filename: string,
): Promise<ExtractionResult> {
  const user = `Extract information from this resume and return a JSON object with exactly this shape:
{
  "name": "Full name (use filename if unclear)",
  "location": "City, Country or 'Location not specified'",
  "currentRole": "Most recent job title",
  "currentCompany": "Most recent employer",
  "experiences": [{ "role": "job title", "company": "company name", "period": "e.g. Jan 2020 - Present" }],
  "skills": ["skill1", "skill2"]
}
Rules: extract REAL names/companies/dates from text, no placeholders, up to 5 experiences most-recent-first, filename "${filename}" only if text is unreadable.
Return ONLY the JSON object.

RESUME TEXT:
${resumeText}`;

  const raw = await callAI<unknown>(SYSTEM, user, { maxTokens: 480 });
  return parseExtractionResult(raw, filename);
}
