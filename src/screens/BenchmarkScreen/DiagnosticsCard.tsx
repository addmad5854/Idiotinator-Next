import React, {useRef, useState} from 'react';
import {Share, View} from 'react-native';
import {Button, Text} from 'react-native-paper';
import Clipboard from '@react-native-clipboard/clipboard';
import DeviceInfo from 'react-native-device-info';
import {getBackendDevicesInfo} from 'llama.rn';
import {getCpuInfo, getGpuInfo, checkGpuSupport} from '../../utils/deviceCapabilities';
import {modelStore} from '../../store';

type Check = {name: string; status: 'pass' | 'fail' | 'unavailable' | 'not_tested'; data?: unknown};
export const DiagnosticsCard = ({busy}: {busy: boolean}) => {
  const lock = useRef(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const run = async () => {
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
        return (devices || []).map(d => ({name: d.deviceName, type: d.type}));
      });
      await probe('memory_bytes', async () => ({total: await DeviceInfo.getTotalMemory(), appUsed: await DeviceInfo.getUsedMemory()}));
      await probe('storage_bytes', async () => ({free: await DeviceInfo.getFreeDiskStorage()}));
      await probe('loaded_context', async () => {
        const c = modelStore.context;
        const s = modelStore.activeContextSettings;
        return {loaded: !!c, model: c ? {size: c.model.size, parameters: c.model.nParams} : null, settings: s ? {n_ctx: s.n_ctx, n_ubatch: s.n_ubatch, n_gpu_layers: s.n_gpu_layers, devices: s.devices} : null};
      });
      for (const name of ['actual_gpu_offload','generation','reasoning','math_rendering','offline_network_isolation','voice','thermal','native_logs']) {
        checks.push({name, status: 'not_tested'});
      }
      setReport(JSON.stringify({schema: 1, createdAt: new Date().toISOString(), mode: 'read_only', note: 'Pass means the probe returned data, not that acceleration or inference works.', checks}, null, 2));
    } finally {
      lock.current = false;
      setRunning(false);
    }
  };
  return (
    <View style={{gap: 8, marginVertical: 12}}>
      <Text variant="titleLarge">Diagnostics &amp; Self-Test</Text>
      <Text>Read-only local hardware and inference configuration report. No chat content, account identifiers or automatic upload.</Text>
      <Button mode="contained" disabled={busy || running} loading={running} onPress={run}>Run quick diagnostics</Button>
      {report ? <>
        <Text selectable variant="bodySmall">{report}</Text>
        <Button mode="outlined" onPress={() => Clipboard.setString(report)}>Copy report</Button>
        <Button mode="outlined" onPress={async () => {try {await Share.share({message: report, title: 'Idiotinator diagnostics'});} catch {setError('Sharing failed. Use Copy report instead.');}}}>Share report</Button>
      </> : null}
      {error ? <Text>{error}</Text> : null}
    </View>
  );
};
