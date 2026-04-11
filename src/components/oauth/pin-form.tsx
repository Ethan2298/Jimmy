"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PinForm({
  redirectUri,
  state,
  codeChallenge,
}: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/oauth/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pin,
        redirect_uri: redirectUri,
        state: state || undefined,
        code_challenge: codeChallenge || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    const { redirectUrl } = await res.json();
    window.location.href = redirectUrl;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      <Input
        type="text"
        placeholder="Jimmy@0000"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        required
        autoFocus
        className="rounded-none text-center text-lg tracking-widest"
      />
      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-none"
      >
        {loading ? "Connecting..." : "Authorize"}
      </Button>
    </form>
  );
}
