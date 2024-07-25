const http = require('http');
const https = require('https');
const fs = require('fs');
const config = require('./config.js');

class server {
  constructor(requestHandler, connectionManager, errorHandler) {
    this._requestHandler = requestHandler;
    this._connectionManager = connectionManager;
    this._errorHandler = errorHandler
    this._server = null;
    this._port = config.PORT;
    this._host = config.HOST;
  }

  start() {
    if (this._server) return;

    const serverOptions = config.USE_HTTPS ? {
      key: fs.readFileSync(config.HTTPS_KEY),
      cert: fs.readFileSync(config.HTTPS_CERT),
    } : {};

    this._server = config.USE_HTTPS
      ? https.createServer(serverOptions, (req, res) => this._requestHandler.handle(req, res))
      : http.createServer((req, res) => this._requestHandler.handle(req, res));

    this._server.listen(this._port, this._host, () => {
      console.log(`Server running at http${config.USE_HTTPS ? 's' : ''}://${this._host}:${this._port}/`);
    });

    this._server.on('connection', (connection) => {
      this._connectionManager.add(connection);
    });

    process.on('SIGINT', () => this.stop());
    process.on('uncaughtException', (err) => this._errorHandler.handle(err));
  }

  stop() {
    if (this._server) {
      console.log('Server is closing');
      process.exit(0);
      this._server.close(() => {
        this._connectionManager.closeAll();
        process.exit(0);
      });
    }
  }
}

module.exports = server;