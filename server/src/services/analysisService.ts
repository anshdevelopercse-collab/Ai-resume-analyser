import { getAIProvider } from '../integrations/ai';
import {
  createAnalysis,
  findAnalysisByIdempotencyKey,
  findAnalysisById,
  updateAnalysis,
  listAnalyses,
} from '../repositories/resumeAnalysisRepository';
import { findResumeForAnalysis } from '../repositories/resumeRepository';
import { NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import type { ResumeAnalysisResult } from '@resumeiq/shared';

const ANALYSIS_PROMPT_SYSTEM = `You are an expert resume analyst and career coach. Analyze the provided resume text and return a structured JSON analysis. Be specific, evidence-based, and constructive. Do not fabricate information. Return ONLY valid JSON matching the specified schema exactly.`;

function buildAnalysisPrompt(resumeText: string): string {
  return `Analyze this resume and return a JSON object with EXACTLY this structure. Do not include any text outside the JSON.

RESUME_TEXT:
${resumeText.slice(0, 8000)}

Return JSON with this exact schema:
{
  "overallScore": <0-100 integer>,
  "atsScore": <0-100 integer>,
  "formattingScore": <0-100 integer>,
  "contentScore": <0-100 integer>,
  "impactScore": <0-100 integer>,
  "sections": [{"section": string, "score": number, "maxScore": 100, "issues": string[], "suggestions": string[], "evidence": string[]}],
  "skills": {"technical": string[], "soft": string[], "domain": string[], "tools": string[]},
  "strengths": string[],
  "weaknesses": string[],
  "improvements": [{"priority": "high"|"medium"|"low", "category": string, "issue": string, "suggestion": string, "evidence": string}],
  "wordCount": number,
  "pageCount": 1,
  "hasQuantifiableAchievements": boolean,
  "scoringMethodology": "Weighted rubric: Content 30%, ATS Compatibility 25%, Formatting 20%, Impact 25%",
  "disclaimer": "Scores represent an AI assessment and are not guarantees of ATS system compatibility or hiring outcomes."
}`;
}

export async function createAnalysisJob(userId: string, resumeId: string, force = false) {
  const resume = await findResumeForAnalysis(resumeId, userId);
  if (!resume) throw new NotFoundError('Resume');

  const idempotencyKey = `analysis:${userId}:${resumeId}`;

  // Return existing if not forcing a re-analysis
  if (!force) {
    const existing = await findAnalysisByIdempotencyKey(idempotencyKey, ['completed', 'processing']);
    if (existing) return existing;
  }

  // Reset any existing record (completed, processing, or failed) rather than creating a duplicate
  const existingAny = await findAnalysisByIdempotencyKey(idempotencyKey, ['completed', 'processing', 'failed']);
  if (existingAny) {
    const reset = await updateAnalysis(existingAny.id, {
      status: 'processing',
      result: null,
      error: null,
      provider: 'pending',
      aiModel: 'pending',
    });
    processAnalysis(existingAny.id, resume.extractedText).catch(err => {
      logger.error('Analysis reprocessing failed', { error: err, analysisId: existingAny.id });
    });
    return reset;
  }

  const analysis = await createAnalysis({
    userId,
    resumeId,
    status: 'processing',
    idempotencyKey,
    provider: 'pending',
    aiModel: 'pending',
  });

  processAnalysis(analysis.id, resume.extractedText).catch(err => {
    logger.error('Analysis processing failed', { error: err, analysisId: analysis.id });
  });

  return analysis;
}

async function processAnalysis(analysisId: string, resumeText: string): Promise<void> {
  const start = Date.now();
  try {
    const provider = getAIProvider();
    const result = await provider.complete([
      { role: 'user', content: buildAnalysisPrompt(resumeText) },
    ], { systemPrompt: ANALYSIS_PROMPT_SYSTEM, maxTokens: 4000 });

    let parsed: ResumeAnalysisResult;
    try {
      const jsonText = extractJSON(result.content);
      parsed = JSON.parse(jsonText);
      validateAnalysisResult(parsed);
    } catch (parseErr) {
      logger.error('AI response parse error', { error: parseErr, content: result.content.slice(0, 200) });
      throw new Error('AI returned malformed response');
    }

    await updateAnalysis(analysisId, {
      status: 'completed',
      result: parsed,
      provider: result.provider,
      aiModel: result.model,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate,
      processingMs: Date.now() - start,
    });
  } catch (err) {
    await updateAnalysis(analysisId, {
      status: 'failed',
      error: (err as Error).message,
      processingMs: Date.now() - start,
    });
  }
}

function extractJSON(text: string): string {
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found in response');
  return text.slice(jsonStart, jsonEnd + 1);
}

function validateAnalysisResult(result: any): void {
  if (typeof result.overallScore !== 'number') throw new Error('Invalid analysis: missing overallScore');
  if (!Array.isArray(result.sections)) throw new Error('Invalid analysis: missing sections');
  if (!result.skills) throw new Error('Invalid analysis: missing skills');
  result.overallScore = Math.min(100, Math.max(0, Math.round(result.overallScore)));
  result.atsScore = Math.min(100, Math.max(0, Math.round(result.atsScore ?? 0)));
  result.formattingScore = Math.min(100, Math.max(0, Math.round(result.formattingScore ?? 0)));
  result.contentScore = Math.min(100, Math.max(0, Math.round(result.contentScore ?? 0)));
  result.impactScore = Math.min(100, Math.max(0, Math.round(result.impactScore ?? 0)));
}

export async function getAnalysis(userId: string, analysisId: string) {
  const analysis = await findAnalysisById(analysisId, userId);
  if (!analysis) throw new NotFoundError('Analysis');
  return analysis;
}

export async function getUserAnalyses(userId: string, page = 1, limit = 10, resumeId?: string) {
  const { analyses, total } = await listAnalyses(userId, page, limit, resumeId);
  return { analyses, total, page, limit, totalPages: Math.ceil(total / limit) };
}
