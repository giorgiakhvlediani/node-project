class errorHandler {
  handle(err) {
    console.error(`Uncaught Exception: ${err.message}`);
    process.exit(1);
  }
}

module.exports = errorHandler;