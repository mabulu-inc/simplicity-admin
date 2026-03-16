import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { parseBody } from '../src/routes/helpers.js';

/** Create a fake IncomingMessage from chunks with optional delays */
function fakeRequest(chunks: Buffer[]): IncomingMessage {
  const stream = new Readable({
    read() {
      for (const chunk of chunks) {
        this.push(chunk);
      }
      this.push(null);
    },
  });
  return stream as unknown as IncomingMessage;
}

describe('parseBody body size limiting', () => {
  it('accepts bodies under 1 MB (default limit)', async () => {
    const data = JSON.stringify({ key: 'value' });
    const req = fakeRequest([Buffer.from(data)]);
    const result = await parseBody(req);
    expect(result).toEqual({ key: 'value' });
  });

  it('rejects bodies over 1 MB with a PayloadTooLargeError', async () => {
    // Create a body slightly over 1 MB
    const oversized = Buffer.alloc(1024 * 1024 + 1, 'x');
    const req = fakeRequest([oversized]);
    await expect(parseBody(req)).rejects.toThrow('Payload too large');
    await expect(parseBody(fakeRequest([oversized]))).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it('rejects bodies delivered in multiple chunks that exceed the limit', async () => {
    const chunkSize = 512 * 1024; // 512 KB each
    const chunk1 = Buffer.alloc(chunkSize, 'a');
    const chunk2 = Buffer.alloc(chunkSize, 'b');
    const chunk3 = Buffer.alloc(chunkSize, 'c'); // total = 1.5 MB > 1 MB
    const req = fakeRequest([chunk1, chunk2, chunk3]);
    await expect(parseBody(req)).rejects.toThrow('Payload too large');
  });

  it('configurable limit works — accepts body under custom limit', async () => {
    const data = JSON.stringify({ small: true });
    const req = fakeRequest([Buffer.from(data)]);
    const result = await parseBody(req, { maxBodySize: 100 });
    expect(result).toEqual({ small: true });
  });

  it('configurable limit works — rejects body over custom limit', async () => {
    const oversized = Buffer.alloc(200, 'x');
    const req = fakeRequest([oversized]);
    await expect(parseBody(req, { maxBodySize: 100 })).rejects.toThrow('Payload too large');
  });

  it('accepts exactly 1 MB body (boundary)', async () => {
    // Build valid JSON that is exactly 1 MB
    const targetSize = 1024 * 1024;
    const prefix = '{"d":"';
    const suffix = '"}';
    const padding = 'a'.repeat(targetSize - prefix.length - suffix.length);
    const body = prefix + padding + suffix;
    expect(Buffer.byteLength(body)).toBe(targetSize);

    const req = fakeRequest([Buffer.from(body)]);
    const result = await parseBody(req);
    expect(result).toHaveProperty('d');
  });

  it('destroys the request stream when limit is exceeded', async () => {
    let destroyed = false;
    const stream = new Readable({
      read() {
        this.push(Buffer.alloc(1024 * 1024 + 1, 'x'));
        this.push(null);
      },
      destroy(_err, cb) {
        destroyed = true;
        cb(null);
      },
    });
    const req = stream as unknown as IncomingMessage;
    await expect(parseBody(req)).rejects.toThrow('Payload too large');
    expect(destroyed).toBe(true);
  });
});
