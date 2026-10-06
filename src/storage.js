const fs = require('fs');
const path = require('path');

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
    return parsed;
  } catch (error) {
    const backup = `${file}.corrupt`;
    try {
      fs.copyFileSync(file, backup);
    } catch (_) {
      /* keep going with defaults */
    }
    console.error('FocusBuddy could not read settings. Using defaults.', error.message);
    return fallback;
  }
}

function saveJson(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

module.exports = { loadJson, saveJson };
