export function validateUsername(username: string): string | null {
  if (!username || username.length < 3 || username.length > 50) return 'Username must be 3-50 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username must be alphanumeric or underscore';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < 6) return 'Password must be at least 6 characters';
  return null;
}
