import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

/**
 * Encrypts small secrets (storage access keys) for the database: AES-256-GCM, random IV,
 * authenticated. Format: "v1:<iv>:<tag>:<ciphertext>" (base64url). Plain function, no
 * framework: copy it to another project as is.
 */
const VERSION = 'v1';

export function deriveKey(material: string, context: string): Buffer {
  // A 32-byte key from any secret string, separated per purpose (context).
  return Buffer.from(
    hkdfSync(
      'sha256',
      createHash('sha256').update(material).digest(),
      '',
      context,
      32,
    ),
  );
}

export function sealSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data]
    .map((part) =>
      typeof part === 'string' ? part : part.toString('base64url'),
    )
    .join(':');
}

/** null when the value was sealed with another key (key changed) or was tampered with. */
export function openSecret(sealed: string, key: Buffer): string | null {
  const [version, iv, tag, data] = sealed.split(':');
  if (version !== VERSION || !iv || !tag || !data) {
    return null;
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/** "AKIA…7Q2X" style hint: never more than the last 4 characters. */
export function maskSecret(plain: string): string {
  return plain.length <= 4 ? '••••' : `••••${plain.slice(-4)}`;
}
