/**
 * Cloudflare Worker for nazimhossain.org.
 *
 * - Serves the built website from the dist folder.
 * - Sends www.nazimhossain.org visitors to nazimhossain.org.
 * - Receives the forms at /api/send and emails them to Nazim.
 *
 * The address that receives the forms is the FORM_TO secret, set in the
 * Cloudflare dashboard, so it never appears in this public code.
 */
import { EmailMessage } from "cloudflare:email";
import FORMS from "./forms.json";

const SITE = "https://nazimhossain.org";
const FROM = "forms@nazimhossain.org";
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.startsWith("www.")) {
      return Response.redirect(SITE + url.pathname + url.search, 301);
    }
    if (url.pathname === "/api/send") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
      }
      return handleSend(request, env);
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

async function handleSend(request, env) {
  const wantsJson = (request.headers.get("Accept") || "").includes("application/json");
  const reply = (ok, error) => {
    if (wantsJson) {
      return new Response(JSON.stringify(ok ? { ok: true } : { ok: false, error }), {
        status: ok ? 200 : 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    return Response.redirect(SITE + (ok ? "/message-sent/" : "/message-not-sent/"), 303);
  };

  let data;
  try {
    data = await request.formData();
  } catch {
    return reply(false, "The form could not be read.");
  }
  const get = (name, max) => String(data.get(name) || "").trim().slice(0, max);
  const key = get("form", 40);
  const form = FORMS[key];
  if (!form) return reply(false, "Unknown form.");
  if (get("website", 200)) return reply(true); // filled in by a bot, so quietly ignore it

  const name = get("name", 100).replace(/[\r\n]+/g, " ");
  const email = get("email", 254);
  const phone = get("phone", 40).replace(/[\r\n]+/g, " ");
  const message = get("message", 4000);
  const words = message ? message.split(/\s+/).length : 0;

  if (form.contact_required && (!name || !email)) return reply(false, "Name and email are required.");
  if (email && !EMAIL.test(email)) return reply(false, "The email address is not valid.");
  if (!message) return reply(false, "The message is empty.");
  if (words > form.max_words) return reply(false, `The message is longer than ${form.max_words} words.`);

  const lines = [`Form: ${form.title}`, `Name: ${name || "Not given"}`, `Email: ${email || "Not given"}`];
  if (form.contact_required) lines.push(`Phone or WhatsApp: ${phone || "Not given"}`);
  if (form.choose_one) {
    const choice = get(form.choose_one.name, 200);
    if (!form.choose_one.options.includes(choice)) return reply(false, form.choose_one.error);
    lines.push(labelled(form.choose_one.legend.replace(/ \(choose one\)$/, ""), choice));
  }
  if (form.choose_many) {
    const allowed = [...form.choose_many.options, "Other"];
    const chosen = data.getAll(form.choose_many.name).map(String).filter((v) => allowed.includes(v));
    const other = get("other", 200).replace(/[\r\n]+/g, " ");
    const list = chosen.map((v) => (v === "Other" && other ? `Other: ${other}` : v));
    lines.push(labelled(form.choose_many.legend.replace(/ \(choose all that apply\)$/, ""), list.length ? list.join("; ") : "None chosen"));
  }
  lines.push("", `Message (${words} words):`, message, "", `Sent from the ${form.title} form on ${SITE} on ${bangladeshTime()} (Bangladesh time).`);

  if (!env.FORM_TO || !env.MAILER) {
    console.error("FORM_TO secret or MAILER binding is missing.");
    return reply(false, "The form is not set up yet.");
  }
  const subject = `${form.title}: ${name || "message from the website"}`;
  const raw = [
    `From: "nazimhossain.org" <${FROM}>`,
    `To: <${env.FORM_TO}>`,
    ...(email ? [`Reply-To: <${email}>`] : []),
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@nazimhossain.org>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(lines.join("\r\n")).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");

  try {
    await env.MAILER.send(new EmailMessage(FROM, env.FORM_TO, raw));
  } catch (error) {
    console.error("Sending failed:", error);
    return new Response(wantsJson ? JSON.stringify({ ok: false, error: "Sending failed." }) : null, {
      status: wantsJson ? 502 : 303,
      headers: wantsJson ? { "Content-Type": "application/json; charset=utf-8" } : { Location: SITE + "/message-not-sent/" },
    });
  }
  return reply(true);
}

function labelled(label, value) {
  return /[?:]$/.test(label) ? `${label} ${value}` : `${label}: ${value}`;
}

function bangladeshTime() {
  return new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "long", timeStyle: "short" });
}

function base64(text) {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function encodeHeader(text) {
  if (/^[\x20-\x7e]*$/.test(text)) return text;
  const chunks = [];
  let current = "";
  for (const char of text) {
    if (new TextEncoder().encode(current + char).length > 42) {
      chunks.push(current);
      current = "";
    }
    current += char;
  }
  if (current) chunks.push(current);
  return chunks.map((chunk) => `=?UTF-8?B?${base64(chunk)}?=`).join("\r\n ");
}
