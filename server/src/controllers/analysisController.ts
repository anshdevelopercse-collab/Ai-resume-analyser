import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { createAnalysis, getAnalysis, getUserAnalyses } from '../services/analysisService';
import { isDemoMode } from '../integrations/ai';

export async function startAnalysis(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const analysis = await createAnalysis(req.userId!, req.params.resumeId as string);

    await req.user?.updateOne({ $inc: { 'usage.aiAnalyses': 1 } });

    res.status(202).json({
      success: true,
      data: analysis,
      meta: {
        demoMode: isDemoMode(),
        message: isDemoMode()
          ? 'Running in demo mode. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY for real AI analysis.'
          : undefined,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAnalysisById(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const analysis = await getAnalysis(req.userId!, req.params.id as string);
    res.json({ success: true, data: analysis });
  } catch (err) {
    next(err);
  }
}

export async function listAnalyses(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const result = await getUserAnalyses(req.userId!, page, limit);

    res.json({
      success: true,
      data: result.analyses,
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
