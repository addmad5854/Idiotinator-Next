import {readMemoryRows, writeMemoryRows} from './memoryDatabase';
import {isSensitiveMemory} from './memoryPrivacy';
import {extractFeedback, confidence, type LearningEvidence} from './learningEvidence';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MemoryEntry = {id: string; text: string; source: 'user'; createdAt: number; evidence?: LearningEvidence};
const KEY = '@idiotinator/adaptive-memory/v1';
// Keep each AsyncStorage value below Android's typical per-row read limit.
const MAX_SERIALIZED_BYTES = 1500000;
export function serializeEntries(entries: MemoryEntry[]): string {
  const raw = JSON.stringify(entries);
  // Three bytes per UTF-16 code unit is a conservative UTF-8 upper bound.
  if (raw.length * 3 > MAX_SERIALIZED_BYTES) throw new Error('Memory storage budget reached. Export or delete older memories.');
  return raw;
}
let queue: Promise<unknown> = Promise.resolve();

export function normalizeMemory(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, 1000);
}

async function readLegacyEntries(): Promise<MemoryEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(e => e && typeof e.id === 'string' && typeof e.text === 'string' && e.source === 'user' && typeof e.createdAt === 'number')) {
    throw new Error('Invalid memory store');
  }
  return parsed;
}

let migrated = false;
async function readEntries(): Promise<MemoryEntry[]> {
  if (!migrated) {
    const marker = await AsyncStorage.getItem(KEY + '/sqlite');
    if (marker !== 'true') {
      const old = await readLegacyEntries();
      const rows = await readMemoryRows();
      const merged = new Map(old.map(e=>[e.id,e]));
      for (const row of rows) merged.set(row.id,row);
      await writeMemoryRows([...merged.values()]);
      await AsyncStorage.setItem(KEY + '/sqlite','true');
    }
    migrated = true;
  }
  return readMemoryRows();
}
async function persistEntries(entries: MemoryEntry[]): Promise<void> {
  await readEntries();
  await writeMemoryRows(entries);
}
function mutate<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

export async function listMemories(): Promise<MemoryEntry[]> {
  return mutate(readEntries);
}

export function rememberExplicit(text: string): Promise<void> {
  return mutate(async () => {
    if (!(await memoryEnabled())) return;
    const clean = normalizeMemory(text);
    if (!clean) return;
    const entries = await readEntries();
    if (entries.some(e => e.text.toLowerCase() === clean.toLowerCase())) return;
    entries.push({id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), text: clean, source: 'user', createdAt: Date.now()});
    await persistEntries(entries);
  });
}

export function deleteMemory(id: string): Promise<void> {
  return mutate(async () => {
    await persistEntries((await readEntries()).filter(e => e.id !== id));
  });
}

export function explicitMemoryRequest(text: string): string | null {
  const match = /^remember (?:that )?(.+)$/is.exec(text.trim());
  return match ? normalizeMemory(match[1]) || null : null;
}

const STOP_WORDS = new Set(['the','and','that','this','with','what','when','where','how','can','you','your','remember','about','for','are','was','have','from','tell','please']);
function keywords(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(w => !STOP_WORDS.has(w)));
}
export function retrieveMemories(entries: MemoryEntry[], query: string, charBudget = 1200): MemoryEntry[] {
  const words = keywords(query);
  const ranked = entries.filter(entry => !entry.evidence || ['user_statement', 'user_correction', 'user_confirmed_success'].includes(entry.evidence.kind)).map(entry => {
    const terms = keywords(entry.text);
    const overlap = [...terms].filter(w => words.has(w)).length;
    return {entry, score: overlap / Math.sqrt(Math.max(1, terms.size)) * confidence({key: entry.id, claim: entry.text, disputed: false, evidence: [entry.evidence ?? {kind: 'user_statement', text: entry.text, recordedAt: entry.createdAt}]})};
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score || b.entry.createdAt - a.entry.createdAt);
  const result: MemoryEntry[] = [];
  let remaining = Math.max(0, charBudget);
  for (const {entry} of ranked) {
    const cost = JSON.stringify({text: entry.text, source: entry.evidence?.kind ?? 'user_statement'}).length + 2;
    if (cost > remaining) continue;
    result.push(entry);
    remaining -= cost;
    if (result.length >= 5) break;
  }
  return result;
}

export function updateMemory(id: string, text: string): Promise<void> {
  return mutate(async () => {
    const clean = normalizeMemory(text);
    if (!clean) throw new Error('Memory cannot be empty');
    const entries = await readEntries();
    if (!entries.some(e => e.id === id)) throw new Error('Memory not found');
    await persistEntries(entries.map(e => e.id === id ? {...e, text: clean, evidence: undefined} : e));
  });
}

export async function exportMemories(): Promise<string> {
  return JSON.stringify({schema: 1, entries: await listMemories()}, null, 2);
}

export function restoreMemories(raw: string): Promise<void> {
  return mutate(async () => {
    const data = JSON.parse(raw);
    if (data.schema !== 1 || !Array.isArray(data.entries) || raw.length > MAX_SERIALIZED_BYTES) throw new Error('Invalid backup');
    const ids = new Set<string>();
    const entries: MemoryEntry[] = data.entries.map((e: MemoryEntry) => {
      if (!e || typeof e.id !== 'string' || !e.id || ids.has(e.id) || typeof e.text !== 'string' || !normalizeMemory(e.text) || e.source !== 'user' || !Number.isFinite(e.createdAt)) throw new Error('Invalid memory entry');
      ids.add(e.id);
      return {id: e.id, text: normalizeMemory(e.text), source: 'user', createdAt: e.createdAt, ...(e.evidence && ['user_correction', 'user_confirmed_success', 'model_candidate'].includes(e.evidence.kind) && typeof e.evidence.text === 'string' && normalizeMemory(e.evidence.text) === normalizeMemory(e.text) && Number.isFinite(e.evidence.recordedAt) && e.evidence.recordedAt > 0 ? {evidence: {kind: e.evidence.kind, text: normalizeMemory(e.evidence.text), recordedAt: e.evidence.recordedAt}} : {})};
    });
    await persistEntries(entries);
  });
}

const ENABLE_KEY = KEY + '/enabled';
export async function memoryEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLE_KEY)) !== 'false';
}
export async function setMemoryEnabled(enabled: boolean): Promise<void> {
  await mutate(() => AsyncStorage.setItem(ENABLE_KEY, String(enabled)));
}

