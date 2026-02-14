import "dotenv/config";
import express from "express";
import cors from "cors";
import https from "https";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const app = express();
const PORT = process.env.PORT || 5000;
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0";
const REGION = process.env.AWS_REGION || "us-east-1";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

app.use(express.json({ limit: "2mb" }));

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // allow curl/postman
  if (process.env.NODE_ENV === "production") {
    return ALLOWED_ORIGIN ? origin === ALLOWED_ORIGIN : false;
  }
  if (origin.includes("localhost")) return true;
  if (ALLOWED_ORIGIN && origin === ALLOWED_ORIGIN) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

// Force HTTP/1.1 with explicit timeouts. This avoids intermittent HTTP/2 stream cancel errors
// some Windows networks hit when calling AWS endpoints.
const bedrock = new BedrockRuntimeClient({
  region: REGION,
  maxAttempts: 2,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 10_000,
    requestTimeout: 90_000,
    httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 50 }),
  }),
});

const extractOutputText = (decoded) => {
  const contentList = decoded?.output?.message?.content;
  if (Array.isArray(contentList)) {
    const textBlock = contentList.find((item) => item?.text);
    if (textBlock?.text) return textBlock.text;
  }
  return decoded?.results?.[0]?.outputText || decoded?.completion || "";
};

const clampMode = (mode) => {
  return ["email", "summary", "plan", "general"].includes(mode) ? mode : "general";
};

const clampTone = (tone) => {
  return ["professional", "friendly", "urgent"].includes(tone) ? tone : "professional";
};

const clampLength = (length) => {
  return ["short", "medium", "long"].includes(length) ? length : "medium";
};

const lengthToMaxTokens = (length) => {
  if (length === "short") return 420;
  if (length === "long") return 1100;
  return 750;
};

const extractInlineContext = (raw) => {
  // Allows users to paste:
  // Role: X
  // Company: Y
  // Name: Z
  // Portfolio: ...
  // GitHub: ...
  // LinkedIn: ...
  // Email: ...
  const lines = String(raw || "").split(/\r?\n/);
  const ctx = {};
  const kept = [];

  const setIf = (key, value) => {
    const v = String(value || "").trim();
    if (!v) return;
    ctx[key] = v;
  };

  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z ]{1,20})\s*:\s*(.+?)\s*$/);
    if (!m) {
      kept.push(line);
      continue;
    }
    const k = m[1].trim().toLowerCase();
    const v = m[2].trim();

    if (k === "role") setIf("role", v);
    else if (k === "company") setIf("company", v);
    else if (k === "name") setIf("name", v);
    else if (k === "recipient" || k === "to") setIf("recipient", v);
    else if (k === "portfolio") setIf("portfolio", v);
    else if (k === "github") setIf("github", v);
    else if (k === "linkedin") setIf("linkedin", v);
    else if (k === "email") setIf("email", v);
    else kept.push(line);
  }

  return { ctx, task: kept.join("\n").trim() };
};

const lengthToWordRange = (length) => {
  if (length === "short") return "120-160 words";
  if (length === "long") return "220-300 words";
  return "160-220 words";
};

const isGreeting = (text) => {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return false;
  // Keep it simple and robust for hackathon demos.
  return (
    t === "hi" ||
    t === "hello" ||
    t === "hey" ||
    t.startsWith("hello ") ||
    t.startsWith("hi ") ||
    t.startsWith("hey ") ||
    t.startsWith("i'm ") ||
    t.startsWith("im ") ||
    t.startsWith("my name is ") ||
    t.includes("good morning") ||
    t.includes("good afternoon") ||
    t.includes("good evening")
  );
};

