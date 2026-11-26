import React, {useRef, useState, useEffect} from 'react';
import * as RNFS from '@dr.pogodin/react-native-fs';
import NativeShare from 'react-native-share';
import type {GenerationLease} from '../../store/generationLease';
import {diagnosticStatus} from '../../utils/diagnosticStatus';
import {Share, View} from 'react-native';
import {Button, Text} from 'react-native-paper';
import Clipboard from '@react-native-clipboard/clipboard';
import DeviceInfo from 'react-native-device-info';
import NativeHardwareInfo from '../../specs/NativeHardwareInfo';
import {getBackendDevicesInfo} from 'llama.rn';
import {getCpuInfo, getGpuInfo, checkGpuSupport} from '../../utils/deviceCapabilities';
import {chooseReasoning, finalAnswer} from '../../utils/idiotinatorReasoning';
import {detectQuantizationType} from '../../utils/deviceSelection';
import {modelStore} from '../../store';
import {LocalCompletionEngine} from '../../api/completionEngines';

type Check = {name: string; status: 'pass' | 'fail' | 'unavailable' | 'not_tested' | 'cancelled'; data?: unknown};
export const DiagnosticsCard = ({busy, onRunning}: {busy: boolean; onRunning: (value: boolean) => void}) => {
  const lock = useRef(false);
  const active = useRef<GenerationLease | null>(null);
  const cancelled = useRef(false);
  const cancel = () => {cancelled.current = true; active.current?.abort();};
  useEffect(() => () => {cancelled.current = true; active.current?.abort();}, []);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const run = async (full = false) => {
    if (lock.current || busy) return;
    lock.current = true;
    cancelled.current = false;
    onRunning(true);
    setRunning(true);
    setError('');
    setReport('');
    const checks: Check[] = [];
    const probe = async (name: string, fn: () => Promise<unknown>) => {
      try {
        if (cancelled.current || active.current?.signal.aborted) {checks.push({name, status: 'cancelled'}); return;}
        const data = await fn();
        checks.push({name, status: diagnosticStatus(data, cancelled.current || !!active.current?.signal.aborted), data});
      } catch (e) {
        // Do not export raw exceptions: they may contain private paths or URLs.
        checks.push({name, status: cancelled.current || active.current?.signal.aborted ? 'cancelled' : 'fail', data: e instanceof Error ? e.name : 'UnknownError'});
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
      await probe('accelerator_readiness', async () => {
        const eligibility = await checkGpuSupport();
        const devices = await getBackendDevicesInfo();
        const gpuDetected = !!devices?.some(d => d.type === 'gpu' && !!d.deviceName);
        const npuDetected = !!devices?.some(d => d.deviceName?.startsWith('HTP'));
        const settings = modelStore.activeContextSettings;
        return {
          hardwareEligible: eligibility.isSupported,
          gpuDetected,
          npuDetected,
          match: !eligibility.isSupported || gpuDetected,
          diagnosis: gpuDetected ? 'gpu_enumerated_offload_unverified' : eligibility.isSupported ? 'eligible_gpu_missing_from_native_backend' : 'gpu_not_eligible',
          requestedGpuLayers: settings?.n_gpu_layers ?? null,
          requestedDevices: settings?.devices ?? null,
          actualOffloadVerified: false,
        };
      });
      await probe('memory_bytes', async () => ({total: await DeviceInfo.getTotalMemory(), appUsed: await DeviceInfo.getUsedMemory(), available: await NativeHardwareInfo.getAvailableMemory()}));
      await probe('model_recommendation', async () => {
        const available = await NativeHardwareInfo.getAvailableMemory();
        const total = await DeviceInfo.getTotalMemory();
        const budget = Math.max(0, Math.min(available - 768 * 1048576, total * 0.6));
        const devices = await getBackendDevicesInfo();
        return {availableBytes: available, conservativeWeightBudgetBytes: Math.floor(budget * 0.65), gpuDetected: !!devices?.some(d => d.type === 'gpu'), guidance: 'Prefer a smaller quantized model within the weight budget. Context cache and runtime overhead vary; this is not a guaranteed fit.'};
      });
      await probe('storage_bytes', async () => ({free: await DeviceInfo.getFreeDiskStorage()}));
      await probe('loaded_context', async () => {
        const c = modelStore.context;
        const s = modelStore.activeContextSettings;
        return {loaded: !!c, model: c ? {name: modelStore.activeModel?.name, quantization: detectQuantizationType(modelStore.activeModel?.filename || ''), size: c.model.size, parameters: c.model.nParams} : null, settings: s ? {n_ctx: s.n_ctx, n_ubatch: s.n_ubatch, n_gpu_layers: s.n_gpu_layers, devices: s.devices} : null};
      });
      if (full && modelStore.context && !cancelled.current) {
        const lease = modelStore.tryAcquireGeneration();
        if (lease && !(lease.engine instanceof LocalCompletionEngine)) {
          lease.end();
        }
        if (lease && lease.engine instanceof LocalCompletionEngine) {
          active.current = lease;
          const stop = () => {void lease.engine.stopCompletion().catch(() => {});};
          lease.signal.addEventListener('abort', stop);
          const timeout = setTimeout(cancel, 120000);
          try {
            await probe('generation', async () => {
              const start = Date.now();
              let first: number | null = null;
              const result = await lease.engine.completion({messages: [{role: 'user', content: 'What is 17 plus 25? Reply with only the number.'}], n_predict: 32, temperature: 0, enable_thinking: false, chat_template_kwargs: {enable_thinking: false}}, token => {if (first === null && (token.token || token.content)) first = Date.now() - start;});
              const answer = finalAnswer(result.content || result.text || '');
              return {answer, expected: '42', match: /^42[.!]?$/.test(answer), elapsedMs: Date.now() - start, firstTokenMs: first, timings: result.timings, interrupted: result.interrupted};
            });
            await probe('instruction_following', async () => {
              const result = await lease.engine.completion({messages: [{role: 'user', content: 'Reply with only the word BLUE.'}], n_predict: 16, temperature: 0, enable_thinking: false, chat_template_kwargs: {enable_thinking: false}});
              const answer = finalAnswer(result.content || result.text || '');
              return {answer, expected: 'BLUE', match: /^BLUE[.!]?$/i.test(answer), interrupted: result.interrupted};
            });
            await probe('reasoning', async () => {const start = Date.now(); const level = await chooseReasoning(lease.engine, 'Prove that the square root of two is irrational.', '', lease.signal); return {level, expected: 'deep', match: level === 'deep', elapsedMs: Date.now() - start};});
          } finally {clearTimeout(timeout); lease.signal.removeEventListener('abort', stop); active.current = null; lease.end();}
        } else {for (const name of ['generation', 'instruction_following', 'reasoning']) checks.push({name, status: 'unavailable'});}
      } else {for (const name of ['generation', 'instruction_following', 'reasoning']) checks.push({name, status: cancelled.current ? 'cancelled' : full ? 'unavailable' : 'not_tested'});}
      await probe('thermal', async () => {
        const cpu = await getCpuInfo();
        return typeof cpu?.thermalStatus === 'number' ? {androidThermalStatus: cpu.thermalStatus, match: cpu.thermalStatus < 3} : null;
      });
      for (const name of ['actual_gpu_offload','math_rendering','offline_network_isolation','voice','native_logs']) {
        checks.push({name, status: 'not_tested'});
      }
      setReport(JSON.stringify({schema: 1, createdAt: new Date().toISOString(), mode: full ? 'local_inference' : 'read_only', note: 'Inventory pass means data collected; functional pass means expected output matched. Actual GPU offloading is not verified.', checks}, null, 2));
    } catch {setError('Diagnostic run failed. Retry with no other inference active.');} finally {
      lock.current = false;
      onRunning(false);
      setRunning(false);
    }
  };
  return (
    <View style={{gap: 8, marginVertical: 12}}>
      <Text variant="titleLarge">Diagnostics &amp; Self-Test</Text>
      <Text>Local hardware inventory and optional controlled inference tests. No chat content, account identifiers or automatic upload.</Text>
      <Button mode="contained" disabled={busy || running} loading={running} onPress={() => run(false)}>Run quick diagnostics</Button>
      <Button mode="outlined" disabled={busy || running || !modelStore.context} onPress={() => run(true)}>Run inference self-test</Button>
      {running ? <Button onPress={cancel}>Cancel self-test</Button> : null}
      {report ? <>
        <Text selectable variant="bodySmall">{report}</Text>
        <Button mode="outlined" onPress={async () => {try {const path = RNFS.CachesDirectoryPath + '/Idiotinator-diagnostics.json'; await RNFS.writeFile(path, report, 'utf8'); await NativeShare.open({url: 'file://' + path, type: 'application/json', failOnCancel: false});} catch {setError('File export failed. Use Copy report instead.');}}}>Export JSON file</Button>
        <Button mode="outlined" onPress={() => Clipboard.setString(report)}>Copy report</Button>
        <Button mode="outlined" onPress={async () => {try {await Share.share({message: report, title: 'Idiotinator diagnostics'});} catch {setError('Sharing failed. Use Copy report instead.');}}}>Share report</Button>
      </> : null}
      {error ? <Text>{error}</Text> : null}
    </View>
  );
};
