import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  register, login, logout, refresh,
  verifyEmailHandler, forgotPassword, resetPasswordHandler,
  getMe, updateProfile, changePasswordHandler, deleteAccount,
  autoLogin,
} from '../controllers/authController';
import {
  registerSchema, loginSchema, forgotPasswordSchema,
  resetPasswordSchema, changePasswordSchema, updateProfileSchema,
} from '@resumeiq/shared';
import { config } from '../config';

const authLimiter = rateLimit({
  windowMs: config.rateLimits.windowMs,
  max: config.rateLimits.authMax,
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Auto-login endpoint — only active when DISABLE_AUTH=true
router.get('/auto-login', autoLogin);

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', authLimiter, refresh);
router.get('/verify-email/:token', verifyEmailHandler);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPasswordHandler);

// Authenticated routes
router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePasswordHandler);
router.delete('/me', authenticate, deleteAccount);

export default router;
