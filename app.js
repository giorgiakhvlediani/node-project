const Server = require('./server.js');
const requestHandler = require('./requestHandler.js');
const cnnectionManager = require('./connectionManager.js');
const errorHandler = require('./errorHandler.js');

const requestHandlerClass = new requestHandler();
const connectionManagerClass = new cnnectionManager();
const errorHandlerClass = new errorHandler()
console.log(requestHandlerClass, connectionManagerClass, errorHandlerClass)
const server = new Server(requestHandlerClass, connectionManagerClass, errorHandlerClass);

server.start();