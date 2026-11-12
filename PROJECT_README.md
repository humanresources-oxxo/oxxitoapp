# Conoxxo (antes Oxxito) — React Native / Expo

Implementación en React Native (Expo SDK 56) del flujo de **onboarding** de Conoxxo (antes Oxxito),
a partir del design handoff (`design_handoff_oxxito_app`).

## Estado actual

🎨 **Marca Conoxxo:** la app se llama Conoxxo. Logo en `assets/images/conoxxo-logo.png`
  (y el emblema circular en `conoxxo-emblem.png`, base de los íconos de app, web y Android).
  Paleta del logo en `src/theme/tokens.ts`: rojo `#E30613`, amarillo `#F6B800`, azul
  `#005AAE`. Se conserva el osito como mascota. La dirección web sigue siendo `/oxxitoapp/`
  y las llaves guardadas (`oxxito:*`) no cambian, para no cerrar sesiones ni romper la app
  instalada. Al publicar, `index.html` lleva title "Conoxxo" y `theme-color` `#E30613`
  (lo pone `scripts/patch-web-index.mjs`).

🧭 **Diseño y navegación (revisión de UX):**
- **5 pestañas para todos:** Inicio, Chat, Avisos, Directorio, Perfil. Lo demás (Vacaciones,
  Votaciones, Resumen de plaza y las herramientas de gestión) abre desde Inicio como pantalla
  propia, sin barra de pestañas y con botón de regresar.
- **Inicio:** campo "Pregúntale al reglamento", consultas recientes (al tocarlas se vuelven a
  preguntar), "Para ti" (días de vacaciones, avisos sin leer, votaciones por votar) y la lista
  "Gestión" según el puesto.
- **Atrás:** el botón de Android y el atrás del navegador regresan a Inicio en vez de salir
  (`MainTabsNavigator`: `BackHandler` + una entrada de historial en web).
- **Chat:** la conversación se guarda en el teléfono (`oxxito:chatMessages`, se borra al cerrar
  sesión); el lápiz del encabezado empieza una nueva.
- **Entrada:** 3 pasos; los términos se aceptan una sola vez por empleado en cada teléfono
  (`oxxito:terminosAceptados`, que no se borra al cerrar sesión). Cerrar sesión pide confirmar.
- **Actas y formatos por pasos:** tipo → datos del formato → firmas → revisar y enviar, con
  barra de avance (se puede saltar entre pasos) y botones fijos abajo.
- **Piezas compartidas** (`src/components`): `Encabezado` (título, regresar y acciones),
  `Estado` (`Esqueleto` de carga y `EstadoVacio` con reintento), `Pressable` (todo lo que se
  toca se atenúa al presionarlo). Las hojas inferiores son sólidas (`hoja` en `tokens.ts`).
- **Tokens** (`src/theme/tokens.ts`): las pantallas usan `fontFamily.*` y `colors.*` en vez de
  valores escritos a mano. Texto mínimo de 12 px y contraste AA para texto (`ink3`, `ok` y los
  degradados se oscurecieron); `colors.placeholder` es solo para la pista de un campo vacío.
  En pantallas anchas la app queda en una columna centrada (`anchoMaximo`).

✅ **Onboarding + tabs post-login completos:**
- Splash, Welcome, Login, Verify, Register (crear PIN / PIN temporal → definitivo), Permissions
- Home (saludo con nombre real), Chat, Directorio (con `tel:`), Notificaciones, Perfil

✅ **Backend real (Supabase, ver `supabase/migration_*.sql`, en orden):**
- Auth: tabla `employees` cargada con la nómina real (`employee_lookup` / `set_initial_pin` /
  `verify_pin` / `change_pin`). Solo empleados ya en la nómina pueden entrar — no hay
  registro libre; un empleado nuevo se agrega vía el panel admin (`conoxxo.html` de DashboardsOxxo).
  Al abrir la app, la sesión guardada se revisa contra la nómina (`employee_lookup`): se
  actualiza el puesto y, si el empleado ya no está en `employees`, se cierra la sesión.
  Sin red (o con el rate-limit) se conserva la sesión guardada.
  Cada empleado arranca con un **PIN temporal aleatorio** (generado por
  `generate_temp_pins()` / el panel admin) que debe cambiar en su primer login.
- Seguridad: bloqueo de cuenta tras 5 intentos fallidos de PIN (`verify_pin`/`change_pin`),
  y rate-limit por IP en `employee_lookup` (20/min) para evitar enumerar la nómina.
- Chat: tabla `reglamento_articles` con los 110 artículos reales del RIT (`Uso Interno` —
  nunca se embebe en el bundle del cliente), búsqueda de texto completo en español vía
  RPC `search_reglamento`. Sin LLM: es un keyword match contra el texto real.
- Directorio: tabla `directory_contacts`, editable desde el panel admin.
- Avisos: tabla `notices`. Se publican desde Avisos (botón de lápiz) o Perfil, solo RH y Gerente
  de plaza, con la llave de sesión (sin passcode); el panel admin web sigue usando el passcode de RH.
  Desde la migración 36 llevan hasta 3 imágenes (`notice_images`, Base64): se eligen con
  `expo-image-picker` y se comprimen en el teléfono con `expo-image-manipulator` (JPEG, lado mayor
  1280 px, ~150 KB); la app lista con `list_avisos` y carga cada imagen con `aviso_imagen`. Con
  imagen el texto es opcional. RH y Gerente de plaza también los borran desde el detalle
  (`sesion_borrar_aviso`). Componentes: `AvisoComposer`, `PinUnaVez`.
