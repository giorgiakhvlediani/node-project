const http = require('http');
const https = require('https');
const fs = require('fs');
const config = require('../config');
const Server = require('../server');

jest.mock('http');
jest.mock('https');
jest.mock('fs');
jest.mock('../config');

describe('Server', () => {
  let requestHandler, connectionManager, errorHandler, serverInstance;

  beforeEach(() => {
    requestHandler = {
      handle: jest.fn(),
    };
    connectionManager = {
      add: jest.fn(),
      closeAll: jest.fn(),
    };
    errorHandler = {
      handle: jest.fn(),
    };
    config.PORT = 3000;
    config.HOST = 'localhost';
    config.USE_HTTPS = false;

    serverInstance = new Server(requestHandler, connectionManager, errorHandler);

    // Mock console.log
    jest.spyOn(console, 'log').mockImplementation(() => { });
    // Mock process.exit
    jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with "${code}"`);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should start an HTTP server and handle requests', () => {
    http.createServer.mockImplementation((handler) => ({
      listen: (port, host, callback) => callback(),
      on: jest.fn(),
    }));

    serverInstance.start();

    expect(http.createServer).toHaveBeenCalled();
    expect(http.createServer).toHaveBeenCalledWith(expect.any(Function));
    expect(serverInstance._server.listen).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function));
  });

  test('should start an HTTPS server if USE_HTTPS is true', () => {
    config.USE_HTTPS = true;
    config.HTTPS_KEY = 'path/to/key';
    config.HTTPS_CERT = 'path/to/cert';

    fs.readFileSync.mockImplementation((path) => `fake ${path}`);

    https.createServer.mockImplementation((options, handler) => ({
      listen: (port, host, callback) => callback(),
      on: jest.fn(),
    }));

    serverInstance.start();

    expect(https.createServer).toHaveBeenCalled();
    expect(https.createServer).toHaveBeenCalledWith(
      {
        key: 'fake path/to/key',
        cert: 'fake path/to/cert',
      },
      expect.any(Function)
    );
    expect(serverInstance._server.listen).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function));
  });

  test('should handle new connections', () => {
    http.createServer.mockImplementation((handler) => ({
      listen: (port, host, callback) => callback(),
      on: jest.fn().mockImplementation((event, handler) => {
        if (event === 'connection') {
          handler('mock connection');
        }
      }),
    }));

    serverInstance.start();

    expect(connectionManager.add).toHaveBeenCalledWith('mock connection');
  });

  test('should handle uncaught exceptions', () => {
    const mockError = new Error('test error');

    process.emit = jest.fn().mockImplementation((event, error) => {
      if (event === 'uncaughtException') {
        errorHandler.handle(mockError);
      }
    });

    serverInstance.start();

    expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
  });

  test('should stop the server', () => {
    http.createServer.mockImplementation((handler) => ({
      listen: (port, host, callback) => callback(),
      close: jest.fn().mockImplementation((callback) => callback()),
      on: jest.fn(),
    }));

    serverInstance.start();
    serverInstance.stop();

    expect(serverInstance._server.close).toHaveBeenCalled();
    expect(connectionManager.closeAll).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });
});