import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// In production, refuse to boot without an explicit JWT_SECRET. A silent
// fallback to "dev-only-secret" on Heroku would let anyone forge sessions.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production (e.g. `heroku config:set JWT_SECRET=...`).");
}
const SECRET = process.env.JWT_SECRET || "dev-only-secret";
const TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export type JwtPayload = { sub: string; username: string };

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: TOKEN_TTL_SEC });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = "mr_session";
const IS_PROD = process.env.NODE_ENV === "production";
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: IS_PROD, // HTTPS required in production
  path: "/",
  maxAge: TOKEN_TTL_SEC,
};
