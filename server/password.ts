import crypto from "crypto";

const SCRYPT_KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt.toString("base64")}:${derivedKey.toString("base64")}`);
    });
  });
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [saltBase64, hashBase64] = storedHash.split(":");
  if (!saltBase64 || !hashBase64) {
    return false;
  }

  const salt = Buffer.from(saltBase64, "base64");
  const storedHashBuffer = Buffer.from(hashBase64, "base64");

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(crypto.timingSafeEqual(storedHashBuffer, derivedKey));
    });
  });
}
