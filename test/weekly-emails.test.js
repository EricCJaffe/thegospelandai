import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEEKLY_EMAILS } from '../content/weekly-emails.js';
import { renderEmail } from '../lib/email-render.js';
import { checkVerses } from '../lib/verses.js';

test('ten weeks, numbered 1..10, each complete', () => {
  assert.deepEqual(WEEKLY_EMAILS.map((e) => e.week), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const e of WEEKLY_EMAILS) {
    for (const k of ['chapter', 'subject', 'preheader']) assert.ok(e[k], `week ${e.week} ${k}`);
    assert.ok(e.verse.ref && e.verse.text, `week ${e.week} verse`);
    assert.ok(e.body.length >= 2, `week ${e.week} body`);
    assert.ok(e.subject.length <= 70, `week ${e.week} subject too long`);
  }
});

test('every verse reference exists', () => {
  for (const e of WEEKLY_EMAILS) {
    const r = checkVerses(e.verse.ref);
    assert.deepEqual(r.invalid, [], `week ${e.week}`);
    assert.equal(r.verses.length, 1, `week ${e.week} ${e.verse.ref} not recognized`);
  }
});

test('render escapes content and carries both color forms and an unsubscribe link', () => {
  const out = renderEmail({ ...WEEKLY_EMAILS[0], subject: '<b>x</b> & "y"' }, { unsubscribeUrl: 'https://example.com/u?a=1&b=2' });
  assert.ok(!out.html.includes('<b>x</b>'));
  assert.ok(out.html.includes('&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;'));
  assert.ok(out.html.includes('href="https://example.com/u?a=1&amp;b=2"'));
  assert.ok(out.html.includes('bgcolor="#1E3A5F"') && out.html.includes('background-color:#1E3A5F'));
  assert.ok(out.text.includes('Unsubscribe: https://example.com/u?a=1&b=2'));
  assert.ok(out.text.includes(WEEKLY_EMAILS[0].verse.ref));
});

test('builder only: nothing in the email path can send', () => {
  for (const f of ['content/weekly-emails.js', 'lib/email-render.js', 'api/admin/emails.js']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /resend|sendgrid|nodemailer|postmark|mailgun|graph\.microsoft|fetch\(/i, f);
  }
});
