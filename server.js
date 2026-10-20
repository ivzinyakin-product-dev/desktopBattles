/**
 * Tensa Zangetsu: Soul Altar Defense - Zero-Dependency Local Static Server
 * 
 * Uses ONLY built-in Node.js modules (http, fs, path).
 * Serves canonical HTML5/JS/CSS game files with MIME type mapping and path traversal protection.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname);
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function safeResolvePath(urlPath) {
  const cleanPath = urlPath.split('?')[0].split('#')[0];
  const decodedPath = decodeURIComponent(cleanPath);
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const absolutePath = path.resolve(ROOT_DIR, relativePath);

  // Path Traversal Security Check
  if (!absolutePath.startsWith(ROOT_DIR)) {
    return null;
  }
  return absolutePath;
}

function createStaticServer() {
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }

    const targetPath = safeResolvePath(req.url);
    if (!targetPath) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    fs.stat(targetPath, (err, stats) => {
      if (err || !stats) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      let filePath = targetPath;
      if (stats.isDirectory()) {
        filePath = path.join(targetPath, 'index.html');
      }

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('File Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Content-Length': content.length
        });

        if (req.method === 'HEAD') {
          res.end();
        } else {
          res.end(content);
        }
      });
    });
  });

  return server;
}

function startServer(port = DEFAULT_PORT) {
  const server = createStaticServer();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Tensa Zangetsu] Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[Tensa Zangetsu] Server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`\n========================================================`);
    console.log(`  TENSA ZANGETSU: SOUL ALTAR DEFENSE`);
    console.log(`  Server running at http://localhost:${port}/`);
    console.log(`========================================================\n`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { createStaticServer, startServer, safeResolvePath, MIME_TYPES };
