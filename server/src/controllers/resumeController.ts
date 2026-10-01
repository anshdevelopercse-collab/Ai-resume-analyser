import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { incrementUsage } from '../repositories/userRepository';
import { Resume } from '../models/Resume';
import { uploadFile, downloadFile, deleteFile } from '../integrations/storage';
import { parseDocument, validateFileMagicBytes } from '../services/fileParser';
import { NotFoundError, AppError, ForbiddenError } from '../middleware/errorHandler';
import { FILE_LIMITS } from '@resumeiq/shared';
import { logger } from '../utils/logger';

export async function uploadResume(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);

    const { buffer, originalname, mimetype, size } = req.file;

    if (size > FILE_LIMITS.MAX_SIZE_BYTES) {
      throw new AppError(`File too large. Maximum is ${FILE_LIMITS.MAX_SIZE_MB}MB`, 413);
    }

    if (!FILE_LIMITS.ALLOWED_MIME_TYPES.includes(mimetype as any)) {
      throw new AppError('Invalid file type. Please upload a PDF or DOCX file.', 415);
    }

    const isValidMagic = await validateFileMagicBytes(buffer, mimetype);
    if (!isValidMagic) {
      throw new AppError('File signature does not match declared type', 415);
    }

    const parsed = await parseDocument(buffer, mimetype, originalname);
    const storageKey = await uploadFile(buffer, originalname, mimetype);

    const resume = await Resume.create({
      userId: req.userId,
      filename: storageKey,
      originalName: originalname,
      mimeType: mimetype,
      sizeBytes: size,
      storageKey,
      extractedText: parsed.text,
      pageCount: parsed.pageCount,
      wordCount: parsed.wordCount,
    });

    // Update usage counter
    await incrementUsage(req.userId!, 'usageResumeUploads');

    res.status(201).json({
      success: true,
      data: {
        id: resume._id,
        originalName: resume.originalName,
        mimeType: resume.mimeType,
        sizeBytes: resume.sizeBytes,
        wordCount: resume.wordCount,
        pageCount: resume.pageCount,
        extractedText: resume.extractedText,
        createdAt: resume.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getResumes(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [resumes, total] = await Promise.all([
      Resume.find({ userId: req.userId, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-storageKey -extractedText'),
      Resume.countDocuments({ userId: req.userId, isDeleted: false }),
    ]);

    res.json({
      success: true,
      data: resumes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getResume(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.userId,
      isDeleted: false,
    }).select('-storageKey');

    if (!resume) throw new NotFoundError('Resume');
    res.json({ success: true, data: resume });
  } catch (err) {
    next(err);
  }
}

export async function updateResume(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.userId,
      isDeleted: false,
    });
    if (!resume) throw new NotFoundError('Resume');

    const { label, extractedText } = req.body;
    if (label !== undefined) resume.label = label;
    if (extractedText !== undefined) {
      resume.extractedText = String(extractedText).slice(0, 50000);
    }

    await resume.save();
    res.json({ success: true, data: resume });
  } catch (err) {
    next(err);
  }
}

export async function deleteResume(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.userId,
      isDeleted: false,
    });
    if (!resume) throw new NotFoundError('Resume');

    resume.isDeleted = true;
    resume.deletedAt = new Date();
    await resume.save();

    // Clean up storage file async
    deleteFile(resume.storageKey).catch(err =>
      logger.warn('Failed to delete storage file', { key: resume.storageKey, err })
    );

    res.json({ success: true, message: 'Resume deleted' });
  } catch (err) {
    next(err);
  }
}

export async function downloadResume(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.userId,
      isDeleted: false,
    });
    if (!resume) throw new NotFoundError('Resume');

    const buffer = await downloadFile(resume.storageKey);

    res.setHeader('Content-Type', resume.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${resume.originalName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
