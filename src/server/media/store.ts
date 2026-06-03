import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_MEDIA_DIR = path.join(process.cwd(), '.novelscript', 'media');
const INLINE_MEDIA_STORAGE_MODE = 'inline';
const FILESYSTEM_MEDIA_STORAGE_MODE = 'filesystem';

export function getMediaStoreDirectory() {
  const configuredPath = process.env.NOVELSCRIPT_MEDIA_DIR?.trim();
  return configuredPath ? path.resolve(configuredPath) : DEFAULT_MEDIA_DIR;
}

export async function storeBrowserFile(
  file: File,
  input: {
    prefix?: string;
    extension?: string;
  } = {}
) {
  const arrayBuffer = await file.arrayBuffer();
  const extension =
    normalizeExtension(input.extension) ??
    normalizeExtension(path.extname(file.name)) ??
    extensionForMimeType(file.type) ??
    'bin';

  return storeMediaBuffer({
    buffer: Buffer.from(arrayBuffer),
    extension,
    prefix: input.prefix,
  });
}

export async function storeMediaBuffer(input: {
  buffer: Buffer;
  extension: string;
  prefix?: string;
}) {
  const checksum = createHash('sha256').update(input.buffer).digest('hex');

  if (shouldStoreMediaInline()) {
    return {
      storageKey: null,
      content: input.buffer.toString('base64'),
      contentEncoding: 'base64' as const,
      checksum,
      byteSize: input.buffer.byteLength,
      absolutePath: null,
    };
  }

  const mediaRoot = getMediaStoreDirectory();
  const extension = normalizeExtension(input.extension) ?? 'bin';
  const prefix = sanitizePrefix(input.prefix);
  const storageKey = path.posix.join(prefix, `${Date.now()}-${randomUUID()}.${extension}`);
  const targetPath = resolveStoragePath(storageKey, mediaRoot);

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, input.buffer);

  return {
    storageKey,
    content: null,
    contentEncoding: null,
    checksum,
    byteSize: input.buffer.byteLength,
    absolutePath: targetPath,
  };
}

export async function readStoredMedia(storageKey: string) {
  const absolutePath = resolveStoragePath(storageKey);
  const buffer = await readFile(absolutePath);

  return {
    buffer,
    absolutePath,
  };
}

function resolveStoragePath(storageKey: string, rootDir = getMediaStoreDirectory()) {
  const normalizedStorageKey = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  const absolutePath = path.resolve(rootDir, normalizedStorageKey);
  const rootWithSep = `${rootDir}${path.sep}`;

  if (absolutePath !== rootDir && !absolutePath.startsWith(rootWithSep)) {
    throw new Error('INVALID_STORAGE_KEY');
  }

  return absolutePath;
}

function sanitizePrefix(prefix?: string) {
  if (!prefix?.trim()) {
    return 'artifacts';
  }

  return prefix
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase())
    .join('/');
}

function normalizeExtension(extension?: string | null) {
  if (!extension) {
    return null;
  }

  const normalized = extension.replace(/^\./, '').trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function extensionForMimeType(mimeType?: string | null) {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'video/mp4':
      return 'mp4';
    default:
      return null;
  }
}

function shouldStoreMediaInline() {
  const configuredMode = process.env.NOVELSCRIPT_MEDIA_STORAGE?.trim().toLowerCase();
  if (configuredMode === INLINE_MEDIA_STORAGE_MODE) {
    return true;
  }

  if (configuredMode === FILESYSTEM_MEDIA_STORAGE_MODE) {
    return false;
  }

  return Boolean(process.env.VERCEL) && !process.env.NOVELSCRIPT_MEDIA_DIR?.trim();
}
