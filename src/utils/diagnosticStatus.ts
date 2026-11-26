export function diagnosticStatus(data: unknown, cancelled = false): 'pass' | 'fail' | 'unavailable' | 'cancelled' {
  if (cancelled) return 'cancelled';
  if (data == null) return 'unavailable';
  if (typeof data === 'object') {
    const value = data as Record<string, unknown>;
    if (value.interrupted === true || value.match === false) return 'fail';
    if (value.loaded === false) return 'unavailable';
  }
  return 'pass';
}
