/**
 * POST /api/request — the club materials request endpoint.
 *
 * Does two things on every valid submission:
 *   1. files the submission in the CodeSpark inbox (this is the "stored in
 *      our email" half — every request lands as a searchable thread, with
 *      Reply-To set to the requester so replying just works)
 *   2. sends the requester an immediate confirmation
 *
 * Delivery runs through Resend. Required environment variables on Vercel:
 *   RESEND_API_KEY   — from resend.com/api-keys
 *   MAIL_FROM        — a verified sender, e.g. "CodeSpark Clubs <clubs@yourdomain>"
 *                      (falls back to Resend's shared onboarding sender)
 *   MAIL_TO          — where submissions are filed (defaults to the club inbox)
 *
 * With no RESEND_API_KEY set this returns 503 and the front end quietly falls
 * back to a mail draft, so the form is never broken while the key is missing.
 */

const INBOX = process.env.MAIL_TO || 'clubs.codespark@gmail.com';
const FROM = process.env.MAIL_FROM || 'CodeSpark Clubs <onboarding@resend.dev>';

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

async function send(key, message) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ error: 'Mail not configured' });

  // Vercel parses JSON bodies, but be tolerant of a raw string.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 200);
  const school = String(body.school || '').trim().slice(0, 200);
  const students = String(body.students || '').trim().slice(0, 10);
  const need = String(body.need || '').trim().slice(0, 120);
  const notes = String(body.notes || '').trim().slice(0, 4000);

  if (!name || !school || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  const rows = [
    ['Name', name],
    ['Email', email],
    ['School', school],
    ['Students expected', students || '—'],
    ['Requesting', need || '—'],
    ['Notes', notes || '—'],
  ];

  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#666c74;font:12px/1.5 -apple-system,sans-serif;white-space:nowrap;vertical-align:top">${esc(k)}</td>` +
        `<td style="padding:6px 0;color:#121416;font:14px/1.6 -apple-system,sans-serif">${esc(v).replace(/\n/g, '<br>')}</td></tr>`
    )
    .join('');

  // Filing the submission is the part that must not fail — that is the
  // club's record of the request. The confirmation is best-effort: on
  // Resend's shared sender, mail to anyone but the account owner is
  // rejected until a domain is verified, and a student losing their
  // request because of that would be the worst possible failure.
  try {
    await send(key, {
      from: FROM,
      to: [INBOX],
      reply_to: email,
      subject: `Club request — ${school} (${students || '?'} students)`,
      html:
        `<h2 style="font:600 18px/1.3 -apple-system,sans-serif;color:#121416;margin:0 0 16px">New club materials request</h2>` +
        `<table cellpadding="0" cellspacing="0">${table}</table>`,
      text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    });

    return res.status(200).json({ ok: true, confirmed: await confirm(key, { name, email, school, need, students }) });
  } catch (err) {
    console.error('filing the submission failed:', err);
    return res.status(502).json({ error: 'Delivery failed' });
  }
}

// Best-effort confirmation to the requester. Returns whether it went out;
// never throws, so it cannot take the submission down with it.
// TODO: swap this copy for Armaan's template once he sends it.
async function confirm(key, { name, email, school, need, students }) {
  try {
    await send(key, {
      from: FROM,
      to: [email],
      reply_to: INBOX,
      subject: 'Your CodeSpark club materials are on the way',
      html:
        `<div style="font:15px/1.65 -apple-system,sans-serif;color:#121416;max-width:520px">` +
        `<p>Hi ${esc(name.split(/\s+/)[0])},</p>` +
        `<p>Thanks for requesting materials for <strong>${esc(school)}</strong>. We've got your request and your club pack will land in this inbox within 24 hours.</p>` +
        `<p>You asked for: <strong>${esc(need || 'the full starter kit')}</strong>${students ? `, for around ${esc(students)} students` : ''}.</p>` +
        `<p>Questions before then? Just reply to this email.</p>` +
        `<p style="color:#666c74">— The CodeSpark Clubs team</p>` +
        `</div>`,
      text:
        `Hi ${name.split(/\s+/)[0]},\n\n` +
        `Thanks for requesting materials for ${school}. We've got your request and your club pack will land in this inbox within 24 hours.\n\n` +
        `You asked for: ${need || 'the full starter kit'}${students ? `, for around ${students} students` : ''}.\n\n` +
        `Questions before then? Just reply to this email.\n\n— The CodeSpark Clubs team`,
    });
    return true;
  } catch (err) {
    console.warn('confirmation to requester not sent:', err.message);
    return false;
  }
}
