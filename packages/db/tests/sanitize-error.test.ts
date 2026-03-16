import { describe, it, expect, vi } from 'vitest';
import { sanitizeDbError } from '../src/sanitize-error.js';

describe('sanitizeDbError', () => {
	it('returns user-friendly message for unique constraint violations', () => {
		const err = Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), {
			code: '23505',
		});
		const result = sanitizeDbError(err);
		expect(result).toBe('A record with this value already exists');
	});

	it('returns user-friendly message for foreign key violations', () => {
		const err = Object.assign(
			new Error('insert or update on table "orders" violates foreign key constraint "orders_user_id_fkey"'),
			{ code: '23503' },
		);
		const result = sanitizeDbError(err);
		expect(result).toBe('Cannot delete: referenced by other records');
	});

	it('returns generic message for unknown database errors', () => {
		const err = new Error('relation "nonexistent" does not exist');
		const result = sanitizeDbError(err);
		expect(result).toBe('An error occurred while saving');
	});

	it('does not expose the original error message to the client', () => {
		const sensitiveMessage = 'ERROR: column "secret_internal_col" of relation "users" does not exist';
		const err = new Error(sensitiveMessage);
		const result = sanitizeDbError(err);
		expect(result).not.toContain('secret_internal_col');
		expect(result).not.toContain('relation');
		expect(result).toBe('An error occurred while saving');
	});

	it('returns generic message for non-Error objects', () => {
		const result = sanitizeDbError('string error' as unknown as Error);
		expect(result).toBe('An error occurred while saving');
	});

	it('logs the original error server-side', () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const err = new Error('detailed internal error info');
		sanitizeDbError(err);
		expect(consoleSpy).toHaveBeenCalledWith('[DB Error]', err);
		consoleSpy.mockRestore();
	});

	it('returns generic message for errors with unknown PostgreSQL codes', () => {
		const err = Object.assign(new Error('some pg error'), { code: '42P01' });
		const result = sanitizeDbError(err);
		expect(result).toBe('An error occurred while saving');
	});

	it('returns user-friendly message for not-null violations', () => {
		const err = Object.assign(new Error('null value in column "name" violates not-null constraint'), {
			code: '23502',
		});
		const result = sanitizeDbError(err);
		expect(result).toBe('A required field is missing');
	});
});
