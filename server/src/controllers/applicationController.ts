import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { incrementUsage } from '../repositories/userRepository';
import {
  createApplication as createApp,
  findApplicationById,
  listApplications,
  updateApplication as updateApp,
  softDeleteApplication,
  getApplicationStats as getStats,
} from '../repositories/applicationRepository';
import { NotFoundError } from '../middleware/errorHandler';
import { APPLICATION_STATUS } from '@resumeiq/shared';
import { ApplicationStatus } from '@prisma/client';

export async function createApplication(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const app = await createApp({ ...req.body, userId: req.userId! });
    await incrementUsage(req.userId!, 'usageApplications');
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

    const statuses: ApplicationStatus[] = [];
    if (req.query.status) {
      (req.query.status as string).split(',').forEach(s => {
        if (APPLICATION_STATUS.includes(s as any)) statuses.push(s as ApplicationStatus);
      });
    }

    const search = req.query.search ? String(req.query.search).slice(0, 100) : undefined;
    const sortField = req.query.sort as string || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 'asc' : 'desc';

    const { apps, total } = await listApplications(
      req.userId!,
      { statuses: statuses.length ? statuses : undefined, search },
      { field: sortField, order: sortOrder },
      page,
      limit,
    );

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
    const app = await findApplicationById(req.params.id as string, req.userId!);
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
    const app = await updateApp(req.params.id as string, req.userId!, req.body);
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
    const deleted = await softDeleteApplication(req.params.id as string, req.userId!);
    if (!deleted) throw new NotFoundError('Application');
    res.json({ success: true, message: 'Application deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getApplicationStats(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const rows = await getStats(req.userId!);

    const result: Record<string, number> = {};
    APPLICATION_STATUS.forEach(s => { result[s] = 0; });
    rows.forEach(r => { result[r.status] = r._count.status; });
    result.total = Object.values(result).reduce((a, b) => a + b, 0);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
