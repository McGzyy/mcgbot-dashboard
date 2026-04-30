/**
 * In-dashboard notification sounds (stored in user_preferences.sound_type).
 * All except `classic` are synthesized via Web Audio (no extra assets).
 */

export const NOTIFICATION_SOUND_IDS = [
  "gentle_bell",
  "minimal_drop",
  "glass_ping",
  "digital_tap",
  "pulse_two",
  "warm_pluck",
  "soft_pop",
  "soft_chime",
  "classic",
] as const;

export type NotificationSoundId = (typeof NOTIFICATION_SOUND_IDS)[number];

export const DEFAULT_NOTIFICATION_SOUND: NotificationSoundId = "gentle_bell";

/** UI: value + human-readable label (order = suggested try order, subtle first). */
export const NOTIFICATION_SOUND_OPTIONS: {
  id: NotificationSoundId;
  label: string;
}[] = [
  { id: "gentle_bell", label: "Gentle bell — soft single tone" },
  { id: "minimal_drop", label: "Minimal drop — very quiet thump" },
  { id: "glass_ping", label: "Glass ping — short bright tick" },
  { id: "digital_tap", label: "Digital tap — tiny UI blip" },
  { id: "pulse_two", label: "Pulse two — two soft rising notes" },
  { id: "warm_pluck", label: "Warm pluck — mellow plucked tone" },
  { id: "soft_pop", label: "Soft pop — small pitch drop" },
  { id: "soft_chime", label: "Soft chime — harmonic shimmer" },
  { id: "classic", label: "Classic ping — original MP3 alert" },
];

const ID_SET = new Set<string>(NOTIFICATION_SOUND_IDS);

export function parseNotificationSoundType(raw: unknown): NotificationSoundId {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "ping") return "soft_pop";
  if (ID_SET.has(s)) return s as NotificationSoundId;
  return DEFAULT_NOTIFICATION_SOUND;
}

export function isClassicMp3Sound(type: NotificationSoundId): boolean {
  return type === "classic";
}

function connectMaster(ctx: AudioContext, peak: number, hold: number, tail: number): GainNode {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0, now);
  master.gain.linearRampToValueAtTime(peak, now + 0.006);
  master.gain.exponentialRampToValueAtTime(0.0001, now + hold + tail);
  master.connect(ctx.destination);
  return master;
}

/** Plays every sound id except `classic` (that uses /sounds/ping.mp3 in the caller). */
export function playNotificationWebSound(ctx: AudioContext, type: NotificationSoundId): void {
  if (type === "classic") return;

  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  if (type === "soft_pop") {
    const master = connectMaster(ctx, 0.18, 0.02, 0.26);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(520, now);
    o.frequency.exponentialRampToValueAtTime(220, now + 0.09);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.85, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.18);
    return;
  }

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

  if (type === "gentle_bell") {
    const master = connectMaster(ctx, 0.12, 0.02, 0.45);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(523.25, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.55, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.48);
    return;
  }

  if (type === "minimal_drop") {
    const master = connectMaster(ctx, 0.09, 0.01, 0.2);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(185, now);
    o.frequency.exponentialRampToValueAtTime(95, now + 0.11);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.7, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.16);
    return;
  }

  if (type === "glass_ping") {
    const master = connectMaster(ctx, 0.11, 0.015, 0.22);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1560, now);
    o.frequency.linearRampToValueAtTime(2200, now + 0.035);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.55, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.15);
    return;
  }

  if (type === "digital_tap") {
    const master = connectMaster(ctx, 0.1, 0.01, 0.06);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(1180, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.5, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.055);
    return;
  }

  if (type === "pulse_two") {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0, now);
    master.gain.linearRampToValueAtTime(0.11, now + 0.005);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    master.connect(ctx.destination);

    const pulse = (t0: number, freq: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + 0.065);
    };
    pulse(now, 392);
    pulse(now + 0.09, 523.25);
    return;
  }

  if (type === "warm_pluck") {
    const master = connectMaster(ctx, 0.13, 0.02, 0.28);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(330, now);
    o.frequency.exponentialRampToValueAtTime(165, now + 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.58, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + 0.26);
    return;
  }

  const _exhaustive: never = type;
  void _exhaustive;
}

let previewAudioCtx: AudioContext | null = null;

function previewAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as
    | (new () => AudioContext)
    | undefined;
  if (!AC) return null;
  if (!previewAudioCtx) previewAudioCtx = new AC();
  return previewAudioCtx;
}

/** Play one sample of the chosen preset (settings preview; matches live toast behavior). */
export function previewNotificationSound(type: NotificationSoundId): void {
  if (isClassicMp3Sound(type)) {
    const audio = new Audio("/sounds/ping.mp3");
    audio.volume = 0.22;
    void audio.play().catch(() => {});
    return;
  }
  const ctx = previewAudioContext();
  if (!ctx) return;
  playNotificationWebSound(ctx, type);
}
