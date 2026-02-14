import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import { PanelLeft } from "lucide-react";
import Sidebar from "./components/Sidebar.jsx";
import MessageList from "./components/MessageList.jsx";
import ChatInput from "./components/ChatInput.jsx";
import ConfirmModal from "./components/ConfirmModal.jsx";
import { useThemePreference } from "./hooks/useThemePreference.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const STORAGE_KEY = "dinova_chats_v3";
const STORAGE_KEY_OLD = "dinova_chats_v2";
const UI_KEY = "dinova_ui_v1";

const uid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const defaultChat = (settings = {}) => ({
  id: uid(),
  title: "New chat",
  createdAt: Date.now(),
  settings: {
    mode: settings.mode || "general",
    length: settings.length || "medium",
    tone: settings.tone || "professional",
  },
  messages: [],
});

const deriveTitle = (messages) => {
  const firstUser = messages.find((m) => m.role === "user")?.content || "";
  const t = firstUser.trim();
  if (!t) return "New chat";
  return t.length > 32 ? `${t.slice(0, 32)}...` : t;
};

const INITIAL_CHAT = defaultChat({ mode: "general", length: "medium", tone: "professional" });

const hasMeaningfulMessages = (chat) => {
  const msgs = Array.isArray(chat?.messages) ? chat.messages : [];
  return msgs.some((m) => {
    if (!m || typeof m !== "object") return false;
    if (m.meta?.thinking) return false;
    if (m.role !== "user" && m.role !== "assistant") return false;
    const text = typeof m.content === "string" ? m.content.trim() : "";
    return text.length > 0;
  });
};

