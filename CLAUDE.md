# DINOVA — Claude Context

## What is this?

DINOVA is a focused AI chat assistant for professional writing tasks — emails, summaries, plans, and general Q&A. Hackathon-built project (Eluwole David), powered by Groq (llama-3.3-70b-versatile) via a Node.js backend. No user accounts, all state in localStorage.

## Architecture

```
dinova-monorepo/
├── frontend/          # React 18 + Vite 5 + Tailwind CSS 3.4
│   ├── src/
│   │   ├── App.jsx              # Main app shell, all state, chat management
│   │   ├── components/
│   │   │   ├── Sidebar.jsx      # Mobile drawer + tools/prefs/history
│   │   │   ├── ChatInput.jsx    # Composer bar (length dropdown, theme toggle, send)
│   │   │   ├── MessageList.jsx  # Scrollable message area
│   │   │   ├── MessageBubble.jsx # User/assistant bubbles + markdown + action row
│   │   │   └── ConfirmModal.jsx # Delete confirmation dialog
│   │   ├── hooks/
│   │   │   └── useThemePreference.js  # system/dark/light theme state
│   │   └── index.css            # CSS vars, composer styles, markdown styles
│   └── index.html               # Viewport meta, Sora font (loaded from CDN)
├── backend/           # Express + Groq SDK
│   ├── index.js       # /api/health, /api/generate endpoints
│   └── .env           # GROQ_API_KEY, ALLOWED_ORIGIN
└── package.json       # Monorepo root: concurrently runs both
```

## Tech Stack

- **Frontend**: React 18, Vite 5, Tailwind 3.4 (class-based dark mode), axios, jsPDF, lucide-react, react-hot-toast, react-markdown + remark-gfm
- **Backend**: Express 4, Groq SDK (groq-sdk), dotenv, cors, nodemon (dev)
- **Model**: `llama-3.3-70b-versatile` via Groq (configurable via `GROQ_MODEL` env var)

## Commands

```bash
npm run dev          # Start both (concurrently)
npm run frontend     # Vite dev server (port 5173)
npm run backend      # Express dev server (port 5000, nodemon)
cd frontend && npm run build   # Production build (Vite)
```

Backend env vars (in `backend/.env`):
- `GROQ_API_KEY` — required
- `ALLOWED_ORIGIN` — optional, for production CORS
- `GROQ_MODEL` — optional, defaults to `llama-3.3-70b-versatile`
- `PORT` — optional, defaults to 5000

## Theming System

CSS variables in `index.css` drive light/dark mode. Tailwind uses `class` darkMode strategy.

| Variable      | Light                              | Dark                                         |
| ------------- | ---------------------------------- | -------------------------------------------- |
| `--bg`        | `color-mix(#8d99ae 14%, #fff)`    | `#000000`                                    |
| `--panel`     | `#ffffff`                          | `#2b2d42`                                    |
| `--text`      | `#2b2d42` (space-indigo)          | `#ffffff`                                    |
| `--muted`     | `#8d99ae` (lavender-grey)         | `#8d99ae`                                    |
| `--border`    | `color-mix(#8d99ae 22%, #fff)`    | `color-mix(#8d99ae 28%, #2b2d42)`           |
| `--accent`    | `#2b2d42` (space-indigo)          | `#f8f32b` (bright-lemon)                    |

Brand palette: space-indigo `#2b2d42`, lavender-grey `#8d99ae`, bright-lemon `#f8f32b`

Theme preference stored in localStorage key `dinova_theme_pref_v1`. Logos swap via `.dinova-logo-light` / `.dinova-logo-dark` CSS visibility rules.

## Chat Modes

Four modes, each with its own prompt template in the backend:
- **email** — professional outreach/application email with structured output (subject, body, signature). Supports inline context: `Role:`, `Company:`, `Name:`, etc.
- **summary** — executive summary (TL;DR, Key Points, Next Steps)
- **plan** — practical numbered plan with timeline, risks, success metrics
- **general** — natural chat, greeting detection, conversational tone

Each chat stores its mode/length/tone settings in `chat.settings`.

## State Management

All state lives in `App.jsx` and persists to localStorage:
- `dinova_chats_v3` — chat history (last 60 messages per chat, compacted)
- `dinova_ui_v1` — mode, length, tone, voice preference, active chat ID

Empty chats auto-clean on load (`hasMeaningfulMessages` filter).

## Key Gotchas

- **Mobile viewport**: Uses `h-dvh-safe` (custom class) for dynamic viewport height — do NOT replace with `h-screen` as it breaks on mobile browsers with address bar
- **iOS safe areas**: `viewport-fit=cover` is set; use `env(safe-area-inset-*)` for edge padding
- **Composer font size**: Must be ≥16px on mobile to prevent iOS Safari auto-zoom on input focus
- **Sidebar is a mobile drawer**: `fixed` + `translate-x` with backdrop overlay on mobile, `static` on desktop (`md:static`)
- **Logo swapping**: Dark mode shows `logo-dark.png`, light mode shows `logo-light.png` — don't change the class names
- **Inline context in emails**: Users can paste structured fields (Role, Company, etc.) in the input; the backend extracts them via regex and builds a structured prompt

## Git History

- `17a51f3` — initial gitignore
- `7e004bf` — DINOVA: initial hackathon build
- `a401c4b` — feat: add lambda function (later removed, backend reverted to Express+Groq)

Uncommitted changes include: theme system, sidebar drawer, mobile responsive CSS, composer redesign, and backend cleanup (lambda removal).
