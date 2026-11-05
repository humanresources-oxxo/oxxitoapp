// worker/index.js
// The app itself is static (assets). This only runs for /DashboardsOxxo/*: the
// same path the app uses on GitHub Pages, so ResumenScreen and tiendas.ts
// don't change. It is passed to the dashboards Worker through the service
// binding, which Cloudflare Access does not cover, so it lets through ONLY
// what the Ficha needs (its page, js, css and assets: code and the store
// catalog). /api and every other dashboard page stay behind Access. The Ficha
// reads its data with the app's session key (?embed=1), never through /api.
const PERMITIDO = [/^\/dashboards\/ficha-plaza(\.html)?$/, /^\/js\/[\w./-]+\.js$/, /^\/css\/[\w./-]+\.css$/, /^\/assets\/[\w./-]+$/];

// The Conoxxo admin panel lives next to the dashboards' Panel Admin, behind
// Cloudflare Access (DashboardsOxxo conoxxo.html). The old /admin/ address
// sends people there.
const PANEL_CONOXXO = 'https://dashboardsoxxo.plaza-oaxaca.workers.dev/conoxxo.html';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return Response.redirect(PANEL_CONOXXO, 302);
    // Fonts are exported under /assets/node_modules/@expo-google-fonts/...;
    // Cloudflare's asset server answers "@" with a redirect to "%40" and the
    // browser loops on it. Ask for the encoded path directly.
    if (url.pathname.startsWith('/assets/') && url.pathname.includes('@')) {
      return env.ASSETS.fetch(new Request(url.origin + url.pathname.replace(/@/g, '%40') + url.search, request));
    }
    if (!url.pathname.startsWith('/DashboardsOxxo/')) return env.ASSETS.fetch(request);
    const ruta = url.pathname.slice('/DashboardsOxxo'.length);
    if (!['GET', 'HEAD'].includes(request.method) || ruta.includes('..') || !PERMITIDO.some((re) => re.test(ruta))) {
      return new Response('No encontrado', { status: 404 });
    }
    const destino = new URL(ruta + url.search, 'https://dashboardsoxxo.internal');
    const r = await env.DASHBOARDS.fetch(new Request(destino, { method: request.method, headers: { accept: request.headers.get('accept') || '*/*' } }));
    // The dashboards site drops ".html" with a redirect; keep it under this prefix.
    const ubicacion = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && ubicacion) {
      const nueva = new URL(ubicacion, destino);
      return Response.redirect(`${url.origin}/DashboardsOxxo${nueva.pathname}${nueva.search}`, r.status === 308 ? 308 : 307);
    }
    return r;
  },
};
