"use client";

import type { DocStatus } from "@prisma/client";
import {
  CheckCircle2,
  ClipboardList,
  Hand,
  Package,
  Pencil,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";

import { ActionButton, ActionGroup } from "@/components/action-button";
import type { PickingConfig } from "@/components/documents/config";
import { ButtonLink } from "@/components/ui/button";
import { DOC_STATUS } from "@/lib/enums";
import {
  cancelPickingAction,
  checkAvailabilityAction,
  deletePickingAction,
  markPackedAction,
  markPickedAction,
  resetPickingToDraftAction,
  validatePickingAction,
} from "@/server/actions/pickings";

export function PickingActions({
  id,
  status,
  config,
  pickedAt,
  packedAt,
}: {
  id: string;
  status: DocStatus;
  config: PickingConfig;
  pickedAt?: Date | null;
  packedAt?: Date | null;
}) {
  const editable =
    status === DOC_STATUS.DRAFT || status === DOC_STATUS.WAITING || status === DOC_STATUS.READY;

  // Pick and pack are the two preparation steps a delivery goes through.
  // Receipts and internal transfers have no equivalent.
  const showPreparation = editable && config.type === "DELIVERY";

  return (
    <ActionGroup>
      {showPreparation ? (
        <>
          <ActionButton
            action={markPickedAction}
            id={id}
            variant={pickedAt ? "ghost" : "secondary"}
            pendingLabel="Marking…"
          >
            <Hand aria-hidden />
            {pickedAt ? "Picked ✓" : "Mark picked"}
          </ActionButton>

          <ActionButton
            action={markPackedAction}
            id={id}
            variant={packedAt ? "ghost" : "secondary"}
            pendingLabel="Marking…"
          >
            <Package aria-hidden />
            {packedAt ? "Packed ✓" : "Mark packed"}
          </ActionButton>
        </>
      ) : null}

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
