import {Q, Model} from '@nozbe/watermelondb';
import {database} from '../database';
import type AdaptiveMemory from '../database/models/AdaptiveMemory';
import type {MemoryEntry} from './adaptiveMemory';
import type AdaptiveMemoryTerm from '../database/models/AdaptiveMemoryTerm';
const termsTable=()=>database.get<AdaptiveMemoryTerm>('adaptive_memory_terms');
const tokens=(s:string)=>[...new Set(s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])];
const collection = () => database.get<AdaptiveMemory>('adaptive_memories');
export async function readMemoryRows(): Promise<MemoryEntry[]> {
  return (await collection().query().fetch()).map(row => JSON.parse(row.payload) as MemoryEntry);
}
export async function writeMemoryRows(entries: MemoryEntry[]): Promise<void> {
  await database.write(async () => {
    const rows = await collection().query().fetch();
    const existing = new Map(rows.map(row => [row.memoryId,row]));
    const desired = new Set(entries.map(e=>e.id));
    const operations: Model[] = rows.filter(row=>!desired.has(row.memoryId)).map(row=>row.prepareDestroyPermanently());
    for (const entry of entries) {
      const payload = JSON.stringify(entry);
      const row = existing.get(entry.id);
      if (!row) operations.push(collection().prepareCreate(record=>{record.memoryId=entry.id;record.payload=payload;}));
      else if (row.payload!==payload) operations.push(row.prepareUpdate(record=>{record.payload=payload;}));
    }
    const oldTerms=await termsTable().query().fetch();
    const desiredTerms=new Map<string,{term:string;memoryId:string}>();
    for(const e of entries) for(const term of tokens(e.text)) desiredTerms.set(JSON.stringify([e.id,term]),{term,memoryId:e.id});
    for(const row of oldTerms){const key=JSON.stringify([row.memoryId,row.term]);if(desiredTerms.has(key)) desiredTerms.delete(key);else operations.push(row.prepareDestroyPermanently());}
    for(const value of desiredTerms.values()) operations.push(termsTable().prepareCreate(row=>{row.term=value.term;row.memoryId=value.memoryId;}));
    if (operations.length) await database.batch(...operations);
  });
}

export async function searchMemoryRows(terms: string[]): Promise<MemoryEntry[]> {
  if (!terms.length) return [];
  const hits=await termsTable().query(Q.where('term',Q.oneOf(terms.slice(0,32)))).fetch();
  const ids=[...new Set(hits.map(row=>row.memoryId))];
  const result:MemoryEntry[]=[];
  for(let i=0;i<ids.length;i+=400) result.push(...(await collection().query(Q.where('memory_id',Q.oneOf(ids.slice(i,i+400)))).fetch()).map(row=>JSON.parse(row.payload) as MemoryEntry));
  return result;
}
export async function pageMemoryRows(query:string,page:number):Promise<{entries:MemoryEntry[];total:number}>{
 const filters=query.trim()?[Q.where('payload',Q.like('%'+Q.sanitizeLikeString(query.trim())+'%'))]:[];
 const total=await collection().query(...filters).fetchCount();
 const entries=(await collection().query(...filters,Q.sortBy('memory_id',Q.desc),Q.skip(Math.max(0,page)*20),Q.take(20)).fetch()).map(row=>JSON.parse(row.payload) as MemoryEntry);
 return {entries,total};
}
