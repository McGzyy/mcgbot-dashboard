/**
 * Server-only LiveKit project credentials.
 * Set on the dashboard host: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
 * (see LiveKit Cloud project settings).
 */
export function getLiveKitServerEnv(): {
  url: string;
  apiKey: string;
  apiSecret: string;
} | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}
