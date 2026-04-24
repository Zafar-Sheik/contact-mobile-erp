import bcrypt from "bcryptjs";

/**
 * Validates password strength requirements
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password || typeof password !== 'string') {
    return "Password is required.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }

  if (password.length > 128) {
    return "Password must be less than 128 characters long.";
  }

  // Check for at least one uppercase, one lowercase, one number
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    return "Password must contain at least one uppercase letter, one lowercase letter, and one number.";
  }

  // Check for common weak passwords (basic check)
  const commonPasswords = ['password', '12345678', 'qwerty', 'admin', 'letmein'];
  if (commonPasswords.includes(password.toLowerCase())) {
    return "Password is too common. Please choose a stronger password.";
  }

  return null;
}

/**
 * Hashes a password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Invalid password provided for hashing');
  }

  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verifies a password against its hash
 */
export async function verifyPassword(password: string, passHash: string): Promise<boolean> {
  if (!password || !passHash) {
    return false;
  }

  try {
    // Handle migration from plain text passwords (temporary)
    if (!passHash.startsWith('$2')) {
      console.warn('[Auth] Plain text password detected - this should be migrated');
      return password === passHash;
    }

    return await bcrypt.compare(password, passHash);
  } catch (error) {
    console.error('[Auth] Password verification error:', error);
    return false;
  }
}

/**
 * Generates a secure random password reset token
 */
export function generatePasswordResetToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Checks if password hash needs rehashing (for security upgrades)
 */
export function needsRehash(passHash: string): boolean {
  if (!passHash.startsWith('$2')) {
    return true; // Plain text needs rehash
  }

  // Could check bcrypt cost factor here if upgraded
  return false;
}