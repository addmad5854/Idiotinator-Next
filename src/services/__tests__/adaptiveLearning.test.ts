import {isSensitiveMemory} from '../memoryPrivacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {retrieveMemories, rememberExplicit, listMemories, learnFeedback, setAutoLearningEnabled, setMemoryEnabled, saveKnowledgeCandidate, updateMemory, exportMemories, restoreMemories, type MemoryEntry} from '../adaptiveMemory';
import {groundedCandidate} from '../knowledgeExtraction';
import {confidence} from '../learningEvidence';

jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map<string,string>();
  return {__esModule:true, default:{getItem:jest.fn(async (k:string)=>data.get(k) ?? null),setItem:jest.fn(async (k:string,v:string)=>{data.set(k,v);}),clear:jest.fn(async()=>{data.clear();})}};
});
jest.mock('../memoryDatabase',()=>{let rows:unknown[]=[];return {readMemoryRows:jest.fn(async()=>JSON.parse(JSON.stringify(rows))),writeMemoryRows:jest.fn(async(v:unknown[])=>{rows=JSON.parse(JSON.stringify(v));})};});
beforeEach(async()=>{await AsyncStorage.clear();await require('../memoryDatabase').writeMemoryRows([]);});
test('unconfirmed candidates never enter chat retrieval',()=>{
  const e:MemoryEntry={id:'1',text:'My motorcycle is blue',source:'user',createdAt:1,evidence:{kind:'model_candidate',text:'My motorcycle is blue',recordedAt:1}};
  expect(retrieveMemories([e],'motorcycle')).toEqual([]);
});
test('extraction rejects fabricated and sensitive quotes',()=>{
  expect(groundedCandidate('My motorcycle is blue','My motorcycle is red')).toBeNull();
  expect(groundedCandidate('My password is abcdef','My password is abcdef')).toBeNull();
  expect(groundedCandidate('My motorcycle is blue','My motorcycle is blue')).toBe('My motorcycle is blue');
});
test('learning is opt-in and respects disabled memory',async()=>{
  await saveKnowledgeCandidate('My motorcycle is blue');
  expect(await listMemories()).toEqual([]);
  await setAutoLearningEnabled(true);
  await setMemoryEnabled(false);
  await learnFeedback('Correction: My preferred language is Marathi');
  expect(await listMemories()).toEqual([]);
});
test('keyed corrections replace old preferences',async()=>{
  await setAutoLearningEnabled(true);
  await rememberExplicit('My preferred language is English');
  await learnFeedback('Correction: My preferred language is Marathi');
  expect((await listMemories()).map(e=>e.text)).toEqual(['My preferred language is Marathi']);
});
test('editing invalidates evidence and backup retains valid evidence',async()=>{
  await setAutoLearningEnabled(true);
  await learnFeedback('Correction: My preferred language is Marathi');
  const backup=await exportMemories();
  await restoreMemories(backup);
  const [entry]=await listMemories();
  expect(entry.evidence?.kind).toBe('user_correction');
  await updateMemory(entry.id,'My preferred language is Hindi');
  expect((await listMemories())[0].evidence).toBeUndefined();
});
test('disputed evidence receives zero confidence',()=>{
  expect(confidence({key:'x',claim:'x',disputed:true,evidence:[]})).toBe(0);
});

test('privacy screening catches email and long identifiers',()=>{expect(isSensitiveMemory('Contact me at test@example.com')).toBe(true);expect(isSensitiveMemory('My identifier is 123456789012')).toBe(true);expect(isSensitiveMemory('My motorcycle is blue')).toBe(false);});
test('mismatched evidence receives no confidence',()=>{expect(confidence({key:'x',claim:'new',disputed:false,evidence:[{kind:'user_correction',text:'old',recordedAt:1}]})).toBe(0);});
