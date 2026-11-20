// Backend log lines: time, level, text. Used by the Test environment page and a test's
// "Backend log" tab.
import { esc } from '../lib.js';

const tf = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hour12: false });

const highlight = (text, q) => {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
};

/** HTML for log lines (already filtered). */
export function logLinesHtml(lines, q = '') {
  return lines
    .map((l) => {
      const level = l.level === 'warn' || l.level === 'warning' ? 'warn' : l.level === 'error' || l.level === 'fatal' ? 'error' : 'info';
      return `<div class="ln ${level}"><span class="t">${l.t ? tf.format(new Date(l.t)) : ''}</span><span class="lv">${esc(l.level)}</span><span class="tx">${highlight(l.text, q)}</span></div>`;
    })
    .join('');
}

export const matchesLog = (l, { q = '', level = 'all', apiOnly = false }) =>
  (level === 'all' || (level === 'problems' ? /warn|error|fatal/.test(l.level) : l.level === level)) &&
  (!apiOnly || l.text.startsWith('[HTTP]')) &&
  (!q || l.text.toLowerCase().includes(q.toLowerCase()));
