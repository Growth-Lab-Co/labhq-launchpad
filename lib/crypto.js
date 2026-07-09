// Shared AES-256-GCM encryption for anything at rest in Netlify Blobs that
// needs it (GHL OAuth connections, portal account records). One key, derived
// from LAUNCHPAD_MASTER_KEY - see DEPLOY.md "OAuth apps" for how it's set.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export function encryptionKey() {
  const secret = process.env.LAUNCHPAD_MASTER_KEY;
  if (!secret) throw new Error("LAUNCHPAD_MASTER_KEY is not set");
  return createHash("sha256").update(secret).digest();
}

export function encrypt(obj) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}
