// Renders one weekly email to { subject, preheader, html, text }.
// Email-client-safe HTML: tables, inline styles, and bgcolor beside every
// background color (Outlook honors the attribute more reliably).
// RENDER ONLY: nothing here sends mail.

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SITE_URL = 'https://thegospelandai.com';

export function renderEmail(email, { unsubscribeUrl = `${SITE_URL}/unsubscribe` } = {}) {
  const ask = `${SITE_URL}/#chat-form`;
  const paras = email.body
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1a1a1a;">${esc(p)}</p>`)
    .join('\n');
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(email.subject)}</title></head>
<body style="margin:0;padding:0;background-color:#F1F5F9;" bgcolor="#F1F5F9">
<span style="display:none;max-height:0;overflow:hidden;">${esc(email.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#F1F5F9" style="background-color:#F1F5F9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
<tr><td bgcolor="#1E3A5F" style="background-color:#1E3A5F;padding:24px 28px;color:#ffffff;">
<div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#CBD5E1;">Anchored in the Storm &middot; Week ${email.week}</div>
<div style="font-size:22px;font-weight:600;margin-top:8px;">${esc(email.subject)}</div>
</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#EFF6FF" style="background-color:#EFF6FF;border-left:4px solid #3B82F6;padding:14px 18px;">
<div style="font-size:16px;font-style:italic;line-height:1.5;color:#1E293B;">&ldquo;${esc(email.verse.text)}&rdquo;</div>
<div style="font-size:13px;font-weight:600;margin-top:6px;color:#1E3A5F;">${esc(email.verse.ref)}</div>
</td></tr></table>
<div style="height:20px;"></div>
${paras}
<p style="margin:8px 0 0;"><a href="${ask}" style="display:inline-block;background-color:#3B82F6;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:500;">Ask Anchored a question</a></p>
</td></tr>
<tr><td style="padding:18px 28px;font-size:12px;color:#64748B;line-height:1.5;">
From chapter ${email.week}: ${esc(email.chapter)}.<br>
Scripture quotations are from the ESV® Bible.<br>
You are getting this because you joined the Anchored in the Storm list. <a href="${esc(unsubscribeUrl)}" style="color:#64748B;">Unsubscribe</a>.
</td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    `ANCHORED IN THE STORM - WEEK ${email.week}`,
    email.subject,
    '',
    `"${email.verse.text}" (${email.verse.ref})`,
    '',
    ...email.body.flatMap((p) => [p, '']),
    `Ask Anchored a question: ${ask}`,
    '',
    `From chapter ${email.week}: ${email.chapter}.`,
    'Scripture quotations are from the ESV(R) Bible.',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return { subject: email.subject, preheader: email.preheader, html, text };
}
