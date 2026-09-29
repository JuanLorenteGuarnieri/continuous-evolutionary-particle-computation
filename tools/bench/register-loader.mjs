// Registers ts-prefer-loader.mjs through the supported module.register() API.
// Use with:  node --experimental-strip-types --import ./tools/bench/register-loader.mjs <script>
import { register } from 'node:module';

register('./ts-prefer-loader.mjs', import.meta.url);
