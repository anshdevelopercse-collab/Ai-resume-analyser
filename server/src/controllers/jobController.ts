import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { JobDescription } from '../models/JobDescription';
import { createJobMatch, getJobMatch, getUserJobMatches } from '../services/jobMatchService';
import { NotFoundError } from '../middleware/errorHandler';
import { isDemoMode } from '../integrations/ai';

export async function createJobDescription(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const jd = await JobDescription.create({ ...req.body, userId: req.userId });
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
    const skip = (page - 1) * limit;

    const [jds, total] = await Promise.all([
      JobDescription.find({ userId: req.userId, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      JobDescription.countDocuments({ userId: req.userId, isDeleted: false }),
    ]);

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
    const jd = await JobDescription.findOne({
      _id: req.params.id,
      userId: req.userId,
      isDeleted: false,
    });
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
    const jd = await JobDescription.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, isDeleted: false },
      req.body,
      { new: true, runValidators: true }
    );
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
    const jd = await JobDescription.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!jd) throw new NotFoundError('Job description');
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
    const match = await createJobMatch(req.userId!, resumeId, req.params.jobId as string);

    await req.user?.updateOne({ $inc: { 'usage.jobMatches': 1 } });

    res.status(202).json({
      success: true,
      data: match,
      meta: {
        demoMode: isDemoMode(),
        message: isDemoMode()
          ? 'Running in demo mode. Configure an AI provider for real matching.'
          : undefined,
      },
    });
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
