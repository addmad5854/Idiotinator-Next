import {chooseReasoning, finalAnswer} from '../idiotinatorReasoning';
import type {CompletionEngine} from '../completionTypes';

test('greeting bypasses model classification', async () => {
  const completion = jest.fn();
  const engine: CompletionEngine = {completion, stopCompletion: jest.fn()};
  expect(
    await chooseReasoning(engine, 'Hello', '', new AbortController().signal),
  ).toBe('instant');
  expect(completion).not.toHaveBeenCalled();
});
test.each(['instant', 'standard', 'deep', 'invalid'])(
  'classifier result %s',
  async label => {
    const engine: CompletionEngine = {
      completion: jest.fn().mockResolvedValue({content: label}),
      stopCompletion: jest.fn(),
    };
    expect(
      await chooseReasoning(
        engine,
        'Explain this',
        'previous context',
        new AbortController().signal,
      ),
    ).toBe(label === 'invalid' ? 'standard' : label);
  },
);

test('casual greeting with history avoids extra inference', async () => {
  const completion = jest.fn();
  const engine: CompletionEngine = {completion, stopCompletion: jest.fn()};
  expect(
    await chooseReasoning(
      engine,
      'Hello, how are you?',
      'history',
      new AbortController().signal,
    ),
  ).toBe('instant');
  expect(completion).not.toHaveBeenCalled();
});

test('Qwen thinking wrappers do not contaminate final answers', async () => {
  expect(finalAnswer('<think>\n\n</think>\n\n42')).toBe('42');
  expect(finalAnswer('<think>\n\n</think>\n\nBLUE')).toBe('BLUE');
  expect(finalAnswer('<think>unfinished')).toBe('<think>unfinished');
  const engine: CompletionEngine = {
    completion: jest
      .fn()
      .mockResolvedValue({content: '<think>\n</think>\ndeep'}),
    stopCompletion: jest.fn(),
  };
  expect(
    await chooseReasoning(
      engine,
      'Explain this',
      '',
      new AbortController().signal,
    ),
  ).toBe('deep');
});
test('explicit proof requests bypass classifier', async () => {
  const completion = jest.fn();
  const engine: CompletionEngine = {completion, stopCompletion: jest.fn()};
  expect(
    await chooseReasoning(
      engine,
      'Prove that the square root of two is irrational.',
      '',
      new AbortController().signal,
    ),
  ).toBe('deep');
  expect(completion).not.toHaveBeenCalled();
});

test('ambiguous request uses model classifier rather than proof shortcut', async () => {
  const completion = jest.fn().mockResolvedValue({content: 'deep'});
  const engine: CompletionEngine = {completion, stopCompletion: jest.fn()};
  expect(
    await chooseReasoning(
      engine,
      'Explain this difficult problem',
      'context',
      new AbortController().signal,
    ),
  ).toBe('deep');
  expect(completion).toHaveBeenCalledTimes(1);
});

test.each([
  'How are you feeling?',
  "How's it going?",
  'Who are you?',
  'What can you do?',
])('casual prompt %s skips classification', async prompt => {
  const completion = jest.fn();
  const engine: CompletionEngine = {completion, stopCompletion: jest.fn()};
  expect(
    await chooseReasoning(
      engine,
      prompt,
      'history',
      new AbortController().signal,
    ),
  ).toBe('instant');
  expect(completion).not.toHaveBeenCalled();
});
