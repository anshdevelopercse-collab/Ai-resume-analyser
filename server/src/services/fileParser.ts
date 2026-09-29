import { AppError } from '../middleware/errorHandler';
import { FILE_LIMITS } from '@resumeiq/shared';
import { logger } from '../utils/logger';

export interface ParsedDocument {
  text: string;
  pageCount?: number;
  wordCount: number;
  mimeType: string;
}

export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParsedDocument> {
  if (!FILE_LIMITS.ALLOWED_MIME_TYPES.includes(mimeType as any)) {
    throw new AppError(`Unsupported file type: ${mimeType}`, 415);
  }

  if (buffer.length > FILE_LIMITS.MAX_SIZE_BYTES) {
    throw new AppError(`File too large. Maximum size is ${FILE_LIMITS.MAX_SIZE_MB}MB`, 413);
  }

  if (mimeType === 'application/pdf') {
    return parsePDF(buffer);
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return parseDOCX(buffer);
  }

  throw new AppError(`Unsupported file type: ${mimeType}`, 415);
}

async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  try {
    // Dynamic import to avoid issues if module not present
    const pdfParse = await import('pdf-parse').then(m => m.default ?? m);
    const data = await pdfParse(buffer, {
      // Prevent any code execution from PDF
      max: 0,
    });

    const text = sanitizeExtractedText(data.text);
    const wordCount = countWords(text);

    return {
      text,
      pageCount: data.numpages,
      wordCount,
      mimeType: 'application/pdf',
    };
  } catch (err) {
    logger.error('PDF parse error', { error: err });
    throw new AppError('Failed to parse PDF. Please ensure the file is not password-protected or corrupted.', 422);
  }
}

async function parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });

    const text = sanitizeExtractedText(result.value);
    const wordCount = countWords(text);

    return {
      text,
      wordCount,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  } catch (err) {
    logger.error('DOCX parse error', { error: err });
    throw new AppError('Failed to parse DOCX file. Please ensure the file is not corrupted.', 422);
  }
}

function sanitizeExtractedText(text: string): string {
  return text
    .replace(/\x00/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/\t/g, '  ')
    .trim()
    .slice(0, 50000);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function validateFileMagicBytes(
  buffer: Buffer,
  expectedMimeType: string
): Promise<boolean> {
  // PDF magic bytes: %PDF
  if (expectedMimeType === 'application/pdf') {
    return buffer.slice(0, 4).toString() === '%PDF';
  }
  // DOCX magic bytes: PK (zip file)
  if (expectedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return buffer[0] === 0x50 && buffer[1] === 0x4B;
  }
  return false;
}
