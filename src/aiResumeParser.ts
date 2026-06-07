import { Candidate, RecommendationType } from './interfaces';
import { runPipeline } from './agents/pipeline';
import { TokenUsage } from './agents/types';

const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export class AIResumeParser {
  private static instance: AIResumeParser;

  private constructor() {}

  static getInstance(): AIResumeParser {
    if (!AIResumeParser.instance) AIResumeParser.instance = new AIResumeParser();
    return AIResumeParser.instance;
  }

  async parseResume(
    filename: string,
    extractedText: string,
    jd: { mustHave: string; niceToHave: string },
    config: { provider: 'anthropic' | 'gemini'; apiKey: string; model: string }
  ): Promise<{ candidate: Candidate; usage: TokenUsage; error?: string }> {
    try {
      return await runPipeline(filename, extractedText, jd, config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[TalentScan] Pipeline failed for "${filename}":`, message);
      return { candidate: this.ruleBasedFallback(filename, extractedText, jd), usage: ZERO_USAGE, error: message };
    }
  }

  // ---------------------------------------------------------------------------
  // Rule-based fallback — used when API key is absent or all agents fail
  // ---------------------------------------------------------------------------

  private ruleBasedFallback(filename: string, text: string, jd: { mustHave: string; niceToHave: string }): Candidate {
    const name = this.extractName(filename, text);
    const currentRole = this.extractRole(text);

    const mustHave = jd.mustHave.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    const niceToHave = jd.niceToHave.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    const lower = text.toLowerCase();

    const matchedMust = mustHave.filter(s => lower.includes(s));
    const missingMust = mustHave.filter(s => !lower.includes(s));
    const matchedNice = niceToHave.filter(s => lower.includes(s));

    const mustRatio = mustHave.length > 0 ? matchedMust.length / mustHave.length : 0;
    const niceRatio = niceToHave.length > 0 ? matchedNice.length / niceToHave.length : 0;
    const score = Math.max(4, Math.round((mustRatio * 7 + niceRatio * 3) * 10) / 10);

    const recommendation: RecommendationType =
      score >= 8.0 && missingMust.length <= 1 ? 'approve' :
      score < 6.0 || missingMust.length > 2 ? 'reject' : 'hold';

    const strengths = matchedMust.length > 0
      ? [`Matches key skills: ${matchedMust.slice(0, 3).join(', ')}`]
      : ['Relevant professional experience'];
    if (matchedMust.length === mustHave.length && mustHave.length > 0) strengths.unshift('Meets all must-have requirements');

    const weaknesses = missingMust.length > 0
      ? [`Missing: ${missingMust.slice(0, 3).join(', ')}`]
      : ['Further review recommended'];

    const experiences = this.extractExperiences(text, currentRole);
    return {
      id: Date.now().toString() + Math.random(),
      name,
      location: this.extractLocation(text),
      currentRole,
      currentCompany: experiences[0]?.company || 'Company not specified',
      score,
      experiences,
      strengths,
      weaknesses,
      recommendation,
    };
  }

  private extractName(filename: string, text: string): string {
    let name = filename.replace(/\.[^.]+$/, '').replace(/\s*(resume|cv)\s*$/i, '').trim();
    if (name.includes('_') && name.split('_').length <= 4) {
      name = name.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    } else {
      name = name.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    }
    if (/^(my|updated|new|final|latest|resume|cv|document|\d+|v\d+|draft|temp)$/i.test(name) || name.length < 2) {
      for (const line of text.split(/\r?\n/).slice(0, 10).map(l => l.trim()).filter(Boolean)) {
        const m = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]*){1,2})$/);
        if (m && m[1].length >= 4 && !/\b(engineer|developer|manager|software|company)\b/i.test(m[1])) return m[1];
      }
      return 'Candidate ' + Date.now().toString().slice(-4);
    }
    if (name === name.toUpperCase() || name === name.toLowerCase()) {
      name = name.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
    return name;
  }

  private extractRole(text: string): string {
    const lower = text.toLowerCase();
    const patterns: [string[], string][] = [
      [['full stack', 'fullstack'], 'Full Stack Developer'],
      [['frontend', 'front end', 'front-end'], 'Frontend Developer'],
      [['backend', 'back end', 'back-end'], 'Backend Developer'],
      [['data scientist'], 'Data Scientist'],
      [['senior developer', 'senior engineer'], 'Senior Developer'],
      [['tech lead', 'lead developer'], 'Technical Lead'],
      [['software engineer', 'software developer'], 'Software Engineer'],
    ];
    for (const [keywords, role] of patterns) {
      if (keywords.some(k => lower.includes(k))) return role;
    }
    return 'Software Professional';
  }

  private extractLocation(text: string): string {
    const cities = ['bangalore', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'pune', 'kolkata', 'gurugram', 'noida'];
    const lower = text.toLowerCase();
    for (const city of cities) {
      if (lower.includes(city)) return city.charAt(0).toUpperCase() + city.slice(1);
    }
    return 'Location not specified';
  }

  private extractExperiences(text: string, defaultRole: string): Array<{ role: string; company: string; period: string }> {
    const known = ['TCS', 'Infosys', 'Wipro', 'Cognizant', 'HCL', 'Accenture', 'IBM', 'Microsoft', 'Google', 'Amazon'];
    const found = known.filter(c => text.includes(c));
    if (found.length > 0) {
      return found.slice(0, 3).map((company, i) => ({
        role: defaultRole,
        company,
        period: i === 0 ? '2022 - Present' : `${2020 - i} - ${2022 - i}`,
      }));
    }
    return [{ role: defaultRole, company: 'Previous Company', period: '2022 - Present' }];
  }
}
