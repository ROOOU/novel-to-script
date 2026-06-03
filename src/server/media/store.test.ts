import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { storeMediaBuffer } from './store';

describe('media store', () => {
  let previousMediaDir: string | undefined;
  let previousMediaStorage: string | undefined;
  let previousVercel: string | undefined;
  let tempDir: string | null = null;

  beforeEach(() => {
    previousMediaDir = process.env.NOVELSCRIPT_MEDIA_DIR;
    previousMediaStorage = process.env.NOVELSCRIPT_MEDIA_STORAGE;
    previousVercel = process.env.VERCEL;
  });

  afterEach(async () => {
    restoreEnv('NOVELSCRIPT_MEDIA_DIR', previousMediaDir);
    restoreEnv('NOVELSCRIPT_MEDIA_STORAGE', previousMediaStorage);
    restoreEnv('VERCEL', previousVercel);

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('stores media inline on Vercel when no filesystem media directory is configured', async () => {
    process.env.VERCEL = '1';
    delete process.env.NOVELSCRIPT_MEDIA_DIR;
    delete process.env.NOVELSCRIPT_MEDIA_STORAGE;

    const buffer = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112]);
    const stored = await storeMediaBuffer({
      buffer,
      extension: 'mp4',
      prefix: 'videos',
    });

    expect(stored.storageKey).toBeNull();
    expect(stored.absolutePath).toBeNull();
    expect(stored.contentEncoding).toBe('base64');
    expect(stored.content).toBe(buffer.toString('base64'));
    expect(stored.byteSize).toBe(buffer.byteLength);
  });

  it('keeps filesystem media storage when a media directory is configured', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-media-store-'));
    process.env.VERCEL = '1';
    process.env.NOVELSCRIPT_MEDIA_DIR = tempDir;

    const buffer = Buffer.from('image-bytes');
    const stored = await storeMediaBuffer({
      buffer,
      extension: 'png',
      prefix: 'images',
    });

    expect(stored.storageKey).toContain('images/');
    expect(stored.content).toBeNull();
    expect(stored.contentEncoding).toBeNull();
    expect(stored.absolutePath).toContain(tempDir);
    expect(await readFile(stored.absolutePath!)).toEqual(buffer);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
