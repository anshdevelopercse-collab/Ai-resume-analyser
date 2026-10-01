import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { listUsers, setUserRole, countActiveUsers } from '../repositories/userRepository';
import { countActiveResumes } from '../repositories/resumeRepository';
import { ResumeAnalysis } from '../models/ResumeAnalysis';
import { Application } from '../models/Application';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const { users, total } = await listUsers(page, limit);

    res.json({
      success: true,
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

router.get('/stats', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const totalUsers = await countActiveUsers();

    const [totalResumes, totalAnalyses, totalApplications] = await Promise.all([
      countActiveResumes(),
      ResumeAnalysis.countDocuments(),
      Application.countDocuments({ isDeleted: false }),
    ]);

    const recentAnalyses = await ResumeAnalysis.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalTokens: { $sum: '$tokensUsed' }, totalCost: { $sum: '$costEstimate' } } },
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalResumes,
        totalAnalyses,
        totalApplications,
        aiUsage: recentAnalyses[0] || { totalTokens: 0, totalCost: 0 },
      },
    });
  } catch (err) { next(err); }
});

router.patch('/users/:id/role', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      res.status(422).json({ success: false, error: 'Invalid role' });
      return;
    }
    const user = await setUserRole(req.params.id as string, role as UserRole);
    res.json({ success: true, data: { id: user.id, role: user.role } });
  } catch (err) { next(err); }
});

export default router;
