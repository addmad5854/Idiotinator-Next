import {diagnosticStatus} from '../diagnosticStatus';
describe('diagnostic outcomes', () => {
  it('fails wrong answers and interrupted results', () => {
    expect(diagnosticStatus({match: false})).toBe('fail');
    expect(diagnosticStatus({match: true, interrupted: true})).toBe('fail');
  });
  it('distinguishes missing and cancelled tests', () => {
    expect(diagnosticStatus(null)).toBe('unavailable');
    expect(diagnosticStatus({loaded: false})).toBe('unavailable');
    expect(diagnosticStatus({match: true}, true)).toBe('cancelled');
  });
  it('accepts correct results', () =>
    expect(diagnosticStatus({match: true})).toBe('pass'));
});
