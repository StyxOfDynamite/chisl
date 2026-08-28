// chisl — contact form handler
// Runtime: Node.js 18.x or later (AWS SDK v3 is bundled in the Lambda runtime)
//
// Flow: static site POSTs JSON -> this Lambda -> publishes to an SNS topic
// -> your subscribed email/SMS/etc. gets notified. No database involved.

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({});
const TOPIC_ARN = process.env.TOPIC_ARN;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;
// Submissions scoring below this are treated as bots (0.0 = bot, 1.0 = human).
const RECAPTCHA_MIN_SCORE = Number(process.env.RECAPTCHA_MIN_SCORE || "0.5");

// Comma-separated list of origins allowed to POST here, e.g.
// "https://chisl.io,https://styxofdynamite.github.io". The site lives at the
// github.io URL until the custom domain is attached, so both need to work.
// "*" allows any site — fine for testing, not for production.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// CORS only permits a single origin in the response header, so echo back
// whichever allowed origin actually made the request.
function corsHeaders(requestOrigin) {
  let allowOrigin;
  if (ALLOWED_ORIGINS.includes("*")) {
    allowOrigin = "*";
  } else if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    allowOrigin = requestOrigin;
  } else {
    // Not an allowed origin — name the canonical one so the browser blocks it.
    allowOrigin = ALLOWED_ORIGINS[0];
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // Without this, a cache could serve one origin's response to another.
    Vary: "Origin",
  };
}

function respond(statusCode, body, requestOrigin) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders(requestOrigin) },
    body: JSON.stringify(body),
  };
}

function escapeForNotification(value) {
  return String(value).slice(0, 5000);
}

// Hard ceiling on the SMS body. GSM-7 packs 160 characters into a billable
// segment, so 300 is two segments — enough for contact details plus a useful
// slice of the message, without a long submission running up a bill.
const SMS_MAX_CHARS = Number(process.env.SMS_MAX_CHARS || "300");

// Characters outside the GSM-7 alphabet (emoji, curly quotes, em dashes)
// force the whole message into UCS-2, which drops the segment size from 160
// to 70 — more than doubling the cost. Fold the common ones back to ASCII.
function toGsmSafe(value) {
  return String(value)
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    // Anything still non-GSM gets dropped rather than silently doubling cost.
    .replace(/[^\x20-\x7E\n\r@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉÄÖÑÜ§¿äöñüà]/g, "");
}

function buildSmsText({ email, phone, message }) {
  const header = `chisl inquiry\n${toGsmSafe(email)}\n${toGsmSafe(phone)}\n`;
  const room = SMS_MAX_CHARS - header.length;

  // Collapse newlines so the body doesn't burn segment space on formatting.
  const body = toGsmSafe(message).replace(/\s+/g, " ").trim();

  if (room <= 0) return header.slice(0, SMS_MAX_CHARS);
  return header + (body.length > room ? body.slice(0, Math.max(0, room - 3)) + "..." : body);
}

// Verifies a reCAPTCHA v3 token with Google. Node 18+ Lambda runtimes
// include a global `fetch`, so no extra dependency is needed.
async function verifyRecaptcha(token) {
  const params = new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token });
  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  return res.json();
}

export const handler = async (event) => {
  // Header casing isn't guaranteed, so check both spellings.
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin;

  // Preflight
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(origin), body: "" };
  }

  if (method !== "POST") {
    return respond(405, { error: "Method not allowed" }, origin);
  }

  if (!TOPIC_ARN) {
    console.error("Missing TOPIC_ARN environment variable");
    return respond(500, { error: "Server misconfigured" }, origin);
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON body" }, origin);
  }

  const { name, email, phone, projectType, message, recaptchaToken } = data;

  if (!name || !email || !phone || !message) {
    return respond(400, { error: "name, email, mobile number, and message are required" }, origin);
  }

  // Block spam before it can trigger an SNS publish (and its cost).
  if (RECAPTCHA_SECRET) {
    if (!recaptchaToken) {
      return respond(400, { error: "Missing spam-check token" }, origin);
    }
    let verification;
    try {
      verification = await verifyRecaptcha(recaptchaToken);
    } catch (err) {
      console.error("reCAPTCHA verification request failed:", err);
      return respond(502, { error: "Could not verify submission" }, origin);
    }
    const passesScore = verification.score === undefined || verification.score >= RECAPTCHA_MIN_SCORE;
    if (!verification.success || !passesScore) {
      console.warn("reCAPTCHA rejected submission:", verification);
      return respond(403, { error: "Spam check failed" }, origin);
    }
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return respond(400, { error: "Invalid email address" }, origin);
  }

  // Accepts digits with optional leading +, spaces, dashes, dots, parens;
  // requires at least 7 digits so single-digit junk gets rejected.
  const phonePattern = /^[+()\d][\d\s().-]{6,}$/;
  if (!phonePattern.test(phone.trim())) {
    return respond(400, { error: "Invalid mobile number" }, origin);
  }

  const messageText = [
    "New contact form submission — chisl.io",
    "",
    `Name: ${escapeForNotification(name)}`,
    `Email: ${escapeForNotification(email)}`,
    `Mobile: ${escapeForNotification(phone)}`,
    `Project type: ${escapeForNotification(projectType || "Not specified")}`,
    "",
    "Message:",
    escapeForNotification(message),
  ].join("\n");

  // SMS is billed per 160-character segment, so the text subscribers get is
  // capped rather than carrying the full (up to 5000-char) message body.
  const smsText = buildSmsText({ email, phone, message });

  try {
    await sns.send(
      new PublishCommand({
        TopicArn: TOPIC_ARN,
        Subject: `New inquiry from ${String(name).slice(0, 80)}`,
        // Per-protocol payloads: email gets the full submission, SMS gets the
        // trimmed version. "default" covers any other subscriber type.
        MessageStructure: "json",
        Message: JSON.stringify({
          default: messageText,
          email: messageText,
          sms: smsText,
        }),
        MessageAttributes: {
          // Transactional prioritises delivery over cost — right for an
          // inquiry alert, and it bypasses promotional-message filtering.
          "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
        },
      })
    );
    return respond(200, { ok: true }, origin);
  } catch (err) {
    console.error("SNS publish failed:", err);
    return respond(502, { error: "Could not send notification" }, origin);
  }
};
