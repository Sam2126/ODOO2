"use client";

import type { DocStatus } from "@prisma/client";
import { CheckCircle2, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";

import { ActionButton, ActionGroup } from "@/components/action-button";
import { ButtonLink } from "@/components/ui/button";
import { DOC_STATUS } from "@/lib/enums";
import {
  cancelAdjustmentAction,
  deleteAdjustmentAction,
  resetAdjustmentToDraftAction,
  validateAdjustmentAction,
} from "@/server/actions/adjustments";

export function AdjustmentActions({ id, status }: { id: string; status: DocStatus }) {
  const editable = status === DOC_STATUS.DRAFT || status === DOC_STATUS.WAITING;

  return (
    <ActionGroup>
      {editable ? (
        <>
          <ActionButton
            action={validateAdjustmentAction}
            id={id}
            variant="primary"
            pendingLabel="Applying…"
          >
            <CheckCircle2 aria-hidden />
            Apply count
          </ActionButton>

          <ButtonLink href={`/adjustments/${id}/edit`} variant="secondary">
            <Pencil aria-hidden />
            Edit
          </ButtonLink>

          <ActionButton
            action={cancelAdjustmentAction}
            id={id}
            variant="ghost"
            confirm="Confirm cancel"
          >
            <XCircle aria-hidden />
            Cancel
          </ActionButton>
        </>
      ) : null}

      {status === DOC_STATUS.CANCELED ? (
        <ActionButton action={resetAdjustmentToDraftAction} id={id} variant="secondary">
          <RotateCcw aria-hidden />
          Reset to draft
        </ActionButton>
      ) : null}

      {status !== DOC_STATUS.DONE ? (
        <ActionButton
          action={deleteAdjustmentAction}
          id={id}
          variant="ghost"
          confirm="Confirm delete"
          className="text-danger hover:bg-danger-subtle"
        >
          <Trash2 aria-hidden />
          Delete
        </ActionButton>
      ) : null}
    </ActionGroup>
  );
}
