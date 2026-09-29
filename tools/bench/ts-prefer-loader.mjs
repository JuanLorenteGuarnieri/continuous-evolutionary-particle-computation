/**
 * Node ESM resolve hook used by the Phase 14 CPU benchmark (and reusable by
 * other Node-side tooling) to execute the repository's TypeScript sources
 * directly with `--experimental-strip-types`, exactly as Vite would see them.
 *
 * It does two things Node's default resolver does not:
 *
 * 1. Prefers `<name>.ts` over `<name>.js` for relative specifiers ending in
 *    `.js`. The sources use the TypeScript NodeNext convention (`./foo.js`
 *    means `./foo.ts`). The repository also contains stale, checked-in compiled
 *    `.js` siblings that would otherwise shadow the real sources.
 * 2. Maps bare `@cepc/<package>` specifiers to `src/<package>/src/index.ts`
 *    (mirroring the `paths` entry in tsconfig.json), so the tooling does not
 *    depend on how node_modules/@cepc is linked.
 *
 * Usage:
 *   node --no-warnings --experimental-strip-types \
 *        --experimental-loader=./tools/bench/ts-prefer-loader.mjs <script>
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@cepc/')) {
    const packageName = specifier.slice('@cepc/'.length).split('/')[0];
    const entry = join(repoRoot, 'src', packageName, 'src', 'index.ts');
    if (existsSync(entry)) {
      return nextResolve(pathToFileURL(entry).href, context);
    }
  }

  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    specifier.endsWith('.js') &&
    context.parentURL
  ) {
    const tsSpecifier = specifier.slice(0, -3) + '.ts';
    const tsUrl = new URL(tsSpecifier, context.parentURL);
    if (tsUrl.protocol === 'file:' && existsSync(fileURLToPath(tsUrl))) {
      return nextResolve(tsSpecifier, context);
    }
  }

  return nextResolve(specifier, context);
}
