import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import {
  uploadResume, getResumes, getResume,
  updateResume, deleteResume, downloadResume,
} from '../controllers/resumeController';
import {
  startAnalysis, getAnalysisById, listAnalyses,
} from '../controllers/analysisController';
import { config } from '../config';
import { FILE_LIMITS } from '@resumeiq/shared';

const uploadLimiter = rateLimit({
  windowMs: config.rateLimits.windowMs,
  max: config.rateLimits.uploadMax,
  message: { success: false, error: 'Too many upload requests' },
});

const aiLimiter = rateLimit({
  windowMs: config.rateLimits.windowMs,
  max: config.rateLimits.aiMax,
  message: { success: false, error: 'Too many AI requests' },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_LIMITS.MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (FILE_LIMITS.ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX allowed.'));
    }
  },
});

const router = Router();

router.use(authenticate);

router.post('/', uploadLimiter, upload.single('file'), uploadResume);
router.get('/', getResumes);
router.get('/:id', getResume);
router.patch('/:id', updateResume);
router.delete('/:id', deleteResume);
router.get('/:id/download', downloadResume);

// Analysis routes nested under resumes
router.post('/:resumeId/analyses', aiLimiter, startAnalysis);
router.get('/analyses/all', listAnalyses);
router.get('/analyses/:id', getAnalysisById);

export default router;
