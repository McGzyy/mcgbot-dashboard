const path = require('path');
const { readJson, writeJson } = require('./jsonStore');

const settingsFilePath = path.join(__dirname, '../data/scannerSettings.json');

/** @type {Record<string, unknown>} */
let _scannerSettings = {};
let _scannerSettingsHydrated = false;

async function initScannerSettingsStore() {
  if (_scannerSettingsHydrated) return;
  _scannerSettingsHydrated = true;
  try {
    const parsed = await readJson(settingsFilePath);
    _scannerSettings =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? /** @type {Record<string, unknown>} */ (parsed)
        : {};
  } catch (error) {
    const code = error && /** @type {{ code?: string }} */ (error).code;
    if (code === 'ENOENT') {
      await writeJson(settingsFilePath, {});
      _scannerSettings = {};
    } else if (error instanceof SyntaxError) {
      console.error('[ScannerSettings] Invalid JSON in scannerSettings.json:', error.message);
      _scannerSettings = {};
    } else {
      console.error('[ScannerSettings] Failed to load settings:', /** @type {Error} */ (error).message);
      _scannerSettings = {};
    }
  }
}

function loadScannerSettings() {
  if (!_scannerSettingsHydrated) {
    throw new Error('[ScannerSettings] initScannerSettingsStore() must be awaited before use');
  }
  try {
    return { ..._scannerSettings };
  } catch (error) {
    console.error('[ScannerSettings] Failed to load settings:', /** @type {Error} */ (error).message);
    return {};
  }
}

function updateScannerSetting(key, value) {
  try {
    if (!key || typeof key !== 'string') return false;
    if (!_scannerSettingsHydrated) {
      throw new Error('[ScannerSettings] initScannerSettingsStore() must be awaited before use');
    }

    _scannerSettings[key] = value;

    writeJson(settingsFilePath, _scannerSettings).catch((error) => {
      console.error('[ScannerSettings] Failed to update setting:', /** @type {Error} */ (error).message);
    });
    return true;
  } catch (error) {
    console.error('[ScannerSettings] Failed to update setting:', /** @type {Error} */ (error).message);
    return false;
  }
}

module.exports = {
  initScannerSettingsStore,
  loadScannerSettings,
  updateScannerSetting
};
