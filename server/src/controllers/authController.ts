import { Request, Response, NextFunction } from 'express';
import {
  registerUser, loginUser, refreshUserTokens,
  verifyEmail, initiatePasswordReset, resetPassword,
  changePassword,
} from '../services/authService';
import { revokeRefreshToken, generateTokenPair } from '../services/tokenService';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { config } from '../config';
import { emailService } from '../integrations/email';
import { AppError } from '../middleware/errorHandler';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: (config.isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, verificationToken } = await registerUser(req.body);

    await emailService.sendVerificationEmail(user.email, verificationToken, user.firstName);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, tokens } = await loginUser(
      req.body,
      req.headers['user-agent'],
      req.ip
    );

    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTS);

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          plan: user.plan,
          emailVerified: user.emailVerified,
          avatarUrl: user.avatarUrl,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    res.clearCookie('refreshToken', COOKIE_OPTS);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ success: false, error: 'Refresh token required' });
      return;
    }

    const tokens = await refreshUserTokens(
      refreshToken,
      req.headers['user-agent'],
      req.ip
    );

    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTS);
    res.json({ success: true, data: { accessToken: tokens.accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function verifyEmailHandler(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const token = req.params.token as string;
    await verifyEmail(token);
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { email } = req.body;
    const token = await initiatePasswordReset(email);

    if (token) {
      const user = await User.findOne({ email });
      if (user) {
        await emailService.sendPasswordResetEmail(email, token, user.firstName);
      }
    }

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If that email exists, a reset link has been sent.',
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPasswordHandler(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { token, password } = req.body;
    await resetPassword(token, password);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        plan: user.plan,
        emailVerified: user.emailVerified,
        avatarUrl: user.avatarUrl,
        usage: user.usage,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;
    const { firstName, lastName, avatarUrl } = req.body;

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl ?? undefined;

    await user.save();
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    await changePassword(req.userId!, req.body.currentPassword, req.body.newPassword);
    res.clearCookie('refreshToken', COOKIE_OPTS);
    res.json({ success: true, message: 'Password changed. Please log in again.' });
  } catch (err) {
    next(err);
  }
}

export async function autoLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!config.disableAuth) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    const demoUser = await User.findOne({ email: 'demo@resumeiq.local' });
    if (!demoUser) {
      res.status(503).json({ success: false, error: 'Demo user not initialized. Restart the server.' });
      return;
    }

    const tokens = await generateTokenPair(String(demoUser._id), demoUser.role);
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTS);

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        user: {
          id: demoUser._id,
          email: demoUser.email,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          role: demoUser.role,
          plan: demoUser.plan,
          emailVerified: demoUser.emailVerified,
          avatarUrl: demoUser.avatarUrl,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAccount(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const user = req.user!;
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();
    res.clearCookie('refreshToken', COOKIE_OPTS);
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
}
