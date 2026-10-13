// Kør: node scripts/selftest-cli.mjs [antal] [seed]
import { runSelfTest, formatReport } from '../src/selftest.js';

const runs = Number(process.argv[2]) || 20000;
const seed = Number(process.argv[3]) || 2026;
const t0 = Date.now();
const res = runSelfTest({ runs, seed });
console.log(formatReport(res));
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (/FEJL/.test(formatReport(res))) process.exitCode = 1;
