import { useEffect, useRef } from "react";

export function ConfirmResetDialog({
  confirmLabel = "Reset sample data",
  description = "This replaces the shared active dataset with the canonical sample trades and prices. Historical immutable datasets remain in the database, but every user will see the reset data.",
  open,
  pending,
  title = "Reset sample data?",
  onCancel,
  onConfirm,
}: {
  readonly confirmLabel?: string;
  readonly description?: string;
  readonly open: boolean;
  readonly pending: boolean;
  readonly title?: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      cancelButtonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-labelledby="reset-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
        }

        if (event.key === "Tab") {
          const first = cancelButtonRef.current;
          const last = confirmButtonRef.current;

          if (first === null || last === null) {
            return;
          }

          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }}
      role="dialog"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-950" id="reset-title">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="focus-ring rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            disabled={pending}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            Cancel
          </button>
          <button
            className="focus-ring rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            onClick={onConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {pending ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
