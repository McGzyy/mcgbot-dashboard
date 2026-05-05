import { ImageResponse } from "next/og";
import { fetchProfileMeta, siteOriginForOG } from "@/lib/profileRouteMeta";

export const alt = "McGBot caller profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const routeParam = decodeURIComponent(String(raw ?? "")).trim();
  const origin = siteOriginForOG();
  const profile = routeParam ? await fetchProfileMeta(origin, routeParam) : null;

  const displayName = profile?.displayName ?? "McGBot caller";
  const username = profile?.username?.trim() ?? "";
  const statsLine =
    profile && profile.stats.totalCalls > 0
      ? `${profile.stats.totalCalls} calls · ${profile.stats.avgX.toFixed(1)}× avg · ${Math.round(profile.stats.winRate)}% win rate`
      : "Caller stats on McGBot Terminal";

  const initial = (displayName || "?").trim().slice(0, 1).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#09090b",
          backgroundImage:
            "linear-gradient(145deg, rgba(34,211,238,0.09) 0%, transparent 42%, rgba(16,185,129,0.07) 100%)",
          padding: 52,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 36 }}>
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/og runtime
            <img
              src={profile.avatarUrl}
              alt=""
              width={132}
              height={132}
              style={{
                borderRadius: 28,
                border: "2px solid rgba(63,63,70,0.85)",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 132,
                height: 132,
                borderRadius: 28,
                backgroundColor: "#27272a",
                border: "2px solid rgba(63,63,70,0.65)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 52,
                fontWeight: 700,
                color: "#a1a1aa",
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              flex: 1,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 54,
                  fontWeight: 700,
                  color: "#fafafa",
                  letterSpacing: -1.5,
                  lineHeight: 1.1,
                }}
              >
                {displayName}
              </span>
              {profile?.isTopCaller ? (
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "#fde68a",
                    border: "1px solid rgba(251,191,36,0.45)",
                    borderRadius: 999,
                    padding: "8px 14px",
                    backgroundColor: "rgba(120,53,15,0.35)",
                  }}
                >
                  Top Caller
                </span>
              ) : null}
              {profile?.isTrustedPro ? (
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "#ddd6fe",
                    border: "1px solid rgba(139,92,246,0.45)",
                    borderRadius: 999,
                    padding: "8px 14px",
                    backgroundColor: "rgba(76,29,149,0.35)",
                  }}
                >
                  Trusted Pro
                </span>
              ) : null}
            </div>
            {username ? (
              <span style={{ fontSize: 26, color: "#71717a", marginTop: 2 }}>@{username}</span>
            ) : null}
            <span style={{ fontSize: 28, color: "#a1a1aa", marginTop: 10, lineHeight: 1.35 }}>
              {statsLine}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            width: "100%",
            paddingTop: 24,
            borderTop: "1px solid rgba(63,63,70,0.55)",
          }}
        >
          <span
            style={{
              fontSize: 22,
              color: "#52525b",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            McGBot Terminal
          </span>
          <span style={{ fontSize: 22, color: "#3f3f46", fontWeight: 600 }}>mcgbot.xyz</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
