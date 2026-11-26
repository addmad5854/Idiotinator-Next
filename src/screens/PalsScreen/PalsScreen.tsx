import React, {useState} from 'react';
import {View, ScrollView} from 'react-native';
import {Button, Card, Text, Searchbar} from 'react-native-paper';
import {observer} from 'mobx-react-lite';
import {useTheme} from '../../hooks';
import {PalSheet} from '../../components/PalsSheets';
import {palStore, Pal} from '../../store';
import {createNewAssistantPal, createNewRoleplayPal, createNewVideoPal, preparePalForEditing} from '../../utils/pal-templates';

export const PalsScreen: React.FC = observer(() => {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState<Partial<Pal> | null>(null);
  const items = palStore.getLocalPals().filter(p =>
    (p.name + ' ' + (p.description || '')).toLowerCase().includes(query.toLowerCase()));
  return (
    <View style={{flex: 1, backgroundColor: theme.colors.background}}>
      <ScrollView contentContainerStyle={{padding: 20, gap: 14}}>
        <Text variant="headlineMedium">Intelligence studio</Text>
        <Text variant="bodyMedium">Configure local personalities and specialist assistants.</Text>
        <View style={{padding: 18, borderRadius: 20, backgroundColor: theme.colors.surface, gap: 8}}>
          <Text variant="titleLarge">Personality presets</Text>
          <Text>Choose a starting personality, then edit its instructions and save it.</Text>
          {[
            ['Idiotinator', 'Curious, analytical, direct, with occasional dry humour. Admit uncertainty.'],
            ['Engineer', 'Practical, precise, check units and assumptions.'],
            ['Scientist', 'Skeptical, evidence-driven, distinguish facts from hypotheses.'],
            ['Tutor', 'Patient, explain step by step and ask guiding questions.'],
            ['Developer', 'Write maintainable code and explain tests and limitations.'],
            ['Dry wit', 'Concise, witty, mildly sarcastic, serious when appropriate.'],
          ].map(([name, prompt]) => <Button key={name} mode="outlined" onPress={() => setCurrent({...createNewAssistantPal(), name, description: prompt, systemPrompt: 'You are ' + name + '. ' + prompt, originalSystemPrompt: 'You are ' + name + '. ' + prompt})}>{name}</Button>)}
        </View>
        <Button mode="contained" icon="plus" onPress={() => setCurrent(createNewAssistantPal())}>Create assistant</Button>
        <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
          <Button mode="outlined" onPress={() => setCurrent(createNewRoleplayPal())}>Roleplay</Button>
          <Button mode="outlined" onPress={() => setCurrent(createNewVideoPal())}>Video assistant</Button>
        </View>
        <Searchbar placeholder="Search local assistants" value={query} onChangeText={setQuery}/>
        <Text variant="titleMedium">Local assistants</Text>
        {items.length === 0 && <Text>No matching assistants.</Text>}
        {items.map(p => <Card key={p.id} mode="outlined" onPress={() => setCurrent(preparePalForEditing(p))}>
          <Card.Title title={p.name} subtitle="Local assistant"/>
          <Card.Content><Text>{p.description || 'Custom instructions'}</Text></Card.Content>
          <Card.Actions><Button onPress={() => setCurrent(preparePalForEditing(p))}>Configure</Button></Card.Actions>
        </Card>)}
      </ScrollView>
      {current && <PalSheet isVisible={true} pal={current} onClose={() => setCurrent(null)}/>}
    </View>
  );
});
export default PalsScreen;
