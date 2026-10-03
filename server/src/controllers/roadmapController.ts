import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import {
  createRoadmap,
  findRoadmapById,
  updateRoadmap,
  listRoadmaps,
  resetRoadmapForRetry,
} from '../repositories/roadmapRepository';
import { findResumeById } from '../repositories/resumeRepository';
import { findJobDescriptionById } from '../repositories/jobDescriptionRepository';
import { getAIProvider } from '../integrations/ai';
import { AppError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export async function generateRoadmap(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { resumeId, jobDescriptionId, targetRole } = req.body as {
      resumeId?: string;
      jobDescriptionId?: string;
      targetRole: string;
    };

    if (!targetRole?.trim()) {
      throw new AppError('targetRole is required', 400);
    }

    // Fail fast if no AI provider is available — avoid creating a doomed processing record
    try {
      getAIProvider();
    } catch {
      throw new AppError('No AI provider is configured on this server. Please add an ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY to the server environment.', 503);
    }

    let resumeText = '';
    let jobText = '';

    if (resumeId) {
      const resume = await findResumeById(resumeId, userId);
      if (resume?.extractedText) resumeText = resume.extractedText.slice(0, 4000);
    }

    if (jobDescriptionId) {
      const job = await findJobDescriptionById(jobDescriptionId, userId);
      if (job?.description) jobText = job.description.slice(0, 2000);
    }

    const roadmap = await createRoadmap({
      userId,
      targetRole,
      resumeId: resumeId || undefined,
      jobDescriptionId: jobDescriptionId || undefined,
      status: 'processing',
    });

    processRoadmap(roadmap.id, targetRole, resumeText, jobText).catch((err) => {
      logger.error('Roadmap processing error', { err, roadmapId: roadmap.id });
    });

    res.status(202).json({ success: true, data: roadmap });
  } catch (err) {
    next(err);
  }
}

export async function retryRoadmap(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const existing = await findRoadmapById(id as string, userId);
    if (!existing) throw new NotFoundError('Roadmap');
    if (existing.status === 'processing') {
      throw new AppError('Roadmap is already being generated', 409);
    }

    // Fail fast if no AI provider is available
    try {
      getAIProvider();
    } catch {
      throw new AppError('No AI provider is configured on this server. Please add an ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY to the server environment.', 503);
    }

    let resumeText = '';
    let jobText = '';
    if (existing.resumeId) {
      const resume = await findResumeById(existing.resumeId, userId);
      if (resume?.extractedText) resumeText = resume.extractedText.slice(0, 4000);
    }
    if (existing.jobDescriptionId) {
      const job = await findJobDescriptionById(existing.jobDescriptionId, userId);
      if (job?.description) jobText = job.description.slice(0, 2000);
    }

    const roadmap = await resetRoadmapForRetry(id as string, userId);

    processRoadmap(roadmap.id, existing.targetRole, resumeText, jobText).catch((err) => {
      logger.error('Roadmap retry processing error', { err, roadmapId: roadmap.id });
    });

    res.status(202).json({ success: true, data: roadmap });
  } catch (err) {
    next(err);
  }
}

async function processRoadmap(
  roadmapId: string,
  targetRole: string,
  resumeText: string,
  jobText: string,
): Promise<void> {
  try {
    const provider = getAIProvider();

    const prompt = `Generate a skill development roadmap for someone targeting the role: "${targetRole}".
${resumeText ? `Current resume:\n${resumeText}\n` : ''}
${jobText ? `Target job description:\n${jobText}\n` : ''}

Respond ONLY with valid JSON matching this schema:
{
  "summary": "2-3 sentence overview of the learning path",
  "skillGaps": ["skill1", "skill2"],
  "milestones": [
    {
      "id": "uuid",
      "title": "Milestone title",
      "description": "What to learn and why",
      "priority": "high|medium|low",
      "estimatedWeeks": 2,
      "resources": ["Resource 1", "Resource 2"],
      "completed": false
    }
  ]
}

Guidelines:
- 6-10 milestones ordered from foundational to advanced
- Be specific and actionable, not generic
- Each resource should be a named course, book, or practice method
- Priorities: high = critical gap, medium = important, low = nice to have
- This is practice guidance, not a guaranteed career outcome`;

    const response = await provider.complete([{ role: 'user', content: prompt }], {
      maxTokens: 2000,
      temperature: 0.5,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');

    const result = JSON.parse(jsonMatch[0]);

    const milestones = (result.milestones || []).map((m: any) => ({
      id: m.id || uuidv4(),
      title: String(m.title || '').slice(0, 200),
      description: String(m.description || '').slice(0, 500),
      priority: ['high', 'medium', 'low'].includes(m.priority) ? m.priority : 'medium',
      estimatedWeeks: typeof m.estimatedWeeks === 'number' ? Math.min(m.estimatedWeeks, 52) : undefined,
      resources: Array.isArray(m.resources) ? m.resources.slice(0, 5).map(String) : [],
      completed: false,
    }));

    await updateRoadmap(roadmapId, {
      status: 'completed',
      provider: provider.name,
      summary: String(result.summary || '').slice(0, 1000),
      skillGaps: Array.isArray(result.skillGaps) ? result.skillGaps.slice(0, 20).map(String) : [],
      milestones,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Roadmap AI processing failed', { err, roadmapId });
    await updateRoadmap(roadmapId, { status: 'failed', error: message }).catch(() => {});
  }
}

export async function getRoadmaps(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const roadmaps = await listRoadmaps(userId, limit);
    res.json({ success: true, data: roadmaps });
  } catch (err) {
    next(err);
  }
}

export async function updateMilestone(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const roadmapId = req.params.roadmapId as string;
    const milestoneId = req.params.milestoneId as string;
    const { completed } = req.body as { completed: boolean };

    const roadmap = await findRoadmapById(roadmapId, userId);
    if (!roadmap) throw new NotFoundError('Roadmap');

    const milestones = roadmap.milestones as any[];
    const milestone = milestones.find(m => m.id === milestoneId);
    if (!milestone) throw new NotFoundError('Milestone');

    milestone.completed = Boolean(completed);
    const updated = await updateRoadmap(roadmapId, { milestones });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
