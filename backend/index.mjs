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

// Set this to your deployed site's origin once you know it, e.g.
// "https://your-username.github.io". Using "*" works for testing but
// allows any site to POST to this function.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

function escapeForNotification(value) {
  return String(value).slice(0, 5000);
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
  // Preflight
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (method !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  if (!TOPIC_ARN) {
    console.error("Missing TOPIC_ARN environment variable");
    return respond(500, { error: "Server misconfigured" });
  }

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return respond(400, { error: "Invalid JSON body" });
  }

  const { name, email, phone, projectType, message, recaptchaToken } = data;

  if (!name || !email || !phone || !message) {
    return respond(400, { error: "name, email, mobile number, and message are required" });
  }

  // Block spam before it can trigger an SNS publish (and its cost).
  if (RECAPTCHA_SECRET) {
    if (!recaptchaToken) {
      return respond(400, { error: "Missing spam-check token" });
    }
    let verification;
    try {
      verification = await verifyRecaptcha(recaptchaToken);
    } catch (err) {
      console.error("reCAPTCHA verification request failed:", err);
      return respond(502, { error: "Could not verify submission" });
    }
    const passesScore = verification.score === undefined || verification.score >= RECAPTCHA_MIN_SCORE;
    if (!verification.success || !passesScore) {
      console.warn("reCAPTCHA rejected submission:", verification);
      return respond(403, { error: "Spam check failed" });
    }
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return respond(400, { error: "Invalid email address" });
  }

  // Accepts digits with optional leading +, spaces, dashes, dots, parens;
  // requires at least 7 digits so single-digit junk gets rejected.
  const phonePattern = /^[+()\d][\d\s().-]{6,}$/;
  if (!phonePattern.test(phone.trim())) {
    return respond(400, { error: "Invalid mobile number" });
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

  try {
    await sns.send(
      new PublishCommand({
        TopicArn: TOPIC_ARN,
        Subject: `New inquiry from ${String(name).slice(0, 80)}`,
        Message: messageText,
      })
    );
    return respond(200, { ok: true });
  } catch (err) {
    console.error("SNS publish failed:", err);
    return respond(502, { error: "Could not send notification" });
  }
};