- Llave de sesión (migración 35, `src/services/sesion.ts`): al iniciar sesión con el PIN la app
  pide a `iniciar_sesion` una llave aleatoria y la guarda en el teléfono (Supabase guarda solo su
  SHA-256). Publicar avisos, votar y administrar votaciones van con esa llave, sin PIN ni
  passcode. Cambiar o reiniciar el PIN la invalida; cerrar sesión también. Una sesión de antes
  de la llave pide el PIN una sola vez. Dura 180 días desde el último uso.

✅ **Panel admin (`conoxxo.html` en el repositorio DashboardsOxxo):** página web aparte (no
  dentro del app de React Native). Vive junto al Panel Admin de los dashboards, en
  https://dashboardsoxxo.plaza-oaxaca.workers.dev/conoxxo.html, detrás de Cloudflare Access
  (correo de la lista autorizada) y con botones para pasar de un panel al otro. La dirección
  vieja de la app (`/admin/`) redirige ahí (`worker/index.js`). Si hay que cambiarlo, se
  cambia en DashboardsOxxo. Desde la migración 37 se entra con **número de empleado y PIN** (llave de sesión);
  el passcode compartido de RH ya no existe. RH (Responsable RH, Analista EC y quien esté en `accesos_especiales`, migración 42)
  ve Empleados: agregar empleados y "Dar PIN temporal" (4 dígitos que se muestran una vez; al
  entrar, la app obliga a crear uno propio). RH y Gerente de plaza ven Avisos y Directorio.
  Todo lo que viene de la base se pinta como texto (`textContent`). No guarda ningún secreto:
  el acceso lo decide el servidor por el puesto de quien entra.

✅ **Seguridad de acceso (migración 37):**
  - Bloqueo de PIN que crece y no depende de la dirección: 5 fallos → 15 min por intento,
    10 → 1 h, 20 → 24 h (lo limpia un PIN correcto o RH). Lo comparten `verify_pin` y
    `change_pin`. Además, máximo 30 fallos por hora por dirección cuando se conoce (`cliente_ip()`).
  - PINs triviales (1234, 0000, 1111…) rechazados al crear o cambiar.
  - Primer registro: los puestos con permisos (`puesto_con_permisos`, mismos que
    `PUESTOS_ACTAS`) no pueden crear su primer PIN; RH les da uno temporal. Tope de 60 registros
    por hora en total (10 por dirección).
  - Desde la migración 38, si RH cargó la **fecha de nacimiento** de un empleado
    (`employees.fecha_nacimiento`, panel → Empleados → Fechas de nacimiento, pegando dos columnas
    de Excel), el primer registro (`registrar_pin`) también la pide; nunca se devuelve
    (`employee_lookup` solo dice `pide_fecha`). 5 fechas equivocadas bloquean el registro de esa
    cuenta 24 h. Sin fecha cargada, el registro sigue siendo número + PIN.
  - Desde la migración 39, quien se registra solo queda **pendiente de aprobación**: no puede
    entrar (`verify_pin` responde `pendiente`) hasta que su asesor (el `asesor` de su fila en
    `employees`, comparado sin acentos con el nombre del asesor), RH o el Gerente de plaza la
    aprueben en la app (Inicio → Altas por aprobar, `src/screens/AltasScreen.tsx`) o en el panel
    (Empleados → Altas por aprobar). Rechazar borra el PIN y deja la cuenta libre. Un PIN temporal
    de RH aprueba la cuenta solo.
  - La dirección del cliente sale de `cf-connecting-ip` (la pone Cloudflare; un encabezado falso
    se rechaza con 403). El diagnóstico `mi_red()` se borró en la migración 38.

✅ **Lecturas con sesión (migraciones 49 y 50):** el reglamento (búsqueda, sanciones, puntos y
  preguntas frecuentes), los avisos (con sus imágenes) y el directorio ya no contestan a la llave
  pública: se leen con la llave de sesión (`rpcSesion` en `src/services/sesion.ts` →
  `sesion_buscar_reglamento`, `sesion_lista_sanciones`, `sesion_sancion`, `sesion_lista_items`,
  `sesion_item`, `sesion_faq_aprobadas`, `sesion_buscar_faq`, `sesion_avisos`,
  `sesion_aviso_imagen`, `sesion_directorio`). El Worker del chat busca con la llave de quien
  pregunta. Sin llave (sesión de antes de la llave, o terminada por un cambio de PIN) la app pide
  el PIN una vez (`PinUnaVez` desde `MainTabsNavigator`) y recarga la pantalla. Lo único público
  es `contacto_recuperar_pin()`: nombre y teléfono de recepción de RH para "Olvidé mi PIN".
  **Orden:** correr la 49 → publicar la app → correr la 50 (cierra las funciones viejas; antes,
  revisar que el Panel Conoxxo no las use).

