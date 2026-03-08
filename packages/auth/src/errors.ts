export class AuthError extends Error {
  readonly code: string;

  constructor(message: string, code: string, cause?: Error) {
    super(message, { cause });
    this.name = 'AuthError';
    this.code = code;
  }
}
