export class DatabaseError extends Error {
  readonly code: string;

  constructor(message: string, code: string, cause?: Error) {
    super(message, { cause });
    this.name = 'DatabaseError';
    this.code = code;
  }
}

/**
 * Masks the password in a PostgreSQL connection URL.
 * postgres://user:secret@host/db → postgres://user:***@host/db
 */
export function maskConnectionUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    // If URL can't be parsed, return a safe placeholder
    return '<invalid-url>';
  }
}