✅ **El número de empleado ya no entrega datos personales (migraciones 52 y 53):** antes
  `employee_lookup` devolvía nombre completo, tienda, plaza, asesor y puesto con solo el número
  y sin sesión. Ahora la pantalla de acceso usa `acceso_empleado` (solo si existe, si tiene PIN,
  si el registro pide fecha y el primer nombre para el saludo; mismo tope de 20 por minuto). El
  perfil propio se lee con la llave de sesión (`sesion_mi_perfil`: al terminar el acceso y en cada
  apertura) y buscar a otro empleado por número, para un acta, es `sesion_buscar_empleado`, solo
  para puestos con permisos. **Orden:** correr la 52 → publicar la app → correr la 53 (cierra
  `employee_lookup`).

✅ **Cerrar sesión borra todo lo del empleado en el teléfono:** `cerrarSesion`
  (`src/services/sesion.ts`) borra todas las llaves `oxxito:*` (sesión, llave, historial y contador
  del chat, avisos leídos, borrador de acta, saldo de vacaciones, catálogo de tiendas) y termina
  la llave en el servidor. En la web, además, la página se recarga para soltar lo que las
  pantallas guardan en memoria.

✅ **Revisión automática (`.github/workflows/revisar.yml`):** cada pull request y cada push a
  `main` corre `npm run typecheck` (TypeScript), `npm run check:worker` (sintaxis de `worker/`) y
  `npm run build:cloudflare` (la misma compilación que hace Cloudflare). No usa secretos.

✅ **Votaciones (`src/screens/VotacionesScreen.tsx`):** votaciones secretas para lugares,
  fechas y decisiones del equipo (no sindicales). Supabase, migración 34
  (`supabase/migration_34_votaciones.sql`); servicio `src/services/votaciones.ts`.
  - **Quién vota:** toda la plaza o solo algunas tiendas (se comparan con la tienda del
    empleado en `employees`, sin acentos ni "OXXO"/"OAX"; también los nombres que nómina
    corta a 25 letras). Un voto por empleado, con su llave de sesión (migración 35; las
    funciones con PIN de la migración 34 se borraron).
  - **Lista con sesión (migraciones 54 y 55):** la lista (`sesion_votaciones`) se lee con la
    llave de sesión; antes `list_votaciones(numero)` decía, con solo el número y sin sesión, en
    cuáles ya había votado esa persona y, con un número de RH, los resultados en vivo.
  - **Secreto:** `votacion_participantes` guarda quién ya votó y `votacion_opciones.votos` es
    un contador; no hay tabla que una a la persona con su opción ni horas de voto.
  - **Resultados:** al cerrar (o al votar, si se marcó "Mostrar resultados al votar"). RH los
    ve siempre. Las cerradas se ven 60 días.
  - **Crear / cerrar / borrar:** desde la misma pantalla, solo los puestos de
    `voto_puede_administrar` (RH: Responsable RH, Analista EC, Practicante; Gerente de plaza), con su llave de sesión. Son los mismos que publican avisos. Una votación para toda la plaza publica un aviso (tipo `vote`).
  - La tarjeta de Inicio muestra cuántas faltan por votar y se oculta si Supabase no responde.

✅ **Mudanza a Cloudflare:** la app web vive en **`conoxxo.plaza-oaxaca.workers.dev`**
  (Cloudflare Workers, proyecto `conoxxo`, sin Cloudflare Access: se entra con número de
  empleado y PIN). Cada push a `main` la compila Cloudflare con `npm run build:cloudflare`.
  - `scripts/build-cloudflare.mjs` hace el export web con la app en la raíz
    (`EXPO_BASE_URL=''`, leído por `app.config.js`), las variables públicas de Supabase y
    `--clear`. Manifiesto con rutas relativas y `public/instalar.html`: se instala desde el
    navegador (Chrome: Instalar app · Safari: Compartir → Agregar a inicio).
  - `wrangler.jsonc` + `worker/index.js`: `/DashboardsOxxo/*` pasa al Worker de los
    dashboards por *service binding* (no pasa por Access) y SOLO deja la Ficha
    (`dashboards/ficha-plaza.html`), `js/`, `css/` y `assets/` (incluye el CSV del
    catálogo); `/api` y los demás dashboards dan 404. Las fuentes con "@" en la ruta se
    piden ya codificadas (si no, Cloudflare redirige en ciclo).
  - GitHub Pages ya no publica la app: `deploy-web.yml` publica `mudanza/index.html` en
    todas las rutas de `/oxxitoapp/`, que avisa y manda a la misma ruta en la dirección
    nueva. Pages desaparece cuando el repositorio pasa a privado.

✅ **Lectura con sesión (paso 3, Apps Script v66):** Estructura, Vacaciones, el catálogo de
  tiendas y la cuota sindical ya no dependen de que el Google Sheet sea público. `leerCsv`
  (`src/services/gviz.ts`) pide los datos al Apps Script (`leerDatos`) con la llave de sesión;
  el script lee la hoja como su dueño y solo deja leer `Configuracion`, `Catalogo_Asesores`,
  `Dashboard_1_Diario` y `Dashboard_5_Semanal`. Mientras la hoja siga pública (o el Apps
  Script no esté en v66, que se revisa con un GET antes de usarlo: a uno anterior la petición
  le contaría como contraseña fallida) se cae a GViz directo como antes. Si el script responde
  `sesion_conoxxo`, la pantalla pide el PIN una vez (`src/components/PinDeSesion.tsx`). La
  cuota sindical manda la llave y seguirá pública hasta que DashboardsOxxo active
  `LECTURA_PRIVADA` (entonces exige sesión).

