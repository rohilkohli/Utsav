import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = join(import.meta.dirname, '../../..');
const SRC = join(ROOT, 'src');

function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && entry !== '__tests__' && entry !== 'node_modules') {
      results.push(...collectFiles(full, exts));
    } else if (stat.isFile() && exts.includes(extname(entry))) {
      results.push(full);
    }
  }
  return results;
}

const PROD_FILES = collectFiles(SRC, ['.ts', '.tsx']).filter(
  (f) => !f.includes('__tests__') && !f.endsWith('.d.ts'),
);

describe('Code Hygiene', () => {
  it('has no raw console.log in production source files', () => {
    const violations: string[] = [];
    for (const file of PROD_FILES) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/console\.log\s*\(/.test(line) && !line.trimStart().startsWith('//')) {
          violations.push(`${file.replace(ROOT, '').replace(/\\/g, '/')}:${i + 1} — ${line.trim()}`);
        }
      });
    }
    expect(violations, `console.log found in prod files:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('has no hardcoded API keys or secrets (patterns)', () => {
    const patterns = [
      /AIza[0-9A-Za-z-_]{35}/,          // Google API key
      /sk-[A-Za-z0-9]{48}/,             // OpenAI secret key
      /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/, // FCM key
    ];
    const violations: string[] = [];
    for (const file of PROD_FILES) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          violations.push(`${file.replace(ROOT, '').replace(/\\/g, '/')}: possible hardcoded secret`);
        }
      }
    }
    expect(violations, `Hardcoded secrets found:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('has no leftover TODO/FIXME/HACK comments in production source', () => {
    const violations: string[] = [];
    for (const file of PROD_FILES) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/\/\/\s*(TODO|FIXME|HACK)\b/i.test(line)) {
          violations.push(`${file.replace(ROOT, '').replace(/\\/g, '/')}:${i + 1} — ${line.trim()}`);
        }
      });
    }
    expect(violations, `TODO/FIXME/HACK found in prod files:\n${violations.join('\n')}`).toHaveLength(0);
  });
});
