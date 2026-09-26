"use client";

import { Loader2 } from "lucide-react";
import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";

const ResultContext = createContext<(state: FormState | null) => void>(() => {});

/**
 * Wraps a row of action buttons and displays the result directly above them.
 *
 * This keeps action feedback close to the action that produced it instead of
 * hiding it in a global toast.
 */
export function ActionGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [result, setResult] = useState<FormState | null>(null);

  return (
    <ResultContext.Provider value={setResult}>
      <div className="space-y-3">
        {result?.message ? (
          <Alert tone={result.status === "error" ? "error" : "success"}>
            {result.message}
          </Alert>
        ) : null}

        <div className={cn("flex flex-wrap items-center gap-2", className)}>
          {children}
        </div>
      </div>
    </ResultContext.Provider>
  );
}

type ActionButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick" | "type"
> & {
  action: (id: string) => Promise<FormState>;
  id: string;
  /** When set, the button asks for confirmation before running. */
  confirm?: string;
  pendingLabel?: string;
};

export function ActionButton({
  action,
  id,
  confirm,
  children,
  pendingLabel,
  className,
  ...props
}: ActionButtonProps) {
  const setResult = useContext(ResultContext);
  const [isPending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);

  function run() {
    if (confirm && !armed) {
      setArmed(true);
      return;
    }

    setArmed(false);

    // Clear the previous result while the new action is running.
    setResult(null);

    startTransition(async () => {
      // A redirecting action never returns; Next handles the navigation.
      const result = await action(id);
      setResult(result);
    });
  }

  return (
    <Button
      type="button"
      disabled={isPending}
      onClick={run}
      onBlur={() => setArmed(false)}
      className={cn(armed && "ring-2 ring-danger/40", className)}
      {...props}
    >
      {isPending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : null}

      {isPending
        ? (pendingLabel ?? children)
        : armed
          ? confirm
          : children}
    </Button>
  );
}
