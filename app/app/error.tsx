"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import posthog from "posthog-js";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
    posthog.captureException(error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="card-soft max-w-xl w-full p-10 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#0A0A0A] bg-[var(--accent)]/10">
          <AlertTriangle className="h-7 w-7 text-[var(--accent)]" />
        </div>
        <h1 className="editorial-serif text-3xl text-[var(--foreground)] mb-3">
          Algo quebrou aqui.
        </h1>
        <p className="text-[var(--muted)] mb-6">
          A gente já foi avisado. Tenta de novo — se persistir, mande um print
          no chat e a gente resolve.
        </p>
        {error?.digest ? (
          <p className="mb-6 text-xs font-mono text-[var(--muted)]">
            ref: {error.digest}
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white shadow-[4px_4px_0_0_#0A0A0A] transition hover:-translate-x-0.5 hover:-translate-y-0.5"
          >
            <RefreshCw size={14} />
            Tentar de novo
          </button>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-[#0A0A0A] bg-[#FFFDF9] px-5 py-2.5 text-sm font-bold text-[#0A0A0A] shadow-[4px_4px_0_0_#0A0A0A] transition hover:-translate-x-0.5 hover:-translate-y-0.5"
          >
            Voltar pro dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
