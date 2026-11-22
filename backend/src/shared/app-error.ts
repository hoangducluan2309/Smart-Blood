export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(options: {
    message: string;
    statusCode: number;
    code: string;
    details?: unknown;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.isOperational = true;
    this.details = options.details;
  }
}

export function createAppError(options: {
  message: string;
  statusCode: number;
  code: string;
}): AppError {
  return new AppError(options);
}
