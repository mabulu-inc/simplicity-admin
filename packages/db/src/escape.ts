/**
 * Escapes a SQL identifier by replacing double quotes with double-double quotes
 * and wrapping the result in double quotes.
 *
 * This prevents SQL injection via identifier interpolation.
 *
 * @throws {Error} if the identifier is empty
 */
export function escapeIdentifier(name: string): string {
  if (name === '') {
    throw new Error('SQL identifier must not be empty');
  }
  return `"${name.replace(/"/g, '""')}"`;
}