✅ **Sesión en el Apps Script (paso 2 de la auditoría, Apps Script v65 + migración 41):** CCT
  (`consultarCct`), DILOS (`consultarDilos`) y las actas (`enviarActa`) mandan la llave de sesión
  (`llave`). El script la valida con `sesion_validar` en Supabase (5 min en caché) y solo contesta
  CCT y DILOS a puestos con permisos (o al panel con su contraseña); si no, responde
  `sesion_conoxxo` y la pantalla pide el PIN una vez (`PinUnaVez`). Un acta enviada con sesión
  dice en el correo quién la mandó y no la frena el límite global del formulario web (sí uno por
  persona). Cuota sindical sigue pública porque la usa la página pública de DashboardsOxxo
  (paso 3).

🧪 **Chat con IA (prototipo, `worker/chat.js` + `answerQuestion` en `src/services/chatQa.ts`):**
  el chat del reglamento puede contestar con un modelo de **Cloudflare Workers AI** (gratis
  hasta 10,000 neuronas al día) en lugar de solo mostrar el artículo encontrado.
  - La app manda la pregunta y la llave de sesión a `POST /api/chat` del Worker de la app. El
    Worker valida la sesión (`sesion_validar`), deja pasar a quien diga
    `CHAT_IA_NUMEROS` (`wrangler.jsonc`; desde el 2026-11-11 es `"*"`: **todos** los que tienen
    sesión; una lista de números lo limita a esos), con un
    tope de `CHAT_IA_LIMITE_DIA` preguntas por persona al día. Desde la migración 51 el tope
    (chat, Mejorar redacción y Lo importante) se cuenta en Supabase (`sesion_ia_contar`, tabla
    `ia_usos`, día de la Ciudad de México; `worker/limite.js`), así que vale para todas las copias
    del Worker. Si Supabase no puede contar, se usa la cuenta en memoria de antes.
  - Busca los 3 artículos más cercanos con la misma `search_reglamento` de siempre y **solo
    esos** van al modelo (`CHAT_IA_MODELO`, hoy `@cf/meta/llama-3.3-70b-instruct-fp8-fast`),
    con la instrucción de contestar únicamente con ellos, citar el artículo y mandar a RH lo
    que no esté. La última línea del modelo ("ARTICULO: n") dice cuál fue la fuente.
  - En el chat sale con la insignia "Respuesta con IA · prueba". Si el artículo en el que se basó
    la IA tiene opciones (sanciones 79/93/106, artículos con puntos 77/78), abajo de la
    respuesta van las opciones de ese artículo. Si el número no está habilitado, la IA falla o se acaba
    la cuota del día, se muestra la búsqueda de siempre.
  - El texto de las preguntas no se guarda en los registros: solo modelo, tokens, tiempo y
    artículo citado (Cloudflare → Workers → conoxxo → Observabilidad, buscar `chat_ia`).
  - Para abrirlo a todos: decidir con RH y quitar la lista (o cambiarla por puesto).

🧪 **Claude Haiku 5.5 (etapa 1, `worker/claude.js`):** con el secreto `ANTHROPIC_API_KEY` en
  Cloudflare (Workers → conoxxo → Settings → Variables and Secrets, tipo *Secret*; nunca en el
  código ni en la app), el Worker usa Claude Haiku 5.5 con la librería oficial
  `@anthropic-ai/sdk`. Sin el secreto todo sigue como antes. Cada llamada pide JSON con un
  esquema fijo (salidas estructuradas) y esfuerzo `low`; si Haiku rechaza, se corta o falla,
  se usa lo de antes.
  - **Chat** (`CHAT_IA_PROVEEDOR`: `auto` = Haiku si hay llave, si no Workers AI): Haiku
    convierte la pregunta en 1 a 3 búsquedas con las palabras del reglamento, se busca con
    todas (`search_reglamento`, hasta 5 artículos) y Haiku contesta con ellos
    (`{ respuesta, articulo }`). Si Haiku falla, contesta Workers AI.
  - **Mejorar redacción** (`worker/redactar.js`, `POST /api/redactar`; botón en
    `AvisoComposer`): para quien puede publicar avisos (`sesion_panel` → `avisos`). Corrige
    ortografía y tono sin cambiar fechas, horas, nombres ni montos, y lo muestra como
    propuesta: "Usar esta versión" o "Descartar". No publica ni guarda nada.
  - **Lo importante de la ficha** (`worker/resumen.js`, `POST /api/resumen-ficha`): la Ficha
    de Plaza de la pestaña Resumen manda sus propios números (`datosResumen` en
    DashboardsOxxo) y Haiku escribe un titular y 2 a 4 puntos solo con ellos. Solo puestos
    con permisos. Con los mismos números no se vuelve a pedir (memoria del Worker y del
    teléfono), así que se paga una vez por corte. Si no está activo, la tarjeta no aparece.
  - **Preguntas frecuentes del reglamento** (migración 44, `worker/faq.js`): en el Panel
    Conoxxo (pestaña "Preguntas frecuentes"), RH genera propuestas: el Worker lee el RIT
    por partes con la sesión (`sesion_reglamento_articulos`, solo RH y accesos especiales) y
    Haiku escribe preguntas y respuestas solo con cada artículo; se guardan como propuesta
    (`sesion_faq_proponer`). RH las aprueba, corrige o descarta. Las aprobadas salen como
    sugerencias del chat (`faq_reglamento_aprobadas`) y Haiku las recibe como referencia al
    contestar (`search_faq`). `/api/faq/generar` solo acepta llamadas del navegador desde el
    panel (CORS para `dashboardsoxxo.plaza-oaxaca.workers.dev`).
  - No se registra el texto: solo modelo, tokens y tiempo (Observabilidad: `chat_ia`,
    `redactar_ia`, `resumen_ia`, `faq_ia`). Costo y límite de gasto: en la consola de Anthropic.