type LearnedClaim = {key: string; text: string};
export function extractUserClaim(input: string): LearnedClaim | null {
  const text = input.trim().replace(/^(?:actually|correction)\s*[:,]?\s*/i, '');
  if (text.length > 240 || /[?\n]|(?:password|secret|token|pin code|credit card)/i.test(text)) return null;
  const match = /^(?:my (preferred language|preferred units|preferred editor|preferred programming language|preferred response style|preferred name) is|i (prefer)) ([^.!?]+)[.!]?$/i.exec(text);
  if (!match) return null;
  const value = match[3].trim();
  if (!value || /(?:\b(?:if|unless|sometimes|might|would|maybe|not)\b)/i.test(value)) return null;
  return {key: match[1]?.toLowerCase() || 'general preference:' + value.toLowerCase(), text: match[1] ? 'My ' + match[1].toLowerCase() + ' is ' + value : 'I prefer ' + value};
}

export function learnUserClaim(input: string): Promise<void> {
  return mutate(async () => {
    if (!(await memoryEnabled()) || (await AsyncStorage.getItem(KEY + '/auto')) !== 'true') return;
    if (isSensitiveMemory(input)) return;
    const claim = extractUserClaim(input);
    if (!claim) return;
    const entries = await readEntries();
    const previous = entries.find(e => extractUserClaim(e.text)?.key === claim.key && e.evidence?.kind !== 'model_candidate');
    if (previous?.text.toLowerCase() === claim.text.toLowerCase()) return;
    const next = entries.filter(e => extractUserClaim(e.text)?.key !== claim.key);
    next.push({id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), text: claim.text, source: 'user', createdAt: Date.now()});
    await persistEntries(next);
  });
}
export async function autoLearningEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY + '/auto')) === 'true';
}
export async function setAutoLearningEnabled(enabled: boolean): Promise<void> {
  await mutate(() => AsyncStorage.setItem(KEY + '/auto', String(enabled)));
}

export function learnFeedback(input: string): Promise<void> {
  return mutate(async () => {
    if (!(await memoryEnabled()) || !(await autoLearningEnabled())) return;
    if (isSensitiveMemory(input)) return;
    const evidence = extractFeedback(input);
    if (!evidence) return;
    const text = normalizeMemory(evidence.text);
    const entries = await readEntries();
    if (entries.some(e => e.text.toLowerCase() === text.toLowerCase() && e.evidence?.kind === evidence.kind)) return;
    // Only replace a contradiction when a supported stable preference key matches.
    const claim = extractUserClaim(text);
    const retained = evidence.kind === 'user_correction' && claim ? entries.filter(e => extractUserClaim(e.text)?.key !== claim.key) : entries;
    retained.push({id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), text, source: 'user', createdAt: Date.now(), evidence});
    await persistEntries(retained);
  });
}

export function saveKnowledgeCandidate(quote: string): Promise<void> {
  return mutate(async () => {
    if (!(await memoryEnabled()) || !(await autoLearningEnabled())) return;
    if (isSensitiveMemory(quote)) return;
    const text = normalizeMemory(quote);
    if (!text) return;
    const entries = await readEntries();
    if (entries.some(e => e.text.toLowerCase() === text.toLowerCase())) return;
    const now = Date.now();
    entries.push({id: now.toString(36) + '-' + Math.random().toString(36).slice(2), text, source: 'user', createdAt: now, evidence: {kind:'model_candidate', text, recordedAt:now}});
    await persistEntries(entries);
  });
}
