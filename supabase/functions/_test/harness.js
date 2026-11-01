// Loads a real edge function (supabase/functions/<name>/index.ts) in Node.
//
// The function's own code runs unchanged: esbuild strips the TypeScript and
// the remote imports (https://esm.sh/..., npm:...) are pointed at the small
// in-memory fakes next to this file, then the result is imported fresh. The
// harness provides the Deno and EdgeRuntime globals the function expects,
// captures the handler it passes to Deno.serve, and collects
// EdgeRuntime.waitUntil work so a test can wait for the "after the
// response" processing to finish.
//
// (Vitest externalizes https: imports before any plugin or alias sees them,
// hence rewriting the specifiers rather than aliasing them.)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = path.resolve(HERE, '..');
const OUT_DIR = path.join(HERE, '.gen'); // gitignored

const FAKES = {
  'https://esm.sh/@supabase/supabase-js@2': './fake-supabase.js',
  'npm:@sentry/deno@10.72.0': './fake-sentry.js',
  'npm:@upstash/ratelimit@2.0.8': './fake-upstash.js',
  'npm:@upstash/redis@1.38.3': './fake-upstash.js',
};

let builds = 0;

// Compiles one .ts file into OUT_DIR, rewriting its imports. Relative
// imports of other .ts files (../_shared/sentry.ts) are compiled too.
function compile(file, tag) {
  const { code } = transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'esm', sourcefile: file });
  const rewritten = code.replace(/(from\s+|import\s*\()(["'])([^"']+)\2/g, (whole, lead, quote, spec) => {
    if (FAKES[spec]) return `${lead}${quote}../${FAKES[spec].slice(2)}${quote}`;
    if (spec.startsWith('.') && spec.endsWith('.ts')) {
      return `${lead}${quote}./${compile(path.resolve(path.dirname(file), spec), tag)}${quote}`;
    }
    if (/^(https?:|npm:|jsr:)/.test(spec)) throw new Error(`No test fake for ${spec} (add one in _test/)`);
    return whole; // node: builtins
  });
  const outName = `${path.relative(FUNCTIONS_DIR, file).replace(/[\\/]/g, '__').replace(/\.ts$/, '')}.${tag}.mjs`;
  writeFileSync(path.join(OUT_DIR, outName), rewritten);
  return outName;
}

export async function loadFunction(name, env) {
  mkdirSync(OUT_DIR, { recursive: true });
  const tag = `${process.pid}-${++builds}`; // a fresh module (and module state) per load
  const entry = compile(path.join(FUNCTIONS_DIR, name, 'index.ts'), tag);

  let handler;
  const background = [];
  globalThis.Deno = {
    env: { get: (key) => env[key] },
    serve: (fn) => { handler = fn; },
  };
  globalThis.EdgeRuntime = { waitUntil: (promise) => background.push(promise) };
  await import(/* @vite-ignore */ pathToFileURL(path.join(OUT_DIR, entry)).href);
  if (!handler) throw new Error(`${name} never called Deno.serve`);
  return {
    call: (request) => handler(request),
    settle: async () => { while (background.length) await background.shift(); },
  };
}

export function unloadGlobals() {
  delete globalThis.Deno;
  delete globalThis.EdgeRuntime;
}
