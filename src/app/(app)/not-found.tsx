import { FileQuestion } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

/** Reached by notFound() — a document id that does not exist, or a stale link. */
export default function AppNotFound() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardBody className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
          <FileQuestion className="size-5" aria-hidden />
        </span>

        <div>
          <h1 className="text-lg font-semibold">Not found</h1>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            That record does not exist, or it was deleted. Deleted documents are gone for good —
            validated ones never are.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href="/dashboard">Back to dashboard</ButtonLink>
          <ButtonLink href="/moves" variant="secondary">
            Open the ledger
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );
}
