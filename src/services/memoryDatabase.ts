import {database} from '../database';
import type AdaptiveMemory from '../database/models/AdaptiveMemory';
import type {MemoryEntry} from './adaptiveMemory';
const collection = () => database.get<AdaptiveMemory>('adaptive_memories');
export async function readMemoryRows(): Promise<MemoryEntry[]> {
  return (await collection().query().fetch()).map(row => JSON.parse(row.payload) as MemoryEntry);
}
export async function writeMemoryRows(entries: MemoryEntry[]): Promise<void> {
  await database.write(async () => {
    const rows = await collection().query().fetch();
    const existing = new Map(rows.map(row => [row.memoryId,row]));
    const desired = new Set(entries.map(e=>e.id));
    const operations = rows.filter(row=>!desired.has(row.memoryId)).map(row=>row.prepareDestroyPermanently());
    for (const entry of entries) {
      const payload = JSON.stringify(entry);
      const row = existing.get(entry.id);
      if (!row) operations.push(collection().prepareCreate(record=>{record.memoryId=entry.id;record.payload=payload;}));
      else if (row.payload!==payload) operations.push(row.prepareUpdate(record=>{record.payload=payload;}));
    }
    if (operations.length) await database.batch(...operations);
  });
}
