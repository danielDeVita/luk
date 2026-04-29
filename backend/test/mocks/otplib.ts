export function generateSecret(): string {
  return 'TESTTOTPSECRET';
}

export function generateURI(
  accountName: string,
  issuer: string,
  secret: string,
): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

export function verifySync(): boolean {
  return true;
}
