<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Product roadmap (dashboard)

- **B4 — Bot calls moderation:** done — bulk exclude/restore via `/api/bot/call-exclude-bulk`, page + row selection on Bot Calls.
- **Pass 12 — Sidebar shell:** hidden nav scrollbar (`no-scrollbar`), comfortable nav spacing, flex column layout (fix-it + profile pinned; nav scrolls in between).
- **Pass 13 — Activity feed watchlist:** per-row `+` → inline Add/Cancel (no `window.confirm`); ✓ link when already on private watchlist; compact times with full timestamp on hover.
