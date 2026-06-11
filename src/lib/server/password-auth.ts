import "server-only";

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

const PASSWORD_HASH_ALGORITHM = "scrypt";
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_HASH_OPTIONS = {
  N: 16_384,
  maxmem: 64 * 1024 * 1024,
  p: 1,
  r: 8,
} satisfies ScryptOptions;
const PASSWORD_HASH_SEPARATOR = "$";
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keyLength: number,
  options: ScryptOptions,
) => Promise<Buffer>;

type PasswordHashParts = {
  hash: Buffer;
  options: ScryptOptions;
  salt: string;
};

function createPasswordSalt() {
  return randomBytes(16).toString("base64url");
}

function parsePasswordHash(value: string): PasswordHashParts | null {
  const [algorithm, n, r, p, salt, hash] = value.split(PASSWORD_HASH_SEPARATOR);

  if (
    algorithm !== PASSWORD_HASH_ALGORITHM ||
    salt === undefined ||
    hash === undefined
  ) {
    return null;
  }

  const parsedN = Number(n);
  const parsedR = Number(r);
  const parsedP = Number(p);

  if (
    !Number.isInteger(parsedN) ||
    !Number.isInteger(parsedR) ||
    !Number.isInteger(parsedP) ||
    parsedN <= 0 ||
    parsedR <= 0 ||
    parsedP <= 0
  ) {
    return null;
  }

  return {
    hash: Buffer.from(hash, "base64url"),
    options: {
      N: parsedN,
      maxmem: PASSWORD_HASH_OPTIONS.maxmem,
      p: parsedP,
      r: parsedR,
    },
    salt,
  };
}

export async function hashUserPassword(password: string, salt = createPasswordSalt()) {
  const hash = await scrypt(
    password,
    salt,
    PASSWORD_HASH_KEY_LENGTH,
    PASSWORD_HASH_OPTIONS,
  );

  return [
    PASSWORD_HASH_ALGORITHM,
    PASSWORD_HASH_OPTIONS.N,
    PASSWORD_HASH_OPTIONS.r,
    PASSWORD_HASH_OPTIONS.p,
    salt,
    hash.toString("base64url"),
  ].join(PASSWORD_HASH_SEPARATOR);
}

export async function verifyUserPassword(password: string, storedHash: string | null) {
  if (storedHash === null) {
    return false;
  }

  const parsedHash = parsePasswordHash(storedHash);

  if (parsedHash === null) {
    return false;
  }

  const candidateHash = await scrypt(
    password,
    parsedHash.salt,
    parsedHash.hash.byteLength,
    parsedHash.options,
  );

  return (
    candidateHash.byteLength === parsedHash.hash.byteLength &&
    timingSafeEqual(candidateHash, parsedHash.hash)
  );
}
