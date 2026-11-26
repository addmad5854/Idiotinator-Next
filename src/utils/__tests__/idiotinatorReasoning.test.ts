import {chooseReasoning} from '../idiotinatorReasoning';
import type {CompletionEngine} from '../completionTypes';

test('greeting bypasses model classification', async () => {
  const completion = jest.fn();
  const engine: CompletionEngine = {completion, stopCompletion: jest.fn()};
  expect(await chooseReasoning(engine, 'Hello', '', new AbortController().signal)).toBe('instant');
  expect(completion).not.toHaveBeenCalled();
});
test.each(['instant', 'standard', 'deep', 'invalid'])('classifier result %s', async label => {
  const engine: CompletionEngine = {completion: jest.fn().mockResolvedValue({content: label}), stopCompletion: jest.fn()};
  expect(await chooseReasoning(engine, 'Explain this', 'previous context', new AbortController().signal)).toBe(label === 'invalid' ? 'standard' : label);
});