✅ **Casos DILOS (`src/screens/DilosScreen.tsx`):** dashboard **solo de la app**: casos
  abiertos de la **Zona Centro Sur** del "Reporte DILOS" que manda RH (hoja `ZCS`: caso,
  región, plaza, facilitador, estatus, días abiertos). Solo para los puestos de
  `PUESTOS_ACTAS`; se abre desde Inicio.
  - **Carga:** panel admin de DashboardsOxxo → Administrativo → tarjeta "Casos DILOS"
    (`js/dilos-conoxxo.js`), con la sesión del panel. **El nombre del facilitador no se
    envía.** El Apps Script (`publicarDilos`, v64) lo guarda en un libro privado; la app lee
    `consultarDilos` (`src/services/dilos.ts`). La fecha del corte sale del nombre del archivo.
  - **Pantalla:** folios abiertos y por agendar, cuántos hay en cada nivel de la matriz de
    escalamiento (`MATRIZ_DILOS`: en tiempo 0–19 días, Nivel 1 20–25, Nivel 2 26–50, Nivel 3
    51+), la tabla **"Folios por Plaza"** y la lista del más antiguo al más reciente con
    filtros por nivel, región y plaza.
  - **Por escalar:** un aviso arriba con los folios a los que les faltan 3 días o menos para
    subir de nivel (`porEscalar`, `DIAS_ALERTA_ESCALAR`, como el "Alerta si faltan 3 días"
    del libro de RH); al tocarlo filtra la lista, donde esos días van en rojo.
  - El panel también acepta la exportación del portal de Línea Ética (Case Number, Case
    Status, Days Open…): solo carga los abiertos y limpia región y plaza. Como ese archivo no
    trae fecha en el nombre, la pantalla muestra la fecha en que se cargó.
  - **Folios por Plaza** (como "Vacantes por Asesor" de los dashboards): folios con barra,
    días promedio, días máximo y folios en tiempo / N1 / N2 / N3 en pastillas del color de
    su nivel, con fila "Total general". Se ordena tocando el encabezado; en celular la
    columna Plaza se queda fija y lo demás se desliza de lado. El punto y la barra de cada
    plaza llevan el color de su folio más grave; Oaxaca dice "TU PLAZA". Tocar una plaza
    filtra la lista de abajo. Reemplaza la tarjeta "Folios por región y nivel".