export default function App() {
  const { themePref, setThemePref } = useThemePreference();

  const [mode, setMode] = useState("general");
  const [length, setLength] = useState("medium");
  const [tone, setTone] = useState("professional");
  const [voicePref, setVoicePref] = useState("default"); // default | feminine | masculine

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [chats, setChats] = useState([INITIAL_CHAT]);
  const [activeChatId, setActiveChatId] = useState(INITIAL_CHAT.id);
  const [hydrated, setHydrated] = useState(false);

  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteDialog, setDeleteDialog] = useState({ open: false, chatId: null });
  const [storageWarning, setStorageWarning] = useState("");

  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const speechRef = useRef({});

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || chats[0],
    [chats, activeChatId]
  );

  const canSend = useMemo(() => composer.trim().length > 0 && !loading, [composer, loading]);

  useEffect(() => {
    let loadedChats = null;
    try {
      const rawChats = localStorage.getItem(STORAGE_KEY);
      const raw = rawChats || localStorage.getItem(STORAGE_KEY_OLD);
      if (raw) {
        const decoded = JSON.parse(raw);
        const arr = Array.isArray(decoded) ? decoded : Array.isArray(decoded?.chats) ? decoded.chats : null;
        if (Array.isArray(arr) && arr.length) {
          loadedChats = arr.map((c) => ({
            ...c,
            settings: {
              mode: c?.settings?.mode || "general",
              length: c?.settings?.length || "medium",
              tone: c?.settings?.tone || "professional",
            },
            messages: Array.isArray(c?.messages) ? c.messages : [],
          }));
          setChats(loadedChats);
          setActiveChatId((curr) => (loadedChats.some((c) => c.id === curr) ? curr : loadedChats[0].id));
        }
      }

      const rawUi = localStorage.getItem(UI_KEY);
      if (rawUi) {
        const ui = JSON.parse(rawUi);
        if (ui?.mode) setMode(ui.mode);
        if (ui?.length) setLength(ui.length);
        if (ui?.tone) setTone(ui.tone);
        if (ui?.voicePref) setVoicePref(ui.voicePref);
        if (ui?.activeChatId) {
          const ok = loadedChats ? loadedChats.some((c) => c.id === ui.activeChatId) : true;
          if (ok) setActiveChatId(ui.activeChatId);
        }
      }
    } catch {
      // ignore
    } finally {
      // Prevent initial render from overwriting stored data before we've loaded it.
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const compact = chats.map((c) => ({
        ...c,
        settings: {
          mode: c?.settings?.mode || "general",
          length: c?.settings?.length || "medium",
          tone: c?.settings?.tone || "professional",
        },
        messages: (c.messages || []).slice(-60).map((m) => {
          const next = { ...m };
          if (next.lastPayload) {
            next.lastPayload = {
              mode: next.lastPayload.mode,
              length: next.lastPayload.length,
              tone: next.lastPayload.tone,
              input: next.lastPayload.input,
            };
          }
          if (next.meta?.model) {
            next.meta = { ...next.meta };
            delete next.meta.model;
          }
          return next;
        }),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
      setStorageWarning("");
    } catch (e) {
      console.warn("DINOVA: failed to persist chats to localStorage", e);
      setStorageWarning("Storage full, recent chats may not persist.");
    }
  }, [chats]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        UI_KEY,
        JSON.stringify({ mode, length, tone, voicePref, activeChatId })
      );
    } catch {
      // ignore
    }
  }, [mode, length, tone, voicePref, activeChatId]);

  // Auto-close empty chats after refresh/load: keep only chats with real messages.
  useEffect(() => {
    if (!hydrated) return;
    setChats((prev) => {
      const kept = prev.filter((c) => hasMeaningfulMessages(c));
      // Always keep at least one chat so the UI has a place to type.
      if (kept.length === 0) return [defaultChat({ mode, length, tone })];
      return kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // If the active chat was empty and got removed, fall back to the first remaining chat.
  useEffect(() => {
    if (!hydrated) return;
    setActiveChatId((curr) => (chats.some((c) => c.id === curr) ? curr : chats[0]?.id));
  }, [hydrated, chats]);

  // Keep per-chat settings in sync with the sidebar controls so each chat "remembers" its tool config.
  useEffect(() => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== activeChatId) return c;
        const curr = c.settings || {};
        const next = { mode, length, tone };
        if (curr.mode === next.mode && curr.length === next.length && curr.tone === next.tone) return c;
        return { ...c, settings: next };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, length, tone, activeChatId]);

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel?.();
      } catch {
        // ignore
      }
    };
  }, []);

  const buildPayload = (input) => {
    const payload = { mode, input, length };
    if (mode === "email") payload.tone = tone;
    return payload;
  };

  const buildHistory = () => {
    const msgs = (activeChat?.messages || [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && !m.meta?.thinking && !m.meta?.isError)
      .map((m) => ({ role: m.role, content: m.content }))
      .filter((m) => typeof m.content === "string" && m.content.trim().length > 0);
    return msgs.slice(-10);
  };

  const appendMessage = (chatId, message) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const messages = [...c.messages, message];
        return { ...c, messages, title: deriveTitle(messages) };
      })
    );
  };

  const replaceMessage = (chatId, messageId, nextMessage) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const messages = c.messages.map((m) => (m.id === messageId ? nextMessage : m));
        return { ...c, messages, title: deriveTitle(messages) };
      })
    );
  };

  const updateMessageMeta = (chatId, messageId, updater) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const messages = c.messages.map((m) => {
          if (m.id !== messageId) return m;
          const nextMeta = updater({ ...(m.meta || {}) });
          return { ...m, meta: nextMeta };
        });
        return { ...c, messages };
      })
    );
  };

  const callGenerate = async (payload) => {
    const response = await axios.post(`${API_URL}/api/generate`, payload);
    return response.data;
  };

  const handleNewChat = () => {
    const next = defaultChat({ mode, length, tone });
    setChats((prev) => [next, ...prev]);
    setActiveChatId(next.id);
    setSidebarOpen(false);
    setError("");
    setComposer("");
  };

  const handleSelectChat = (id) => {
    setActiveChatId(id);
    const selected = chats.find((c) => c.id === id);
    const s = selected?.settings;
    if (s?.mode) setMode(s.mode);
    if (s?.length) setLength(s.length);
    if (s?.tone) setTone(s.tone);
    setSidebarOpen(false);
    setError("");
  };

  const handleDeleteChat = (id) => {
    setDeleteDialog({ open: true, chatId: id });
  };

  const confirmDeleteChat = () => {
    const id = deleteDialog.chatId;
    if (!id) return;

    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const created = defaultChat({ mode, length, tone });
        setActiveChatId(created.id);
        return [created];
      }
      setActiveChatId((curr) => (curr === id ? next[0].id : curr));
      return next;
    });

    setDeleteDialog({ open: false, chatId: null });
  };

  const cancelDeleteChat = () => {
    setDeleteDialog({ open: false, chatId: null });
  };

  const handleCopy = async (text) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const handleLike = (messageId) => {
    updateMessageMeta(activeChat.id, messageId, (meta) => {
      const nextLiked = !meta.liked;
      return { ...meta, liked: nextLiked, disliked: nextLiked ? false : meta.disliked };
    });
  };

  const handleDislike = (messageId) => {
    updateMessageMeta(activeChat.id, messageId, (meta) => {
      const nextDisliked = !meta.disliked;
      return { ...meta, disliked: nextDisliked, liked: nextDisliked ? false : meta.liked };
    });
  };

  const handleExportPdf = (text) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const margin = 48;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    const lines = doc.splitTextToSize(String(text || ""), width);

    let y = margin;
    const lineHeight = 16;
    const pageHeight = doc.internal.pageSize.getHeight() - margin;

    for (const line of lines) {
      if (y > pageHeight) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }

    doc.save("dinova-response.pdf");
  };

  const pickVoice = () => {
    const synth = window.speechSynthesis;
    if (!synth) return null;
    const voices = synth.getVoices?.() || [];
    if (!voices.length) return null;

    const isEnglish = (v) => /en(-|_)?/i.test(v.lang || "") || /english/i.test(v.name || "");
    const english = voices.filter(isEnglish);
    const pool = english.length ? english : voices;

    const name = (v) => `${v.name || ""} ${v.voiceURI || ""}`.toLowerCase();
    const has = (v, needles) => needles.some((n) => name(v).includes(n));

    if (voicePref === "feminine") {
      return (
        pool.find((v) => has(v, ["female", "zira", "susan", "amy", "emma", "samantha", "victoria"])) ||
        pool.find((v) => v.default) ||
        pool[0]
      );
    }
    if (voicePref === "masculine") {
      return (
        pool.find((v) => has(v, ["male", "david", "mark", "guy", "daniel", "alex", "james"])) ||
        pool.find((v) => v.default) ||
        pool[0]
      );
    }
    return pool.find((v) => v.default) || pool[0];
  };

  const handleSpeak = (messageId, text) => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (speakingMessageId === messageId) {
      synth.cancel();
      setSpeakingMessageId(null);
      return;
    }

    synth.cancel();
    setSpeakingMessageId(messageId);

    const utter = new SpeechSynthesisUtterance(String(text || ""));
    speechRef.current.utterance = utter;
    const v = pickVoice();
    if (v) utter.voice = v;
    // Small bias to match preference even when voice names don't map cleanly.
    if (voicePref === "feminine") utter.pitch = 1.1;
    if (voicePref === "masculine") utter.pitch = 0.9;
    utter.onend = () => setSpeakingMessageId(null);
    utter.onerror = () => setSpeakingMessageId(null);
    synth.speak(utter);
  };

  const handleSend = async () => {
    if (!canSend) return;

    const chatId = activeChat.id;
    const text = composer.trim();
    const history = buildHistory();

    setComposer("");
    setError("");
    setLoading(true);

    appendMessage(chatId, { id: uid(), role: "user", content: text, ts: Date.now() });

    const thinkingId = uid();
    appendMessage(chatId, { id: thinkingId, role: "assistant", content: "", ts: Date.now(), meta: { thinking: true } });

    try {
      const payloadForStorage = buildPayload(text);
      const payloadToSend = { ...payloadForStorage, history };
      const data = await callGenerate(payloadToSend);

      replaceMessage(chatId, thinkingId, {
        id: uid(),
        role: "assistant",
        content: data.output || "",
        ts: Date.now(),
        meta: { latency: data.latency ?? null, model: data.model, settings: data.settings },
        lastPayload: payloadForStorage,
      });
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to generate. Please try again.";
      setError(msg);
      replaceMessage(chatId, thinkingId, { id: uid(), role: "assistant", content: `Error: ${msg}`, ts: Date.now(), meta: { isError: true } });
    } finally {
      setLoading(false);
    }
  };

  const canRegenerate = useMemo(() => !!activeChat?.messages?.some((m) => m.lastPayload) && !loading, [activeChat?.messages, loading]);

  const handleRegenerate = async () => {
    if (!canRegenerate) return;

    const chatId = activeChat.id;
    const lastAssistant = [...activeChat.messages].reverse().find((m) => m.lastPayload);
    const payload = lastAssistant?.lastPayload;
    if (!payload) return;

    setError("");
    setLoading(true);

    const thinkingId = uid();
    appendMessage(chatId, { id: thinkingId, role: "assistant", content: "", ts: Date.now(), meta: { thinking: true } });

    try {
      const data = await callGenerate({ ...payload, history: buildHistory() });
      replaceMessage(chatId, thinkingId, {
        id: uid(),
        role: "assistant",
        content: data.output || "",
        ts: Date.now(),
        meta: { latency: data.latency ?? null, model: data.model, settings: data.settings },
        lastPayload: payload,
      });
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to regenerate. Please try again.";
      setError(msg);
      replaceMessage(chatId, thinkingId, { id: uid(), role: "assistant", content: `Error: ${msg}`, ts: Date.now(), meta: { isError: true } });
    } finally {
      setLoading(false);
    }
  };

  const shownSettings = activeChat?.settings || { mode, length, tone };

  return (
    <div className="h-screen overflow-hidden" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="relative flex h-screen w-full min-h-0 overflow-hidden">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          mode={mode}
          setMode={setMode}
          length={length}
          setLength={setLength}
          tone={tone}
          setTone={setTone}
          onRegenerate={handleRegenerate}
          canRegenerate={canRegenerate}
          themePref={themePref}
          setThemePref={setThemePref}
          voicePref={voicePref}
          setVoicePref={setVoicePref}
        />

        <section className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 px-4 py-3 md:px-6" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-xl text-xs md:hidden"
                style={{ border: "1px solid var(--border)", background: "var(--panel)" }}
                aria-label="Open sidebar"
                title="Menu"
              >
                <PanelLeft size={18} strokeWidth={2.5} />
              </button>
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{activeChat?.title || "DINOVA"}</div>
                <div className="text-xs dinova-muted">
                  Tool: {shownSettings.mode} | Length: {shownSettings.length}
                  {shownSettings.mode === "email" ? ` | Tone: ${shownSettings.tone}` : ""}
                </div>
              </div>
            </div>
            <div className="text-xs dinova-muted">No login required</div>
          </header>

          {storageWarning ? (
            <div className="px-4 pt-3 text-xs dinova-muted">{storageWarning}</div>
          ) : null}

          <MessageList
            messages={activeChat?.messages || []}
            onCopy={handleCopy}
            onLike={handleLike}
            onDislike={handleDislike}
            onExportPdf={handleExportPdf}
            onSpeak={handleSpeak}
            speakingMessageId={speakingMessageId}
          />

          <div>
            {error ? (<div className="px-4 pt-3 text-sm" style={{ color: "#ef4444" }}>{error}</div>) : null}
            <ChatInput value={composer} onChange={setComposer} onSend={handleSend} disabled={!canSend} />
          </div>
        </section>
      </div>

      <ConfirmModal
        open={deleteDialog.open}
        title="Delete chat?"
        description={
          deleteDialog.chatId
            ? `This will delete "${chats.find((c) => c.id === deleteDialog.chatId)?.title || "this chat"}".`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteChat}
        onCancel={cancelDeleteChat}
      />
    </div>
  );
}
