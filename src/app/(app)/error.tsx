"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

/**
 * Catches anything a page throws that was not handled as a form error.
 * React strips the message in production and gives us a digest instead, so the
 * digest is shown — it is what matches this failure to the server log.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[page] unhandled error:", error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg">
      <CardBody className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-danger-subtle text-danger">
          <AlertTriangle className="size-5" aria-hidden />
        </span>

        <div>
          <h1 className="text-lg font-semibold">This page could not be loaded</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Nothing was changed. Try again, and if it keeps happening check that the database
            is running with <code className="font-mono text-xs">npm run db:up</code>.
          </p>
        </div>

        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}

        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw aria-hidden />
            Try again
          </Button>
          <ButtonLink href="/dashboard" variant="secondary">
            Back to dashboard
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );
}
