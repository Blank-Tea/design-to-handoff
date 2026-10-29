// Drive the actual key-handling code over pipes on every CI OS. A separate
// real PTY smoke test covers the native terminal and raw-mode restoration.
Object.defineProperty(process.stdin, 'isTTY', { value: true });
Object.defineProperty(process.stdout, 'isTTY', { value: true });
Object.defineProperty(process.stdout, 'columns', { value: 100 });
Object.defineProperty(process.stdout, 'rows', { value: 30 });
process.stdin.isRaw = false;
process.stdin.setRawMode = enabled => {
  process.stdin.isRaw = enabled;
  return process.stdin;
};
