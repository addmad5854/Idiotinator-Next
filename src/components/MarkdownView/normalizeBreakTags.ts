import {closesFence, Fence, openingFence} from './codeFence';

const BREAK_TAG = /<br[ \t]*\/?>/gi;
const normalizeText = (text: string) => text.replace(BREAK_TAG, ' ').replace(/(^|[^\\])((?:\\\\)*)\\\((.+?)\\\)/g, (_, prefix, escaped, math) => prefix + escaped + '$' + math + '$').replace(/(^|[^\\])((?:\\\\)*)\\\[(.+?)\\\]/g, (_, prefix, escaped, math) => prefix + escaped + '$$' + math + '$$');
const endOfBacktickRun = (line: string, start: number): number => {
  let end = start;
  while (line[end] === '`') {
    end++;
  }
  return end;
};

const findClosingRun = (line: string, from: number, length: number) => {
  let i = from;
  while (i < line.length) {
    if (line[i] !== '`') {
      i++;
      continue;
    }
    const runEnd = endOfBacktickRun(line, i);
    if (runEnd - i === length) {
      return runEnd;
    }
    i = runEnd;
  }
  return -1;
};

const replaceOutsideCodeSpans = (line: string): string => {
  let result = '';
  let textStart = 0;
  let i = 0;
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2;
      continue;
    }
    if (line[i] !== '`') {
      i++;
      continue;
    }
    const runEnd = endOfBacktickRun(line, i);
    const spanEnd = findClosingRun(line, runEnd, runEnd - i);
    if (spanEnd === -1) {
      i = runEnd;
      continue;
    }
    result +=
      normalizeText(line.slice(textStart, i)) + line.slice(i, spanEnd);
    textStart = i = spanEnd;
  }
  return result + normalizeText(line.slice(textStart));
};

/**
 * Turns each `<br>` tag outside code into one space. The renderer draws inline
 * HTML literally, and a GFM table cell cannot hold a line break.
 */
export const normalizeBreakTags = (text: string): string => {
  if (!/<br/i.test(text) && !text.includes('\\(') && !text.includes('\\[')) {
    return text;
  }
  let fence: Fence | undefined;
  let displayOpen = -1;
  const lines = text.split('\n');
  // Convert standalone display delimiters only when a matching close exists
  // outside fenced code. Leave unfinished streamed equations untouched.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      if (closesFence(line, fence)) fence = undefined;
      continue;
    }
    fence = openingFence(line);
    if (fence) {displayOpen = -1; continue;}
    if (/^\s*\\\[\s*$/.test(line)) displayOpen = i;
    else if (displayOpen >= 0 && /^\s*\\\]\s*$/.test(line)) {
      lines[displayOpen] = lines[displayOpen].replace('\\[', () => '$');
      lines[i] = line.replace('\\]', () => '$');
      displayOpen = -1;
    }
  }
  fence = undefined;
  return lines.join('\n')
    .split('\n')
    .map(line => {
      if (fence) {
        if (closesFence(line, fence)) {
          fence = undefined;
        }
        return line;
      }
      fence = openingFence(line);
      return fence ? line : replaceOutsideCodeSpans(line);
    })
    .join('\n');
};
