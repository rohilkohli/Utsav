/**
 * Domain-specific error hierarchy for Utsav server.
 * Extends the base Error class so instanceof checks work correctly across
 * async boundaries; each subclass carries an HTTP status code for
 * consistent error response mapping in route handlers.
 */

/**
 * Base application error. All domain errors extend this class so callers
 * can distinguish operational errors (expected, loggable) from programming
 * errors (unexpected, should propagate).
 *
 * @param message - Human-readable error description
 * @param statusCode - HTTP status code to send to the client (default 500)
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintain correct prototype chain for instanceof checks in transpiled ES5
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when Gemini plan generation fails after all retries and no fallback
 * can satisfy the request (e.g. schema validation error on fallback output).
 */
export class PlanGenerationError extends AppError {
  constructor(message: string) {
    super(message, 502);
  }
}

/**
 * Thrown when a share token is not found, has expired, or is structurally
 * invalid (prevents leaking existence via timing differences).
 */
export class ShareNotFoundError extends AppError {
  constructor() {
    super('Shared plan not found or link has expired', 404);
  }
}

/**
 * Thrown when a request body fails Zod schema validation.
 * Routes catch this and return 400 with the validation message.
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}
