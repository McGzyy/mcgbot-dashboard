const fs = require('fs');
const path = require('path');

const userProfilesFilePath = path.join(__dirname, '../data/userProfiles.json');

/**
 * =========================
 * FILE HELPERS
 * =========================
 */

function ensureUserProfilesFile() {
  try {
    if (!fs.existsSync(userProfilesFilePath)) {
      fs.writeFileSync(userProfilesFilePath, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('[UserProfiles] Failed to ensure file:', error.message);
  }
}

function loadUserProfiles() {
  try {
    ensureUserProfilesFile();

    const rawData = fs.readFileSync(userProfilesFilePath, 'utf-8');
    const parsed = JSON.parse(rawData);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[UserProfiles] Failed to load profiles:', error.message);
    return [];
  }
}

function saveUserProfiles(profiles) {
  try {
    fs.writeFileSync(userProfilesFilePath, JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.error('[UserProfiles] Failed to save profiles:', error.message);
  }
}

/**
 * =========================
 * BASIC HELPERS
 * =========================
 */

function normalizeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeXHandle(value) {
  let raw = normalizeString(value);

  if (!raw) return '';

  // Reject Discord user/role/channel mentions entirely
  if (/^<[@#&!]/.test(raw)) return '';

  // Remove Discord angle brackets around links only
  raw = raw.replace(/^<|>$/g, '').trim();

  // Accept full X / Twitter URLs
  raw = raw.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '');
  raw = raw.replace(/^(www\.)?(x|twitter)\.com\//i, '');

  // Remove leading @
  raw = raw.replace(/^@+/, '');

  // Remove trailing slash / query / fragment / extra path
  raw = raw.split('/')[0];
  raw = raw.split('?')[0];
  raw = raw.split('#')[0];

  // Remove punctuation / spaces around pasted handles
  raw = raw.replace(/[^\w]/g, '');

  // Reject pure numeric IDs (likely Discord IDs, not X handles)
  if (/^\d+$/.test(raw)) return '';

  return raw.slice(0, 15);
}

function isLikelyXHandle(value) {
  const handle = normalizeXHandle(value);
  return /^[A-Za-z0-9_]{1,15}$/.test(handle);
}

function buildAliasSet(profile = {}) {
  const aliases = new Set();

  if (profile.discordUserId) aliases.add(`id:${profile.discordUserId}`);
  if (profile.username) aliases.add(`username:${normalizeLower(profile.username)}`);
  if (profile.displayName) aliases.add(`display:${normalizeLower(profile.displayName)}`);

  if (Array.isArray(profile.previousUsernames)) {
    for (const name of profile.previousUsernames) {
      if (name) aliases.add(`username:${normalizeLower(name)}`);
    }
  }

  if (Array.isArray(profile.previousDisplayNames)) {
    for (const name of profile.previousDisplayNames) {
      if (name) aliases.add(`display:${normalizeLower(name)}`);
    }
  }

  return Array.from(aliases);
}

function getDefaultPublicSettings() {
  return {
    publicCreditMode: 'discord_name', // 'anonymous' | 'discord_name' | 'verified_x_tag'
    allowPublicXTag: false,
    allowPublicDisplayName: true,
    publicAlias: ''
  };
}

function getDefaultPublicTracking() {
  return {
    mentionCountToday: 0,
    mentionCountDate: null,
    lastPublicMentionAt: null
  };
}

function getDefaultXVerification() {
  return {
    requestedHandle: '',
    requestedAt: null,
    verificationCode: '',
    status: 'none' // 'none' | 'pending' | 'verified'
  };
}

function createEmptyProfile({
  discordUserId = null,
  username = '',
  displayName = ''
} = {}) {
  const now = new Date().toISOString();

  const profile = {
    discordUserId: discordUserId ? String(discordUserId) : null,
    username: normalizeString(username),
    displayName: normalizeString(displayName),

    previousUsernames: [],
    previousDisplayNames: [],

    xHandle: '',
    verifiedXHandle: '',
    isXVerified: false,
    xVerification: getDefaultXVerification(),

    publicSettings: getDefaultPublicSettings(),
    publicTracking: getDefaultPublicTracking(),

    createdAt: now,
    updatedAt: now
  };

  profile.aliases = buildAliasSet(profile);

  return profile;
}

/**
 * =========================
 * FINDERS
 * =========================
 */

function getAllUserProfiles() {
  return loadUserProfiles();
}

function getUserProfileByDiscordId(discordUserId) {
  if (!discordUserId) return null;

  const profiles = loadUserProfiles();
  return profiles.find(
    profile => String(profile.discordUserId || '') === String(discordUserId)
  ) || null;
}

function getUserProfileByUsername(username) {
  const normalized = normalizeLower(username);
  if (!normalized) return null;

  const profiles = loadUserProfiles();

  return profiles.find(profile => {
    const aliases = Array.isArray(profile.aliases) ? profile.aliases : [];
    return aliases.includes(`username:${normalized}`);
  }) || null;
}

function getUserProfileByDisplayName(displayName) {
  const normalized = normalizeLower(displayName);
  if (!normalized) return null;

  const profiles = loadUserProfiles();

  return profiles.find(profile => {
    const aliases = Array.isArray(profile.aliases) ? profile.aliases : [];
    return aliases.includes(`display:${normalized}`);
  }) || null;
}

function findUserProfile({
  discordUserId = null,
  username = '',
  displayName = ''
} = {}) {
  if (discordUserId) {
    const byId = getUserProfileByDiscordId(discordUserId);
    if (byId) return byId;
  }

  if (username) {
    const byUsername = getUserProfileByUsername(username);
    if (byUsername) return byUsername;
  }

  if (displayName) {
    const byDisplayName = getUserProfileByDisplayName(displayName);
    if (byDisplayName) return byDisplayName;
  }

  return null;
}

/**
 * =========================
 * UPSERT / UPDATE
 * =========================
 */

function upsertUserProfile({
  discordUserId = null,
  username = '',
  displayName = ''
} = {}) {
  const profiles = loadUserProfiles();

  const normalizedDiscordId = discordUserId ? String(discordUserId) : null;
  const normalizedUsername = normalizeString(username);
  const normalizedDisplayName = normalizeString(displayName);

  let existingIndex = profiles.findIndex(
    profile => String(profile.discordUserId || '') === String(normalizedDiscordId || '')
  );

  if (existingIndex === -1 && normalizedUsername) {
    existingIndex = profiles.findIndex(profile => {
      const aliases = Array.isArray(profile.aliases) ? profile.aliases : [];
      return aliases.includes(`username:${normalizeLower(normalizedUsername)}`);
    });
  }

  if (existingIndex === -1 && normalizedDisplayName) {
    existingIndex = profiles.findIndex(profile => {
      const aliases = Array.isArray(profile.aliases) ? profile.aliases : [];
      return aliases.includes(`display:${normalizeLower(normalizedDisplayName)}`);
    });
  }

  if (existingIndex === -1) {
    const newProfile = createEmptyProfile({
      discordUserId: normalizedDiscordId,
      username: normalizedUsername,
      displayName: normalizedDisplayName
    });

    profiles.push(newProfile);
    saveUserProfiles(profiles);
    return newProfile;
  }

  const existing = profiles[existingIndex];

  const previousUsernames = Array.isArray(existing.previousUsernames)
    ? [...existing.previousUsernames]
    : [];

  const previousDisplayNames = Array.isArray(existing.previousDisplayNames)
    ? [...existing.previousDisplayNames]
    : [];

  if (
    existing.username &&
    normalizedUsername &&
    existing.username !== normalizedUsername &&
    !previousUsernames.includes(existing.username)
  ) {
    previousUsernames.push(existing.username);
  }

  if (
    existing.displayName &&
    normalizedDisplayName &&
    existing.displayName !== normalizedDisplayName &&
    !previousDisplayNames.includes(existing.displayName)
  ) {
    previousDisplayNames.push(existing.displayName);
  }

  const updated = {
    ...existing,
    discordUserId: normalizedDiscordId || existing.discordUserId || null,
    username: normalizedUsername || existing.username || '',
    displayName: normalizedDisplayName || existing.displayName || '',
    previousUsernames,
    previousDisplayNames,
    xHandle: normalizeXHandle(existing.xHandle || ''),
    verifiedXHandle: normalizeXHandle(existing.verifiedXHandle || ''),
    isXVerified: !!existing.isXVerified,
    xVerification: {
      ...getDefaultXVerification(),
      ...(existing.xVerification || {}),
      requestedHandle: normalizeXHandle(existing?.xVerification?.requestedHandle || '')
    },
    publicSettings: {
      ...getDefaultPublicSettings(),
      ...(existing.publicSettings || {})
    },
    publicTracking: {
      ...getDefaultPublicTracking(),
      ...(existing.publicTracking || {})
    },
    updatedAt: new Date().toISOString()
  };

  updated.aliases = buildAliasSet(updated);

  profiles[existingIndex] = updated;
  saveUserProfiles(profiles);

  return updated;
}

function updateUserProfile(discordUserId, updates = {}) {
  if (!discordUserId) return null;

  const profiles = loadUserProfiles();
  const index = profiles.findIndex(
    profile => String(profile.discordUserId || '') === String(discordUserId)
  );

  if (index === -1) return null;

  const existing = profiles[index];

  const updated = {
    ...existing,
    ...updates,
    xHandle: normalizeXHandle(updates.xHandle ?? existing.xHandle ?? ''),
    verifiedXHandle: normalizeXHandle(updates.verifiedXHandle ?? existing.verifiedXHandle ?? ''),
    isXVerified: updates.isXVerified ?? existing.isXVerified ?? false,
    xVerification: {
      ...getDefaultXVerification(),
      ...(existing.xVerification || {}),
      ...(updates.xVerification || {}),
      requestedHandle: normalizeXHandle(
        updates?.xVerification?.requestedHandle ??
        existing?.xVerification?.requestedHandle ??
        ''
      )
    },
    publicSettings: {
      ...getDefaultPublicSettings(),
      ...(existing.publicSettings || {}),
      ...(updates.publicSettings || {})
    },
    publicTracking: {
      ...getDefaultPublicTracking(),
      ...(existing.publicTracking || {}),
      ...(updates.publicTracking || {})
    },
    updatedAt: new Date().toISOString()
  };

  updated.aliases = buildAliasSet(updated);

  profiles[index] = updated;
  saveUserProfiles(profiles);

  return updated;
}

/**
 * =========================
 * X VERIFICATION HELPERS
 * =========================
 */

function setPublicCreditMode(discordUserId, mode) {
  const allowed = ['anonymous', 'discord_name', 'verified_x_tag'];
  if (!allowed.includes(mode)) return null;

  const profile = getUserProfileByDiscordId(discordUserId);
  if (!profile) return null;

  const isVerifiedMode = mode === 'verified_x_tag';

  return updateUserProfile(discordUserId, {
    publicSettings: {
      ...profile.publicSettings,
      publicCreditMode: isVerifiedMode && !profile.isXVerified ? 'discord_name' : mode,
      allowPublicXTag: isVerifiedMode && profile.isXVerified
    }
  });
}

function startXVerification(discordUserId, requestedHandle, verificationCode) {
  const normalizedHandle = normalizeXHandle(requestedHandle);

  if (!discordUserId || !isLikelyXHandle(normalizedHandle)) return null;

  const profile = getUserProfileByDiscordId(discordUserId);
  if (!profile) return null;

  return updateUserProfile(discordUserId, {
    xHandle: normalizedHandle,
    xVerification: {
      requestedHandle: normalizedHandle,
      requestedAt: new Date().toISOString(),
      verificationCode: normalizeString(verificationCode),
      status: 'pending'
    }
  });
}

function completeXVerification(discordUserId, verifiedHandle) {
  const normalizedHandle = normalizeXHandle(verifiedHandle);

  if (!discordUserId || !isLikelyXHandle(normalizedHandle)) return null;

  const profile = getUserProfileByDiscordId(discordUserId);
  if (!profile) return null;

  const currentMode = profile?.publicSettings?.publicCreditMode || 'discord_name';

  return updateUserProfile(discordUserId, {
    xHandle: normalizedHandle,
    verifiedXHandle: normalizedHandle,
    isXVerified: true,
    xVerification: {
      requestedHandle: normalizedHandle,
      requestedAt: profile?.xVerification?.requestedAt || new Date().toISOString(),
      verificationCode: profile?.xVerification?.verificationCode || '',
      status: 'verified'
    },
    publicSettings: {
      ...profile.publicSettings,
      allowPublicXTag: true,
      publicCreditMode: currentMode === 'verified_x_tag' ? 'verified_x_tag' : currentMode
    }
  });
}

function clearXVerificationRequest(discordUserId) {
  const profile = getUserProfileByDiscordId(discordUserId);
  if (!profile) return null;

  return updateUserProfile(discordUserId, {
    xVerification: getDefaultXVerification()
  });
}

/**
 * =========================
 * PUBLIC HELPERS
 * =========================
 */

function getPreferredPublicName(profile) {
  if (!profile) return 'Discord User';

  const mode = profile?.publicSettings?.publicCreditMode || 'discord_name';
  const publicAlias = normalizeString(profile?.publicSettings?.publicAlias);

  if (mode === 'anonymous') return 'Discord User';

  if (mode === 'verified_x_tag' && profile.isXVerified && profile.verifiedXHandle) {
    return `@${normalizeXHandle(profile.verifiedXHandle)}`;
  }

  if (publicAlias) return publicAlias;
  if (profile.displayName) return profile.displayName;
  if (profile.username) return profile.username;

  return 'Discord User';
}

function canUserBeTaggedOnX(profile) {
  return !!profile?.isXVerified &&
    profile?.publicSettings?.publicCreditMode === 'verified_x_tag' &&
    !!normalizeXHandle(profile?.verifiedXHandle);
}

/**
 * =========================
 * EXPORTS
 * =========================
 */

module.exports = {
  loadUserProfiles,
  saveUserProfiles,
  getAllUserProfiles,
  getUserProfileByDiscordId,
  getUserProfileByUsername,
  getUserProfileByDisplayName,
  findUserProfile,
  upsertUserProfile,
  updateUserProfile,
  setPublicCreditMode,
  startXVerification,
  completeXVerification,
  clearXVerificationRequest,
  getPreferredPublicName,
  canUserBeTaggedOnX,
  normalizeXHandle,
  isLikelyXHandle
};