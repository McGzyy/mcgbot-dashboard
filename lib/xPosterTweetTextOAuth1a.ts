import crypto from "node:crypto";

/**
 * Text-only tweet via X API v2 + OAuth 1.0a (same signing rules as `utils/xPoster.js` `createPost`).
 * Uses `fetch` only so App Router bundles do not need `axios`.
 */
const X_TWEETS_URL = "https://api.x.com/2/tweets";

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!*()']/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function buildOAuthHeaderPost(url: string): string {
  const consumerKey = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    throw new Error("Missing X API credentials in .env");
  }

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const sorted = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauthParams[key]!)}`)
    .join("&");

  const baseString = ["POST", percentEncode(url), percentEncode(sorted)].join("&");
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  oauthParams.oauth_signature = signature;

  return (
    "OAuth " +
    Object.keys(oauthParams)
      .sort()
      .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key]!)}"`)
      .join(", ")
  );
}

export type TweetPostResult = {
  success: boolean;
  id?: string | null;
  text?: string | null;
  error?: unknown;
};

/** Shape compatible with `runXLeaderboardDigestCron`’s `createPost` callback. */
export async function postTweetTextOAuth1a(
  text: string,
  _replyToId?: string | null
): Promise<TweetPostResult> {
  void _replyToId;
  let authHeader: string;
  try {
    authHeader = buildOAuthHeaderPost(X_TWEETS_URL);
  } catch (e) {
    return { success: false, error: e };
  }

  try {
    const res = await fetch(X_TWEETS_URL, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    const payload = json as { data?: { id?: string; text?: string }; errors?: unknown } | null;
    if (!res.ok) {
      return { success: false, error: payload?.errors ?? json ?? res.statusText };
    }
    const id = payload?.data?.id ?? null;
    const tweetText = payload?.data?.text ?? null;
    if (!id) {
      return { success: false, error: payload ?? json };
    }
    return { success: true, id, text: tweetText };
  } catch (e) {
    return { success: false, error: e };
  }
}
