let chalk;
try { chalk = require('chalk'); } catch {
  chalk = new Proxy({}, {
    get: (_, k) => k === 'bold'
      ? new Proxy({}, { get: () => s => s })
      : s => s
  });
}

const T = () => new Date().toISOString().substring(11, 19);

function createLogger(prefix, color = 'cyan') {
  const p = () => chalk[color](`[${prefix}][${T()}]`);
  return {
    info: msg => console.log(`${p()} ${msg}`),
    ok:   msg => console.log(`${p()} ${chalk.green(`✅ ${msg}`)}`),
    warn: msg => console.log(`${p()} ${chalk.yellow(`⚠️  ${msg}`)}`),
    err:  msg => console.log(`${p()} ${chalk.red(`❌ ${msg}`)}`),
    skip: msg => console.log(`${p()} ${chalk.gray(`⏭️  ${msg}`)}`),
    save: msg => console.log(`${p()} ${chalk.cyan(`💾 ${msg}`)}`),
  };
}

module.exports = { createLogger, chalk, T };
