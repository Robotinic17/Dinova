import { useEffect, useState } from "react";
import { MoreVertical, Plus, RotateCcw, X } from "lucide-react";

const MODES = [
  { id: "email", label: "Email" },
  { id: "summary", label: "Summary" },
  { id: "plan", label: "Plan" },
  { id: "general", label: "General" },
];

const LENGTHS = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

const TONES = [
  { id: "professional", label: "Professional" },
  { id: "friendly", label: "Friendly" },
  { id: "urgent", label: "Urgent" },
];

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  mode,
  setMode,
  length,
  setLength,
  tone,
  setTone,
  onRegenerate,
  canRegenerate,
  themePref,
  setThemePref,
  voicePref,
  setVoicePref,
}) {
  const [menuChatId, setMenuChatId] = useState(null);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (!e.target?.closest?.("[data-chat-menu]")) setMenuChatId(null);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuChatId(null);
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-30 h-full w-[296px] border-r backdrop-blur transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "color-mix(in srgb, var(--panel) 82%, transparent)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex h-full min-h-0 flex-col p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--panel)",
                }}
              >
                <img
                  src="/logo-light.png"
                  alt="DINOVA"
                  className="dinova-logo-light h-8 w-8 object-contain"
                  draggable="false"
                />
                <img
                  src="/logo-dark.png"
                  alt="DINOVA"
                  className="dinova-logo-dark h-8 w-8 object-contain"
                  draggable="false"
                />
              </div>
              <div>
                <div className="text-xs font-semibold tracking-[0.22em] dinova-accent">
                  DINOVA
                </div>
                <div className="text-xs dinova-muted">Focused intelligence</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-xl text-xs md:hidden"
              style={{
                border: "1px solid var(--border)",
                background: "var(--panel)",
              }}
              aria-label="Close sidebar"
              title="Close"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onNewChat?.();
              setMenuChatId(null);
            }}
            className="mt-4 flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
            }}
          >
            <span>New chat</span>
            <Plus size={18} strokeWidth={2} />
          </button>

          {/* Scrollable sidebar content (Tools + Preferences + Chats) */}
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <div
              className="rounded-2xl p-3"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] dinova-muted">
                Tools
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode?.(m.id)}
                    className="rounded-full px-3 py-1.5 text-xs transition"
                    style={{
                      border: "1px solid var(--border)",
                      background:
                        mode === m.id
                          ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                          : "transparent",
                      color: mode === m.id ? "var(--text)" : "var(--muted)",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] dinova-muted">
                  Length
                </span>
                {LENGTHS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLength?.(l.id)}
                    className="rounded-full px-3 py-1.5 text-xs transition"
                    style={{
                      border: "1px solid var(--border)",
                      background:
                        length === l.id
                          ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                          : "transparent",
                      color: length === l.id ? "var(--text)" : "var(--muted)",
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              {mode === "email" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] dinova-muted">
                    Tone
                  </span>
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone?.(t.id)}
                      className="rounded-full px-3 py-1.5 text-xs transition"
                      style={{
                        border: "1px solid var(--border)",
                        background:
                          tone === t.id
                            ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                            : "transparent",
                        color: tone === t.id ? "var(--text)" : "var(--muted)",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onRegenerate?.()}
                  disabled={!canRegenerate}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    border: "1px solid var(--border)",
                    background: canRegenerate
                      ? "color-mix(in srgb, var(--accent) 10%, var(--panel))"
                      : "var(--panel)",
                    color: "var(--text)",
                  }}
                >
                  <RotateCcw size={16} strokeWidth={2.5} />
                  <span>Regenerate</span>
                </button>
              </div>
            </div>

            <div
              className="mt-4 rounded-2xl p-3"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] dinova-muted">
                Preferences
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { id: "system", label: "System" },
                  { id: "dark", label: "Dark" },
                  { id: "light", label: "Light" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemePref?.(t.id)}
                    className="rounded-full px-3 py-1.5 text-xs transition"
                    style={{
                      border: "1px solid var(--border)",
                      background:
                        themePref === t.id
                          ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                          : "transparent",
                      color:
                        themePref === t.id ? "var(--text)" : "var(--muted)",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] dinova-muted">
                Voice
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { id: "default", label: "Default" },
                  { id: "feminine", label: "Female" },
                  { id: "masculine", label: "Male" },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoicePref?.(v.id)}
                    className="rounded-full px-3 py-1.5 text-xs transition"
                    style={{
                      border: "1px solid var(--border)",
                      background:
                        voicePref === v.id
                          ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                          : "transparent",
                      color:
                        voicePref === v.id ? "var(--text)" : "var(--muted)",
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] dinova-muted">
              Recent
            </div>

            <div className="mt-2">
              <div className="flex flex-col gap-2">
                {chats.map((c) => {
                  const isActive = c.id === activeChatId;
                  return (
                    <div
                      key={c.id}
                      className="flex min-w-0 items-stretch justify-between gap-2 rounded-2xl"
                      style={{
                        background: isActive
                          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                          : "transparent",
                        border: `1px solid ${
                          isActive
                            ? "color-mix(in srgb, var(--accent) 26%, var(--border))"
                            : "var(--border)"
                        }`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectChat?.(c.id);
                          setMenuChatId(null);
                        }}
                        className="min-w-0 flex-1 px-3 py-2 text-left"
                      >
                        <div
                          className="truncate text-[13px] font-medium leading-5"
                          style={{ color: "var(--text)" }}
                        >
                          {c.title}
                        </div>
                        <div className="mt-0.5 text-xs dinova-muted">
                          {c.messages.length
                            ? `${c.messages.length} messages`
                            : "Empty"}
                        </div>
                      </button>

                      <div
                        className="relative flex items-center pr-2"
                        data-chat-menu
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setMenuChatId((curr) =>
                              curr === c.id ? null : c.id,
                            )
                          }
                          className="grid h-9 w-9 place-items-center rounded-xl text-xs transition hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          style={{
                            background: "transparent",
                            color: "var(--muted)",
                            outlineColor: "var(--accent)",
                          }}
                          aria-label="Chat menu"
                          title="Chat menu"
                        >
                          <MoreVertical size={20} strokeWidth={2} />
                        </button>

                        {menuChatId === c.id && (
                          <div
                            className="absolute right-0 top-10 z-50 w-44 rounded-2xl p-1"
                            style={{
                              background: "var(--panel)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => onDeleteChat?.(c.id)}
                              className="w-full rounded-xl px-3 py-2 text-left text-sm"
                              style={{ color: "#ef4444" }}
                            >
                              Delete chat
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 text-xs dinova-muted">Nova via Bedrock</div>
        </div>
      </aside>
    </>
  );
}
