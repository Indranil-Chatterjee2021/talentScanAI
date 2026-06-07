import { Filter } from "mongodb";
import crypto from "crypto";
import { dbFindMany, dbFindOneAndUpdate, ConnOpts } from "./dbStore";
import { Recommendation, Candidate, ReportSummary } from "./interfaces";

const COLLECTION = "candidates";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeRecommendation(value: unknown): Recommendation {
  if (value === "approve" || value === "hold" || value === "reject")
    return value;
  return "hold";
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function buildCandidateId(fallbackName?: string): string {
  const suffix = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 10)
    .toUpperCase();
  const prefix =
    (fallbackName || "CAND")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4) || "CAND";
  return `${prefix}-${suffix}`;
}

function normalizeCandidate(input: Partial<Candidate> | any): Candidate {
  const candidateId = input.candidateId?.trim() || buildCandidateId(input.name);

  return {
    candidateId,
    name: input.name?.trim() || "Unknown Candidate",
    location: input.location || "Location not specified",
    currentRole: input.currentRole || "Professional",
    currentCompany: input.currentCompany || "Company not specified",
    score: typeof input.score === "number" ? input.score : Number(input.score || 0),
    recommendation: normalizeRecommendation(input.recommendation),
    experiences: toArray(input.experiences),
    strengths: toArray(input.strengths),
    weaknesses: toArray(input.weaknesses),
    source: input.source?.trim() || "ai_scan",
  };
}

// ─── Public operations ───────────────────────────────────────────────────────

export async function upsertCandidates(
  inputCandidates: Partial<Candidate> | Partial<Candidate>[],
  connOpts?: ConnOpts,
): Promise<Candidate[]> {
  const candidates = (
    Array.isArray(inputCandidates) ? inputCandidates : [inputCandidates]
  ).map(normalizeCandidate);

  if (candidates.length === 0) return [];

  const now = new Date();
  const results = await Promise.all(
    candidates.map((candidate) =>
      dbFindOneAndUpdate<Candidate>(
        COLLECTION,
        { candidateId: candidate.candidateId } as Filter<Candidate>,
        {
          $set: { ...candidate, updatedDate: now },
          $setOnInsert: { createdDate: now },
        },
        { upsert: true },
        connOpts,
      ),
    ),
  );

  return results.filter(Boolean) as Candidate[];
}

export async function updateRecommendation(
  candidateId: string,
  recommendation: string,
  connOpts?: ConnOpts,
): Promise<Candidate | null> {
  const now = new Date();
  return dbFindOneAndUpdate<Candidate>(
    COLLECTION,
    { candidateId } as Filter<Candidate>,
    {
      $set: {
        recommendation: normalizeRecommendation(recommendation),
        updatedDate: now,
      },
    },
    {},
    connOpts,
  );
}

export async function searchCandidates({
  query,
  candidateId,
  limit = 25,
}: {
  query: string;
  candidateId: string;
  limit?: number;
}, connOpts?: ConnOpts): Promise<Candidate[]> {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));

  let filter: Filter<Candidate> = {};
  if (candidateId?.trim())
    filter = { candidateId: { $regex: candidateId.trim(), $options: "i" } } as Filter<Candidate>;
  else if (query?.trim())
    filter = { name: { $regex: query.trim(), $options: "i" } } as Filter<Candidate>;

  return dbFindMany<Candidate>(COLLECTION, filter, {
    sort: { createdDate: -1 },
    limit: safeLimit,
  }, connOpts);
}

export async function getReportSummary(connOpts?: ConnOpts): Promise<ReportSummary> {
  const rows = await dbFindMany<Candidate>(
    COLLECTION,
    {},
    { projection: { recommendation: 1, score: 1 } },
    connOpts,
  );

  const total = rows.length;
  const approve = rows.filter((r) => r.recommendation === "approve").length;
  const hold = rows.filter((r) => r.recommendation === "hold").length;
  const reject = rows.filter((r) => r.recommendation === "reject").length;
  const avgScore =
    total > 0
      ? rows.reduce((sum, r) => sum + Number(r.score || 0), 0) / total
      : 0;

  return {
    total,
    approve,
    hold,
    reject,
    approvalRate: total > 0 ? (approve / total) * 100 : 0,
    averageScore: Number(avgScore.toFixed(2)),
  };
}
