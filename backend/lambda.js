import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const MODEL_ID = process.env.BEDROCK_MODEL_ID || "amazon.nova-lite-v1:0";
const REGION = process.env.AWS_REGION || "us-east-1";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

// In Lambda, default HTTP handling is typically stable and simplest.
const bedrock = new BedrockRuntimeClient({ region: REGION, maxAttempts: 2 });

const extractOutputText = (decoded) => {
  const contentList = decoded?.output?.message?.content;
  if (Array.isArray(contentList)) {
    const textBlock = contentList.find((item) => item?.text);
    if (textBlock?.text) return textBlock.text;
  }
  return decoded?.results?.[0]?.outputText || decoded?.completion || "";
};

const clampMode = (mode) => (["email", "summary", "plan", "general"].includes(mode) ? mode : "general");
const clampTone = (tone) => (["professional", "friendly", "urgent"].includes(tone) ? tone : "professional");
const clampLength = (length) => (["short", "medium", "long"].includes(length) ? length : "medium");

const lengthToMaxTokens = (length) => {
  if (length === "short") return 420;
  if (length === "long") return 1100;
  return 750;
};

const lengthToWordRange = (length) => {
  if (length === "short") return "roughly 60-120 words";
  if (length === "long") return "roughly 220-420 words";
  return "roughly 120-220 words";
};

const extractInlineContext = (raw) => {
  const text = String(raw || "");
  const lines = text.split(/\r?\n/);
  const ctx = {};
  const rest = [];

  const pick = (k) => {
    const key = k.toLowerCase();
    if (key === "role") return "role";
    if (key === "company") return "company";
    if (key === "name") return "name";
    if (key === "recipient") return "recipient";
    if (key === "portfolio") return "portfolio";
    if (key === "github") return "github";
    if (key === "linkedin") return "linkedin";
    if (key === "email") return "email";
    return null;
  };

  for (const line of lines) {
    const m = /^\s*([A-Za-z _-]{2,24})\s*:\s*(.+?)\s*$/.exec(line);
    if (!m) {
      rest.push(line);
      continue;
    }
    const k = pick(m[1]);
    if (!k) {
      rest.push(line);
      continue;
    }
    ctx[k] = m[2];
  }

  return { ctx, task: rest.join("\n").trim() };
};

const isGreeting = (s) => {
  const t = String(s || "").trim().toLowerCase();
  if (!t) return false;
  if (t.length > 60) return false;
  return /^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b/.test(t);
};

const cleanGeneralOutput = (output) => {
  let s = String(output || "");
  // Remove leading label lines sometimes produced by "template-y" outputs.
  s = s.replace(/^\s*(friendly greeting|greeting response)\s*$/gim, "").trim();
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
      "Best,",
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
  return cleaned.slice(-10);
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // allow curl/postman
  if (ALLOWED_ORIGIN) return origin === ALLOWED_ORIGIN;
  // Dev-friendly fallback (lock this down by setting ALLOWED_ORIGIN).
  return origin.includes("localhost") || origin.includes("127.0.0.1");
};

const corsHeaders = (origin) => {
  const allowOrigin = isAllowedOrigin(origin) ? (ALLOWED_ORIGIN ? ALLOWED_ORIGIN : origin || "*") : "null";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
};

const json = (statusCode, origin, payload) => ({
  statusCode,
  headers: {
    "content-type": "application/json; charset=utf-8",
    ...corsHeaders(origin),
  },
  body: JSON.stringify(payload),
});

