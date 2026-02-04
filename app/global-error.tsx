"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-sm text-gray-400">
            Our team has been notified. Try again or return home.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="rahi-btn-primary px-4 py-2"
            >
              Try again
            </button>
            <a href="/" className="rahi-btn-secondary px-4 py-2">
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
