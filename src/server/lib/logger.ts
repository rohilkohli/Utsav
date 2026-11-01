function write(stream: NodeJS.WriteStream, level: string, msg: string): void {
  if (process.env.NODE_ENV !== 'test') {
    stream.write(`[${new Date().toISOString()}] ${level} ${msg}\n`);
  }
}

export const logger = {
  debug: (msg: string): void => write(process.stdout, 'DEBUG', msg),
  info: (msg: string): void => write(process.stdout, 'INFO ', msg),
  warn: (msg: string): void => write(process.stderr, 'WARN ', msg),
  error: (msg: string): void => write(process.stderr, 'ERROR', msg),
};
