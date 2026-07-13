"use client";

import { useState } from "react";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    const response = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setStatus(response.ok ? "sent" : "error");
  }

  if (status === "sent") {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Wenn ein Trainer-Konto mit dieser Adresse existiert, wurde ein
        Anmelde-Link per E-Mail verschickt.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="email">
        E-Mail-Adresse
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="trainer@example.com"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900"
      >
        {status === "sending" ? "Wird gesendet …" : "Anmelde-Link anfordern"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600">
          Das hat nicht geklappt. Bitte E-Mail-Adresse prüfen.
        </p>
      )}
    </form>
  );
}
