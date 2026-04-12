"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();

  return (
    <main style={{ padding: 40, textAlign: "center" }}>
      <h1>McGBot Dashboard</h1>

      {!session ? (
        <>
          <p>You are not logged in</p>
          <button onClick={() => signIn("discord")}>
            Login with Discord
          </button>
        </>
      ) : (
        <>
          <p>Logged in as {session.user?.name}</p>
          <img
            src={session.user?.image ?? ""}
            alt="avatar"
            width={80}
            style={{ borderRadius: "50%" }}
          />
          <br /><br />
          <button onClick={() => signOut()}>
            Logout
          </button>
        </>
      )}
    </main>
  );
}