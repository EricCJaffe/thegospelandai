// Admin: preview the weekly email sequence. READ ONLY, and there is no send:
// sending waits on a provider, a list decision and Eric's separate yes.
//   GET /api/admin/emails        -> { emails: [{ week, chapter, subject, preheader }] }
//   GET /api/admin/emails?week=N -> { week, chapter, subject, preheader, html, text }
// Auth: header `x-admin-password` must match ADMIN_PASSWORD (as resources.js).
import { WEEKLY_EMAILS } from '../../content/weekly-emails.js';
import { renderEmail } from '../../lib/email-render.js';

function checkAuth(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(503).json({ error: 'Admin is not configured. Set ADMIN_PASSWORD.' });
    return false;
  }
  const given = req.headers['x-admin-password'];
  if (!given || given !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export default function handler(req, res) {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const week = req.query?.week;
  if (week === undefined) {
    return res.status(200).json({
      emails: WEEKLY_EMAILS.map(({ week, chapter, subject, preheader }) => ({ week, chapter, subject, preheader })),
    });
  }
  const email = WEEKLY_EMAILS.find((e) => String(e.week) === String(week));
  if (!email) return res.status(404).json({ error: 'No email for that week.' });
  return res.status(200).json({ week: email.week, chapter: email.chapter, ...renderEmail(email) });
}
