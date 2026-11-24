// scripts/e2e.mjs
// Walks through the main screens of the built web app (dist/) in an emulated
// iPhone before anything is published (.github/workflows/revisar.yml). Every
// call to Supabase and to the Worker is answered here with fixed data: no
// network, no real session, nothing is written anywhere.
//
// Usage: npm run build:cloudflare && npm run e2e
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const DIST = path.resolve('dist');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// Static server with the single-page fallback, like Cloudflare.
const servidor = http.createServer(async (req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let archivo = path.join(DIST, ruta);
  if (!archivo.startsWith(DIST)) return res.writeHead(403).end();
  try {
    if ((await stat(archivo)).isDirectory()) archivo = path.join(archivo, 'index.html');
  } catch {
    archivo = path.join(DIST, 'index.html');
  }
  try {
    const cuerpo = await readFile(archivo);
    res.writeHead(200, { 'content-type': TIPOS[path.extname(archivo)] || 'application/octet-stream' }).end(cuerpo);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${servidor.address().port}/`;

const ARTICULO = { id: 21, article: 'Artículo 21', number: 21, body: 'La Empresa otorgará diez minutos como tiempo máximo para registrar su ingreso.' };
const FAQ = [
  { id: 1, articulo: 21, pregunta: '¿Cuántos minutos de tolerancia tengo?', respuesta: 'Diez minutos. (Art. 21)' },
  { id: 2, articulo: 36, pregunta: '¿Con cuánta anticipación pido un permiso?', respuesta: '48 horas. (Art. 36)' },
  { id: 3, articulo: 85, pregunta: '¿Me pueden cambiar de tienda?', respuesta: 'Sí, con 24 horas de aviso. (Art. 85)' },
];
const AVISOS = [{ id: '11111111-1111-1111-1111-111111111111', title: 'Cambio de horario', body: 'Desde el lunes', kind: 'schedule', priority: false, published_at: new Date().toISOString(), imagenes: [] }];
const DIRECTORIO = [{ id: '1', name: null, area: 'Recursos Humanos', role: 'Recepción de RH', phone: '9511234567', schedule: 'L-V 9-18', tags: ['recepcion'], urgent: true }];

const fallas = [];
const revisar = (nombre, ok, detalle = '') => {
  if (!ok) fallas.push(`${nombre}${detalle ? `: ${detalle}` : ''}`);
};

// PW_CHROMIUM: a Chromium already installed (when it is not the one this
// Playwright version downloads, e.g. in a dev container).
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

async function abrir({ puesto, sesion = true, sinRed = false }) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(
    ({ puesto, sesion }) => {
      if (sessionStorage.getItem('e2e')) return;
      sessionStorage.setItem('e2e', '1');
      localStorage.setItem('oxxito:onboardingDone', 'true');
      if (sesion) {
        localStorage.setItem('oxxito:session', JSON.stringify({ numeroEmpleado: '5843652', nombre: 'Prueba', puesto }));
        localStorage.setItem('oxxito:sessionKey', JSON.stringify('a'.repeat(64)));
      }
    },
    { puesto, sesion }
  );
  const llamadas = [];
  const estado = { sinRed };
  await ctx.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(BASE)) return route.continue();
    const rpc = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/);
    if (rpc) {
      const fn = rpc[1];
      llamadas.push({ fn, body: route.request().postDataJSON() });
      if (estado.sinRed && fn !== 'sesion_mi_perfil') return route.abort('internetdisconnected');
      const r = {
        sesion_mi_perfil: { estado: 'ok', numero: '5843652', nombre: 'Prueba', tienda: 'Oficina', plaza: 'Oaxaca', asesor: '', puesto, created_at: null },
        acceso_empleado: [{ primer_nombre: 'Prueba', has_pin: true, pide_fecha: false }],
        sesion_buscar_reglamento: [ARTICULO],
        sesion_faq_aprobadas: FAQ,
        sesion_avisos: AVISOS,
        sesion_directorio: DIRECTORIO,
        contacto_recuperar_pin: [{ name: 'Recepción de RH', phone: '+529511234567' }],
        sesion_uso_registrar: 'ok',
        sesion_chat_votar: 'ok',
      }[fn];
      return route.fulfill({ json: r === undefined ? [] : r });
    }
    if (url.includes('/api/push/clave')) return route.fulfill({ status: 503, json: { ok: false, error: 'push_no_configurado' } });
    if (url.includes('/api/')) return route.fulfill({ status: 401, json: { ok: false, error: 'sesion_conoxxo' } });
    return route.abort();
  });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message.slice(0, 160)));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return { ctx, page, errores, llamadas, estado };
}

const texto = (page) => page.evaluate(() => document.body.innerText);
const ancho = (page) => page.evaluate(() => document.documentElement.scrollWidth);
const pestaña = async (page, nombre) => {
  await page.getByText(nombre, { exact: true }).last().click();
  await page.waitForTimeout(700);
};

// 1. Office puesto: Inicio, tabs, chat with vote and WhatsApp to RH.
{
  const { ctx, page, errores, llamadas } = await abrir({ puesto: 'PRACTICANTE' });
  const inicio = await texto(page);
  revisar('oficina ve Resumen de plaza', inicio.includes('Resumen de plaza'));
  revisar('oficina ve Actas', inicio.includes('Actas y formatos'));
  for (const [tab, titulo] of [['Avisos', 'Cambio de horario'], ['Directorio', 'Recepción de RH'], ['Perfil', 'Prueba'], ['Chat', 'Asistente']]) {
    await pestaña(page, tab);
    const t = await texto(page);
    revisar(`pestaña ${tab}`, t.includes(titulo), `no se ve "${titulo}"`);
    revisar(`pestaña ${tab} sin desborde`, (await ancho(page)) <= 391);
  }
  revisar('directorio sin nombres', !/\bnull\b|undefined/.test(await texto(page)));
  const campo = page.getByPlaceholder(/^Pregunta/).first();
  revisar('campo del chat de 16 px', parseFloat(await campo.evaluate((e) => getComputedStyle(e).fontSize)) >= 16);
  revisar('sugerencias antes de preguntar', (await page.getByRole('button', { name: /^¿/ }).count()) > 0);
  await campo.fill('cuando es retardo');
  await campo.press('Enter');
  try {
    await page.getByText(/diez minutos/).first().waitFor({ timeout: 10000 });
  } catch {
    revisar('el chat contesta', false);
  }
  revisar('sugerencias ocultas después', (await page.getByRole('button', { name: /^¿/ }).count()) === 0);
  await page.getByText('👎 No').first().click();
  await page.waitForTimeout(400);
  revisar('voto con artículo', llamadas.some((l) => l.fn === 'sesion_chat_votar' && l.body.p_articulo === 21 && l.body.p_voto === -1));
  revisar('botón Preguntar a RH tras el No', (await page.getByText('Preguntar a RH por WhatsApp').count()) > 0);
  revisar('uso registrado', llamadas.some((l) => l.fn === 'sesion_uso_registrar'));
  revisar('oficina sin errores', !errores.length, errores.join(' | '));
  await ctx.close();
}

// 2. Store staff (no puesto): no management screens.
{
  const { ctx, page, errores } = await abrir({ puesto: null });
  const t = await texto(page);
  revisar('tienda no ve Resumen', !t.includes('Resumen de plaza'));
  revisar('tienda no ve Actas', !t.includes('Actas y formatos'));
  revisar('tienda sin desborde', (await ancho(page)) <= 391);
  revisar('tienda sin errores', !errores.length, errores.join(' | '));
  await ctx.close();
}

// 3. No session: welcome screen.
{
  const { ctx, page, errores } = await abrir({ puesto: null, sesion: false });
  // The welcome screen animates in: its button appears after a moment.
  const bienvenida = await page.getByText('Comenzar').first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  revisar('sin sesión muestra la bienvenida', bienvenida && !(await texto(page)).includes('Gestión'));
  revisar('bienvenida sin errores', !errores.length, errores.join(' | '));
  await ctx.close();
}

// 4. Without signal: saved avisos and preguntas frecuentes.
{
  const { ctx, page, errores, estado } = await abrir({ puesto: null });
  await pestaña(page, 'Avisos');
  await pestaña(page, 'Chat');
  await pestaña(page, 'Inicio');
  estado.sinRed = true;
  await pestaña(page, 'Avisos');
  const t = await texto(page);
  revisar('avisos sin señal: aviso guardado', t.includes('Cambio de horario') && t.includes('Sin conexión'));
  await pestaña(page, 'Chat');
  const campo = page.getByPlaceholder(/^Pregunta/).first();
  await campo.fill('cuantos minutos de tolerancia tengo');
  await campo.press('Enter');
  await page.waitForTimeout(2000);
  revisar('chat sin señal: pregunta guardada', (await texto(page)).includes('Diez minutos. (Art. 21)'));
  revisar('sin señal sin errores', !errores.length, errores.join(' | '));
  await ctx.close();
}

// 5. Small phone (iPhone SE): the 0 key of the login keypad is not covered by
// the Continuar button (most employee numbers have a 0).
{
  const ctx = await browser.newContext({ ...devices['iPhone SE'] });
  await ctx.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.fulfill({ json: [] })));
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message.slice(0, 160)));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const boton = await page.getByText('Comenzar').first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  if (boton) {
    await page.getByText('Comenzar').first().click();
    await page.waitForTimeout(800);
    const libre = await page.evaluate(() => {
      const ceros = [...document.querySelectorAll('div')].filter((d) => d.childElementCount === 0 && d.textContent.trim() === '0');
      const k = ceros[ceros.length - 1];
      if (!k) return false;
      const r = k.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!el && el.textContent.trim() === '0';
    });
    revisar('celular chico: la tecla 0 no queda tapada', libre);
  } else revisar('celular chico: bienvenida', false);
  revisar('celular chico sin errores', !errores.length, errores.join(' | '));
  await ctx.close();
}

await browser.close();
servidor.close();
if (fallas.length) {
  console.log(`Pantallas: ${fallas.length} fallas\n- ${fallas.join('\n- ')}`);
  process.exit(1);
}
console.log('Pantallas: todo bien (oficina, tienda, sin sesión, sin señal y celular chico)');
