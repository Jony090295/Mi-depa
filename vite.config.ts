import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * En producción, api/tipo-cambio.ts corre como función de Vercel. En local
 * Vite no ejecuta api/ — sin esto, /api/tipo-cambio devolvía el código fuente
 * del archivo en vez de su resultado. Monta la misma función solo en dev, con
 * un adaptador mínimo a la interfaz de Vercel (query, status, json).
 */
function apiTipoCambioDev(): Plugin {
  return {
    name: 'api-tipo-cambio-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/tipo-cambio', async (req, res) => {
        const { default: handler } = await server.ssrLoadModule('/api/tipo-cambio.ts');
        const url = new URL(req.url ?? '', 'http://localhost');
        const vreq: any = Object.assign(req, { query: Object.fromEntries(url.searchParams) });
        const vres: any = Object.assign(res, {
          status(code: number) { res.statusCode = code; return vres; },
          json(body: unknown) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(body));
            return vres;
          },
        });
        await handler(vreq, vres);
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiTipoCambioDev()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
