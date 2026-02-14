import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble.jsx";

export default function MessageList({
  messages,
  onCopy,
  onLike,
  onDislike,
  onExportPdf,
  onSpeak,
  speakingMessageId,
}) {
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  return (
    <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
      <div className="mx-auto w-full max-w-[760px]">
        {messages?.length ? (
          <div className="flex flex-col gap-6">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onCopy={onCopy}
                onLike={() => onLike?.(m.id)}
                onDislike={() => onDislike?.(m.id)}
                onExportPdf={onExportPdf}
                onSpeak={(text) => onSpeak?.(m.id, text)}
                isSpeaking={speakingMessageId === m.id}
              />
            ))}
          </div>
        ) : (
          <div className="py-16">
            <div className="text-sm dinova-muted">Ask DINOVA anything...</div>
            <div className="mt-2 text-xs dinova-muted">
              Pick a tool on the left. Press Enter to send, Shift+Enter for a new line.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
