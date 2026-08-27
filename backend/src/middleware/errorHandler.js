function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  res.status(status).json({
    ok: false,
    error: err.message || 'Server error',
  });
}

module.exports = errorHandler;
