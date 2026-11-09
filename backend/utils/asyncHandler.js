/**
 * Wrap an async Express handler so rejected promises reach the error handler.
 * Express 4 does not catch async errors on its own.
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
