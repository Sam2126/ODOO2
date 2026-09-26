"use client";

import type { DocStatus } from "@prisma/client";
import { CheckCircle2, ClipboardList, Pencil, RotateCcw, Trash2, XCircle } from "lucide-react";

import { ActionButton, ActionGroup } from "@/components/action-button";
import type { PickingConfig } from "@/components/documents/config";
import { ButtonLink } from "@/components/ui/button";
import { DOC_STATUS } from "@/lib/enums";
import {
  cancelPickingAction,
  checkAvailabilityAction,
  deletePickingAction,
  resetPickingToDraftAction,
  validatePickingAction,
} from "@/server/actions/pickings";

export function PickingActions({
  id,
  status,
  config,
}: {
  id: string;
  status: DocStatus;
  config: PickingConfig;
}) {
  const editable =
    status === DOC_STATUS.DRAFT || status === DOC_STATUS.WAITING || status === DOC_STATUS.READY;

  return (
    <ActionGroup>
      {editable ? (
        <>
          <ActionButton
            action={validatePickingAction}
            id={id}
            variant="primary"
            pendingLabel="Validating…"
          >
            <CheckCircle2 aria-hidden />
            {config.validateLabel}
          </ActionButton>

          <ActionButton
            action={checkAvailabilityAction}
            id={id}
            variant="secondary"
            pendingLabel="Checking…"
          >
            <ClipboardList aria-hidden />
            Check availability
          </ActionButton>

          <ButtonLink href={`${config.route}/${id}/edit`} variant="secondary">
            <Pencil aria-hidden />
            Edit
          </ButtonLink>

          <ActionButton
            action={cancelPickingAction}
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
        <ActionButton action={resetPickingToDraftAction} id={id} variant="secondary">
          <RotateCcw aria-hidden />
          Reset to draft
        </ActionButton>
      ) : null}

      {status !== DOC_STATUS.DONE ? (
        <ActionButton
          action={deletePickingAction}
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
