import { describe, it, expect } from 'vitest';

describe('@simplicity-admin/ui', () => {
	it('package imports successfully', async () => {
		const mod = await import('@simplicity-admin/ui');
		expect(mod).toBeDefined();
	});
});
