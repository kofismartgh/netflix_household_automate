type LogLevel = 'info' | 'warn' | 'error';

export default class Logger {
  private logLevel: LogLevel;

  constructor(logLevel: string = 'info') {
    this.logLevel = (logLevel.toLowerCase() as LogLevel) || 'info';
  }

  private formatTimestamp(): string {
    const currentDateTime = new Date();
    return new Intl.DateTimeFormat('default', {
      dateStyle: 'full',
      timeStyle: 'long',
    }).format(currentDateTime);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  private log(level: LogLevel, event: string, details?: string) {
    if (!this.shouldLog(level)) return;

    const timestamp = this.formatTimestamp();
    const detailsStr = details ? ` | ${details}` : '';
    console.log(`${timestamp} | ${level.toUpperCase()} | ${event}${detailsStr}`);
  }

  info(event: string, details?: string) {
    this.log('info', event, details);
  }

  warn(event: string, details?: string) {
    this.log('warn', event, details);
  }

  error(event: string, details?: string) {
    this.log('error', event, details);
  }
}
