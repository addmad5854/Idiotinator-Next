// Defense in depth, not a guarantee of sensitive-data detection.
export function isSensitiveMemory(text: string): boolean {
  return /\b(?:password|passphrase|passwd|secret|api[\s_-]*key|access[\s_-]*token|refresh[\s_-]*token|private[\s_-]*key|otp|pin|aadhaar|aadhar|passport|credit card|debit card|bank account|medical diagnosis|medical record)\b/i.test(text)
    || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)
    || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)
    || /(?:\d[\s-]?){10,}/.test(text)
    || /\b(?:ghp_|github_pat_|sk-|AKIA)[A-Za-z0-9_-]{12,}/.test(text);
}
