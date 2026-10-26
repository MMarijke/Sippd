// Syntax-checks every Supabase edge function (supabase/functions/**/*.ts)
// with esbuild, which Vite already installs. Edge functions are Deno code
// outside the Vite build, so nothing else in CI parses them: a syntax error
// only surfaced after merge, as the Supabase Preview check's "failed to
// bundle function" (2026-10-26, a stray "})" in image-proxy). This catches
// that class on the PR. It checks syntax only, not types; `supabase
// functions deploy` still type-checks with Deno.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { transformSync } from 'esbuild';

const ROOT = 'supabase/functions';

function tsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsFiles(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

let failed = 0;
for (const file of tsFiles(ROOT)) {
  try {
    transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'esm', sourcefile: file });
    console.log(`ok    ${file}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${file}`);
    for (const err of e.errors ?? []) {
      console.error(`      line ${err.location?.line ?? '?'}: ${err.text}`);
    }
  }
}

if (failed) {
  console.error(`\n${failed} edge function file(s) failed to parse.`);
  process.exit(1);
}
