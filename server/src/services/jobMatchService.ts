import { getAIProvider } from '../integrations/ai';
import {
  createJobMatch,
  findJobMatchByIdempotencyKey,
  findJobMatchById,
  updateJobMatch,
  listJobMatches,
} from '../repositories/jobMatchRepository';
import { findResumeById } from '../repositories/resumeRepository';
import { findJobDescriptionById } from '../repositories/jobDescriptionRepository';
import { NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const MATCH_PROMPT_SYSTEM = `You are an expert career advisor. Analyze the match between a resume and job description. Return structured JSON only.`;

function buildMatchPrompt(resumeText: string, jobDescription: string): string {
  return `Analyze how well this resume matches the job description. Return ONLY JSON.

RESUME:
${resumeText.slice(0, 4000)}

JOB_DESCRIPTION:
${jobDescription.slice(0, 3000)}

Return JSON with this exact schema:
{
  "matchScore": <0-100 integer>,
  "matchingSkills": string[],
  "missingSkills": string[],
  "relevantExperience": [{"item": string, "relevance": string}],
  "keywordCoverage": <0-100 integer>,
  "qualificationGaps": string[],
  "suggestedEdits": [{"section": string, "original": string, "suggested": string, "reason": string}],
  "summary": string,
  "disclaimer": "Match scores are AI-generated estimates and do not predict hiring decisions. Do not fabricate qualifications."
}`;
}

export async function createJobMatchJob(
  userId: string,
  resumeId: string,
  jobDescriptionId: string,
) {
  const [resume, jobDesc] = await Promise.all([
    findResumeById(resumeId, userId),
    findJobDescriptionById(jobDescriptionId, userId),
  ]);
  if (!resume) throw new NotFoundError('Resume');
  if (!jobDesc) throw new NotFoundError('Job description');

  const idempotencyKey = `match:${userId}:${resumeId}:${jobDescriptionId}`;
  const existing = await findJobMatchByIdempotencyKey(idempotencyKey, ['completed', 'processing']);
  if (existing) return existing;

  const match = await createJobMatch({
    userId,
    resumeId,
    jobDescriptionId,
    status: 'processing',
    idempotencyKey,
    provider: 'pending',
    aiModel: 'pending',
  });

  processMatch(match.id, resume.extractedText, jobDesc.description).catch(err => {
    logger.error('Job match processing failed', { error: err, matchId: match.id });
  });

  return match;
}

async function processMatch(matchId: string, resumeText: string, jobDescription: string): Promise<void> {
  try {
    const provider = getAIProvider();
    const result = await provider.complete([
      { role: 'user', content: buildMatchPrompt(resumeText, jobDescription) },
    ], { systemPrompt: MATCH_PROMPT_SYSTEM });

    const jsonText = result.content.slice(result.content.indexOf('{'), result.content.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonText);
    parsed.matchScore = Math.min(100, Math.max(0, Math.round(parsed.matchScore)));
    parsed.keywordCoverage = Math.min(100, Math.max(0, Math.round(parsed.keywordCoverage)));

    await updateJobMatch(matchId, {
      status: 'completed',
      result: parsed,
      provider: result.provider,
      aiModel: result.model,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate,
    });
  } catch (err) {
    await updateJobMatch(matchId, {
      status: 'failed',
      error: (err as Error).message,
    });
  }
}

export async function getJobMatch(userId: string, matchId: string) {
  const match = await findJobMatchById(matchId, userId);
  if (!match) throw new NotFoundError('Job match');
  return match;
}

export async function getUserJobMatches(userId: string, page = 1, limit = 10) {
  const { matches, total } = await listJobMatches(userId, page, limit);
  return { matches, total, page, limit, totalPages: Math.ceil(total / limit) };
}
