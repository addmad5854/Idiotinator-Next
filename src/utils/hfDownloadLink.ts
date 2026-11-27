export function parseHFDownloadLink(input: string): {
  repoId: string;
  filename: string;
} {
  const url = new URL(input.trim());
  if (
    url.protocol !== 'https:' ||
    url.host !== 'huggingface.co' ||
    url.username ||
    url.password
  ) {
    throw new Error('Use an HTTPS Hugging Face GGUF link.');
  }
  const parts = url.pathname.split('/').slice(1).map(decodeURIComponent);
  if (
    parts.length < 5 ||
    !['resolve', 'blob'].includes(parts[2]) ||
    parts[3] !== 'main' ||
    parts.some(
      p => !p || p === '.' || p === '..' || /[\\/\x00-\x1f]/.test(p),
    ) ||
    !parts[parts.length - 1].toLowerCase().endsWith('.gguf')
  ) {
    throw new Error('Use a GGUF file link from the main branch.');
  }
  if (!parts.slice(0, 2).every(p => /^[A-Za-z0-9_.-]+$/.test(p))) {
    throw new Error('Invalid Hugging Face repository.');
  }
  return {
    repoId: parts.slice(0, 2).join('/'),
    filename: parts.slice(4).join('/'),
  };
}
