import { useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";

export default function ChatInput({ value, onChange, onSend, disabled }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 160);
    el.style.height = `${next}px`;
  }, [value]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend?.();
    }
  };

  return (
    <div className="px-4 pb-4 md:px-6">
      <div className="mx-auto w-full max-w-[760px]">
        <div
          className="flex items-end gap-3 rounded-3xl px-3 py-3"
          style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
        >
          <textarea
            ref={ref}
            className="min-h-[44px] max-h-40 flex-1 resize-none rounded-2xl bg-transparent px-3 py-2 text-sm outline-none placeholder:dinova-muted"
            placeholder="Ask anything..."
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            onClick={() => onSend?.()}
            disabled={disabled}
            className="grid h-10 w-10 place-items-center rounded-2xl transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            aria-label="Send"
            title="Send"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="mt-2 text-center text-xs dinova-muted">
          Enter to send, Shift+Enter for a new line.
        </div>
      </div>
    </div>
  );
}
