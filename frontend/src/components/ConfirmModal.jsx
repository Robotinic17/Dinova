import { useEffect, useRef } from "react";

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => cancelRef.current?.focus?.(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={() => onCancel?.()}
        aria-label="Close dialog"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl rounded-3xl p-6 shadow-2xl"
        style={{
          background: "color-mix(in srgb, var(--panel) 92%, black)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="text-2xl font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </div>
        {description ? (
          <div className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
            {description}
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onCancel?.()}
            className="rounded-2xl px-5 py-2 text-sm font-semibold"
            style={{ border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)" }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm?.()}
            className="rounded-2xl px-5 py-2 text-sm font-semibold text-white"
            style={{ background: "#ef4444" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

