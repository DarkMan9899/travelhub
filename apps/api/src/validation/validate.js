/**
 * Shared Layer-2 (structural) validation middleware factory.
 *
 * Implements BACKEND_ARCHITECTURE.md §10 (Validators) and §25 (Validation
 * Pipeline): every module's validators/ folder exports a Zod schema per
 * endpoint; this factory wraps that schema into Express middleware that
 * runs BEFORE any Controller/Service code, per the fixed middleware order
 * documented in src/app.js.
 *
 * This is Layer 2 only (structural/format validation from the request
 * payload alone) — Layer 3 (business-rule validation requiring a
 * database read, e.g. availability/ownership checks) belongs in the
 * Service layer, never here (BOOKING_ENGINE_ARCHITECTURE.md §11.1).
 *
 * Usage (inside a module's validators/ file, added in a later sprint):
 *   import { validate } from '../../../validation/validate.js';
 *   router.post('/booking-holds', validate(createHoldSchema), controller.create);
 */

import { ValidationError } from '../errors/AppError.js';

/**
 * @param {import('zod').ZodSchema} schema - validates { body, query, params }
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        issue: issue.code,
      }));
      next(new ValidationError('One or more fields are invalid.', details));
      return;
    }

    // Replace request data with the parsed/coerced result so downstream
    // Controllers receive already-validated, already-typed values.
    req.validated = result.data;
    next();
  };
}

export default validate;
