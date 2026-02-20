"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="mb-2 text-lg font-semibold text-red-800">
          Bir hata olustu
        </h2>
        <p className="mb-4 text-sm text-red-600">
          {error.message || "Bilinmeyen hata"}
        </p>
        {error.digest && (
          <p className="mb-4 text-xs text-red-400">Digest: {error.digest}</p>
        )}
        <Button onClick={reset} variant="outline">
          Tekrar Dene
        </Button>
      </div>
    </div>
  );
}