✅ **Contratos colectivos (`src/screens/CctScreen.tsx`):** dashboard **solo de la app** (no
  existe en DashboardsOxxo). Los datos salen del Excel de CCT de RH ("Data colectiva Tiendas
  OXXO", hojas `CCTs Tiendas` y `CCT ejercicio <año>`), que es de todas las plazas de OXXO.
  Solo para los puestos de `PUESTOS_ACTAS`; se abre desde Inicio.
  - **Carga:** en el **panel admin de DashboardsOxxo** (`admin.html`), área Administrativo →
    tarjeta "Contratos colectivos (CCT) · Solo app Conoxxo" (`js/cct-conoxxo.js` de ese
    repo), con la sesión abierta del panel (no pide otra contraseña). Ningún dashboard web
    lo muestra. El Excel se normaliza en el navegador (porcentajes a fracción, fechas
    `AAAA-MM-DD`, "NA" → vacío) y **no se envían** nombres de responsables ni ligas a
    SharePoint. El Apps Script (`publicarCct`, v63) lo guarda en un libro privado aparte y
    la app lo lee con la acción pública `consultarCct` (`src/services/cct.ts`). Si cambian
    las llaves que lee la app, hay que actualizar `CAMPOS` en `js/cct-conoxxo.js`.
  - La migración 32 (tabla `cct_contratos` en Supabase) fue la primera versión, que pedía el
    passcode de RH de Conoxxo; la migración 33 la borra.
  - **Pantalla:** el contrato de Plaza Oaxaca (revisión del año con su aumento nominal y días
    contra el vencimiento, contrato, legitimación y consulta, prestaciones, cumplimiento
    documental e historial) y el comparativo con las demás plazas del ejercicio: promedio
    nacional y del cluster, lugar, distribución del aumento, sindicatos y lista buscable.
  - Igual que Cuota sindical: no está en el Sheet público de los dashboards, pero la
    consulta `consultarCct` es pública (solo indicadores), sin candado por usuario.

✅ **Cuota sindical (`src/screens/CuotaSindicalScreen.tsx`):** lo descontado de cuota
  sindical por mes en Plaza Oaxaca, desde el dashboard Cuota Sindical de DashboardsOxxo
  (`src/services/cuotaSindical.ts`). Solo para los puestos de `PUESTOS_ACTAS`; los Asesores
  de Tienda solo ven sus tiendas. Se abre desde Inicio.
  - Los datos no están en el Sheet público: vienen de la acción pública
    `consultarCuotaSindical` del Apps Script, que solo devuelve totales por mes, división,
    tienda y puesto de su libro privado (sin nombres: la afiliación sindical es un dato
    personal sensible).
  - Por mes: descontado y variación contra el mes anterior, personas con descuento (exactas
    para toda la plaza, desde `Resumen`; para un AT, suma por tienda y puesto), promedio por
    persona y ajustes (devoluciones y reversos); tendencia de los meses cargados; desglose
    por asesor (solo quien ve toda la plaza), por puesto y por tienda.
  - El AT de cada tienda sale de `Catalogo_Asesores` por nombre (los nombres de nómina vienen
    cortados a 25 caracteres; se acepta un inicio único). Entrenamiento/Operaciones va
    aparte y lo que no se encuentra queda en "Sin Asesor Asignado".
  - El mes llega como fecha ("2025-10-01T06:00:00.000Z") porque Sheets convierte "2025-10";
    la app lo toma como `AAAA-MM`.

✅ **Estructura (`src/screens/EstructuraScreen.tsx`):** posiciones de cada tienda desde el
  Dashboard 1 de DashboardsOxxo (pestaña `Dashboard_1_Diario`, `src/services/estructura.ts`).
  Solo para los puestos de `PUESTOS_ACTAS` y solo Plaza Oaxaca; se abre desde Inicio.
  Los Asesores de Tienda solo ven sus tiendas; RH, Gerente Plaza, etc. ven toda la plaza.
  - Usa el corte del mes más reciente (columna `Mes`): cobertura,
    vacantes, y por tienda quién ocupa cada posición y desde cuándo está vacante cada una.
  - Mismos filtros por defecto que `dashboard-1.html`: sin unidades de Entrenamiento u
    Operaciones, sin preaperturas (`PREOPENING_STORE_KEYS`) y solo sus seis puestos por
    defecto. Vacante = `Status ocupacion` dice "vacante" o "no ocupado", igual que la web.
  - El AT de cada tienda sale de `Catalogo_Asesores` por CR (como `applyAsesorCatalog`);
    si la tienda no está en el catálogo, el de la hoja. "Mis tiendas" filtra por el
    nombre de la sesión.
  - **Descargar Excel:** un `.xlsx` con una fila por posición de las tiendas a la vista
    (tienda, CR, asesor, puesto, ID, ocupada/vacante, colaborador, vacante desde y días). Un
    AT solo descarga sus tiendas; RH y demás, toda la plaza o lo que hayan filtrado. Se
    genera en el teléfono sin librerías (`src/utils/xlsx.ts`) y se comparte con
    `src/utils/compartir.ts` (en web se descarga), igual que el Word de las actas.
  - Si DashboardsOxxo cambia los puestos por defecto, la lista de preaperturas, la
    pestaña o sus columnas, hay que actualizar el servicio.
  - `src/services/gviz.ts` concentra la lectura (Apps Script con sesión, o GViz) que comparten Vacaciones y
    Estructura (y el parser CSV que usa el catálogo de tiendas). Las hojas traen las cinco
    plazas de la Región; la app filtra a `PLAZA = 'Oaxaca'` en la consulta y otra vez al leer.

✅ **Vacaciones (`src/screens/VacacionesScreen.tsx`):** saldo de vacaciones desde el
  Dashboard 5 de DashboardsOxxo (pestaña `Dashboard_5_Semanal` del Google Sheet de los
  dashboards, leída por GViz CSV como la web; `src/services/vacaciones.ts`). Se abre desde
  Inicio ("Mis vacaciones"). **Solo Plaza Oaxaca** (`PLAZA` en `src/services/gviz.ts`).
  - Todos ven su propio saldo, buscado por su número de empleado: días restantes, periodo
    anterior y actual, y cuándo vencen (`Bucket_Ant` / `Bucket_Act`). El último saldo leído
    se guarda en el teléfono para verlo sin señal y se borra al cerrar sesión.
  - Los puestos de `PUESTOS_ACTAS` tienen además "Mi equipo". Los Asesores de Tienda
    (`soloSusTiendas` en `src/services/actas.ts`) solo ven sus tiendas; los demás, toda
    Plaza Oaxaca. El AT de cada tienda sale de `Catalogo_Asesores` (como en Estructura).
  - "Mi equipo" sigue el diseño del **Dashboard 6 (Ausentismos)** de DashboardsOxxo:
    filtros arriba (Asesor y Puesto, más "Mis tiendas" / "Toda la plaza" cuando el nombre
    de la sesión es el Asesor de esas filas) que valen para toda la pantalla, y cuatro
    capas. **Resumen ejecutivo:** tarjetas con borde de color (colaboradores, días
    pendientes, vencidos del periodo anterior, vencen en 0 a 50 días, al día, tiendas con
    vencidos); tocar Vencidos, Vencen o Al día filtra lo de abajo. **Vencidos y por
    vencer:** personas por rango de `Bucket_Ant` y barras rojo / naranja / verde por
    asesor (por tienda en las tiendas de un solo asesor). **Foco y responsables:**
    "Atender primero" y días pendientes por asesor. **Exploración detallada:** tiendas,
    puestos, resumen por rango y el detalle completo con búsqueda (20 a la vez). Cada
    tarjeta explica qué muestra con el botón ⓘ.
  - La fecha de actualización sale de la pestaña `Configuracion` (fila `s5`).
  - El reporte solo trae personal de tienda (SINDICALIZADO): el personal de oficina no
    aparece y, si tiene acceso, la pantalla abre directo en "Mi equipo".
  - Con la hoja cerrada (Apps Script v68), un puesto sin permisos solo recibe su propio
    renglón: "Mi equipo" depende del servidor, no solo de la app.
  - Si DashboardsOxxo renombra la pestaña o sus columnas, hay que actualizar el servicio.

✅ **Actas y Formatos (`src/screens/ActasScreen.tsx`):** versión nativa del formulario
  de DashboardsOxxo (`dashboards/acta-administrativa.html`). Seis formatos de RH: acta
  administrativa, acta por falta de probidad, acta ultimátum, retroalimentación, acta de
  hechos y renuncia voluntaria. Solo la ven ciertos puestos (`PUESTOS_ACTAS` en
  `src/services/actas.ts`, contra `employees.puesto` de la sesión); se abre desde Inicio.
  - El texto y el Word salen de `src/utils/actaDocx.ts`, copia fiel de
    `js/acta-administrativa.js` de DashboardsOxxo (genera el mismo `.docx` byte por byte).
    Si se cambia el texto de un formato allá, hay que copiarlo aquí también.
  - Firmas con el dedo (`SignaturePad`); `src/utils/firmaPng.ts` las convierte en PNG para
    el Word. Con alguna firma los datos quedan bloqueados, igual que en la web.
  - "Enviar a RH" usa la misma acción pública `enviarActa` del Apps Script de
    DashboardsOxxo: llega al correo de RH y queda en el mismo registro privado de actas.
    "Compartir Word" (en web, "Descargar Word") no lo registra.
  - La tienda se elige del catálogo de DashboardsOxxo (`Catalogo_Asesores`, en
    `src/services/tiendas.ts`): primero la hoja en vivo vía Apps Script (`leerDatos` con sesión, luego `readSheet`), si
    falla el CSV de GitHub Pages, y sin señal la última copia guardada. Así el acta se
    envía con el **CR** de la tienda y en el registro de RH (panel admin → Registro de
    actas) se junta con las de la web, que también agrupan por CR. Al elegir la tienda
    se llena su AT como representante.
  - El número de empleado del trabajador se busca en la nómina con `employee_lookup`.
  - El borrador se guarda en el teléfono (sin firmas) y se borra al cerrar sesión.

🚧 **Pendiente:**
- Persistencia nativa (hoy `appStorage.ts` usa `@react-native-async-storage/async-storage`,
  que sí funciona en iOS/Android — falta solamente *probarlo* en un dispositivo real).
- Teléfonos de asesores por tienda (el Directorio solo tiene contactos generales de RH/Sistemas/Salud).
- Probar la app en un dispositivo físico vía Expo Go (bloqueado por un retraso de Apple
  en aprobar la versión de Expo Go compatible con SDK 56 a la fecha de este documento).
- Jessica Yazmin Verdi Toala es AT de Plaza Oaxaca en `Catalogo_Asesores`, pero no tiene
  `puesto` en `employees` (o no está en la nómina): no ve Actas, Estructura ni "Mi equipo".
  Falta su número de empleado para darle el puesto `ASESOR TIENDA`.
- Usuarios sin número de empleado: se les inventa uno de 8 dígitos en el rango `9000000x`
  (los reales tienen 7 o menos). Hoy: 90000001 David (Sindicato, puesto `SINDICATO`, con
  acceso completo vía `PUESTOS_ACTAS`) y 90000002 Antonio Cruz (sin puesto) (migración 31).
- El resto del personal de tienda no tiene `puesto` en `employees` (solo los 22 de la
  migración 22; la cuenta de prueba 1599067 se borró en la migración 42). Hoy no les quita acceso a nada.

## Publicación web (automática)

Cada push a `main` publica la versión web en https://humanresources-oxxo.github.io/oxxitoapp/
con el workflow `.github/workflows/deploy-web.yml` (también se puede lanzar a mano desde la
pestaña Actions → "Publicar web" → Run workflow). El workflow:

1. instala dependencias (`npm ci`) y revisa tipos (`tsc --noEmit`); si falla, no publica;
2. exporta la web (`expo export -p web`) con `EXPO_PUBLIC_SUPABASE_URL` y
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (valores publicables; una variable del repo con el mismo
   nombre los reemplaza);
3. ajusta `index.html` con `scripts/patch-web-index.mjs`;
4. reemplaza en la rama `gh-pages` los archivos de la app (`_expo`, `assets`, `index.html`,
   íconos, manifest…) y conserva lo demás (`instalar.html`, `.nojekyll`).

Para saber qué commit está publicado: https://humanresources-oxxo.github.io/oxxitoapp/version.txt

`instalar.html` (la guía de instalación) solo vive en `gh-pages`; se edita ahí.

## Cómo correrlo

```bash
npm install
npm run ios       # o npm run android / npm run web
```

Requiere Expo Go (SDK 56) en tu dispositivo, o un simulador/emulador configurado.

## Estructura

```
src/
  theme/tokens.ts         — colores, gradientes, tipografía, radios, sombras (fuente de verdad visual)
  components/
    Icon.tsx               — set de iconos SVG (24-grid, stroke)
    Bear.tsx                — mascota (Bear grande + BearAvatar circular)
    OxButton.tsx            — botón primario/ghost/light/outline
    OxField.tsx             — campo de texto estilo app
    OxKeypad.tsx            — teclado numérico 3×4
    PinDots.tsx             — puntos de PIN con shake de error
    StepsHeader.tsx         — header con back + progreso de 4 pasos
    SignaturePad.tsx        — recuadro de firma con el dedo (Actas)
  screens/
    SplashScreen.tsx
    WelcomeScreen.tsx
    LoginScreen.tsx
    VerifyScreen.tsx
    RegisterScreen.tsx
    PermissionsScreen.tsx
    ActasScreen.tsx         — Actas y Formatos (solo ciertos puestos)
    VacacionesScreen.tsx    — saldo de vacaciones (propio y, para ciertos puestos, del equipo)
    CuotaSindicalScreen.tsx — cuota sindical por mes, asesor, puesto y tienda (solo ciertos puestos)
    CctScreen.tsx           — contratos colectivos: Oaxaca y comparativo nacional (solo ciertos puestos)
    DilosScreen.tsx         — casos DILOS abiertos de la Zona Centro Sur (solo ciertos puestos)
    EstructuraScreen.tsx    — posiciones ocupadas y vacantes por tienda (solo ciertos puestos)
  services/actas.ts         — quién puede levantar actas, envío a RH, compartir Word
  services/tiendas.ts       — catálogo de tiendas (nombre, CR, AT) para las actas
  services/vacaciones.ts    — saldos del Dashboard 5 (Dashboard_5_Semanal) vía GViz
  services/estructura.ts    — estructura por tienda del Dashboard 1 (Dashboard_1_Diario)
  services/gviz.ts          — lectura de pestañas del Sheet de los dashboards (GViz CSV)
  services/cuotaSindical.ts — totales de cuota sindical (Apps Script consultarCuotaSindical)
  services/cct.ts           — contratos colectivos (Apps Script consultarCct; carga en el panel de DashboardsOxxo)
  services/dilos.ts         — casos DILOS (Apps Script consultarDilos; carga en el panel de DashboardsOxxo)
  utils/
    actaDocx.ts             — texto de cada formato + generador del .docx
    firmaPng.ts             — firma (trazos) → PNG
  navigation/
    OnboardingNavigator.tsx — stack nativo (@react-navigation/native-stack)
  context/
    OnboardingContext.tsx   — estado compartido (empNum, pin, regPin, notif, terms)
assets/images/
  oxxito-bear.png           — frame estático extraído del GIF (mascota)
  osito_saludando.gif       — mascota animada (splash)
```

## Notas de fidelidad

- **Liquid glass / blur**: el diseño original usa `backdrop-filter` (web). Por ahora las
  superficies "glass" del onboarding usan opacidad sólida aproximada. Para el Chat Home
  (que usa glass intensivamente) conviene introducir `expo-blur` (`BlurView`) para una
  aproximación más fiel — ya está instalado como dependencia.
- **Tipografía**: Plus Jakarta Sans vía `@expo-google-fonts/plus-jakarta-sans`.
- **Mascota**: el zip original no incluía `assets/oxxito.png` (solo el GIF). Se extrajo
  un frame estático del GIF como sustituto. Si tienes el PNG original de alta fidelidad,
  reemplaza `assets/images/oxxito-bear.png`.
- **Gradientes**: portados con `expo-linear-gradient`, mismos colores/stops que el CSS.

## Próximo paso sugerido

Construir Chat Home + Conversación (`screens-chat-proto.jsx` en el handoff), que introduce:
- Superficies liquid-glass (recomendado usar `BlurView`)
- El motor de respuestas mock (`QA`, `matchQA`, `FALLBACK`) como capa de servicio reemplazable
- Burbujas de chat, citas de artículo, chips de sugerencias, indicador de "escribiendo…"

### Pregúntale a la ficha (chatbot de oficina)

- Tarjeta dentro de la Ficha de Plaza (pestaña Resumen; DashboardsOxxo `js/ficha-chat.js`). Manda la
  pregunta, los números agregados de la ficha (`OXXO_FICHA.datosChat`: totales, una fila por asesor y
  las 5 plazas; nunca filas ni nombres de colaboradores) y las últimas 4 preguntas a
  `POST /api/datos-chat` (`worker/datos.js`), que contesta con Claude Haiku solo con esos números.
- Quién: sesión válida y puesto que **no** sea de tienda (Líder tienda, Encargado turno, Ayudante
  tienda, satélite incluido); puesto vacío no pasa. `DATOS_IA_NUMEROS` (`wrangler.jsonc`) puede
  limitarlo a una lista de números; desde el 2026-11-12 es `"*"` (todos los de oficina).
- Desde la migración 57 la pestaña Resumen también es para todos los puestos de oficina
  (`puesto_ve_ficha`; `sesion_validar` devuelve `ficha`), sin ampliar `puesto_con_permisos`. El Apps
  Script (v71) les deja leer solo las hojas de la ficha; sus hojas de bajas traen colaborador, motivo y
  género aunque la ficha solo muestre totales.
- Tope: `DATOS_IA_LIMITE_DIA` (30) preguntas por persona al día, contado en Supabase como función
  `datos` (migración 56). El texto de las preguntas no se guarda.
