const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const cookie = require('cookie');
const { 
  generateRegistrationOptions, 
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const { v4: uuidv4 } = require('uuid');

const RP_ID = 'localhost'; // Replace with your domain
const RP_NAME = 'node-projcet';

const users = []; // Replace with a real database

const getUserByEmail = async (email) => {
  return users.find(user => user.email === email);
};

const createUser = async (email) => {
  const newUser = {
    id: uuidv4(),
    email,
    credentials: [], // To store WebAuthn credentials
  };
  users.push(newUser);
  return newUser;
};

const getUserById = async (id) => {
  return users.find(user => user.id === id);
};

const updateUserCounter = async (userId, newCounter) => {
  const user = await getUserById(userId);
  if (user) {
    user.credentials.forEach(credential => {
      if (credential.counter) {
        credential.counter = newCounter;
      }
    });
  }
};

class RequestHandler {

  handle(req, res) {
    console.log(`Handling request for: ${req.url}`);
    const handlers = [
      this.handleInitRegister.bind(this), 
      this.handleAuthenticate.bind(this), 
      this.handleInitAuth.bind(this),
      this.handleVerifyAuth.bind(this),
      this.handleStaticFiles.bind(this), 
      this.handleFaviconRequest.bind(this),
      this.handleIcon.bind(this),
      this.handleOther.bind(this),
    ];
    this.use(handlers, req, res);
  }

  async use(handlers, req, res) {
    for (const handler of handlers) {
      const handlerResult = handler(req, res);
      
      // Check if the handlerResult is a Promise
      if (handlerResult instanceof Promise) {
        try {     
          const result = await handlerResult;
          if (result === true) {
            return; // Exit if the handler processed the request
          }
        } catch (err) {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
          return; // Exit the function on error
        }
      } else if (handlerResult === true) {
        return; // Exit if the handler processed the request
      }
    }
  
    if (!res.headersSent) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('No handler found');
    }
  }

  async handleInitRegister(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    if (parsedUrl.pathname === '/init-register') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }
  
      const email = parsedUrl.searchParams.get('email');
  
      if (!email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Email is required" }));
        return;
      }
  
      const user = await getUserByEmail(email);
      if (user) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "User already exists" }));
        return;
      }
      
      const options = await generateRegistrationOptions({
        rpID: RP_ID,
        rpName: RP_NAME,
        userName: email,
      });
  
      res.setHeader('Set-Cookie', `regInfo=${encodeURIComponent(JSON.stringify({
        userId: options.user.id,
        email,
        challenge: options.challenge,
      }))}; HttpOnly; Max-Age=60`);
  
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(options));
      return true;
    }
    return false;
  }

  async handleAuthenticate(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    if (parsedUrl.pathname === '/verify-register') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }
  
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString(); // Convert Buffer to string
      });

      req.on('end', async () => {
        const regInfo = JSON.parse(req.cookies.regInfo);
        if (!regInfo) {
          return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: "Registration info not found" }));
        }
  
        const registrationResponse = JSON.parse(body); // Parse the body as JSON
        const verification = await verifyRegistrationResponse({
          response: registrationResponse,
          expectedChallenge: regInfo.challenge,
          expectedOrigin: RP_ID, // Update as needed
          expectedRPID: RP_ID,
        });

        if (verification.verified) {
          await createUser(regInfo.email); // Create user in your database
          res.clearCookie("regInfo");
          return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ verified: verification.verified }));
        } else {
          return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ verified: false, error: "Verification failed" }));
        }
      });
    }
    return false;
  }

  async handleInitAuth(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    if (parsedUrl.pathname === '/init-auth') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      const email = parsedUrl.searchParams.get('email');
      if (!email) {
         res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: "Email is required" }));
         return true
      }

      const user = await getUserByEmail(email);
      if (!user) {
         res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: "No user for this email" }));
         return true
      }
        console.log(user)
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: [
          {
            id: user.credentials[0].id,
            type: "public-key",
            transports: user.credentials[0].transports,
          },
        ],
      });
      console.log(options)
      res.setHeader('Set-Cookie', `authInfo=${encodeURIComponent(JSON.stringify({
        userId: user.id,
        challenge: options.challenge,
      }))}; HttpOnly; Max-Age=60`);
  
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(options));
      return true;
    }
    return false;
  }

  async handleVerifyAuth(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    if (parsedUrl.pathname === '/verify-auth') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk.toString(); // Convert Buffer to string
      });

      req.on('end', async () => {
        const authInfo = JSON.parse(req.cookies.authInfo);
        if (!authInfo) {
          return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: "Authentication info not found" }));
        }

        const user = await getUserById(authInfo.userId);
        if (!user || user.credentials[0].id !== req.body.id) {
          return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: "Invalid user" }));
        }

        const verification = await verifyAuthenticationResponse({
          response: JSON.parse(body),
          expectedChallenge: authInfo.challenge,
          expectedOrigin: RP_ID,
          expectedRPID: RP_ID,
          authenticator: {
            credentialID: user.credentials[0].id,
            credentialPublicKey: user.credentials[0].publicKey,
            counter: user.credentials[0].counter,
            transports: user.credentials[0].transports,
          },
        });

        if (verification.verified) {
          await updateUserCounter(user.id, verification.authenticationInfo.newCounter);
          res.clearCookie("authInfo");
          return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ verified: verification.verified }));
        } else {
          return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ verified: false, error: "Verification failed" }));
        }
      });
    }
    return false;
  }

  handleStaticFiles(req, res) {
    const distDir = path.join(__dirname, 'dist');
    let filePath;

    if (req.url === '/bundle.js') {
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

  handleFaviconRequest(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    if (parsedUrl.pathname === '/favicon.ico') {
      const faviconPath = path.join(__dirname, 'client', 'favicon.ico');
      fs.readFile(faviconPath, (err, content) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'image/x-icon' });
          res.end();
        } else {
          res.writeHead(200, { 'Content-Type': 'image/x-icon' });
          res.end(content);
        }
      });
      return true;
    }
    return false;
  }

  handleIcon(req, res) {
    return false;
  }

  handleOther(req, res) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return true;
  }

  getContentType(extname) {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };

    return mimeTypes[extname] || 'application/octet-stream';
  }
}

module.exports = RequestHandler;
