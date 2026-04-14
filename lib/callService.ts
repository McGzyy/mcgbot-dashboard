export async function processCall(contractAddress: string) {
  const res = await fetch(process.env.BOT_API_URL + "/internal/call", {
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

