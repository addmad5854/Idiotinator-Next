import AsyncStorage from '@react-native-async-storage/async-storage';

export type MemoryEntry = {id: string; text: string; source: 'user'; createdAt: number};
const KEY = '@idiotinator/adaptive-memory/v1';
// Keep each AsyncStorage value below Android's typical per-row read limit.
const MAX_SERIALIZED_BYTES = 1500000;
function serializeEntries(entries: MemoryEntry[]): string {
  const raw = JSON.stringify(entries);
  // Three bytes per UTF-16 code unit is a conservative UTF-8 upper bound.
  if (raw.length * 3 > MAX_SERIALIZED_BYTES) throw new Error('Memory storage budget reached. Export or delete older memories.');
  return raw;
}
let queue: Promise<unknown> = Promise.resolve();

export function normalizeMemory(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, 1000);
}

async function readEntries(): Promise<MemoryEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(e => e && typeof e.id === 'string' && typeof e.text === 'string' && e.source === 'user' && typeof e.createdAt === 'number')) {
    throw new Error('Invalid memory store');
  }
  return parsed;
}

function mutate<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

export async function listMemories(): Promise<MemoryEntry[]> {
  await queue;
  return readEntries();
}

export function rememberExplicit(text: string): Promise<void> {
  return mutate(async () => {
    const clean = normalizeMemory(text);
    if (!clean) return;
    const entries = await readEntries();
    if (entries.some(e => e.text.toLowerCase() === clean.toLowerCase())) return;
    entries.push({id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), text: clean, source: 'user', createdAt: Date.now()});
    await AsyncStorage.setItem(KEY, serializeEntries(entries));
  });
}

export function deleteMemory(id: string): Promise<void> {
  return mutate(async () => {
    await AsyncStorage.setItem(KEY, serializeEntries((await readEntries()).filter(e => e.id !== id)));
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
  const ranked = entries.map(entry => {
    const terms = keywords(entry.text);
    const overlap = [...terms].filter(w => words.has(w)).length;
    return {entry, score: overlap / Math.sqrt(Math.max(1, terms.size))};
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score || b.entry.createdAt - a.entry.createdAt);
  const result: MemoryEntry[] = [];
  let remaining = Math.max(0, charBudget);
  for (const {entry} of ranked) {
    const cost = JSON.stringify(entry.text).length + 2;
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
    await AsyncStorage.setItem(KEY, serializeEntries(entries.map(e => e.id === id ? {...e, text: clean} : e)));
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
      return {id: e.id, text: normalizeMemory(e.text), source: 'user', createdAt: e.createdAt};
    });
    await AsyncStorage.setItem(KEY, JSON.stringify(entries));
  });
}

const ENABLE_KEY = KEY + '/enabled';
export async function memoryEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLE_KEY)) !== 'false';
}
export async function setMemoryEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLE_KEY, String(enabled));
}
