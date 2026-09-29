import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface StorageFile {
  key: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export interface StorageProvider {
  upload(file: StorageFile): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor() {
    this.basePath = config.storage.localPath;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async upload(file: StorageFile): Promise<string> {
    await this.ensureDir();
    const ext = path.extname(file.filename);
    const key = `${uuidv4()}${ext}`;
    const filePath = path.join(this.basePath, key);
    await fs.writeFile(filePath, file.buffer);
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, key);
    return fs.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

let _storageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (_storageProvider) return _storageProvider;
  _storageProvider = new LocalStorageProvider();
  return _storageProvider;
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  return getStorageProvider().upload({ key: '', buffer, mimeType, filename });
}

export async function downloadFile(key: string): Promise<Buffer> {
  return getStorageProvider().download(key);
}

export async function deleteFile(key: string): Promise<void> {
  return getStorageProvider().delete(key);
}
