import { readFileSync, writeFileSync } from 'node:fs';
import { ExperimentManifest } from './ExperimentManifest.js';
export function loadExperimentManifest(path) {
    const raw = readFileSync(path, 'utf-8');
    const obj = JSON.parse(raw);
    return ExperimentManifest.fromJSON(obj);
}
export function saveExperimentManifest(manifest, path) {
    writeFileSync(path, JSON.stringify(manifest.toJSON(), null, 2), 'utf-8');
}
//# sourceMappingURL=io.js.map