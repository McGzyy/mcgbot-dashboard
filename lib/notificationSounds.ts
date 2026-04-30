/**
 * In-dashboard notification sounds (user_preferences.sound_type).
 * All presets are synthesized via Web Audio (no MP3 assets).
 */

export const NOTIFICATION_SOUND_IDS = [
  "airy_ding",
  "interval_ping",
  "tri_tone",
  "bright_inbox",
  "descending_trio",
  "double_knock",
  "handbell_single",
  "layered_chime",
  "soft_chime",
] as const;

export type NotificationSoundId = (typeof NOTIFICATION_SOUND_IDS)[number];

export const DEFAULT_NOTIFICATION_SOUND: NotificationSoundId = "soft_chime";

/** You connect to a voice room (local join). */
export const VOICE_LOCAL_JOIN_SOUND: NotificationSoundId = "bright_inbox";

/** You disconnect from a voice room (local leave). */
export const VOICE_LOCAL_LEAVE_SOUND: NotificationSoundId = "descending_trio";

/** Someone else joins while you are in the room. */
export const VOICE_REMOTE_JOIN_SOUND: NotificationSoundId = "airy_ding";

/** Someone else leaves while you are in the room. */
export const VOICE_REMOTE_LEAVE_SOUND: NotificationSoundId = "double_knock";

/** UI: id + label */
export const NOTIFICATION_SOUND_OPTIONS: {
  id: NotificationSoundId;
  label: string;
}[] = [
  { id: "soft_chime", label: "Soft chime — harmonic shimmer (default)" },
  { id: "airy_ding", label: "Airy ding — light system-style ping" },
  { id: "interval_ping", label: "Interval ping — fifth harmony, short" },
  { id: "tri_tone", label: "Tri-tone — quick major triad" },
  { id: "bright_inbox", label: "Bright inbox — crisp triplet rise" },
  { id: "descending_trio", label: "Descending trio — message-style fall" },
  { id: "double_knock", label: "Double knock — two soft taps" },
  { id: "handbell_single", label: "Handbell — single warm strike" },
  { id: "layered_chime", label: "Layered chime — staggered harmonics" },
];

const ID_SET = new Set<string>(NOTIFICATION_SOUND_IDS);

/** Old ids from prior releases → map to current default so DB rows still work. */
const LEGACY_SOUND_IDS = new Set([
  "gentle_bell",
  "minimal_drop",
  "glass_ping",
  "digital_tap",
  "pulse_two",
  "warm_pluck",
  "soft_pop",
  "classic",
  "ping",
  "marimba_pair",
  "nudge_warm",
]);

export function parseNotificationSoundType(raw: unknown): NotificationSoundId {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (ID_SET.has(s)) return s as NotificationSoundId;
  if (LEGACY_SOUND_IDS.has(s)) return DEFAULT_NOTIFICATION_SOUND;
  return DEFAULT_NOTIFICATION_SOUND;
}

function connectMaster(ctx: AudioContext, peak: number, hold: number, tail: number): GainNode {
  const t = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0, t);
  master.gain.linearRampToValueAtTime(peak, t + 0.006);
  master.gain.exponentialRampToValueAtTime(0.0001, t + hold + tail);
  master.connect(ctx.destination);
  return master;
}

