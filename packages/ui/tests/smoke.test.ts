import { describe, it, expect } from 'vitest';

describe('@mabulu-inc/simplicity-admin-ui', () => {
	it('package imports successfully', async () => {
		const mod = await import('@mabulu-inc/simplicity-admin-ui');
		expect(mod).toBeDefined();
	});
});
