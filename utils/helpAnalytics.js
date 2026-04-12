'use strict';

const path = require('path');
const { readJson, writeJson } = require('./jsonStore');
const withJsonFile = writeJson.withFileLock;

const ANALYTICS_PATH = path.join(__dirname, '..', 'data', 'helpAnalytics.json');

function defaultData() {
  return {
    version: 1,
    help_topic_requested: {},
    help_question_no_match: 0,
    help_topic_clicked: {},
    faq_opened: 0
  };
}

function mergeParsed(parsed) {
  const base = defaultData();
  if (!parsed || typeof parsed !== 'object') return base;
  return {
    ...base,
    ...parsed,
    help_topic_requested: {
      ...base.help_topic_requested,
      ...(parsed.help_topic_requested && typeof parsed.help_topic_requested === 'object'
        ? parsed.help_topic_requested
        : {})
    },
    help_topic_clicked: {
      ...base.help_topic_clicked,
      ...(parsed.help_topic_clicked && typeof parsed.help_topic_clicked === 'object'
        ? parsed.help_topic_clicked
        : {})
    }
  };
}

/**
 * @returns {Promise<object>}
 */
async function readAnalytics() {
  try {
    const parsed = await readJson(ANALYTICS_PATH);
    try {
      return mergeParsed(/** @type {object} */ (parsed));
    } catch {
      return defaultData();
    }
  } catch (e) {
    const code = e && /** @type {{ code?: string }} */ (e).code;
    if (code === 'ENOENT') return defaultData();
    if (e instanceof SyntaxError) {
      console.error('[HelpAnalytics] Invalid JSON in helpAnalytics.json:', e.message);
      return defaultData();
    }
    return defaultData();
  }
}

function schedule(fn) {
  setImmediate(() => {
    try {
      fn();
    } catch (_) {}
  });
}

function bumpMapCounter(mapName, topic) {
  withJsonFile(ANALYTICS_PATH, async ({ readParsed, writeParsed }) => {
    let parsed;
    try {
      parsed = await readParsed();
    } catch (e) {
      const code = e && /** @type {{ code?: string }} */ (e).code;
      if (code === 'ENOENT') parsed = {};
      else parsed = {};
    }
    const data = mergeParsed(
      parsed && typeof parsed === 'object' ? /** @type {object} */ (parsed) : {}
    );
    if (!data[mapName] || typeof data[mapName] !== 'object') data[mapName] = {};
    const key = getTopicKey(topic);
    data[mapName][key] = Number(data[mapName][key] || 0) + 1;
    await writeParsed(data);
  }).catch((err) => {
    console.error('[HelpAnalytics] write failed:', err?.message || err);
  });
}

/** !help <q> matched and topic content is being delivered. */
function recordHelpTopicRequested(topic) {
  schedule(() => bumpMapCounter('help_topic_requested', topic));
}

/** Interactive help: user picked a topic from the menu. */
function recordHelpTopicClicked(topic) {
  schedule(() => bumpMapCounter('help_topic_clicked', topic));
}

/** !help <q> had no match (before suggestions DM). */
function recordHelpQuestionNoMatch() {
  schedule(() => {
    withJsonFile(ANALYTICS_PATH, async ({ readParsed, writeParsed }) => {
      let parsed;
      try {
        parsed = await readParsed();
      } catch (e) {
        const code = e && /** @type {{ code?: string }} */ (e).code;
        if (code === 'ENOENT') parsed = {};
        else parsed = {};
      }
      const data = mergeParsed(
        parsed && typeof parsed === 'object' ? /** @type {object} */ (parsed) : {}
      );
      data.help_question_no_match = Number(data.help_question_no_match || 0) + 1;
      await writeParsed(data);
    }).catch((err) => {
      console.error('[HelpAnalytics] write failed:', err?.message || err);
    });
  });
}

/** !faq invoked. */
function recordFaqOpened() {
  schedule(() => {
    withJsonFile(ANALYTICS_PATH, async ({ readParsed, writeParsed }) => {
      let parsed;
      try {
        parsed = await readParsed();
      } catch (e) {
        const code = e && /** @type {{ code?: string }} */ (e).code;
        if (code === 'ENOENT') parsed = {};
        else parsed = {};
      }
      const data = mergeParsed(
        parsed && typeof parsed === 'object' ? /** @type {object} */ (parsed) : {}
      );
      data.faq_opened = Number(data.faq_opened || 0) + 1;
      await writeParsed(data);
    }).catch((err) => {
      console.error('[HelpAnalytics] write failed:', err?.message || err);
    });
  });
}

/**
 * Stable key: optional `topic.id`, else trimmed `title`.
 * @param {object|null|undefined} topic
 * @returns {string}
 */
function getTopicKey(topic) {
  if (!topic || typeof topic !== 'object') return 'unknown';
  if (typeof topic.id === 'string' && topic.id.trim()) return topic.id.trim();
  const t = String(topic.title || '').trim();
  return t || 'unknown';
}

module.exports = {
  recordHelpTopicRequested,
  recordHelpTopicClicked,
  recordHelpQuestionNoMatch,
  recordFaqOpened,
  getTopicKey,
  readAnalytics
};
