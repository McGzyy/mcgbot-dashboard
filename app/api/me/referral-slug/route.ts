import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  isPastReferralSlugCooldown,
  referralSlugCooldownEndsAt,
  slugifyDisplayNameForReferral,
  validateReferralSlugInput,
} from "@/lib/referralSlug";

function adminClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("referral_slug, referral_slug_changed_at, discord_display_name")
    .eq("discord_id", discordId)
    .maybeSingle();

  if (error) {
    console.error("[referral-slug GET]", error);
    return Response.json({ error: "Failed to load" }, { status: 500 });
  }

  const row =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (!row) {
    return Response.json({
      discord_id: discordId,
      referral_slug: null,
      referral_slug_changed_at: null,
      can_change_slug: true,
      cooldown_ends_at: null,
      suggested_slug: "",
    });
  }
  const slug = row && typeof row.referral_slug === "string" ? row.referral_slug.trim() : null;
  const normalizedSlug = slug && slug.length > 0 ? slug : null;
  const changedAt =
    row && typeof row.referral_slug_changed_at === "string"
      ? row.referral_slug_changed_at
      : null;
  const displayName =
    row && typeof row.discord_display_name === "string" ? row.discord_display_name.trim() : "";

  const suggested = slugifyDisplayNameForReferral(displayName);
  const suggestedSlug =
    suggested.length >= 3 ? suggested.slice(0, 32) : "";

  const canChangeSlug = isPastReferralSlugCooldown(changedAt);
  const cooldownEndsAt = (() => {
    if (!changedAt || canChangeSlug) return null;
    return referralSlugCooldownEndsAt(changedAt)?.toISOString() ?? null;
  })();

  return Response.json({
    discord_id: discordId,
    referral_slug: normalizedSlug,
    referral_slug_changed_at: changedAt,
    can_change_slug: canChangeSlug,
    cooldown_ends_at: cooldownEndsAt,
    suggested_slug: suggestedSlug,
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const discordId = session?.user?.id?.trim() ?? "";
  if (!discordId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const clear = body.clear === true;
  let nextSlug: string | null;
  if (clear || body.slug === null) {
    nextSlug = null;
  } else if (body.slug === undefined) {
    return Response.json(
      { error: "Provide slug (string), slug: null to clear, or clear: true" },
      { status: 400 }
    );
  } else if (typeof body.slug !== "string") {
    return Response.json({ error: "slug must be a string or null" }, { status: 400 });
  } else {
    const trimmed = body.slug.trim();
    if (trimmed.length === 0) {
      nextSlug = null;
    } else {
      const v = validateReferralSlugInput(trimmed);
      if (!v.ok) {
        return Response.json({ error: v.message, code: v.code }, { status: 400 });
      }
      nextSlug = v.slug;
    }
  }

  const { data: row, error: readErr } = await supabase
    .from("users")
    .select("referral_slug, referral_slug_changed_at")
    .eq("discord_id", discordId)
    .maybeSingle();

  if (readErr) {
    console.error("[referral-slug PATCH read]", readErr);
    return Response.json({ error: "Failed to read profile" }, { status: 500 });
  }

  const current =
    row && typeof (row as Record<string, unknown>).referral_slug === "string"
      ? String((row as Record<string, unknown>).referral_slug).trim() || null
      : null;
  const changedAt =
    row && typeof (row as Record<string, unknown>).referral_slug_changed_at === "string"
      ? String((row as Record<string, unknown>).referral_slug_changed_at)
      : null;

  const same =
    (current === null && nextSlug === null) ||
    (current !== null && nextSlug !== null && current === nextSlug);
  if (same) {
    return Response.json({
      ok: true,
      referral_slug: current,
      message: "No change.",
    });
  }

  if (!isPastReferralSlugCooldown(changedAt)) {
    const ends = referralSlugCooldownEndsAt(changedAt);
    return Response.json(
      {
        error: "You can change your referral link once every 30 days.",
        code: "cooldown",
        cooldown_ends_at: ends?.toISOString() ?? null,
      },
      { status: 429 }
    );
  }

  const nowIso = new Date().toISOString();
  const payload = {
    referral_slug: nextSlug,
    referral_slug_changed_at: nowIso,
  };

  const { data: updatedRows, error: upErr } = await supabase
    .from("users")
    .update(payload)
    .eq("discord_id", discordId)
    .select("discord_id");

  if (upErr) {
    if (upErr.code === "23505") {
      return Response.json(
        { error: "That link name is already taken.", code: "taken" },
        { status: 409 }
      );
    }
    if (upErr.code === "23514") {
      return Response.json(
        { error: "That link name is not allowed.", code: "constraint" },
        { status: 400 }
      );
    }
    console.error("[referral-slug PATCH]", upErr);
    return Response.json({ error: "Could not update" }, { status: 500 });
  }

  const updated = Array.isArray(updatedRows) && updatedRows.length > 0;
  if (!updated) {
    if (nextSlug === null) {
      return Response.json({ error: "No referral link to remove yet." }, { status: 400 });
    }
    const { error: insErr } = await supabase.from("users").insert({
      discord_id: discordId,
      ...payload,
    });
    if (insErr) {
      if (insErr.code === "23505") {
        return Response.json(
          { error: "That link name is already taken.", code: "taken" },
          { status: 409 }
        );
      }
      if (insErr.code === "23514") {
        return Response.json(
          { error: "That link name is not allowed.", code: "constraint" },
          { status: 400 }
        );
      }
      console.error("[referral-slug PATCH insert]", insErr);
      return Response.json({ error: "Could not create profile row" }, { status: 500 });
    }
  }

  return Response.json({
    ok: true,
    referral_slug: nextSlug,
    referral_slug_changed_at: nowIso,
  });
}
