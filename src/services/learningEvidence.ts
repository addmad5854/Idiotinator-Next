export type EvidenceKind = 'user_statement' | 'user_correction' | 'user_confirmed_success' | 'web_source' | 'model_candidate';
export type LearningEvidence = {kind: EvidenceKind; text: string; recordedAt: number; url?: string};
export type LearningRecord = {key: string; claim: string; evidence: LearningEvidence[]; disputed: boolean};
export function confidence(record: LearningRecord): number {
  if (record.disputed) return 0;
  const kinds = new Set(record.evidence.map(e => e.kind));
  if (kinds.has('user_correction') || kinds.has('user_confirmed_success')) return 0.9;
  if (kinds.has('user_statement')) return 0.8;
  // A URL is provenance, not independent verification.
  if (kinds.has('web_source')) return 0.4;
  return 0.1;
}
export function extractFeedback(input: string): LearningEvidence | null {
  const text = input.trim();
  if (text.length > 1000 || text.length < 12) return null;
  const correction = /^(?:correction|the correct answer is|actually)\s*[:,]?\s+(.+)/i.exec(text);
  const success = /^(?:this worked|the solution that worked was|successful approach)\s*[:,]\s*(.+)/i.exec(text);
  if (!correction && !success) return null;
  const claim = (correction || success)![1].trim();
  if (!claim || /[?]|password|secret|api key|credit card/i.test(claim)) return null;
  return {kind: correction ? 'user_correction' : 'user_confirmed_success', text: claim, recordedAt: Date.now()};
}
export function mayUseAsConfirmed(record: LearningRecord): boolean {
  return confidence(record) >= 0.8;
}
