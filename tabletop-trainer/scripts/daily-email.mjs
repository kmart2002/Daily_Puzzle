/**
 * Generates the daily puzzle email (HTML) for today's five seeded puzzles.
 * Run by .github/workflows/daily-puzzle-email.yml; writes email.html and
 * prints a subject line. No dependencies — plain Node.
 *
 * Env:
 *   APP_URL — where the app is hosted (default: the repo's GitHub Pages path)
 */
import { writeFileSync } from 'node:fs';

const APP_URL = (process.env.APP_URL ?? 'https://kmart2002.github.io/improved-engine/tabletop-trainer/')
  .replace(/\/?$/, '/');

const now = new Date();
const stamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(
  now.getUTCDate(),
).padStart(2, '0')}`;

const seeds = Array.from({ length: 5 }, (_, i) => `daily-${stamp}-${i + 1}`);

const rows = seeds
  .map(
    (seed, i) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e5dfd0;font:600 15px system-ui,sans-serif;color:#33302a;">
          Puzzle ${i + 1}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5dfd0;">
          <a href="${APP_URL}?seed=${seed}"
             style="font:600 14px system-ui,sans-serif;color:#1d4ed8;text-decoration:none;">
            Play board ${seed} →
          </a>
        </td>
      </tr>`,
  )
  .join('');

const html = `
<div style="max-width:560px;margin:0 auto;background:#f7f5ef;border-radius:14px;overflow:hidden;border:1px solid #e5dfd0;">
  <div style="background:#10314a;padding:20px 24px;">
    <div style="font:800 20px system-ui,sans-serif;color:#f2f7fb;">🎲 Tabletop Trainer</div>
    <div style="font:400 13px system-ui,sans-serif;color:#b9d2e4;margin-top:4px;">
      Your five Catan placement puzzles for ${stamp}
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;background:#ffffff;">${rows}</table>
  <div style="padding:14px 24px;font:400 12px system-ui,sans-serif;color:#8a8168;">
    Snake draft, seat 3 of 4 — place two settlements and two roads, get graded S–D.
    Five short puzzles ≈ one coffee. Same boards for every player today.
  </div>
</div>`;

writeFileSync('email.html', html);
console.log(`subject=Your ${stamp} Catan puzzles — 5 boards are ready`);
