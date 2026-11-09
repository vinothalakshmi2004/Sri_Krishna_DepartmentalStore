/**
 * express-validator helpers.
 *
 * `validate` runs after a list of validation rules and stops the request
 * with a 400 JSON error when any rule failed:
 *   router.post('/', [body('name').notEmpty()], validate, controller)
 */
const { validationResult, param, query } = require('express-validator');
const AppError = require('../utils/AppError');
const { parseDate } = require('../utils/helpers');

const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array({ onlyFirstError: true }).map((err) => ({
    field: err.path || err.type,
    message: err.msg,
  }));
  // First message as the main message keeps simple UIs simple; full list in `errors`
  return next(new AppError(errors[0].message, 400, errors));
};

// ---------------------------------------------------------------------------
// Reusable rule sets
// ---------------------------------------------------------------------------

/** :id must be a MongoDB ObjectId */
const mongoIdParam = (field = 'id', label = 'ID') =>
  param(field).isMongoId().withMessage(`Invalid ${label}`);

/** ?page, ?limit, ?sort */
const paginationRules = [
  query('page').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('page must be a positive number'),
  query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
  query('sort').optional({ values: 'falsy' }).isString().isLength({ max: 40 }).withMessage('Invalid sort value'),
];

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD */
const dateRangeRules = [
  query('from').optional({ values: 'falsy' })
    .custom((value) => Boolean(parseDate(value))).withMessage('"from" must be a valid date (YYYY-MM-DD)'),
  query('to').optional({ values: 'falsy' })
    .custom((value) => Boolean(parseDate(value))).withMessage('"to" must be a valid date (YYYY-MM-DD)'),
];

/** ?search= */
const searchRule = query('search').optional({ values: 'falsy' })
  .isString().withMessage('Invalid search value')
  .trim()
  .isLength({ max: 100 }).withMessage('Search text is too long');

module.exports = { validate, mongoIdParam, paginationRules, dateRangeRules, searchRule };