export function playNotificationWebSound(ctx: AudioContext, type: NotificationSoundId): void {
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  if (type === "soft_chime") {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0, now);
    master.gain.linearRampToValueAtTime(0.14, now + 0.01);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    master.connect(ctx.destination);

    const mk = (freq: number, detune: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, now);
      o.detune.setValueAtTime(detune, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.65, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      o.connect(g);
      g.connect(master);
      o.start(now);
      o.stop(now + 0.62);
    };
    mk(660, -8);
    mk(990, 6);
    return;
  }

  if (type === "airy_ding") {
    const master = connectMaster(ctx, 0.11, 0.02, 0.24);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1046.5, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.72, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.22);
    return;
  }

  if (type === "interval_ping") {
    const master = connectMaster(ctx, 0.1, 0.02, 0.18);
    const f1 = 523.25;
    const f2 = 783.99;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    o1.type = "sine";
    o2.type = "sine";
    o1.frequency.setValueAtTime(f1, now);
    o2.frequency.setValueAtTime(f2, now);
    for (const g of [g1, g2]) {
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.42, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    }
    o1.connect(g1);
    o2.connect(g2);
    g1.connect(master);
    g2.connect(master);
    o1.start(now);
    o2.start(now);
    o1.stop(now + 0.16);
    o2.stop(now + 0.16);
    return;
  }

  if (type === "tri_tone") {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0, now);
    master.gain.linearRampToValueAtTime(0.11, now + 0.004);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    master.connect(ctx.destination);

    const tone = (t0: number, freq: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.46, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.068);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 0.078);
    };
    tone(now, 698.46);
    tone(now + 0.07, 880.0);
    tone(now + 0.14, 1046.5);
    return;
  }

  if (type === "bright_inbox") {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0, now);
    master.gain.linearRampToValueAtTime(0.12, now + 0.005);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    master.connect(ctx.destination);

    const blip = (t0: number, freq: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.52, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 0.065);
    };
    blip(now, 783.99);
    blip(now + 0.075, 987.77);
    blip(now + 0.15, 1174.66);
    return;
  }

  if (type === "descending_trio") {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0, now);
    master.gain.linearRampToValueAtTime(0.11, now + 0.005);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    master.connect(ctx.destination);

    const note = (t0: number, freq: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.085);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 0.095);
    };
    note(now, 880);
    note(now + 0.095, 659.25);
    note(now + 0.19, 523.25);
    return;
  }

  if (type === "double_knock") {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0, now);
    master.gain.linearRampToValueAtTime(0.12, now + 0.004);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    master.connect(ctx.destination);

    const knock = (t0: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(659.25, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.55, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 0.085);
    };
    knock(now);
    knock(now + 0.09);
    return;
  }

  if (type === "handbell_single") {
    const master = connectMaster(ctx, 0.1, 0.03, 0.55);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(523.25, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.52, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.58);

    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "sine";
    o2.frequency.setValueAtTime(1046.5, now);
    g2.gain.setValueAtTime(0.0001, now);
    g2.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    o2.connect(g2);
    g2.connect(master);
    o2.start(now);
    o2.stop(now + 0.5);
    return;
  }

  if (type === "layered_chime") {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0, now);
    master.gain.linearRampToValueAtTime(0.12, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    master.connect(ctx.destination);

    const partial = (t0: number, freq: number, peak: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.48);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 0.52);
    };
    partial(now, 523.25, 0.45);
    partial(now + 0.028, 659.25, 0.38);
    partial(now + 0.055, 783.99, 0.32);
    return;
  }

  const _exhaustive: never = type;
  void _exhaustive;
}

let previewAudioCtx: AudioContext | null = null;
let voiceCueAudioCtx: AudioContext | null = null;

function previewAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as
    | (new () => AudioContext)
    | undefined;
  if (!AC) return null;
  if (!previewAudioCtx) previewAudioCtx = new AC();
  return previewAudioCtx;
}

function voiceCueAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as
    | (new () => AudioContext)
    | undefined;
  if (!AC) return null;
  if (!voiceCueAudioCtx) voiceCueAudioCtx = new AC();
  return voiceCueAudioCtx;
}

function playPresetCue(type: NotificationSoundId): void {
  const ctx = voiceCueAudioContext();
  if (!ctx) return;
  playNotificationWebSound(ctx, type);
}

export function playVoiceLocalJoinCue(): void {
  playPresetCue(VOICE_LOCAL_JOIN_SOUND);
}

export function playVoiceLocalLeaveCue(): void {
  playPresetCue(VOICE_LOCAL_LEAVE_SOUND);
}

export function playVoiceRemoteJoinCue(): void {
  playPresetCue(VOICE_REMOTE_JOIN_SOUND);
}

export function playVoiceRemoteLeaveCue(): void {
  playPresetCue(VOICE_REMOTE_LEAVE_SOUND);
}

/** Play one sample of the chosen preset (settings preview; matches live toasts). */
export function previewNotificationSound(type: NotificationSoundId): void {
  const ctx = previewAudioContext();
  if (!ctx) return;
  playNotificationWebSound(ctx, type);
}
