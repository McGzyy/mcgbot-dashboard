'use strict';

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/** @type {Map<string, Promise<unknown>>} */
const fileChains = new Map();

/**
 * @param {string} absPath
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 * @template T
 */
function enqueueFileTask(absPath, task) {
  const prev = fileChains.get(absPath) || Promise.resolve();
  const next = prev.then(() => task());
  fileChains.set(absPath, next.catch(() => {}));
  return next;
}

/**
 * @param {string} absPath
 * @param {unknown} data
 * @returns {Promise<void>}
 */
async function atomicWriteJson(absPath, data) {
  const payload = JSON.stringify(data, null, 2);
  const dir = path.dirname(absPath);
  await fs.mkdir(dir, { recursive: true });
  const base = path.basename(absPath);
  const tmp = path.join(
    dir,
    `.${base}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`
  );
  await fs.writeFile(tmp, payload, 'utf8');
  try {
    await fs.rename(tmp, absPath);
  } catch (err) {
    await fs.unlink(tmp).catch(() => {});
    const code = /** @type {{ code?: string }} */ (err).code;
    if (code === 'EPERM' || code === 'EEXIST' || code === 'EBUSY') {
      await fs.rm(absPath, { force: true }).catch(() => {});
      await fs.writeFile(tmp, payload, 'utf8');
      await fs.rename(tmp, absPath);
    } else {
      throw err;
    }
  }
}

/**
 * Read and parse JSON from a file. Serialized with other operations on the same path.
 * @param {string} filePath
 * @returns {Promise<unknown>}
 */
function readJson(filePath) {
  const abs = path.resolve(filePath);
  return enqueueFileTask(abs, async () => {
    const raw = await fs.readFile(abs, 'utf8');
    return JSON.parse(raw);
  });
}

/**
 * Atomically replace JSON file (temp write + rename). Writes to the same path are queued.
 * @param {string} filePath
 * @param {unknown} data
 * @returns {Promise<void>}
 */
function writeJson(filePath, data) {
  const abs = path.resolve(filePath);
  return enqueueFileTask(abs, () => atomicWriteJson(abs, data));
}

/**
 * Run read/write callbacks for one path under the same lock as readJson/writeJson.
 * Use for read-modify-write so concurrent updates cannot interleave.
 * @param {string} filePath
 * @param {(io: {{
 *   readParsed: () => Promise<unknown>,
 *   writeParsed: (data: unknown) => Promise<void>
 * }}) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
function withJsonFile(filePath, fn) {
  const abs = path.resolve(filePath);
  return enqueueFileTask(abs, () =>
    fn({
      readParsed: async () => {
        const raw = await fs.readFile(abs, 'utf8');
        return JSON.parse(raw);
      },
      writeParsed: (data) => atomicWriteJson(abs, data)
    })
  );
}

/** @type {typeof writeJson & { withFileLock?: typeof withJsonFile }} */
const writeJsonExport = writeJson;
writeJsonExport.withFileLock = withJsonFile;

module.exports = {
  readJson,
  writeJson: writeJsonExport
};
