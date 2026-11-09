/**
 * AppError - an "expected" error with an HTTP status code.
 *
 * Throw it anywhere inside a route/controller and the central error handler
 * turns it into a clean JSON response:
 *   throw new AppError('Order not found', 404);
 *   throw new AppError('Validation failed', 400, [{ field: 'phone', message: '...' }]);
 */
class AppError extends Error {
  /**
   * @param {string} message  Human readable message sent to the client
   * @param {number} statusCode HTTP status code (default 500)
   * @param {Array}  [errors]  Optional list of detailed errors (e.g. per field)
   */
  constructor(message, statusCode = 500, errors) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
