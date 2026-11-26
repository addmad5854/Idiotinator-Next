import AsyncStorage from '@react-native-async-storage/async-storage';

export type MemoryEntry = {id: string; text: string; source: 'user'; createdAt: number};
const KEY = '@idiotinator/adaptive-memory/v1';
const LIMIT = 500;
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
    if (entries.length >= LIMIT) throw new Error('Memory limit reached');
    entries.push({id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), text: clean, source: 'user', createdAt: Date.now()});
    await AsyncStorage.setItem(KEY, JSON.stringify(entries));
  });
}

export function deleteMemory(id: string): Promise<void> {
  return mutate(async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify((await readEntries()).filter(e => e.id !== id)));
  });
}

export function explicitMemoryRequest(text: string): string | null {
  const match = /^remember (?:that )?(.+)$/is.exec(text.trim());
  return match ? normalizeMemory(match[1]) || null : null;
}

export function retrieveMemories(entries: MemoryEntry[], query: string): MemoryEntry[] {
  const words = new Set(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
  return entries.map(entry => ({entry, score: [...new Set(entry.text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])].filter(w => words.has(w)).length}))
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || b.entry.createdAt - a.entry.createdAt)
    .slice(0, 5).map(x => x.entry);
}
