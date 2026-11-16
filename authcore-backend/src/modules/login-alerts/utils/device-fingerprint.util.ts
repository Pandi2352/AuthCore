import { createHash } from 'node:crypto';

import Bowser from 'bowser';

/**
 * Identifies "the same device" across sign-ins: browser name + OS name +
 * device type. Versions are ignored, so browser / OS updates don't look like
 * a new device. Based on the User-Agent: good for alerts, not for security
 * decisions (it can be spoofed).
 */
export function deviceFingerprint(userAgent: string): string {
  const parsed = userAgent.trim() === '' ? null : Bowser.parse(userAgent);
  const parts = parsed
    ? [
        parsed.browser.name ?? 'unknown-browser',
        parsed.os.name ?? 'unknown-os',
        parsed.platform.type ?? 'unknown',
      ]
    : ['unknown-browser', 'unknown-os', 'unknown'];
  return createHash('sha256')
    .update(parts.join('|').toLowerCase())
    .digest('hex');
}
