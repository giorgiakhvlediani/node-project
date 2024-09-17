const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

class RequestHandler {

  handle(req, res) {
    console.log(`Handling request for: ${req.url}`);
    const handlers = [
      this.handleStaticFiles.bind(this),
      this.handleFaviconRequest.bind(this),
      this.handleAuthRequest.bind(this),
      this.handleIcon.bind(this),
      this.handleOther.bind(this),
    ];
    this.use(handlers, req, res);
  }

  use(handlers, req, res) {
    for (const handler of handlers) {
      if (handler(req, res)) {
        return;
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('No handler found');
  }

  handleStaticFiles(req, res) {
    const distDir = path.join(__dirname, 'dist');
    let filePath

    if(req.url === '/bundle.js') {
     filePath = path.join(distDir, req.url);
   } else {
     filePath = path.join(__dirname, 'client', req.url);
   }
  

    if (req.url === '/') {
      filePath = path.join(__dirname, 'client', 'index.html');
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        console.error(`Error reading file ${filePath}: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File not found');
        }
      } else {
        // Determine the content type based on the file extension
        const extname = path.extname(filePath).toLowerCase();
        const contentType = this.getContentType(extname);
        if (!res.headersSent) {
          res.writeHead(200, { 'Content-Type': contentType });
        }
        res.end(content);
      }
    });
    return true;
  }


  getContentType(extname) {
    switch (extname) {
      case '.js':
        return 'application/javascript';
      case '.css':
        return 'text/css';
      case '.png':
        return 'image/png';
      case '.jpg':
        return 'image/jpeg';
      case '.html':
        return 'text/html';
      default:
        return 'text/plain';
    }
  }

  handleFaviconRequest(req, res) {
    if (req.url.includes('favicon')) {
      return this.fetchResource('https://via.placeholder.com/150', 'image/x-icon', res);
    }
    return false;
  }

  handleIcon(req, res) {
    console.log(req.url, 1)
    const url = req.url;
    const initialPart = '/image/';
    if (url.startsWith(initialPart)) {
      const fullUrl = `https://${url.substring(initialPart.length)}`;
      return this.fetchResource(fullUrl, 'image/png', res); // Use appropriate Content-Type
    }
    return false;
  }

  handleAuthRequest(req, res) {
    console.log(1)
    const parts = req.url.split('/');
    const action = parts[2];
    const email = parts[3];

    if (action === 'register') {
      return this.handleRegistrationRequest(req, res, email);
    } else if (action === 'login') {
      return this.handleLoginRequest(req, res, email);
    }

    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid authentication action');
  }

  handleRegistrationRequest(req, res, email) {
    if (req.method === 'GET') {
      fetch(`http://localhost:3000/init-register?email=${email}`, { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
          if (data.error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: data.error }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          }
        })
        .catch(error => {
          console.error(`Error during registration initialization: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        });
      return true;
    }
    return false;
  }

  handleLoginRequest(req, res, email) {
    if (req.method === 'GET') {
      fetch(`http://localhost:3000/init-auth?email=${email}`, { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
          if (data.error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: data.error }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          }
        })
        .catch(error => {
          console.error(`Error during authentication initialization: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error');
        });
      return true;
    }
    return false;
  }

  fetchResource(url, contentType, res) {
    console.log(`Fetching ${url} with content-type ${contentType}`);
    fetch(url)
      .then(faviconRes => {
        if (!faviconRes.ok) {
          throw new Error(`Network response was not ok: ${faviconRes.statusText}`);
        }
        res.writeHead(faviconRes.status, {
          'Content-Length': faviconRes.headers.get('content-length'),
          'Content-Type': contentType
        });
        return faviconRes.body;
      })
      .then(body => body.pipe(res))
      .catch(error => {
        console.error(`Error fetching resource: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Cannot handle the request');
      });
    return true;
  }

  handleOther(req, res) {
    if (req.url) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('rame');
      return true
    }
    return false
  }
}

module.exports = RequestHandler;