export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface StructuredLogPayload {
  timestamp: string;
  level: LogLevel;
  operation: string;
  correlationId?: string;
  status?: 'SUCCESS' | 'WARNING' | 'FAILED' | 'PENDING';
  durationMs?: number;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

class Logger {
  private formatLog(
    level: LogLevel,
    operation: string,
    metadata?: Record<string, unknown>,
    status?: 'SUCCESS' | 'WARNING' | 'FAILED' | 'PENDING',
    durationMs?: number,
    error?: Error | unknown,
    correlationId?: string
  ): StructuredLogPayload {
    // Sanitize metadata to never include sensitive keywords
    const sanitizedMetadata: Record<string, unknown> = {};
    if (metadata) {
      for (const [k, v] of Object.entries(metadata)) {
        if (/key|secret|token|password|auth|authorization/i.test(k)) {
          sanitizedMetadata[k] = '[REDACTED]';
        } else {
          sanitizedMetadata[k] = v;
        }
      }
    }

    const payload: StructuredLogPayload = {
      timestamp: new Date().toISOString(),
      level,
      operation,
      status,
      durationMs,
      correlationId: correlationId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined),
      metadata: Object.keys(sanitizedMetadata).length > 0 ? sanitizedMetadata : undefined,
    };

    if (error) {
      if (error instanceof Error) {
        payload.error = {
          message: error.message,
          name: error.name,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        };
      } else {
        payload.error = {
          message: String(error),
        };
      }
    }

    return payload;
  }

  info(operation: string, metadata?: Record<string, unknown>, correlationId?: string) {
    const payload = this.formatLog('info', operation, metadata, 'SUCCESS', undefined, undefined, correlationId);
    console.log(JSON.stringify(payload));
  }

  warn(operation: string, metadata?: Record<string, unknown>, correlationId?: string) {
    const payload = this.formatLog('warn', operation, metadata, 'WARNING', undefined, undefined, correlationId);
    console.warn(JSON.stringify(payload));
  }

  error(operation: string, error?: Error | unknown, metadata?: Record<string, unknown>, correlationId?: string) {
    const payload = this.formatLog('error', operation, metadata, 'FAILED', undefined, error, correlationId);
    console.error(JSON.stringify(payload));
  }

  startTimer(operation: string, correlationId?: string) {
    const startTime = performance.now();
    return {
      end: (status: 'SUCCESS' | 'WARNING' | 'FAILED' = 'SUCCESS', metadata?: Record<string, unknown>, err?: Error | unknown) => {
        const durationMs = Math.round(performance.now() - startTime);
        const level: LogLevel = status === 'FAILED' ? 'error' : status === 'WARNING' ? 'warn' : 'info';
        const payload = this.formatLog(level, operation, metadata, status, durationMs, err, correlationId);
        if (level === 'error') {
          console.error(JSON.stringify(payload));
        } else if (level === 'warn') {
          console.warn(JSON.stringify(payload));
        } else {
          console.log(JSON.stringify(payload));
        }
        return durationMs;
      },
    };
  }
}

export const logger = new Logger();
