import { defineConfig, loadEnv } from 'vite';
import { createRequire } from 'node:module';
import tailwindcss from '@tailwindcss/vite';

const require = createRequire(import.meta.url);

function localPriceApi() {
  const mount = server => {
    server.middlewares.use('/api/harga', async (req, res) => {
      const handler = require('./api/harga.js');
      const shim = {
        status(code) { res.statusCode = code; return shim; },
        setHeader: (k, v) => res.setHeader(k, v),
        json(body) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); return shim; },
      };
      req.url = '/api/harga' + (req.url === '/' ? '' : req.url);
      await handler(req, shim);
    });
  };
  return { name: 'pangan-pas-local-price-api', configureServer: mount, configurePreviewServer: mount };
}

function localServerApis() {
  const mount = server => {
    server.middlewares.use('/api/akun', async (req, res) => {
      req.url = '/api/akun' + req.url;
      await require('./api/akun.js')(req, res);
    });
    server.middlewares.use('/api/ai', async (req, res) => {
      req.url = '/api/ai';
      await require('./api/ai.js')(req, res);
    });
    server.middlewares.use('/api/daerah', async (req, res) => {
      const handler = require('./api/daerah.js');
      const shim = {
        status(code) { res.statusCode = code; return shim; },
        setHeader: (k, v) => res.setHeader(k, v),
        json(body) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); return shim; },
      };
      req.url = '/api/daerah' + (req.url === '/' ? '' : req.url);
      await handler(req, shim);
    });
  };
  return { name: 'pangan-pas-local-server-apis', configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const k of ['ACCOUNT_API_ORIGIN', 'ACCOUNT_PROXY_SECRET', 'NVIDIA_API_KEY', 'NVIDIA_MODEL', 'NVIDIA_BASE_URL']) if (env[k] && !process.env[k]) process.env[k] = env[k];
  return {
    plugins: [tailwindcss(), localPriceApi(), localServerApis()],

  };
});
