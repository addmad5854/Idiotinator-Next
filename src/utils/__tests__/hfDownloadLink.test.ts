import {parseHFDownloadLink} from '../hfDownloadLink';
test('resolves HF file links', () => {
  expect(
    parseHFDownloadLink(
      'https://huggingface.co/a/b/blob/main/model.gguf?download=true',
    ),
  ).toEqual({repoId: 'a/b', filename: 'model.gguf'});
});
test.each([
  'https://evil.example/a/b/resolve/main/x.gguf',
  'https://huggingface.co/a/b/resolve/dev/x.gguf',
  'https://huggingface.co/a/b/resolve/main/x.zip',
  'https://huggingface.co/a/b/resolve/main/a%2Fb.gguf',
])('rejects unsupported link %s', link => {
  expect(() => parseHFDownloadLink(link)).toThrow();
});
