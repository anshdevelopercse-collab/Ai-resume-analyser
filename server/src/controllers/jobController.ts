import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { incrementUsage } from '../repositories/userRepository';
import {
  createJobDescription as createJD,
  findJobDescriptionById,
  listJobDescriptions,
  updateJobDescription as updateJD,
  softDeleteJobDescription,
} from '../repositories/jobDescriptionRepository';
import { createJobMatchJob, getJobMatch, getUserJobMatches } from '../services/jobMatchService';
import { NotFoundError } from '../middleware/errorHandler';

export async function createJobDescription(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const jd = await createJD({ ...req.body, userId: req.userId! });
    res.status(201).json({ success: true, data: jd });
  } catch (err) {
    next(err);
  }
}

export async function getJobDescriptions(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const { jds, total } = await listJobDescriptions(req.userId!, page, limit);

    res.json({
      success: true,
      data: jds,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getJobDescription(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const jd = await findJobDescriptionById(req.params.id as string, req.userId!);
    if (!jd) throw new NotFoundError('Job description');
    res.json({ success: true, data: jd });
  } catch (err) {
    next(err);
  }
}

export async function updateJobDescription(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const jd = await updateJD(req.params.id as string, req.userId!, req.body);
    if (!jd) throw new NotFoundError('Job description');
    res.json({ success: true, data: jd });
  } catch (err) {
    next(err);
  }
}

export async function deleteJobDescription(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const deleted = await softDeleteJobDescription(req.params.id as string, req.userId!);
    if (!deleted) throw new NotFoundError('Job description');
    res.json({ success: true, message: 'Job description deleted' });
  } catch (err) {
    next(err);
  }
}

export async function startJobMatch(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { resumeId } = req.body;
    const match = await createJobMatchJob(req.userId!, resumeId, req.params.jobId as string);

    await incrementUsage(req.userId!, 'usageJobMatches');

    res.status(202).json({ success: true, data: match });
  } catch (err) {
    next(err);
  }
}

export async function getJobMatchById(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const match = await getJobMatch(req.userId!, req.params.id as string);
    res.json({ success: true, data: match });
  } catch (err) {
    next(err);
  }
}

export async function listJobMatches(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const result = await getUserJobMatches(req.userId!, page, limit);

    res.json({
      success: true,
      data: result.matches,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
}
