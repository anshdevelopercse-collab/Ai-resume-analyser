import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { Roadmap } from '../models/Roadmap';
import { Resume } from '../models/Resume';
import { JobDescription } from '../models/JobDescription';
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

    let resumeText = '';
    let jobText = '';

    if (resumeId) {
      const resume = await Resume.findOne({ _id: resumeId, userId, isDeleted: false });
      if (resume?.extractedText) resumeText = resume.extractedText.slice(0, 4000);
    }

    if (jobDescriptionId) {
      const job = await JobDescription.findOne({ _id: jobDescriptionId, userId });
      if (job?.description) jobText = job.description.slice(0, 2000);
    }

    const roadmap = await Roadmap.create({
      userId,
      targetRole,
      resumeId: resumeId || undefined,
      jobDescriptionId: jobDescriptionId || undefined,
      status: 'processing',
    });

    processRoadmap(roadmap._id.toString(), targetRole, resumeText, jobText, userId).catch((err) => {
      logger.error('Roadmap processing error', { err, roadmapId: roadmap._id });
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
  _userId: string,
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

    await Roadmap.findByIdAndUpdate(roadmapId, {
      status: 'completed',
      provider: provider.name,
      summary: String(result.summary || '').slice(0, 1000),
      skillGaps: Array.isArray(result.skillGaps) ? result.skillGaps.slice(0, 20).map(String) : [],
      milestones,
    });
  } catch (err) {
    logger.error('Roadmap AI processing failed', { err, roadmapId });
    await Roadmap.findByIdAndUpdate(roadmapId, { status: 'failed' });
  }
}

export async function getRoadmaps(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const roadmaps = await Roadmap.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, data: roadmaps });
  } catch (err) {
    next(err);
  }
}

export async function updateMilestone(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const { roadmapId, milestoneId } = req.params;
    const { completed } = req.body as { completed: boolean };

    const roadmap = await Roadmap.findOne({ _id: roadmapId, userId });
    if (!roadmap) throw new NotFoundError('Roadmap');

    const milestone = roadmap.milestones.find(m => m.id === milestoneId);
    if (!milestone) throw new NotFoundError('Milestone');

    milestone.completed = Boolean(completed);
    await roadmap.save();

    res.json({ success: true, data: roadmap });
  } catch (err) {
    next(err);
  }
}
