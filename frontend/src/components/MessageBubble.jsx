import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Share2, ThumbsDown, ThumbsUp, Volume2 } from "lucide-react";

function ActionButton({ title, active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-xl transition"
      title={title}
      aria-label={title}
      style={{
        color: active ? "var(--text)" : "var(--muted)",
        background: active
          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
          : "transparent",
      }}
    >
      {children}
    </button>
  );
}

export default function MessageBubble({
  message,
  onCopy,
  onLike,
  onDislike,
  onExportPdf,
  onSpeak,
  isSpeaking,
}) {
  const isUser = message.role === "user";
  const isThinking = !!message.meta?.thinking;
  const isError = !!message.meta?.isError;
  const liked = !!message.meta?.liked;
  const disliked = !!message.meta?.disliked;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
          style={{
            background: "color-mix(in srgb, var(--accent) 14%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--accent) 28%, var(--border))",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`dinova-fade-in ${isError ? "" : ""}`}>
      <div className="text-sm leading-relaxed">
        {isThinking ? (
          <div className="dinova-muted">
            DINOVA is thinking
            <span className="dinova-dots" />
          </div>
        ) : isError ? (
          <div
            className="rounded-2xl px-4 py-3"
            style={{
              background: "color-mix(in srgb, #ef4444 10%, var(--panel))",
              border:
                "1px solid color-mix(in srgb, #ef4444 30%, var(--border))",
            }}
          >
            {message.content}
          </div>
        ) : (
          <div className="dinova-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {!isUser && !isThinking && !isError && (
        <div className="mt-2 flex items-center gap-0">
          <ActionButton title="Copy" onClick={() => onCopy?.(message.content)}>
            <Copy size={20} strokeWidth={2} />
          </ActionButton>
          <ActionButton title="Like" active={liked} onClick={() => onLike?.()}>
            <ThumbsUp
              size={20}
              strokeWidth={2}
              fill={liked ? "currentColor" : "none"}
            />
          </ActionButton>
          <ActionButton
            title="Dislike"
            active={disliked}
            onClick={() => onDislike?.()}
          >
            <ThumbsDown
              size={20}
              strokeWidth={2}
              fill={disliked ? "currentColor" : "none"}
            />
          </ActionButton>
          <ActionButton
            title="Export PDF"
            onClick={() => onExportPdf?.(message.content)}
          >
            <Share2 size={20} strokeWidth={2} />
          </ActionButton>
          <ActionButton
            title={isSpeaking ? "Stop" : "Speak"}
            active={isSpeaking}
            onClick={() => onSpeak?.(message.content)}
          >
            <Volume2 size={20} strokeWidth={2} />
          </ActionButton>
        </div>
      )}
    </div>
  );
}
