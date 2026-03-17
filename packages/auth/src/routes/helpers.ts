import type { IncomingMessage, ServerResponse } from 'node:http';

const DEFAULT_MAX_BODY_SIZE = 1024 * 1024; // 1 MB

export interface ParseBodyOptions {
  /** Maximum allowed body size in bytes. Defaults to 1 MB. */
  maxBodySize?: number;
}

/** Error thrown when the request body exceeds the size limit. */
export class PayloadTooLargeError extends Error {
  public readonly statusCode = 413;
  constructor(limit: number) {
    super(`Payload too large (limit: ${limit} bytes)`);
    this.name = 'PayloadTooLargeError';
  }
}

/** Parse JSON body from an IncomingMessage with size limiting. */
export function parseBody(
  req: IncomingMessage,
  options?: ParseBodyOptions,
): Promise<Record<string, unknown>> {
  const maxSize = options?.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;

    req.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxSize) {
        req.destroy();
        reject(new PayloadTooLargeError(maxSize));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', reject);
  });
}

/** Send JSON response */
export function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
