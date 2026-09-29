import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import {
  generateInterviewQuestions, getInterviewSessions,
  getInterviewSession, submitAnswer,
} from '../controllers/interviewController';
import { config } from '../config';

const aiLimiter = rateLimit({
  windowMs: config.rateLimits.windowMs,
  max: config.rateLimits.aiMax,
  message: { success: false, error: 'Too many AI requests' },
});

const router = Router();

router.use(authenticate);

router.post('/generate', aiLimiter, generateInterviewQuestions);
router.get('/', getInterviewSessions);
router.get('/:id', getInterviewSession);
router.post('/:id/answers', submitAnswer);

export default router;
