import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createJobDescription, getJobDescriptions, getJobDescription,
  updateJobDescription, deleteJobDescription,
  startJobMatch, getJobMatchById, listJobMatches,
} from '../controllers/jobController';
import { jobDescriptionSchema } from '@resumeiq/shared';
import { config } from '../config';

const aiLimiter = rateLimit({
  windowMs: config.rateLimits.windowMs,
  max: config.rateLimits.aiMax,
  message: { success: false, error: 'Too many AI requests' },
});

const router = Router();

router.use(authenticate);

router.post('/', validate(jobDescriptionSchema), createJobDescription);
router.get('/', getJobDescriptions);
router.get('/matches', listJobMatches);
router.get('/matches/:id', getJobMatchById);
router.get('/:id', getJobDescription);
router.put('/:id', validate(jobDescriptionSchema), updateJobDescription);
router.delete('/:id', deleteJobDescription);
router.post('/:jobId/match', aiLimiter, startJobMatch);

export default router;
