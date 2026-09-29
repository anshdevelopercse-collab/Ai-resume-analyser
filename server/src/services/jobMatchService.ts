import { v4 as uuidv4 } from 'uuid';
import { getAIProvider } from '../integrations/ai';
import { JobMatch } from '../models/JobMatch';
import { Resume } from '../models/Resume';
import { JobDescription } from '../models/JobDescription';
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

export async function createJobMatch(
  userId: string,
  resumeId: string,
  jobDescriptionId: string
) {
  const [resume, jobDesc] = await Promise.all([
    Resume.findOne({ _id: resumeId, userId, isDeleted: false }),
    JobDescription.findOne({ _id: jobDescriptionId, userId, isDeleted: false }),
  ]);

  if (!resume) throw new NotFoundError('Resume');
  if (!jobDesc) throw new NotFoundError('Job description');

  const idempotencyKey = `match:${userId}:${resumeId}:${jobDescriptionId}:${uuidv4()}`;

  const match = await JobMatch.create({
    userId,
    resumeId,
    jobDescriptionId,
    status: 'processing',
    idempotencyKey,
    provider: 'pending',
    aiModel: 'pending',
  });

  processMatch(match._id.toString(), resume.extractedText, jobDesc.description).catch(err => {
    logger.error('Job match processing failed', { error: err, matchId: match._id });
  });

  return match;
}

async function processMatch(matchId: string, resumeText: string, jobDescription: string): Promise<void> {
  const match = await JobMatch.findById(matchId);
  if (!match) return;

  const start = Date.now();

  try {
    const provider = getAIProvider();
    const result = await provider.complete([
      { role: 'user', content: buildMatchPrompt(resumeText, jobDescription) },
    ], { systemPrompt: MATCH_PROMPT_SYSTEM });

    const jsonText = result.content.slice(result.content.indexOf('{'), result.content.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonText);
    parsed.matchScore = Math.min(100, Math.max(0, Math.round(parsed.matchScore)));
    parsed.keywordCoverage = Math.min(100, Math.max(0, Math.round(parsed.keywordCoverage)));

    match.status = 'completed';
    match.result = parsed;
    match.provider = result.provider;
    match.aiModel = result.model;
    match.tokensUsed = result.tokensUsed;
    match.costEstimate = result.costEstimate;
    await match.save();
  } catch (err) {
    match.status = 'failed';
    match.error = (err as Error).message;
    await match.save();
  }
}

export async function getJobMatch(userId: string, matchId: string) {
  const match = await JobMatch.findOne({ _id: matchId, userId })
    .populate('resumeId', 'originalName label')
    .populate('jobDescriptionId', 'title company');
  if (!match) throw new NotFoundError('Job match');
  return match;
}

export async function getUserJobMatches(userId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [matches, total] = await Promise.all([
    JobMatch.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('resumeId', 'originalName label')
      .populate('jobDescriptionId', 'title company'),
    JobMatch.countDocuments({ userId }),
  ]);

  return { matches, total, page, limit, totalPages: Math.ceil(total / limit) };
}
