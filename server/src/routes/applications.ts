import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createApplication, getApplications, getApplication,
  updateApplication, deleteApplication, getApplicationStats,
} from '../controllers/applicationController';
import { applicationSchema } from '@resumeiq/shared';

const router = Router();

router.use(authenticate);

router.post('/', validate(applicationSchema), createApplication);
router.get('/', getApplications);
router.get('/stats', getApplicationStats);
router.get('/:id', getApplication);
router.put('/:id', validate(applicationSchema.partial()), updateApplication);
router.delete('/:id', deleteApplication);

export default router;
