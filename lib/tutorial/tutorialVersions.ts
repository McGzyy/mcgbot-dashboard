/** Bump a version when that track’s step list changes so clients reset progress. */
export const TUTORIAL_LATEST_VERSIONS = {
  user: 19,
  mod: 1,
  admin: 1,
} as const;

export type TutorialTrackId = keyof typeof TUTORIAL_LATEST_VERSIONS;
