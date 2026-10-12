import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

const readArg = name => {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error(`Missing --${name}`);
  }
  return process.argv[index + 1];
};

const apkPath = readArg('apk');
const versionCode = Number(readArg('version-code'));
const versionName = readArg('version-name');
const repository = readArg('repository');
const notesPath = readArg('notes-file');
const outputPath = readArg('output');
const required = process.argv.includes('--required');

if (!Number.isSafeInteger(versionCode) || versionCode < 1) {
  throw new Error('version-code must be a positive integer');
}

const [apk, notes] = await Promise.all([
  readFile(apkPath),
  readFile(notesPath, 'utf8'),
]);
const assetName = basename(apkPath);
const manifest = {
  versionCode,
  versionName,
  apkUrl: `https://github.com/${repository}/releases/download/v${versionName}/${assetName}`,
  sha256: createHash('sha256').update(apk).digest('hex').toUpperCase(),
  notes: notes.trim() || 'Cải thiện tính ổn định và trải nghiệm sử dụng.',
  required,
  publishedAt: new Date().toISOString(),
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Created ${outputPath} for ${assetName} (${manifest.sha256})`);
