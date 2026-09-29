import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { generateRoadmap, getRoadmaps, updateMilestone } from '../controllers/roadmapController';

const router = Router();

router.use(authenticate);

router.post('/generate', generateRoadmap);
router.get('/', getRoadmaps);
router.patch('/:roadmapId/milestones/:milestoneId', updateMilestone);

export default router;
