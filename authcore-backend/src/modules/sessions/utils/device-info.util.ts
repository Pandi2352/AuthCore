import Bowser from 'bowser';

export interface DeviceInfo {
  /** desktop, mobile, tablet, tv, bot or unknown */
  deviceType: string;
  /** e.g. "Chrome 131" */
  browser: string | null;
  /** e.g. "Windows 10", "iOS 18.1" */
  os: string | null;
  /** e.g. "Chrome 131 on Windows 10" */
  deviceName: string;
}

function majorVersion(version: string | undefined): string {
  return version ? (version.split('.')[0] ?? '') : '';
}

function join(...parts: (string | undefined)[]): string | null {
  const value = parts.filter(Boolean).join(' ').trim();
  return value === '' ? null : value;
}

/** Best-effort device details from a User-Agent header (never trusted for security). */
export function parseDeviceInfo(userAgent: string): DeviceInfo {
  if (userAgent.trim() === '') {
    return {
      deviceType: 'unknown',
      browser: null,
      os: null,
      deviceName: 'Unknown device',
    };
  }

  const parsed = Bowser.parse(userAgent);
  const browser = join(
    parsed.browser.name,
    majorVersion(parsed.browser.version),
  );
  const os = join(parsed.os.name, parsed.os.versionName ?? parsed.os.version);
  const deviceType = parsed.platform.type ?? 'unknown';

  const deviceName =
    browser && os ? `${browser} on ${os}` : (browser ?? os ?? 'Unknown device');

  return { deviceType, browser, os, deviceName };
}
