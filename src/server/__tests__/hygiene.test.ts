import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { secretResponseLeakLines } from './secretResponseGuard.js';

const ROOT = join(import.meta.dirname, '../../..');
function collect(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? collect(path)
      : /\.tsx?$/.test(path) && !path.endsWith('.d.ts')
        ? [path]
        : [];
  });
}
const files = collect(join(ROOT, 'src'));
const production = files.filter((file) => !file.includes('__tests__'));
function violations(
  paths: string[],
  inspect: (content: string, file: string) => boolean,
): string[] {
  return paths
    .filter((file) => inspect(readFileSync(file, 'utf8'), file))
    .map((file) => relative(ROOT, file));
}

describe('Repository hygiene', () => {
  it('keeps production modules at most 250 lines (static preset tables excepted)', () => {
    expect(
      violations(
        production,
        (text, file) =>
          !/Presets\.ts$|runsheet\.ts$/.test(file) && text.trimEnd().split('\n').length > 250,
      ),
    ).toEqual([]);
  });
  it('has no unsafe type escapes in production or tests', () => {
    expect(
      violations(files, (text, file) => {
        const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
        function unsafe(node: ts.Node): boolean {
          return node.kind === ts.SyntaxKind.AnyKeyword || node.getChildren(source).some(unsafe);
        }
        return unsafe(source) || /@ts-(?:ignore|nocheck)\b/.test(text);
      }),
    ).toEqual([]);
  });
  it('does not permit executable markup or dynamic code evaluation', () => {
    expect(
      violations(production, (text) =>
        /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\s*\(|\bnew\s+Function\s*\(/.test(text),
      ),
    ).toEqual([]);
  });
  it('keeps secrets and console output out of browser/shared source', () => {
    expect(
      violations(
        production.filter((file) => /src\/(?:client|shared)\//.test(file)),
        (text) => /\bconsole\s*\.|GEMINI_API_KEY/.test(text),
      ),
    ).toEqual([]);
  });
  it('has no inline React styles or embedded style elements under strict CSP', () => {
    expect(
      violations(
        production.filter((file) => file.endsWith('.tsx')),
        (text) => /\bstyle\s*=\s*\{|<style\b/.test(text),
      ),
    ).toEqual([]);
  });
  it('never serializes Gemini or Maps server credentials from HTTP routes', () => {
    const routeFiles = production.filter((file) => file.includes('/server/routes/'));
    const leaks = routeFiles.flatMap((file) =>
      secretResponseLeakLines(readFileSync(file, 'utf8')).map(
        (line) => `${relative(ROOT, file)}:${line}`,
      ),
    );
    expect(leaks).toEqual([]);
  });
  it('has no hardcoded credentials or unfinished production comments', () => {
    expect(
      violations(production, (text) =>
        /AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{48}|\/\/\s*(?:TODO|FIXME|HACK)\b/.test(text),
      ),
    ).toEqual([]);
  });
});
