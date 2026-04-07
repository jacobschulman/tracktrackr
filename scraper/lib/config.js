const fs = require('fs');
const path = require('path');

function loadFestival(name) {
  const file = path.join(__dirname, '..', 'festivals', `${name}.json`);
  if (!fs.existsSync(file)) {
    console.error(`Festival config not found: ${file}`);
    console.error(`Available festivals:`);
    const dir = path.join(__dirname, '..', 'festivals');
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f =>
        console.error(`  - ${f.replace('.json', '')}`)
      );
    }
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Validate required fields
  const required = ['name', 'displayName', 'sourceId', 'outputDir', 'filenameSuffix'];
  for (const field of required) {
    if (!config[field]) {
      console.error(`Festival config missing required field: ${field}`);
      process.exit(1);
    }
  }

  return Object.freeze(config);
}

module.exports = { loadFestival };
