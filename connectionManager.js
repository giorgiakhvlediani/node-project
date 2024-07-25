class connectionManager {
  constructor() {
    this._connections = [];
  }

  add(connection) {
    console.log('Connection established');
    this._connections.push(connection);
    connection.on('close', () => {
      console.log('Connection closed');
      this._connections = this._connections.filter(curr => curr !== connection);
    });
  }

  closeAll() {
    console.log('Closing connections');
    this._connections.forEach((connection) => {
      connection.end('Server is restarting');
      connection.destroy();
    });
  }
}

module.exports = connectionManager;