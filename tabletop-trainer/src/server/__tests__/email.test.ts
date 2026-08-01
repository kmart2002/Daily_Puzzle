import { describe, expect, it } from 'vitest';
import {
  CONFIRM_SUBJECT, dailyEmailSubject, escapeHtml, renderConfirmEmail, renderDailyEmail,
  renderNoticePage, renderUnsubscribeConfirmPage,
} from '../email';

const base = {
  displayName: 'Marty',
  puzzleDate: '2026-08-01',
  puzzleUrls: Array.from({ length: 5 }, (_, i) => `https://example.com/app/?seed=daily-2026-08-01-${i + 1}&t=tok`),
  unsubscribeUrl: 'https://api.example.com/unsubscribe?token=u-1',
  leaderboardUrl: 'https://example.com/app/#leaderboard',
  senderAddress: 'Tabletop Trainer · 1 Example St',
};

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;',
    );
  });
});

describe('daily email', () => {
  it('links every puzzle with an absolute URL', () => {
    const html = renderDailyEmail(base);
    for (const url of base.puzzleUrls) expect(html).toContain(url.replace(/&/g, '&amp;'));
    expect(html).not.toMatch(/href="http:\/\/\/?"/); // the empty-host bug must not return
  });

  it('always includes an unsubscribe link (bulk-mail requirement)', () => {
    expect(renderDailyEmail(base)).toContain(base.unsubscribeUrl.replace(/&/g, '&amp;'));
  });

  it('escapes a hostile display name instead of emitting markup', () => {
    const html = renderDailyEmail({ ...base, displayName: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('escapes ampersands in signed URLs so the query string survives', () => {
    const html = renderDailyEmail(base);
    expect(html).toContain('seed=daily-2026-08-01-1&amp;t=tok');
  });

  it('names the date in the subject', () => {
    expect(dailyEmailSubject('2026-08-01')).toContain('2026-08-01');
  });
});

describe('confirm email', () => {
  it('contains the confirm URL and a fixed subject', () => {
    const html = renderConfirmEmail({
      displayName: 'Marty',
      confirmUrl: 'https://api.example.com/confirm?token=c-1',
      senderAddress: base.senderAddress,
    });
    expect(html).toContain('https://api.example.com/confirm?token=c-1');
    expect(CONFIRM_SUBJECT.length).toBeGreaterThan(0);
  });
});

describe('unsubscribe confirmation page', () => {
  it('puts the state change behind a POST form, so prefetching a GET is inert', () => {
    const page = renderUnsubscribeConfirmPage('https://api.example.com/unsubscribe?token=u-1');
    expect(page).toContain('method="post"');
    expect(page).toContain('action="https://api.example.com/unsubscribe?token=u-1"');
  });

  it('escapes the action URL', () => {
    const page = renderUnsubscribeConfirmPage('https://x.test/u?token=a"><script>alert(1)</script>');
    expect(page).not.toContain('<script>alert(1)</script>');
    expect(page).toContain('&quot;&gt;&lt;script&gt;');
  });
});

describe('notice page', () => {
  it('renders a complete HTML document and escapes its message', () => {
    const page = renderNoticePage('Subscribed', 'Welcome <b>friend</b>', 'https://example.com/app/');
    expect(page.startsWith('<!doctype html>')).toBe(true);
    expect(page).toContain('&lt;b&gt;friend&lt;/b&gt;');
  });
});
