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

✅ **Onboarding + tabs post-login completos:**
- Splash, Welcome, Login, Verify, Register (crear PIN / PIN temporal → definitivo), Permissions
- Home (saludo con nombre real), Chat, Directorio (con `tel:`), Notificaciones, Perfil

✅ **Backend real (Supabase, ver `supabase/migration_*.sql`, en orden):**
- Auth: tabla `employees` cargada con la nómina real (`employee_lookup` / `set_initial_pin` /
  `verify_pin` / `change_pin`). Solo empleados ya en la nómina pueden entrar — no hay
  registro libre; un empleado nuevo se agrega vía el panel admin (`admin/index.html`).
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

✅ **Panel admin (`admin/index.html`):** página web aparte (no dentro del app de React
  Native). Desde la migración 37 se entra con **número de empleado y PIN** (llave de sesión);
  el passcode compartido de RH ya no existe. RH (Responsable RH, Analista EC, cuenta de prueba)
  ve Empleados: agregar empleados y "Dar PIN temporal" (4 dígitos que se muestran una vez; al
  entrar, la app obliga a crear uno propio). RH y Gerente de plaza ven Avisos y Directorio.
  Todo lo que viene de la base se pinta como texto (`textContent`). Se corre local con
  `npx serve admin` o similar — no está desplegada en ningún lado público.

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
  - La dirección del cliente sale de `cf-connecting-ip` (la pone Cloudflare; un encabezado falso
    se rechaza con 403). El diagnóstico `mi_red()` se borró en la migración 38.

✅ **Votaciones (`src/screens/VotacionesScreen.tsx`):** votaciones secretas para lugares,
  fechas y decisiones del equipo (no sindicales). Supabase, migración 34
  (`supabase/migration_34_votaciones.sql`); servicio `src/services/votaciones.ts`.
  - **Quién vota:** toda la plaza o solo algunas tiendas (se comparan con la tienda del
    empleado en `employees`, sin acentos ni "OXXO"/"OAX"; también los nombres que nómina
    corta a 25 letras). Un voto por empleado, con su llave de sesión (migración 35; las
    funciones con PIN de la migración 34 se borraron).
  - **Secreto:** `votacion_participantes` guarda quién ya votó y `votacion_opciones.votos` es
    un contador; no hay tabla que una a la persona con su opción ni horas de voto.
  - **Resultados:** al cerrar (o al votar, si se marcó "Mostrar resultados al votar"). RH los
    ve siempre. Las cerradas se ven 60 días.
  - **Crear / cerrar / borrar:** desde la misma pantalla, solo los puestos de
    `voto_puede_administrar` (RH: Responsable RH, Analista EC, Practicante; Gerente de plaza;
    Acces Test), con su llave de sesión. Son los mismos que publican avisos. Una votación para toda la plaza publica un aviso (tipo `vote`).
  - La tarjeta de Inicio muestra cuántas faltan por votar y se oculta si Supabase no responde.

✅ **Casos DILOS (`src/screens/DilosScreen.tsx`):** dashboard **solo de la app**: casos
  abiertos de la **Zona Centro Sur** del "Reporte DILOS" que manda RH (hoja `ZCS`: caso,
  región, plaza, facilitador, estatus, días abiertos). Solo para los puestos de
  `PUESTOS_ACTAS`; se abre desde Inicio.
  - **Carga:** panel admin de DashboardsOxxo → Administrativo → tarjeta "Casos DILOS"
    (`js/dilos-conoxxo.js`), con la sesión del panel. **El nombre del facilitador no se
    envía.** El Apps Script (`publicarDilos`, v64) lo guarda en un libro privado; la app lee
    `consultarDilos` (`src/services/dilos.ts`). La fecha del corte sale del nombre del archivo.
  - **Pantalla:** casos abiertos, promedio y el más antiguo, cuántos llevan más de 15 días,
    en atención de RH / Administración, región Tabasco, por plaza, y la lista del más antiguo
    al más reciente con filtros por región, área y atraso.

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
  - `src/services/gviz.ts` concentra la lectura por GViz que comparten Vacaciones y
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
    Plaza Oaxaca. El AT de cada tienda sale de `Catalogo_Asesores` (como en Estructura). Con
    búsqueda por nombre, número o tienda, el filtro "Mis tiendas" (cuando el nombre de la
    sesión es el Asesor de esas filas) y "Por vencer o vencidos".
  - La fecha de actualización sale de la pestaña `Configuracion` (fila `s5`).
  - El reporte solo trae personal de tienda (SINDICALIZADO): el personal de oficina no
    aparece y, si tiene acceso, la pantalla abre directo en "Mi equipo".
  - La hoja es pública por GViz, igual que para los dashboards: el filtro por puesto solo
    oculta la vista de equipo en la app, no es un candado.
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
    `src/services/tiendas.ts`): primero la hoja en vivo vía Apps Script (`readSheet`), si
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
  migración 22 y la cuenta de prueba 1599067). Hoy no les quita acceso a nada.

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
