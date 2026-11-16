// EMBERKEEPER — main.ts
// Hands the entry in (Node 22, stdlib only, erasable TypeScript only).
// Copies game/ and screenshots/ beside this file into the output dir and
// writes dossier.json with buildDossier from vendor/makefun-game.ts.
// The output directory's CONTENTS are emptied only — the directory itself
// is never removed (it may be a bind mount in the grader).
import { readdir, rm, mkdir, cp, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const root = dirname(fileURLToPath(import.meta.url));

async function emptyDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir);
  for (const entry of entries) {
    await rm(join(dir, entry), { recursive: true, force: true });
  }
}

await emptyDir(out);
await cp(join(root, 'game'), join(out, 'game'), { recursive: true });
await cp(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });
const dossier: string = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
await writeFile(join(out, 'dossier.json'), dossier);
