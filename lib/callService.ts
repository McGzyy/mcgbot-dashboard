import { botApiBaseUrl } from "@/lib/botInternal";

export async function processCall(contractAddress: string) {
  const base = botApiBaseUrl();
  if (!base) {
    throw new Error("BOT_API_URL is not configured");
  }
  const res = await fetch(`${base}/internal/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.BOT_API_KEY}`,
    },
    body: JSON.stringify({ ca: contractAddress }),
  });

  if (!res.ok) {
    throw new Error("Bot call failed");
  }

  const data = await res.json();
  return data;
}

