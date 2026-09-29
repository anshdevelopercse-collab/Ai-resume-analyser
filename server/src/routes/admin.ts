import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { User } from '../models/User';
import { Resume } from '../models/Resume';
import { ResumeAnalysis } from '../models/ResumeAnalysis';
import { Application } from '../models/Application';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('email firstName lastName role plan emailVerified usage createdAt'),
      User.countDocuments({ isDeleted: false }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

router.get('/stats', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, totalResumes, totalAnalyses, totalApplications] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      Resume.countDocuments({ isDeleted: false }),
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
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: { id: user._id, role: user.role } });
  } catch (err) { next(err); }
});

export default router;
