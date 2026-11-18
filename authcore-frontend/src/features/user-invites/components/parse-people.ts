import type { InvitePerson } from '../types/invite.types';

export const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/;

export interface ParsedLine {
  line: number;
  raw: string;
  person: InvitePerson | null;
  problem: string | null;
}

/** "a@x.com, b@y.com" on one line → two entries (named entries stay whole). */
const splitPlainEmails = (line: string): string[] =>
  !line.includes('<') && (line.match(/@/g)?.length ?? 0) > 1 ? line.split(/[s,;]+/) : [line];

/**
 * One person per line: "email", "email, First, Last" or "First Last <email>".
 * Commas / semicolons between plain emails work too.
 */
export function parsePeople(text: string): ParsedLine[] {
  const lines = text
    .split(/\r?\n/)
    .flatMap(splitPlainEmails)
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return lines.map((raw, index) => {
    let email = '';
    let firstName: string | undefined;
    let lastName: string | undefined;
    const angle = /^(.*)<([^>]+)>$/.exec(raw);
    if (angle) {
      email = (angle[2] ?? '').trim();
      const names = (angle[1] ?? '').trim().replace(/^"|"$/g, '').split(/\s+/).filter(Boolean);
      firstName = names[0];
      lastName = names.slice(1).join(' ') || undefined;
    } else {
      const parts = raw.split(/[,;\t]/).map((p) => p.trim());
      email = parts[0] ?? '';
      firstName = parts[1] || undefined;
      lastName = parts[2] || undefined;
    }
    email = email.toLowerCase();
    let problem: string | null = null;
    if (!EMAIL.test(email)) problem = 'Not a valid email';
    else if (seen.has(email)) problem = 'Listed twice';
    seen.add(email);
    return {
      line: index + 1,
      raw,
      person: problem ? null : { email, firstName, lastName },
      problem,
    };
  });
}
