import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Application } from '../models/Application';
import { NotFoundError } from '../middleware/errorHandler';
import { APPLICATION_STATUS } from '@resumeiq/shared';

export async function createApplication(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const app = await Application.create({ ...req.body, userId: req.userId });
    await req.user?.updateOne({ $inc: { 'usage.applications': 1 } });
    res.status(201).json({ success: true, data: app });
  } catch (err) {
    next(err);
  }
}

export async function getApplications(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: any = { userId: req.userId, isDeleted: false };
    if (req.query.status) {
      const statuses = (req.query.status as string).split(',').filter(s =>
        APPLICATION_STATUS.includes(s as any)
      );
      if (statuses.length > 0) filter.status = { $in: statuses };
    }
    if (req.query.search) {
      const q = String(req.query.search).slice(0, 100);
      filter.$or = [
        { company: { $regex: q, $options: 'i' } },
        { role: { $regex: q, $options: 'i' } },
      ];
    }

    const sortField = ['createdAt', 'company', 'appliedAt', 'status', 'deadline'].includes(
      req.query.sort as string
    ) ? req.query.sort as string : 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    const [apps, total] = await Promise.all([
      Application.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .populate('resumeId', 'originalName label')
        .populate('jobDescriptionId', 'title company'),
      Application.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: apps,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getApplication(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const app = await Application.findOne({
      _id: req.params.id,
      userId: req.userId,
      isDeleted: false,
    });
    if (!app) throw new NotFoundError('Application');
    res.json({ success: true, data: app });
  } catch (err) {
    next(err);
  }
}

export async function updateApplication(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const app = await Application.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, isDeleted: false },
      req.body,
      { new: true, runValidators: true }
    );
    if (!app) throw new NotFoundError('Application');
    res.json({ success: true, data: app });
  } catch (err) {
    next(err);
  }
}

export async function deleteApplication(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const app = await Application.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!app) throw new NotFoundError('Application');
    res.json({ success: true, message: 'Application deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getApplicationStats(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const stats = await Application.aggregate([
      { $match: { userId: req.user!._id, isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result: Record<string, number> = {};
    APPLICATION_STATUS.forEach(s => { result[s] = 0; });
    stats.forEach(s => { result[s._id] = s.count; });
    result.total = Object.values(result).reduce((a, b) => a + b, 0);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
