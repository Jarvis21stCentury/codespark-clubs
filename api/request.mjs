/**
 * POST /api/request — the club materials request endpoint.
 *
 * Does two things on every valid submission:
 *   1. files the submission in the CodeSpark inbox (this is the "stored in
 *      our email" half — every request lands as a searchable thread, with
 *      Reply-To set to the requester so replying just works)
 *   2. sends the requester the materials email — the Drive link and the
 *      resources-site password
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

// What the materials email hands over. Kept here rather than buried in the
// template so rotating the password or moving the folder is a one-line edit
// and does not mean reading through email markup.
const DRIVE_URL =
  'https://drive.google.com/drive/folders/1hmYUTXw46KDtx2EpTzxbr0ychAh_FV6_?usp=sharing';
const RESOURCES_URL = 'https://sparkresources.github.io/';
const RESOURCES_PASSWORD = 'CoffeeLake92';

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
    // Send the materials first, so the notification can report what happened.
    const confirmed = await confirm(key, { name, email });

    const banner = confirmed
      ? `<p style="background:#eef7ee;border-left:3px solid #2f7d32;padding:10px 14px;font:14px/1.5 -apple-system,sans-serif;color:#1b4d1e;margin:0 0 20px">` +
        `Materials email delivered to ${esc(email)}. No action needed.</p>`
      : `<p style="background:#fdeeea;border-left:3px solid #c0392b;padding:10px 14px;font:14px/1.5 -apple-system,sans-serif;color:#7a2318;margin:0 0 20px">` +
        `<strong>The materials email did NOT reach ${esc(email)}.</strong> ` +
        `Send them the Drive link manually. (Usually the unverified-sender limit — see README.)</p>`;

    await send(key, {
      from: FROM,
      to: [INBOX],
      reply_to: email,
      subject: (confirmed ? '' : '[ACTION NEEDED] ') +
        `Club request — ${school} (${students || '?'} students)`,
      html:
        `<h2 style="font:600 18px/1.3 -apple-system,sans-serif;color:#121416;margin:0 0 16px">New club materials request</h2>` +
        banner +
        `<table cellpadding="0" cellspacing="0">${table}</table>`,
      text:
        (confirmed
          ? `Materials email delivered to ${email}. No action needed.\n\n`
          : `ACTION NEEDED: the materials email did NOT reach ${email}. Send the Drive link manually.\n\n`) +
        rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    });

    return res.status(200).json({ ok: true, confirmed });
  } catch (err) {
    console.error('filing the submission failed:', err);
    return res.status(502).json({ error: 'Delivery failed' });
  }
}

// The materials email — the whole point of the form. It hands over the Drive
// link and the resources-site password the moment someone asks, rather than
// making them wait on a person.
//
// Best-effort by design: it reports whether it went out and never throws, so a
// delivery failure cannot take the submission down with it. Note the sender
// restriction in README.md — on Resend's shared sender this is rejected for
// anyone but the account owner until a domain is verified.
async function confirm(key, { name, email }) {
  const first = String(name).trim().split(/\s+/)[0] || 'there';
  const link = (url) =>
    `<a href="${url}" style="color:#c2410c;word-break:break-all">${url}</a>`;

  try {
    await send(key, {
      from: FROM,
      to: [email],
      reply_to: INBOX,
      subject: 'Your CodeSpark Clubs materials',
      html:
        `<div style="font:15px/1.65 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#121416;max-width:560px">` +
          `<p>Hi ${esc(first)},</p>` +
          `<p>I've shared the Google Drive with the free materials. Let me know if you need any further help!</p>` +
          `<p>Make sure to let us know once you have accessed the material!</p>` +
          `<p>Share this with other schools if possible as well.</p>` +
          `<p>Best,<br>CodeSparkClubs Team</p>` +
          `<hr style="border:0;border-top:1px solid #e3e5e8;margin:28px 0">` +
          `<p style="margin-bottom:6px">Here is the link to access the free materials (via Google Drive):</p>` +
          `<p style="margin-top:0">${link(DRIVE_URL)}</p>` +
          `<p style="margin-bottom:6px">Optionally you may also access the material through our website: ${link(RESOURCES_URL)}</p>` +
          `<p style="margin-top:0">The password is: ` +
            `<strong style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f2f4;padding:3px 7px;border-radius:4px">${RESOURCES_PASSWORD}</strong>` +
          `</p>` +
        `</div>`,
      text:
        `Hi ${first},\n\n` +
        `I've shared the Google Drive with the free materials. Let me know if you need any further help!\n\n` +
        `Make sure to let us know once you have accessed the material!\n\n` +
        `Share this with other schools if possible as well.\n\n` +
        `Best,\n\nCodeSparkClubs Team\n\n\n` +
        `Here is the link to access the free materials (via Google Drive):\n` +
        `${DRIVE_URL}\n\n` +
        `Optionally you may also access the material through our website: ${RESOURCES_URL}\n` +
        `The password is: ${RESOURCES_PASSWORD}\n`,
    });
    return true;
  } catch (err) {
    console.warn('materials email to requester not sent:', err.message);
    return false;
  }
}
