import {confidence} from '../../services/learningEvidence';
import React, {useEffect, useState} from 'react';
import {Alert, Share, View} from 'react-native';
import {Button, Card, Switch, Text, TextInput} from 'react-native-paper';
import {listMemoryPage, memoryEnabled, setMemoryEnabled, updateMemory, deleteMemory, exportMemories, restoreMemories, autoLearningEnabled, setAutoLearningEnabled, type MemoryEntry} from '../../services/adaptiveMemory';

export function MemoryCard() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [auto, setAuto] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [backup, setBackup] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [total,setTotal]=useState(0);
  const [page, setPage] = useState(0);
  async function refresh() {
    const result=await listMemoryPage(query,page);
    setEntries(result.entries);setTotal(result.total);
    setEnabled(await memoryEnabled());
    setAuto(await autoLearningEnabled());
    setReady(true);
  }
  useEffect(() => {refresh().catch(() => Alert.alert('Memory unavailable', 'Could not read local memory.'));}, [query,page]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {await action(); await refresh();}
    catch (e) {Alert.alert('Memory operation failed', e instanceof Error ? e.message : 'Unknown error');}
    finally {setBusy(false);}
  }

  return <Card style={{marginVertical: 8}}><Card.Content>
    <Text variant="titleLarge">Personal memory</Text>
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
      <Text>Use memory in chat</Text>
      <Switch value={enabled} disabled={!ready || busy} onValueChange={v => {void run(() => setMemoryEnabled(v));}} />
    </View>
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}><Text>Automatically learn preferences</Text><Switch value={auto} disabled={!ready || busy || !enabled} onValueChange={v => {void run(() => setAutoLearningEnabled(v));}} /></View>
    <Text>Stored locally. Disabling memory does not delete existing entries.</Text>
    <TextInput label="Search memories" value={query} onChangeText={v => {setQuery(v); setPage(0);}} />
    <Text>{total} matching memories</Text>
    {entries.map(e => <View key={e.id} style={{paddingVertical: 8}}>
      {editing === e.id ? <>
        <TextInput multiline value={draft} onChangeText={setDraft} maxLength={1000} />
        <Button disabled={busy || !draft.trim()} onPress={() => {void run(async () => {await updateMemory(e.id, draft); setEditing(null);});}}>Save</Button>
        <Button onPress={() => setEditing(null)}>Cancel</Button>
      </> : <>
        <Text selectable>{e.text}</Text>
        <Text variant="bodySmall">{e.evidence?.kind === 'model_candidate' ? 'Unconfirmed candidate' : e.evidence?.kind === 'user_correction' ? 'Correction' : e.evidence?.kind === 'user_confirmed_success' ? 'Successful strategy' : 'User statement'} · Retrieval weight {confidence({key:e.id,claim:e.text,disputed:false,evidence:[e.evidence ?? {kind:'user_statement',text:e.text,recordedAt:e.createdAt}]}).toFixed(2)}</Text>
        <Button disabled={busy} onPress={() => {setEditing(e.id); setDraft(e.text);}}>Edit</Button>
        <Button disabled={busy} onPress={() => Alert.alert('Delete memory?', e.text, [{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:() => {void run(() => deleteMemory(e.id));}}])}>Delete</Button>
      </>}
    </View>)}
    <Button disabled={page === 0} onPress={() => setPage(p => p - 1)}>Previous page</Button>
    <Button disabled={(page + 1) * 20 >= total} onPress={() => setPage(p => p + 1)}>Next page</Button>
    <Button disabled={!ready || busy} onPress={() => {void run(async () => {await Share.share({message: await exportMemories()});});}}>Share JSON backup</Button>
    <Text>Backups may contain private information. Share only with trusted destinations.</Text>
    <TextInput label="Paste JSON backup" multiline value={backup} onChangeText={setBackup} />
    <Button disabled={!ready || busy || !backup.trim()} onPress={() => Alert.alert('Replace all memories?', 'Restoring replaces existing memory.', [{text:'Cancel',style:'cancel'},{text:'Restore',style:'destructive',onPress:() => {void run(async () => {await restoreMemories(backup); setBackup(''); setPage(0); setEditing(null);});}}])}>Restore backup</Button>
  </Card.Content></Card>;
}
