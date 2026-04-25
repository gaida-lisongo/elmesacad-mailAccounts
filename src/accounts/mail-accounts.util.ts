import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const parseMailbox = (email: string) => {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error('invalid_email');
  }
  const [localPart, domain] = normalized.split('@');
  if (!localPart || !domain) {
    throw new Error('invalid_email');
  }
  const relativeMaildir = `${domain}/${localPart}/`;
  return { email: normalized, localPart, domain, relativeMaildir };
};

const randomSalt = (length = 16) => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./';
  const bytes = randomBytes(length);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
};

export const buildDovecotHash = async (password: string) => {
  if (!password) {
    throw new Error('invalid_password');
  }
  const salt = randomSalt();
  let raw = '';
  try {
    const { stdout } = await execFileAsync('openssl', [
      'passwd',
      '-6',
      '-salt',
      salt,
      password,
    ]);
    raw = stdout.trim();
  } catch (error) {
    const commandError = error as Error & { code?: string };
    if (commandError.code === 'ENOENT') {
      throw new Error('openssl_missing');
    }
    throw new Error('hash_generation_failed');
  }
  if (!raw || !raw.startsWith('$6$')) {
    throw new Error('hash_generation_failed');
  }
  return `{SHA512-CRYPT}${raw}`;
};