const parseJsonBody = (event) => {
  const rawBody = event?.body;
  if (!rawBody) return { ok: true, value: {} };
  if (typeof rawBody === "object") return { ok: true, value: rawBody };

  const asString = event?.isBase64Encoded
    ? Buffer.from(rawBody, "base64").toString("utf8")
    : String(rawBody);

  const tryParse = (s) => {
    try {
      return { ok: true, value: JSON.parse(s) };
    } catch (e) {
      return { ok: false, error: e };
    }
  };

  const contentType = String(event?.headers?.["content-type"] || event?.headers?.["Content-Type"] || "");

  // Normal case.
  const first = tryParse(asString);
  if (first.ok) return first;

  // If the request was sent as form-encoded (curl defaults without the right header), parse it.
  if (!asString.trim().startsWith("{") && asString.includes("=")) {
    try {
      const params = new URLSearchParams(asString);
      const obj = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      return { ok: true, value: obj };
    } catch {
      // ignore
    }
  }

  // Common PowerShell/curl mistake: body becomes `{\"k\":\"v\"}` instead of valid JSON.
  if (asString.includes('\\"')) {
    const cleaned = asString.replace(/\\"/g, '"');
    const second = tryParse(cleaned);
    if (second.ok) return second;
  }

  // If it's a JSON-string-encoded JSON (rare), unwrap once.
  if (/^\s*".*"\s*$/s.test(asString)) {
    const unwrapped = tryParse(asString);
    if (unwrapped.ok && typeof unwrapped.value === "string") {
      const third = tryParse(unwrapped.value);
      if (third.ok) return third;
    }
  }

  return first;
};

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";
  const path = event?.rawPath || event?.path || "/";
  const origin = event?.headers?.origin || event?.headers?.Origin || "";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin), body: "" };
  }

  if (!isAllowedOrigin(origin)) {
    return json(403, origin, { error: "Not allowed by CORS." });
  }

  if (method === "GET" && path === "/api/health") {
    return json(200, origin, { ok: true, timestamp: new Date().toISOString() });
  }

  if (method === "POST" && path === "/api/generate") {
    const start = Date.now();
    try {
      const parsedResult = parseJsonBody(event);
      if (!parsedResult.ok) {
        // Useful for debugging early deploy issues; remove once stable if desired.
        const rawBody = event?.body;
        const asString = event?.isBase64Encoded
          ? Buffer.from(String(rawBody || ""), "base64").toString("utf8")
          : String(rawBody || "");
        console.warn("Invalid JSON body", {
          contentType: String(event?.headers?.["content-type"] || event?.headers?.["Content-Type"] || ""),
          isBase64Encoded: !!event?.isBase64Encoded,
          bodyPreview: asString.slice(0, 220),
        });
        return json(400, origin, { error: "Invalid JSON body." });
      }
      const parsed = parsedResult.value || {};
      const { mode, input, tone, length, history } = parsed || {};

      if (!input || typeof input !== "string" || input.trim().length === 0) {
        return json(400, origin, { error: "Input is required." });
      }
      if (input.length > 10000) {
        return json(400, origin, { error: "Input is too long (max 10000 chars)." });
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

      const prompt = buildPrompt({ mode: safeMode, input, tone: safeTone, length: safeLength });
      const msgs =
        safeMode === "general"
          ? [...normalizeHistory(history), { role: "user", content: [{ text: prompt }] }]
          : [{ role: "user", content: [{ text: prompt }] }];

      const reqBody = JSON.stringify({
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
        body: reqBody,
      });

      const response = await bedrock.send(command);
      const raw = response.body?.transformToString
        ? await response.body.transformToString()
        : new TextDecoder().decode(response.body);
      const decoded = JSON.parse(raw);

      let output = extractOutputText(decoded);
      if (!output) output = "The model returned an empty response.";

      if (safeMode === "email" && typeof output === "string") {
        output = output.replace(/\n---\n/g, "\n\n").replace(/\n{3,}/g, "\n\n").trim();
      }
      if (safeMode === "general") output = cleanGeneralOutput(output);

      const latency = Date.now() - start;
      return json(200, origin, {
        output,
        latency,
        model: MODEL_ID,
        settings: { mode: safeMode, tone: safeTone, length: safeLength },
      });
    } catch (err) {
      console.error("Bedrock error:", err);
      return json(500, origin, { error: "Something went wrong while generating the response. Please try again." });
    }
  }

  return json(404, origin, { error: "Not found." });
};
