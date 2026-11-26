import React, {useRef, useState} from 'react';
import {Share, View} from 'react-native';
import {Button, Text} from 'react-native-paper';
import Clipboard from '@react-native-clipboard/clipboard';
import DeviceInfo from 'react-native-device-info';
import {getBackendDevicesInfo} from 'llama.rn';
import {getCpuInfo, getGpuInfo, checkGpuSupport} from '../../utils/deviceCapabilities';
import {chooseReasoning} from '../../utils/idiotinatorReasoning';
import {detectQuantizationType} from '../../utils/deviceSelection';
import {modelStore} from '../../store';

type Check = {name: string; status: 'pass' | 'fail' | 'unavailable' | 'not_tested'; data?: unknown};
export const DiagnosticsCard = ({busy}: {busy: boolean}) => {
  const lock = useRef(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const run = async (full = false) => {
    if (lock.current || busy) return;
    lock.current = true;
    setRunning(true);
    setError('');
    setReport('');
    const checks: Check[] = [];
    const probe = async (name: string, fn: () => Promise<unknown>) => {
      try {
        const data = await fn();
        checks.push({name, status: data == null ? 'unavailable' : 'pass', data});
      } catch (e) {
        // Do not export raw exceptions: they may contain private paths or URLs.
        checks.push({name, status: 'fail', data: e instanceof Error ? e.name : 'UnknownError'});
      }
    };
    try {
      await probe('application', async () => ({version: DeviceInfo.getVersion(), build: DeviceInfo.getBuildNumber(), model: DeviceInfo.getModel(), os: DeviceInfo.getSystemVersion(), abis: await DeviceInfo.supportedAbis()}));
      await probe('cpu', getCpuInfo);
      await probe('gpu_hardware', getGpuInfo);
      await probe('gpu_requirements', checkGpuSupport);
      await probe('native_backend_enumeration', async () => {
        const devices = await getBackendDevicesInfo();
        return {devices: (devices || []).map(d => ({name: d.deviceName, type: d.type})), acceleratorDetected: !!devices?.some(d => d.type === 'gpu' || d.deviceName?.startsWith('HTP'))};
      });
      await probe('memory_bytes', async () => ({total: await DeviceInfo.getTotalMemory(), appUsed: await DeviceInfo.getUsedMemory()}));
      await probe('storage_bytes', async () => ({free: await DeviceInfo.getFreeDiskStorage()}));
      await probe('loaded_context', async () => {
        const c = modelStore.context;
        const s = modelStore.activeContextSettings;
        return {loaded: !!c, model: c ? {name: modelStore.activeModel?.name, quantization: detectQuantizationType(modelStore.activeModel?.filename || ''), size: c.model.size, parameters: c.model.nParams} : null, settings: s ? {n_ctx: s.n_ctx, n_ubatch: s.n_ubatch, n_gpu_layers: s.n_gpu_layers, devices: s.devices} : null};
      });
      if (full && modelStore.context) {
        const lease = await modelStore.acquireGeneration();
        if (lease) {
          try {
            await probe('generation', async () => {
              const start = Date.now();
              let first: number | null = null;
              const result = await lease.engine.completion({messages: [{role: 'user', content: 'What is 17 plus 25? Reply with only the number.'}], n_predict: 32, temperature: 0, enable_thinking: false, chat_template_kwargs: {enable_thinking: false}}, token => {if (first === null && (token.token || token.content)) first = Date.now() - start;});
              const answer = (result.content || result.text || '').trim();
              return {answer, expected: '42', exactMatch: /^42[.!]?$/.test(answer), elapsedMs: Date.now() - start, firstTokenMs: first, timings: result.timings, interrupted: result.interrupted};
            });
            await probe('reasoning', async () => {const start = Date.now(); const level = await chooseReasoning(lease.engine, 'Prove that the square root of two is irrational.', '', lease.signal); return {level, expected: 'deep', match: level === 'deep', elapsedMs: Date.now() - start};});
          } finally {lease.end();}
        } else {checks.push({name: 'generation', status: 'unavailable'}, {name: 'reasoning', status: 'unavailable'});}
      } else {checks.push({name: 'generation', status: 'not_tested'}, {name: 'reasoning', status: 'not_tested'});}
      for (const name of ['actual_gpu_offload','math_rendering','offline_network_isolation','voice','thermal','native_logs']) {
        checks.push({name, status: 'not_tested'});
      }
      setReport(JSON.stringify({schema: 1, createdAt: new Date().toISOString(), mode: full ? 'local_inference' : 'read_only', note: 'Pass means the probe returned data, not that acceleration or inference works.', checks}, null, 2));
    } finally {
      lock.current = false;
      setRunning(false);
    }
  };
  return (
    <View style={{gap: 8, marginVertical: 12}}>
      <Text variant="titleLarge">Diagnostics &amp; Self-Test</Text>
      <Text>Read-only local hardware and inference configuration report. No chat content, account identifiers or automatic upload.</Text>
      <Button mode="contained" disabled={busy || running} loading={running} onPress={() => run(false)}>Run quick diagnostics</Button>
      <Button mode="outlined" disabled={busy || running || !modelStore.context} onPress={() => run(true)}>Run inference self-test</Button>
      {report ? <>
        <Text selectable variant="bodySmall">{report}</Text>
        <Button mode="outlined" onPress={() => Clipboard.setString(report)}>Copy report</Button>
        <Button mode="outlined" onPress={async () => {try {await Share.share({message: report, title: 'Idiotinator diagnostics'});} catch {setError('Sharing failed. Use Copy report instead.');}}}>Share report</Button>
      </> : null}
      {error ? <Text>{error}</Text> : null}
    </View>
  );
};
