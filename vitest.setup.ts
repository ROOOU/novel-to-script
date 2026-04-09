import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const storeDir = path.join(tmpdir(), 'novelscript-vitest');
const storePath = path.join(storeDir, `store-${process.pid}.json`);

mkdirSync(storeDir, { recursive: true });
rmSync(storePath, { force: true });

process.env.NOVELSCRIPT_STORE_PATH = storePath;
delete process.env.DATABASE_URL;
