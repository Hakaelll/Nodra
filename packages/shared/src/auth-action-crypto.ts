import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export type SealedAuthToken = {
  encryptedToken: string;
  nonce: string;
  tag: string;
};

function mailKey(secret: string) {
  return createHash("sha256")
    .update("nodra-auth-mail-v1")
    .update(Buffer.from([0]))
    .update(secret)
    .digest();
}

export function sealAuthToken(
  token: string,
  actionId: string,
  secret: string,
): SealedAuthToken {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", mailKey(secret), nonce);
  cipher.setAAD(Buffer.from(actionId, "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return {
    encryptedToken: encrypted.toString("base64url"),
    nonce: nonce.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  };
}

export function openAuthToken(
  sealed: SealedAuthToken,
  actionId: string,
  secret: string,
) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    mailKey(secret),
    Buffer.from(sealed.nonce, "base64url"),
  );
  decipher.setAAD(Buffer.from(actionId, "utf8"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(sealed.encryptedToken, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
