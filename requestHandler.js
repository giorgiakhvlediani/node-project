const fetch = require('node-fetch');

class RequestHandler {
  handle(req, res) {
    const handlers = [this.handleFaviconRequest.bind(this), this.handleIcon.bind(this), this.handleOther.bind(this)];
    this.use(handlers, req, res);
  }

  use(handlers, req, res) {
    for (const handler of handlers) {
      if (handler(req, res)) {
        return;
      }
    }
    res.end('No handler found');
  }

  handleFaviconRequest(req, res) {
    if (req.url.includes('favicon')) {
      return this.fetchResource('https://via.placeholder.com/150', 'image/x-icon', res);
    }
    return false;
  }

  handleIcon(req, res) {
    const url = req.url;
    const initialPart = '/image/';
    if (url.startsWith(initialPart)) {
      const fullUrl = `https://${url.substring(initialPart.length)}`;
      return this.fetchResource(fullUrl, 'image/png', res); // Use appropriate Content-Type
    }
    return false;
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

  fetchResource(url, contentType, res) {
    console.log(`Fetching ${url} with content-type ${contentType}`);
    fetch(url)
      .then(faviconRes => {
        if (!faviconRes.ok) {
          throw new Error(`Network response was not ok: ${faviconRes.statusText}`);
        }
        res.writeHead(faviconRes.status, {
          'Content-Length': faviconRes.headers.get('content-length'),
          'Content-Type': faviconRes.headers.get('content-type')
        });
        return faviconRes.body;
      })
      .then(body => body.pipe(res))
      .catch(error => {
        console.error(`Error fetching resource: ${error.message}`);
        res.writeHead(500);
        res.end('Cannot handle the request');
      });
    return true;
  }
}

module.exports = RequestHandler;