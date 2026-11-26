import React, {useEffect, useState} from 'react';
import {Alert, Share, View} from 'react-native';
import {Button, Card, Switch, Text, TextInput} from 'react-native-paper';
import {listMemories, memoryEnabled, setMemoryEnabled, updateMemory, deleteMemory, exportMemories, restoreMemories, type MemoryEntry} from '../../services/adaptiveMemory';

export function MemoryCard() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [backup, setBackup] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(0);
  async function refresh() {
    setEntries(await listMemories());
    setEnabled(await memoryEnabled());
    setReady(true);
  }
  useEffect(() => {refresh().catch(() => Alert.alert('Memory unavailable', 'Could not read local memory.'));}, []);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {await action(); await refresh();}
    catch (e) {Alert.alert('Memory operation failed', e instanceof Error ? e.message : 'Unknown error');}
    finally {setBusy(false);}
  }
  const filtered = entries.filter(e => e.text.toLowerCase().includes(query.toLowerCase()));
  return <Card style={{marginVertical: 8}}><Card.Content>
    <Text variant="titleLarge">Personal memory</Text>
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
      <Text>Use memory in chat</Text>
      <Switch value={enabled} disabled={!ready || busy} onValueChange={v => {void run(() => setMemoryEnabled(v));}} />
    </View>
    <Text>Stored locally. Disabling memory does not delete existing entries.</Text>
    <TextInput label="Search memories" value={query} onChangeText={v => {setQuery(v); setPage(0);}} />
    <Text>{filtered.length} matching memories</Text>
    {filtered.slice(page * 20, page * 20 + 20).map(e => <View key={e.id} style={{paddingVertical: 8}}>
      {editing === e.id ? <>
        <TextInput multiline value={draft} onChangeText={setDraft} maxLength={1000} />
        <Button disabled={busy || !draft.trim()} onPress={() => {void run(async () => {await updateMemory(e.id, draft); setEditing(null);});}}>Save</Button>
        <Button onPress={() => setEditing(null)}>Cancel</Button>
      </> : <>
        <Text selectable>{e.text}</Text>
        <Button disabled={busy} onPress={() => {setEditing(e.id); setDraft(e.text);}}>Edit</Button>
        <Button disabled={busy} onPress={() => Alert.alert('Delete memory?', e.text, [{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:() => {void run(() => deleteMemory(e.id));}}])}>Delete</Button>
      </>}
    </View>)}
    <Button disabled={page === 0} onPress={() => setPage(p => p - 1)}>Previous page</Button>
    <Button disabled={(page + 1) * 20 >= filtered.length} onPress={() => setPage(p => p + 1)}>Next page</Button>
    <Button disabled={!ready || busy} onPress={() => {void run(async () => {await Share.share({message: await exportMemories()});});}}>Share JSON backup</Button>
    <Text>Backups may contain private information. Share only with trusted destinations.</Text>
    <TextInput label="Paste JSON backup" multiline value={backup} onChangeText={setBackup} />
    <Button disabled={!ready || busy || !backup.trim()} onPress={() => Alert.alert('Replace all memories?', 'Restoring replaces existing memory.', [{text:'Cancel',style:'cancel'},{text:'Restore',style:'destructive',onPress:() => {void run(async () => {await restoreMemories(backup); setBackup(''); setPage(0); setEditing(null);});}}])}>Restore backup</Button>
  </Card.Content></Card>;
}
