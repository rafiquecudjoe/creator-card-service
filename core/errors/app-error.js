/**
 * Throw an app error
 * @param {String} errorMessage
 * @param {String} [errorCode]
 * @param {{context:any, details:any, code:String}} [options]
 */
function appError(errorMessage, errorCode = 'ERR', options = {}) {
  const error = new Error(errorMessage);
  error.isApplicationError = true;
  error.errorCode = errorCode;

  // Carry an optional, business-facing error code (e.g. SL02) distinct from the
  // internal errorCode that drives the HTTP status. Surfaced as a flat top-level
  // `code` on the error response body by core/express/server.js.
  if (options.code) {
    error.code = options.code;
  }

  if (options.context) {
    error.context = options.context;
  }

  if (options.details) {
    error.details = options.details;
  }

  throw error;
}

module.exports = appError;
