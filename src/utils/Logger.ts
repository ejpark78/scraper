import * as os from 'os';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

export class Logger {
  private static hostname = os.hostname();
  private static isJson = process.env.JSON_LOG === 'true';

  public static info(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.INFO, message, meta);
  }

  public static warn(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.WARN, message, meta);
  }

  public static error(message: string, error?: Error | any, meta?: Record<string, any>) {
    const errorMeta = error
      ? {
          error_name: error.name || 'Error',
          error_message: error.message || String(error),
          error_stack: error.stack,
        }
      : {};
    this.log(LogLevel.ERROR, message, { ...errorMeta, ...meta });
  }

  public static debug(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  private static log(level: LogLevel, message: string, meta?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    
    // Strip ANSI colors/escapes for clean log aggregation
    const cleanMessage = message.replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d]*)*)?/g, '');

    if (this.isJson) {
      const logPayload = {
        timestamp,
        level,
        hostname: this.hostname,
        message: cleanMessage,
        ...meta,
      };
      console.log(JSON.stringify(logPayload));
    } else {
      const metaString = meta ? ` | ${JSON.stringify(meta)}` : '';
      console.log(`[${timestamp}] [${level}] ${cleanMessage}${metaString}`);
    }
  }
}
