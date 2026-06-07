import { ExtractionResult, NarrativeResult } from './types';

function asString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => asString(v))
    .filter(Boolean)
    .map(v => v.replace(/\s+/g, ' ').trim());
}

function asExperiences(value: unknown): Array<{ role: string; company: string; period: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const obj = (item && typeof item === 'object') ? item as Record<string, unknown> : {};
      const role = asString(obj.role);
      const company = asString(obj.company);
      const period = asString(obj.period);
      if (!role && !company && !period) return null;
      return {
        role: role || 'Professional',
        company: company || 'Company not specified',
        period: period || 'Period not specified',
      };
    })
    .filter((x): x is { role: string; company: string; period: string } => x !== null)
    .slice(0, 5);
}

export function parseExtractionResult(raw: unknown, filename: string): ExtractionResult {
  const obj = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  return {
    name: asString(obj.name, filename.replace(/\.[^.]+$/, '')),
    location: asString(obj.location, 'Location not specified'),
    currentRole: asString(obj.currentRole, 'Professional'),
    currentCompany: asString(obj.currentCompany, 'Company not specified'),
    experiences: asExperiences(obj.experiences),
    skills: asStringArray(obj.skills),
  };
}

function normalizeBullet(s: string): string {
  const cleaned = s.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function parseNarrativeResult(raw: unknown): NarrativeResult {
  const obj = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const strengths = asStringArray(obj.strengths).map(normalizeBullet).filter(Boolean).slice(0, 5);
  const weaknesses = asStringArray(obj.weaknesses).map(normalizeBullet).filter(Boolean).slice(0, 3);

  return {
    strengths: strengths.length > 0 ? strengths : ['Strong technical background'],
    weaknesses: weaknesses.length > 0 ? weaknesses : ['Review manually'],
  };
}
