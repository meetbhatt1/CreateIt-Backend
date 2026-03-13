import mongoose from 'mongoose';

/**
 * Validate that req.params[paramName] is a valid MongoDB ObjectId.
 * Use for routes like GET /:id, /:projectId, etc.
 * @param {string|string[]} paramNames - one param name or array of names
 */
export function validateObjectId(paramNames) {
  const names = Array.isArray(paramNames) ? paramNames : [paramNames];
  return (req, res, next) => {
    for (const name of names) {
      const value = req.params[name];
      if (value != null && !mongoose.Types.ObjectId.isValid(value)) {
        return res.status(400).json({ message: `Invalid ${name}` });
      }
    }
    next();
  };
}