const cleanGeneralOutput = (output) => {
  if (typeof output !== "string") return output;
  let s = output.trim();

  // Strip common unwanted "label" headings the model sometimes adds.
  const badFirstLine = /^(#+\s*)?(friendly greeting|greeting response|introduction|purpose|actionable items|conclusion)\s*$/i;
  const lines = s.split(/\r?\n/);
  if (lines.length >= 2 && badFirstLine.test(lines[0].trim())) {
    s = lines.slice(1).join("\n").trim();
  }

  // Remove remaining obvious section headers anywhere in short small-talk outputs.
  s = s
    .replace(/^\s*(#+\s*)?(friendly greeting|greeting response|introduction|purpose|actionable items|conclusion)\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
};

const buildPrompt = ({ mode, input, tone, length }) => {
  const { ctx, task } = extractInlineContext(input);
  const base = `User task:\n${task || input.trim()}\n\nOutput length: ${length} (${lengthToWordRange(length)}).`;

  if (mode === "email") {
    const recipient = ctx.recipient || "[Name/Team]";
    const role = ctx.role || "[Role]";
    const company = ctx.company || "[Company]";
    const name = ctx.name || "[Your Name]";
    const portfolio = ctx.portfolio || "[Portfolio Link]";
    const github = ctx.github || "[GitHub Link]";
    const linkedin = ctx.linkedin || "[LinkedIn]";
    const email = ctx.email || "[Email]";

    return [
      base,
      `Write a concise outreach/application email in a ${tone} tone.`,
      "",
      "Context:",
      `- Recipient: ${recipient}`,
      `- Role: ${role}`,
      `- Company: ${company}`,
      "- My stack: React, JavaScript, API integration, UI/UX implementation",
      `- Links: Portfolio ${portfolio} | GitHub ${github}`,
      "",
      "Requirements:",
      "- No fluff lines like 'I hope this message finds you well' unless the user explicitly requests a formal tone.",
      "- Avoid vague claims like 'throughout my career' or 'positive feedback from users'.",
      "- Use confident, concise tone. No corporate cliches.",
      "- Do not invent names, titles, companies, achievements, or links. If missing, keep bracket placeholders like [Company], [Role], [Portfolio Link].",
      "- In the Body section, include EXACTLY 2 proof bullets and they MUST start with '- ' (dash + space).",
      "- Must include:",
      "  1) subject line",
      "  2) 2-3 sentence intro (who I am + why I'm reaching out)",
      "  3) 2 bullets of proof (projects/skills); use bracket placeholders if specifics are not provided",
      "  4) clear CTA (15-min call / next steps)",
      "  5) signature",
      "",
      "Return output as EXACTLY:",
      "Subject: ...",
      "Body:",
      "...",
      "",
      "Signature format:",
      `Best,`,
      `${name}`,
      `${email} | ${linkedin}`,
    ].join("\n");
  }

  if (mode === "summary") {
    return [
      base,
      "Create an executive summary.",
      "Use this exact structure:",
      "# TL;DR",
      "# Key Points",
      "Use bullets.",
      "# Next Steps",
      "Use bullets.",
    ].join("\n");
  }

  if (mode === "plan") {
    return [
      base,
      "Create a practical plan that someone can follow.",
      "If the user provides time availability (hours/day, hours/week, weekdays/weekends), compute the hours/week and allocate work that matches that constraint.",
      "If the user provides a deadline date or number of days/weeks, map the timeline to that horizon (avoid generic Day 1-5 unless the user asked for it).",
      "If the user asks for deployment steps, prefer dashboard steps and do NOT invent CLI commands unless the user explicitly requested CLI.",
      "Use this exact structure:",
      "# Goal",
      "# Assumptions (only if needed)",
      "# Steps",
      "Use a numbered list.",
      "# Timeline",
      "# Risks & Mitigations",
      "# Success Metrics",
    ].join("\n");
  }

  // General: default to natural chat unless the user explicitly wants structure.
  if (isGreeting(task || input)) {
    return [
      `User said: ${(task || input).trim()}`,
      "Reply naturally in 1-2 sentences as plain text.",
      "No headings, no titles, no markdown, no meta sections like Purpose/Conclusion.",
      "Start directly with the response sentence (do not add a label line like 'Friendly Greeting').",
      "Then ask one short follow-up question to move the conversation forward.",
    ].join("\n");
  }

  return [
    `User message:\n${(task || input).trim()}`,
    "Reply like a helpful chat assistant. Keep it direct and human.",
    "Only use headings/bullets if they clearly help the user (for example: plans, checklists, steps).",
    "Never add meta sections like 'Purpose', 'Actionable Items', or 'Conclusion' unless the user asked for that format.",
    "If the user asks for deployment steps (e.g., Vercel/Render), prefer dashboard steps and do NOT invent CLI commands unless the user explicitly requested CLI.",
  ].join("\n");
};

const normalizeHistory = (history) => {
  if (!Array.isArray(history)) return [];
  const cleaned = [];
  for (const item of history) {
    if (!item || typeof item !== "object") continue;
    if (item.role !== "user" && item.role !== "assistant") continue;
    const text = typeof item.content === "string" ? item.content : "";
    if (!text.trim()) continue;
    cleaned.push({ role: item.role, content: [{ text }] });
  }
  // Keep the payload small.
  return cleaned.slice(-10);
};

app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post("/api/generate", async (req, res) => {
  const start = Date.now();
  try {
    const { mode, input, tone, length, history } = req.body || {};

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return res.status(400).json({ error: "Input is required." });
    }

    if (input.length > 10000) {
      return res.status(400).json({ error: "Input is too long (max 10000 chars)." });
    }

    const safeMode = clampMode(mode);
    const safeTone = clampTone(tone);
    const safeLength = clampLength(length);

    const systemText =
      safeMode === "email"
        ? "You are a helpful assistant that writes concise, human-sounding professional outreach emails. Follow constraints exactly."
        : safeMode === "general"
          ? "You are DINOVA, a helpful chat assistant. Respond naturally. Do not add headings/titles unless the user requests structure."
        : "You are DINOVA, a concise professional assistant. Return Markdown. Follow the requested structure exactly. Avoid filler.";

    const prompt = buildPrompt({
      mode: safeMode,
      input,
      tone: safeTone,
      length: safeLength,
    });

    const msgs =
      safeMode === "general"
        ? [...normalizeHistory(history), { role: "user", content: [{ text: prompt }] }]
        : [{ role: "user", content: [{ text: prompt }] }];

    const body = JSON.stringify({
      schemaVersion: "messages-v1",
      system: [{ text: systemText }],
      messages: msgs,
      inferenceConfig: {
        maxTokens: lengthToMaxTokens(safeLength),
        temperature: safeMode === "email" ? 0.4 : 0.2,
        topP: 0.9,
      },
    });

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body,
    });

    const response = await bedrock.send(command);
    const raw = response.body?.transformToString
      ? await response.body.transformToString()
      : new TextDecoder().decode(response.body);
    const decoded = JSON.parse(raw);

    let output = extractOutputText(decoded);
    if (!output) {
      if (process.env.NODE_ENV !== "production") {
        output = JSON.stringify(decoded);
      } else {
        output = "The model returned an empty response.";
      }
    }

    // Defensive cleanup: remove obvious formatting artifacts if the model inserts them.
    if (safeMode === "email" && typeof output === "string") {
      output = output.replace(/\n---\n/g, "\n\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    if (safeMode === "general") {
      output = cleanGeneralOutput(output);
    }

    const latency = Date.now() - start;
    return res.json({
      output,
      latency,
      model: MODEL_ID,
      settings: { mode: safeMode, tone: safeTone, length: safeLength },
    });
  } catch (err) {
    console.error("Bedrock error:", err);

    const isProd = process.env.NODE_ENV === "production";
    return res.status(500).json({
      error: "Something went wrong while generating the response. Please try again.",
      ...(isProd
        ? {}
        : {
            details: {
              name: err?.name,
              code: err?.code,
              message: err?.message,
            },
          }),
    });
  }
});

app.listen(PORT, () => {
  console.log(`DINOVA backend running on port ${PORT}`);
});
