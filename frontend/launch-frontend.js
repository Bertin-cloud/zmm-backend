const { spawn } = require('child_process');
const { createWriteStream } = require('fs');
const { join } = require('path');
const outPath = join(__dirname, 'frontend-launch.log');
const out = createWriteStream(outPath, { flags: 'a' });
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCmd, ['start'], {
  cwd: __dirname,
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
});
out.write(`\n=== FRONTEND LAUNCH ${new Date().toISOString()} ===\n`);
child.stdout.on('data', chunk => out.write(chunk));
child.stderr.on('data', chunk => out.write(chunk));
child.on('error', err => out.write(`ERROR: ${err.message}\n`));
child.on('exit', code => out.write(`EXIT CODE: ${code}\n`));
out.on('finish', () => {});
out.on('error', () => {});
