import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * We test the security headers hook by importing the function and calling it
 * with mock SvelteKit event/resolve arguments.
 */
import { securityHeaders } from '$lib/server/security-headers.js';

function createMockEvent(): Parameters<typeof securityHeaders>[0]['event'] {
	return {} as Parameters<typeof securityHeaders>[0]['event'];
}

function createMockResolve(
	body = '',
): Parameters<typeof securityHeaders>[0]['resolve'] {
	return async () =>
		new Response(body, {
			status: 200,
			headers: new Headers({ 'content-type': 'text/html' }),
		});
}

describe('securityHeaders hook', () => {
	const originalEnv = process.env.NODE_ENV;

	afterEach(() => {
		process.env.NODE_ENV = originalEnv;
	});

	it('sets X-Content-Type-Options: nosniff', async () => {
		const response = await securityHeaders({
			event: createMockEvent(),
			resolve: createMockResolve(),
		});
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('sets X-Frame-Options: DENY', async () => {
		const response = await securityHeaders({
			event: createMockEvent(),
			resolve: createMockResolve(),
		});
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
	});

	it('sets Referrer-Policy: strict-origin-when-cross-origin', async () => {
		const response = await securityHeaders({
			event: createMockEvent(),
			resolve: createMockResolve(),
		});
		expect(response.headers.get('Referrer-Policy')).toBe(
			'strict-origin-when-cross-origin',
		);
	});

	it('sets HSTS header when NODE_ENV=production', async () => {
		process.env.NODE_ENV = 'production';
		const response = await securityHeaders({
			event: createMockEvent(),
			resolve: createMockResolve(),
		});
		expect(response.headers.get('Strict-Transport-Security')).toBe(
			'max-age=31536000; includeSubDomains',
		);
	});

	it('does NOT set HSTS header when NODE_ENV is not production', async () => {
		process.env.NODE_ENV = 'development';
		const response = await securityHeaders({
			event: createMockEvent(),
			resolve: createMockResolve(),
		});
		expect(response.headers.get('Strict-Transport-Security')).toBeNull();
	});

	it('preserves existing response headers', async () => {
		const resolve = async () =>
			new Response('', {
				status: 200,
				headers: new Headers({ 'x-custom': 'preserved' }),
			});
		const response = await securityHeaders({
			event: createMockEvent(),
			resolve,
		});
		expect(response.headers.get('x-custom')).toBe('preserved');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('preserves response body and status', async () => {
		const resolve = async () =>
			new Response('hello world', {
				status: 201,
			});
		const response = await securityHeaders({
			event: createMockEvent(),
			resolve,
		});
		expect(response.status).toBe(201);
		expect(await response.text()).toBe('hello world');
	});
});
