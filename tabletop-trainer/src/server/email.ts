/**
 * Pure email templates. No I/O — the Edge Functions do the sending, these
 * functions only build strings, so they can be unit-tested and previewed.
 *
 * Everything interpolated into HTML goes through `escapeHtml`. Display names
 * are user-supplied, so this is the boundary that stops an injected `<script>`
 * or broken markup from reaching someone's inbox.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SHELL_OPEN =
  '<div style="max-width:560px;margin:0 auto;background:#f7f5ef;border-radius:14px;' +
  'overflow:hidden;border:1px solid #e5dfd0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">';

function header(subtitle: string): string {
  return (
    '<div style="background:#10314a;padding:20px 24px;">' +
    '<div style="font:800 20px system-ui,sans-serif;color:#f2f7fb;">🎲 Tabletop Trainer</div>' +
    `<div style="font:400 13px system-ui,sans-serif;color:#b9d2e4;margin-top:4px;">${subtitle}</div>` +
    '</div>'
  );
}

function button(href: string, label: string): string {
  return (
    `<a href="${escapeHtml(href)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;` +
    'text-decoration:none;font:600 15px system-ui,sans-serif;padding:11px 22px;border-radius:8px;">' +
    `${escapeHtml(label)}</a>`
  );
}

/** Footer required for bulk mail: visible unsubscribe + sender identity. */
function footer(unsubscribeUrl: string, senderAddress: string): string {
  return (
    '<div style="padding:14px 24px;font:400 12px system-ui,sans-serif;color:#8a8168;">' +
    `You're receiving this because you subscribed to the daily Catan puzzle. ` +
    `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b6249;">Unsubscribe</a>.` +
    `<br />${escapeHtml(senderAddress)}` +
    '</div>'
  );
}

export interface DailyEmailOptions {
  displayName: string;
  puzzleDate: string;
  /** One entry per puzzle, already signed and absolute. */
  puzzleUrls: string[];
  unsubscribeUrl: string;
  leaderboardUrl: string;
  senderAddress: string;
}

export function dailyEmailSubject(puzzleDate: string): string {
  return `Your ${puzzleDate} Catan puzzles — 5 boards are ready`;
}

export function renderDailyEmail(options: DailyEmailOptions): string {
  const rows = options.puzzleUrls
    .map(
      (url, i) =>
        '<tr>' +
        '<td style="padding:10px 14px;border-bottom:1px solid #e5dfd0;font:600 15px system-ui,sans-serif;color:#33302a;">' +
        `Puzzle ${i + 1}</td>` +
        '<td style="padding:10px 14px;border-bottom:1px solid #e5dfd0;">' +
        `<a href="${escapeHtml(url)}" style="font:600 14px system-ui,sans-serif;color:#1d4ed8;text-decoration:none;">` +
        `Play board ${i + 1} →</a></td></tr>`,
    )
    .join('');

  return (
    SHELL_OPEN +
    header(`Hi ${escapeHtml(options.displayName)} — your five puzzles for ${escapeHtml(options.puzzleDate)}`) +
    `<table style="width:100%;border-collapse:collapse;background:#ffffff;">${rows}</table>` +
    '<div style="padding:16px 24px;background:#ffffff;border-top:1px solid #e5dfd0;">' +
    button(options.leaderboardUrl, 'See today’s leaderboard') +
    '</div>' +
    '<div style="padding:14px 24px 0;font:400 12px system-ui,sans-serif;color:#8a8168;">' +
    'Snake draft, seat 3 of 4 — place two settlements and two roads, graded S–D. ' +
    'Your first attempt at each board is the one that counts.' +
    '</div>' +
    footer(options.unsubscribeUrl, options.senderAddress) +
    '</div>'
  );
}

export interface ConfirmEmailOptions {
  displayName: string;
  confirmUrl: string;
  senderAddress: string;
}

export const CONFIRM_SUBJECT = 'Confirm your daily Catan puzzle subscription';

export function renderConfirmEmail(options: ConfirmEmailOptions): string {
  return (
    SHELL_OPEN +
    header('One click to start your daily puzzles') +
    '<div style="padding:20px 24px;background:#ffffff;font:400 14px system-ui,sans-serif;color:#33302a;">' +
    `<p style="margin:0 0 14px;">Hi ${escapeHtml(options.displayName)},</p>` +
    '<p style="margin:0 0 18px;">Confirm this address and you’ll get five Catan placement ' +
    'puzzles every morning, with coaching on every settlement and road.</p>' +
    button(options.confirmUrl, 'Confirm subscription') +
    '<p style="margin:18px 0 0;font-size:12px;color:#8a8168;">If you didn’t request this, ' +
    'just ignore this email — nothing will be sent.</p>' +
    '</div>' +
    '<div style="padding:14px 24px;font:400 12px system-ui,sans-serif;color:#8a8168;">' +
    `${escapeHtml(options.senderAddress)}</div>` +
    '</div>'
  );
}

/** Minimal HTML page returned by the confirm/unsubscribe endpoints. */
export function renderNoticePage(title: string, message: string, appUrl?: string): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
    `<title>${escapeHtml(title)}</title></head>` +
    '<body style="margin:0;background:#10314a;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">' +
    '<div style="max-width:520px;margin:12vh auto;background:#f7f5ef;border-radius:16px;padding:32px;">' +
    `<h1 style="margin:0 0 12px;font-size:22px;color:#33302a;">${escapeHtml(title)}</h1>` +
    `<p style="margin:0 0 20px;font-size:15px;color:#5b5443;line-height:1.5;">${escapeHtml(message)}</p>` +
    (appUrl ? button(appUrl, 'Play today’s puzzle') : '') +
    '</div></body></html>'
  );
}
