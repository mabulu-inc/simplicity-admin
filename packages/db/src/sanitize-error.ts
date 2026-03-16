/**
 * PostgreSQL error codes we handle with user-friendly messages.
 * See: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_NOT_NULL_VIOLATION = '23502';

const USER_MESSAGES: Record<string, string> = {
	[PG_UNIQUE_VIOLATION]: 'A record with this value already exists',
	[PG_FOREIGN_KEY_VIOLATION]: 'Cannot delete: referenced by other records',
	[PG_NOT_NULL_VIOLATION]: 'A required field is missing',
};

const GENERIC_MESSAGE = 'An error occurred while saving';

/**
 * Sanitizes a database error into a user-friendly message.
 * Logs the original error server-side for debugging.
 * Never exposes raw PostgreSQL error details to the client.
 */
export function sanitizeDbError(err: Error): string {
	console.error('[DB Error]', err);

	if (err instanceof Error && 'code' in err) {
		const code = (err as Error & { code: string }).code;
		const userMessage = USER_MESSAGES[code];
		if (userMessage) {
			return userMessage;
		}
	}

	return GENERIC_MESSAGE;
}
