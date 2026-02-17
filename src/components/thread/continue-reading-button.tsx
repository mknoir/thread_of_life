"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ContinueReadingButtonProps {
  threadTitle: string;
  geneSymbol?: string;
  sectionTitle: string;
  prose: string;
  claimsSummary?: string;
  nextSectionHint?: string;
}

export function ContinueReadingButton({
  threadTitle,
  geneSymbol,
  sectionTitle,
  prose,
  claimsSummary,
  nextSectionHint,
}: ContinueReadingButtonProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [continuation, setContinuation] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClick = async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/thread/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadTitle,
          geneSymbol,
          sectionTitle,
          prose,
          claimsSummary,
          nextSectionHint,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data.error ?? `Request failed (${res.status})`);
        setStatus("error");
        return;
      }

      const text = data.continuation;
      if (!text) {
        setErrorMessage("No text returned");
        setStatus("error");
        return;
      }
      setContinuation(text);
      setStatus("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error");
      setStatus("error");
    }
  };

  if (status === "done" && continuation) {
    return (
      <div className="space-y-3">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {continuation}
        </p>
      </div>
    );
  }

  if (status === "error") {
    const isQuotaError = errorMessage?.includes("429") || errorMessage?.toLowerCase().includes("quota");
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">
          {errorMessage ?? "Couldn't generate."}
        </p>
        {isQuotaError ? (
          <p className="text-xs text-muted-foreground">
            Add a payment method or check usage at{" "}
            <a
              href="https://platform.openai.com/account/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              platform.openai.com
            </a>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            If the key is missing: add OPENAI_API_KEY to .env.local and restart
            the dev server.
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatus("idle");
            setContinuation(null);
            setErrorMessage(null);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={status === "loading"}
    >
      {status === "loading" ? (
        <>
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          Generating...
        </>
      ) : (
        <>Continue reading ↓</>
      )}
    </Button>
  );
}
