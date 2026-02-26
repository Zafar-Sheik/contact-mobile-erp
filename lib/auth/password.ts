import bcrypt from "bcryptjs";

export function validatePasswordStrength(password: string) {
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passHash: string) {
  return bcrypt.compare(password, passHash);
}