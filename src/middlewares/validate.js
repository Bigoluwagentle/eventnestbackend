const AppError = require('../utils/AppError');

/**
 * Validates req against a Zod schema shaped like { body, query, params }.
 * Replaces req.body/query/params with the parsed (and coerced) data.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError('Validation failed', 400, details));
    }

    if (result.data.body) req.body = result.data.body;
    if (result.data.query) req.query = result.data.query;
    if (result.data.params) req.params = result.data.params;

    next();
  };
}

module.exports = validate;