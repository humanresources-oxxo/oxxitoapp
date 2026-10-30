// src/utils/actaDocx.ts
// Actas y Formatos: the text of each RH format and the .docx builder.
// Ported from DashboardsOxxo `js/acta-administrativa.js` (same wording, same
// Word layout) so an acta made in the app is identical to one made on the web.
// A .docx is a ZIP of a few XML files; a "stored" (uncompressed) ZIP is enough
// for Word, so this needs no libraries.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const VACIO = '______________';
export const PARTICIPANTES = 4;

export type ActaTipo = 'administrativa' | 'probidad' | 'ultimatum' | 'retroalimentacion' | 'hechos' | 'renuncia';

export const PRESENTES = Array.from({ length: PARTICIPANTES }, (_, i) => [`participante${i + 1}`, `funcionP${i + 1}`]).flat();

export const CAMPOS = ['tipo', 'tienda', 'ciudad', 'domicilio', 'cp', 'municipio', 'fecha', 'horaInicio', 'representante', 'funcion',
  'trabajador', 'numEmpleado', 'puesto', 'horaEntrada', 'horaSalida', 'fechaIngreso', 'testigo1', 'testigo2',
  ...PRESENTES, 'fechaHechos', 'falta', 'hechos', 'manifiesta', 'compromisos', 'horaCierre', 'copia'] as const;

export type ActaDatos = Partial<Record<(typeof CAMPOS)[number], string>> & Record<string, string | undefined>;

export const ETIQUETAS: Record<string, string> = { tienda: 'Tienda', fecha: 'Fecha', representante: 'Representante', trabajador: 'Trabajador', puesto: 'Puesto',
  fechaHechos: 'Fecha de los hechos', falta: 'Falta al reglamento', hechos: 'Hechos', participante1: 'Al menos una persona presente',
  fechaIngreso: 'Fecha de ingreso', municipio: 'Municipio', ciudad: 'Ciudad' };

type TipoDef = {
  nombre: string;
  titulo: string;
  subtitulo?: string;
  ref?: string;
  cierre?: string;
  carta?: boolean;
  campos: string[];
  obligatorios: string[];
};

// What each format asks for: "campos" decides what the form shows,
// "obligatorios" what is validated.
export const TIPOS: Record<ActaTipo, TipoDef> = {
  administrativa: { nombre: 'Acta administrativa', titulo: 'ACTA ADMINISTRATIVA',
    campos: ['domicilio', 'cp', 'municipio', 'horaInicio', 'representante', 'funcion', 'horaEntrada', 'horaSalida', 'testigo1', 'testigo2', 'fechaHechos', 'falta', 'hechos', 'manifiesta', 'horaCierre'],
    obligatorios: ['tienda', 'fecha', 'representante', 'trabajador', 'puesto', 'fechaHechos', 'falta', 'hechos'] },
  probidad: { nombre: 'Acta por falta de probidad', titulo: 'ACTA ADMINISTRATIVA', subtitulo: 'Falta de probidad',
    campos: ['domicilio', 'municipio', 'horaInicio', 'representante', 'funcion', 'testigo1', 'testigo2', 'falta', 'hechos', 'manifiesta', 'horaCierre'],
    obligatorios: ['tienda', 'fecha', 'municipio', 'representante', 'trabajador', 'puesto', 'hechos'] },
  ultimatum: { nombre: 'Acta ultimátum', titulo: 'ACTA ULTIMÁTUM', ref: 'ACTA ULTIMÁTUM', cierre: 'Acta Ultimátum',
    campos: ['ciudad', 'horaInicio', ...PRESENTES, 'falta', 'hechos', 'manifiesta', 'compromisos'],
    obligatorios: ['tienda', 'fecha', 'ciudad', 'trabajador', 'puesto', 'participante1', 'hechos'] },
  retroalimentacion: { nombre: 'Retroalimentación', titulo: 'RETROALIMENTACIÓN', ref: 'Retroalimentación', cierre: 'Retroalimentación',
    campos: ['ciudad', 'horaInicio', ...PRESENTES, 'falta', 'hechos', 'manifiesta', 'compromisos'],
    obligatorios: ['tienda', 'fecha', 'ciudad', 'trabajador', 'puesto', 'participante1', 'hechos'] },
  hechos: { nombre: 'Acta de hechos', titulo: 'ACTA DE HECHOS',
    campos: ['ciudad', 'domicilio', 'horaInicio', ...PRESENTES, 'falta', 'hechos'],
    obligatorios: ['tienda', 'fecha', 'ciudad', 'participante1', 'hechos'] },
  renuncia: { nombre: 'Renuncia voluntaria', titulo: 'RENUNCIA VOLUNTARIA', carta: true,
    campos: ['ciudad', 'fechaIngreso'],
    obligatorios: ['tienda', 'fecha', 'ciudad', 'trabajador', 'puesto', 'fechaIngreso'] },
};
export const TIPOS_ORDEN = Object.keys(TIPOS) as ActaTipo[];

// Always visible: tienda, fecha, trabajador, No. de empleado, puesto and the email copy.
export const CAMPOS_COMUNES = ['tipo', 'tienda', 'fecha', 'trabajador', 'numEmpleado', 'puesto', 'copia'];
export const tipoDe = (d?: ActaDatos | null): ActaTipo => (d && d.tipo && d.tipo in TIPOS ? (d.tipo as ActaTipo) : 'administrativa');

export function limpio(v: unknown) {
  return String(v == null ? '' : v).trim();
}
export function fechaPartes(iso?: string) {
  const m = limpio(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { dia: String(+m[3]), mes: MESES[+m[2] - 1] || '', anio: m[1] } : { dia: '', mes: '', anio: '' };
}

// ── Model: each format's text, with the blanks marked as fields ──
export type Run = { t: string; campo?: boolean; largo?: boolean };
export type Parrafo = { runs: Run[]; titulo?: boolean; alinear?: 'left' | 'right' | 'center' | 'both'; negrita?: boolean; antes?: number; despues?: number };
export type Firmante = { rol: string; nombre: string };
export type Modelo = TipoDef & {
  tipo: ActaTipo;
  parrafos: Parrafo[];
  firmas: Firmante[];
  nota?: string;
  resumen: Array<Array<[string, string]>> | null;
};

const T = (t: string): Run => ({ t });
const C = (t?: string): Run => ({ t: limpio(t), campo: true });
// Long texts: same data font, without bold or underline (they read better).
const L = (t?: string): Run => ({ t: limpio(t), campo: true, largo: true });
const seccion = (t: string): Parrafo => ({ titulo: true, runs: [T(t)] });
function enLista(nombres: string[]) {
  const n = nombres.filter(Boolean);
  return n.length > 1 ? n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1] : n[0] || '';
}
function presentes(d: ActaDatos) {
  return Array.from({ length: PARTICIPANTES }, (_, i) => ({ nombre: limpio(d[`participante${i + 1}`]), rol: limpio(d[`funcionP${i + 1}`]) }))
    .filter((p) => p.nombre);
}
const NOTA_FIRMA = 'NOTA: Si alguien se niega a firmar, debe asentarse tal hecho.';
const CIERRE_TESTIGOS = ' se le dio el uso de la palabra y argumentó en su defensa y están dispuestos a ratificar los hechos que les consta ante cualquier autoridad que se les indique o requiera. Por ese motivo se firma la presente acta siendo las ';

type Fecha = ReturnType<typeof fechaPartes>;
function resumenDe(d: ActaDatos, f: Fecha): Array<Array<[string, string]>> {
  return [
    [['Tienda', limpio(d.tienda) ? 'OXXO ' + limpio(d.tienda) : ''], ['Fecha', f.dia ? `${f.dia} de ${f.mes} de ${f.anio}` : ''], ['Hora de inicio', limpio(d.horaInicio)]],
    [['Trabajador', limpio(d.trabajador)], ['No. de empleado', limpio(d.numEmpleado)], ['Puesto', limpio(d.puesto)]],
  ];
}

type Cuerpo = Pick<Modelo, 'parrafos' | 'firmas' | 'nota' | 'resumen'>;
const MODELOS: Record<ActaTipo, (d: ActaDatos, f: Fecha) => Cuerpo> = {
  administrativa(d, f) {
    const h = fechaPartes(d.fechaHechos);
    const testigos = enLista([limpio(d.testigo1), limpio(d.testigo2)]);
    return {
      parrafos: [
        { runs: [T('Oaxaca de Juárez, Oaxaca, siendo las '), C(d.horaInicio), T(' horas del día '), C(f.dia), T(' de '), C(f.mes),
          T(' del '), C(f.anio), T(', en la tienda denominada OXXO '), C(d.tienda),
          T(' propiedad de la empresa Cadena Comercial Oxxo SA de CV, sita en '), C(d.domicilio), T(' Cp '), C(d.cp),
          T(' Municipio '), C(d.municipio), T(' Oaxaca y ante la presencia de la C. '), C(d.representante),
          T(' quien desempeña la función de '), C(d.funcion), T(' como representante del patrón en el centro de trabajo, el trabajador de nombre '),
          C(d.trabajador), T(' y los C. '), C(d.testigo1), T(' y '), C(d.testigo2),
          T(', trabajadores como testigos de asistencia. Se levanta la presente Acta Administrativa a fin de hacer constar los siguientes:')] },
        seccion('HECHOS'),
        { runs: [T('El día '), C(h.dia), T(' del mes de '), C(h.mes), T(' del año '), C(h.anio), T(', el empleado de nombre '), C(d.trabajador),
          T(' con número de empleado '), C(d.numEmpleado), T(' y puesto '), C(d.puesto), T(', con horario de trabajo de las '), C(d.horaEntrada), T(' a las '), C(d.horaSalida),
          T(', cometió las siguientes faltas al reglamento (proceso) '), C(d.falta), T(', hechos que se comprueban con: '), L(d.hechos)] },
        seccion('MANIFESTACIÓN DEL TRABAJADOR'),
        { runs: [T('Hecho por lo que EL TRABAJADOR '), C(d.trabajador), T(' en relación a los hechos manifiesta en este acto: '), L(d.manifiesta)] },
        seccion('DECLARACIÓN DE LOS TESTIGOS'),
        { runs: [T('POR SU PARTE LOS INTERVINIENTES COMO TESTIGOS '), C(testigos),
          T(' SEÑALAN: Que al estar presentes y escuchar las manifestaciones les consta que el acta levantada a la C. '), C(d.trabajador),
          T(CIERRE_TESTIGOS), C(d.horaCierre), T(' horas del día de su inicio, firmando los que en ella intervinieron.')] },
      ],
      firmas: [
        { rol: 'REPRESENTANTE DEL CENTRO DE TRABAJO', nombre: limpio(d.representante) },
        { rol: 'TRABAJADOR', nombre: limpio(d.trabajador) },
        { rol: 'TESTIGO', nombre: limpio(d.testigo1) },
        { rol: 'TESTIGO', nombre: limpio(d.testigo2) },
      ],
      resumen: resumenDe(d, f),
    };
  },
  probidad(d, f) {
    const testigos = enLista([limpio(d.testigo1), limpio(d.testigo2)]);
    return {
      parrafos: [
        { runs: [C(d.municipio), T(', Oaxaca, siendo las '), C(d.horaInicio), T(' horas del día '), C(f.dia), T(' de '), C(f.mes), T(' del '), C(f.anio),
          T(', en las instalaciones de la empresa Cadena Comercial Oxxo SA de CV, tienda OXXO '), C(d.tienda), T(', sita en '), C(d.domicilio),
          T(', '), C(d.municipio), T(', Oaxaca y ante la presencia del C. '), C(d.representante), T(', quien desempeña la función de '), C(d.funcion),
          T(', como representante del patrón en el centro de trabajo, el trabajador de nombre '), C(d.trabajador), T(', y los C. '), C(d.testigo1), T(' y '), C(d.testigo2),
          T(', trabajadores como testigos de asistencia. Se levanta la presente Acta Administrativa a fin de hacer constar los siguientes hechos:')] },
        seccion('HECHOS'),
        { runs: [T('El empleado de nombre '), C(d.trabajador), T(' con número de empleado '), C(d.numEmpleado), T(' y puesto de '), C(d.puesto),
          T(' cometió las siguientes faltas al reglamento (proceso) '), C(d.falta), T(': '), L(d.hechos)] },
        seccion('MANIFESTACIÓN DEL TRABAJADOR'),
        { runs: [T('EL TRABAJADOR '), C(d.trabajador), T(' en relación a los hechos manifiesta: '), L(d.manifiesta)] },
        seccion('DECLARACIÓN DE LOS TESTIGOS'),
        { runs: [T('POR SU PARTE LOS INTERVINIENTES COMO TESTIGOS '), C(testigos),
          T(': Que al estar presentes y escuchar las manifestaciones les consta que el acta levantada al C. '), C(d.trabajador),
          T(CIERRE_TESTIGOS), C(d.horaCierre), T(' horas del día de su inicio, firmando los que en ella intervinieron.')] },
      ],
      firmas: [
        { rol: 'ASESOR DE TIENDA', nombre: limpio(d.representante) },
        { rol: 'TRABAJADOR', nombre: limpio(d.trabajador) },
        { rol: 'TESTIGO', nombre: limpio(d.testigo1) },
        { rol: 'TESTIGO', nombre: limpio(d.testigo2) },
      ],
      resumen: resumenDe(d, f),
    };
  },
  // Ultimatum and Retroalimentacion share the format; only the name changes.
  ultimatum: (d, f) => ultimatumDe(d, f, 'ultimatum'),
  retroalimentacion: (d, f) => ultimatumDe(d, f, 'retroalimentacion'),
  hechos(d, f) {
    const lista = presentes(d);
    const firmas = lista.map((p) => ({ rol: p.rol || 'PARTICIPANTE', nombre: p.nombre }));
    if (limpio(d.trabajador)) firmas.push({ rol: 'TRABAJADOR', nombre: limpio(d.trabajador) });
    return {
      parrafos: [
        { runs: [T('En la Ciudad de '), C(d.ciudad), T(', del Estado de Oaxaca, siendo las '), C(d.horaInicio), T(' horas del día '), C(f.dia), T(' del mes de '), C(f.mes),
          T(' del año '), C(f.anio), T(', estando presentes los C. '), C(enLista(lista.map((p) => p.nombre))), T(', quienes desempeñan la función de '),
          C(enLista(lista.map((p) => p.rol))), T(', respectivamente, dentro de la Empresa Cadena Comercial Oxxo SA de CV, sucursal '), C(d.tienda),
          T(', que se encuentra ubicada en: '), C(d.domicilio), T(', procedemos a levantar la presente Acta a fin de hacer constar los siguientes hechos que a continuación detallamos:')] },
        seccion('HECHOS'),
        { runs: [L(d.hechos)] },
        { runs: [T('La presente Acta se levanta el día y lugar arriba mencionados, para los fines legales correspondientes, firmando para constancia cada una de las personas que participan en la misma.')] },
      ],
      firmas,
      nota: NOTA_FIRMA,
      resumen: resumenDe(d, f),
    };
  },
  // The worker's letter: no letterhead and no data box.
  renuncia(d, f) {
    const ing = fechaPartes(d.fechaIngreso);
    const larga = (x: Fecha) => (x.dia ? `${x.dia} de ${x.mes} de ${x.anio}` : '');
    return {
      parrafos: [
        { alinear: 'right', runs: [C(d.ciudad), T(', Oaxaca a '), C(larga(f))] },
        { alinear: 'left', negrita: true, antes: 360, despues: 0, runs: [T('CADENA COMERCIAL OXXO, S.A. DE C.V.')] },
        { alinear: 'left', negrita: true, despues: 0, runs: [T('AL REPRESENTANTE LEGAL')] },
        { alinear: 'left', negrita: true, despues: 240, runs: [T('P R E S E N T E.-')] },
        { runs: [T('Por medio de la presente me permito comunicarle a Usted mi renuncia de carácter irrevocable al puesto de '), C(limpio(d.puesto).toUpperCase()),
          T(', que venía desempeñando desde el día '), C(larga(ing).toUpperCase()), T(' del cual me separo en forma voluntaria a partir del día de hoy, por así convenir a mis intereses personales.')] },
        { runs: [T('Rogándole a Usted se sirva aceptar mi renuncia voluntaria, reiterando que durante mi estancia en esta empresa, siempre me fueron cubiertas todas y cada una de las prestaciones a que tuve derecho no adeudándome a la fecha ninguna cantidad por concepto de: salarios, séptimo día, tiempo extra fijo, aguinaldo, vacaciones, utilidades, riesgos profesionales, primas legales, sobre salarios, ni por ningún otro concepto derivado del contrato de trabajo que tenía celebrado con dicha empresa.')] },
        { runs: [T('Así mismo manifiesto que durante el tiempo que laboré con ustedes, jamás sufrí accidente ni enfermedad profesional alguna que me impida seguir prestando mis servicios para otra empresa.')] },
        { runs: [T('Aprovecho la presente para agradecerle a Usted todas las atenciones que me dispensaron durante todo el tiempo en que presté mis servicios personales para esta empresa.')] },
        { alinear: 'center', antes: 360, runs: [T('A t e n t a m e n t e.-')] },
      ],
      firmas: [{ rol: '', nombre: [limpio(d.numEmpleado), limpio(d.trabajador).toUpperCase()].filter(Boolean).join(' ') }],
      resumen: null,
    };
  },
};

function ultimatumDe(d: ActaDatos, f: Fecha, tipo: 'ultimatum' | 'retroalimentacion'): Cuerpo {
  const lista = presentes(d);
  const t = TIPOS[tipo];
  return {
    parrafos: [
      { runs: [T('En la Ciudad de '), C(d.ciudad), T(' del Estado de Oaxaca, siendo las '), C(d.horaInicio), T(' horas del día '), C(f.dia), T(' de '), C(f.mes),
        T(' del año '), C(f.anio), T(', y ante la presencia de los C. '), C(enLista(lista.map((p) => p.nombre))), T(', quienes desempeñan la función de '),
        C(enLista(lista.map((p) => p.rol))), T(', respectivamente, dentro de la Empresa Cadena Comercial Oxxo S.A. de C.V., se levanta la presente '), T(t.ref || ''),
        T(' a fin de hacer constar los siguientes hechos. En la cual participa el C. '), C(d.trabajador), T(' quien desempeña la función de '), C(d.puesto),
        T(' y que consiste en lo siguiente:')] },
      seccion('HECHOS'),
      { runs: [L(d.hechos)] },
      seccion('MANIFESTACIÓN DEL TRABAJADOR'),
      { runs: [T('Así mismo, en este acto el C. '), C(d.trabajador), T(' manifiesta lo siguiente: '), L(d.manifiesta)] },
      seccion('Y SE COMPROMETE A'),
      { runs: [L(d.compromisos)] },
      { runs: [T(`La presente ${t.cierre} se levanta el día y lugar arriba mencionados, para los fines legales correspondientes, firmando para constancia cada una de las personas que participan en la misma.`)] },
    ],
    firmas: [...lista.map((p) => ({ rol: p.rol || 'PARTICIPANTE', nombre: p.nombre })), { rol: 'TRABAJADOR', nombre: limpio(d.trabajador) }],
    nota: NOTA_FIRMA,
    resumen: resumenDe(d, f),
  };
}

export function modelo(d?: ActaDatos | null): Modelo {
  const datos = d || {};
  const tipo = tipoDe(datos);
  return { tipo, ...TIPOS[tipo], ...MODELOS[tipo](datos, fechaPartes(datos.fecha)) };
}

export function nombreArchivo(d: ActaDatos) {
  const base = [TIPOS[tipoDe(d)].nombre, limpio(d.trabajador), limpio(d.tienda), limpio(d.fecha)].filter(Boolean).join(' - ');
  return base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ._-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) + '.docx';
}

export function faltantes(d: ActaDatos) {
  return TIPOS[tipoDe(d)].obligatorios.filter((k) => !limpio(d[k])).map((k) => ETIQUETAS[k] || k);
}

// ── Word (OOXML) ──
// Format text in dark-gray Arial; what the asesor fills in, in bold navy
// underlined Calibri, so it stands out (and from what is later handwritten).
const COLOR_TEXTO = '262626', COLOR_DATO = '1F3B70', COLOR_ROJO = 'B5121B', COLOR_GRIS = '6F625D';
const FUENTE_DATO = '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/>';
function xml(s: unknown) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
type RunOpts = { campo?: boolean; negrita?: boolean; color?: string; tam?: number; mayus?: boolean; subrayar?: boolean; largo?: boolean };
function runXml(texto: string, { campo = false, negrita = false, color = '', tam = 0, mayus = false, subrayar = true, largo = false }: RunOpts = {}) {
  const vacio = campo && !texto;
  if (largo) subrayar = false;
  const props = (campo && !vacio ? FUENTE_DATO + (largo ? '' : '<w:b/>') : negrita ? '<w:b/>' : '')
    + (mayus ? '<w:caps/>' : '')
    + `<w:color w:val="${campo && !vacio ? COLOR_DATO : color || (vacio ? '9A9A9A' : COLOR_TEXTO)}"/>`
    + (tam ? `<w:sz w:val="${tam}"/><w:szCs w:val="${tam}"/>` : campo && !vacio ? '<w:sz w:val="21"/><w:szCs w:val="21"/>' : '')
    + (campo && !vacio && subrayar ? `<w:u w:val="single" w:color="${COLOR_DATO}"/>` : '');
  const lineas = String(vacio ? VACIO : texto).split(/\r?\n/);
  const cuerpo = lineas.map((l, i) => (i ? '<w:br/>' : '') + `<w:t xml:space="preserve">${xml(l)}</w:t>`).join('');
  return `<w:r><w:rPr>${props}</w:rPr>${cuerpo}</w:r>`;
}
type ParrafoOpts = { alinear?: string; antes?: number; despues?: number; linea?: number; extra?: string };
function parrafoXml(runs: string, { alinear = 'both', antes = 0, despues = 100, linea = 276, extra = '' }: ParrafoOpts = {}) {
  return `<w:p><w:pPr>${extra}<w:spacing w:before="${antes}" w:after="${despues}" w:line="${linea}" w:lineRule="auto"/><w:jc w:val="${alinear}"/></w:pPr>${runs}</w:p>`;
}
// Section title: red, uppercase, with a thin line below.
function seccionXml(texto: string) {
  return parrafoXml(runXml(texto, { negrita: true, color: COLOR_ROJO, tam: 19 }), {
    alinear: 'left', antes: 150, despues: 80, linea: 240,
    extra: '<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="2" w:color="DED6CF"/></w:pBdr>',
  });
}
const SIN_BORDES = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
function tablaXml(anchos: number[], filas: string[], { bordes = SIN_BORDES } = {}) {
  const total = anchos.reduce((a, b) => a + b, 0);
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:jc w:val="center"/>${bordes}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid>${anchos.map((a) => `<w:gridCol w:w="${a}"/>`).join('')}</w:tblGrid>${filas.join('')}</w:tbl>`;
}
function celdaXml(ancho: number, contenido: string, { fondo = '' } = {}) {
  return `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/>${fondo ? `<w:shd w:val="clear" w:color="auto" w:fill="${fondo}"/>` : ''}</w:tcPr>${contenido}</w:tc>`;
}
// Data box: small gray label on top, value in the data font.
function resumenXml(resumen: Array<Array<[string, string]>>) {
  const anchos = [3990, 1990, 3990];
  const borde = (c: string) => `<w:${c} w:val="single" w:sz="4" w:space="0" w:color="DED6CF"/>`;
  const bordes = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(borde).join('')}</w:tblBorders>`;
  const filas = resumen.map((fila) => '<w:tr><w:trPr><w:cantSplit/></w:trPr>' + fila.map(([etq, val], i) => celdaXml(anchos[i],
    parrafoXml(runXml(etq, { color: COLOR_GRIS, tam: 14, mayus: true }), { alinear: 'left', antes: 60, despues: 0, linea: 240 })
    + parrafoXml(runXml(val, { campo: true, subrayar: false }), { alinear: 'left', antes: 0, despues: 60, linea: 240 }), { fondo: 'FAF6F1' })).join('') + '</w:tr>');
  return tablaXml(anchos, filas, { bordes });
}
// Inline image (header logo, signatures): rid points to the relationship in
// the .rels file of the part it lives in.
const EMU = 914400;
function imagenXml(rid: string, id: number, nombre: string, cx: number, cy: number) {
  return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
    + `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="${xml(nombre)}"/>`
    + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${xml(nombre)}.png"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`
    + '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
}

// On-screen signature of one signer: a PNG, or a refusal to sign.
export type FirmaDoc = { png: Uint8Array; cuando: string } | { negada: true; cuando: string } | null;
type FirmanteDoc = Firmante & { n: number; firma: FirmaDoc };

// The signature pad is 3:1; in Word it takes 2.4" x 0.8" above the line.
const FIRMA_CX = Math.round(EMU * 2.4), FIRMA_CY = Math.round(EMU * 0.8);
const NEGADA = 'SE NEGÓ A FIRMAR';
// Signatures in two columns (representante | trabajador, testigo | testigo):
// fits with the text on one page and does not split across pages.
function celdaFirmaXml(f: FirmanteDoc) {
  const s = f.firma;
  const arriba = s && 'png' in s
    ? parrafoXml(imagenXml(`rIdFirma${f.n}`, 100 + f.n, `Firma ${f.n}`, FIRMA_CX, FIRMA_CY), { alinear: 'center', antes: 60, despues: 0, linea: 240 })
    : s && 'negada' in s ? parrafoXml(runXml(NEGADA, { negrita: true, color: COLOR_ROJO, tam: 18 }), { alinear: 'center', antes: 300, despues: 40, linea: 240 }) : '';
  const sello = s && s.cuando
    ? parrafoXml(runXml(`${'negada' in s ? 'Negativa asentada' : 'Firmado en pantalla'} el ${s.cuando}`, { color: COLOR_GRIS, tam: 13 }), { alinear: 'center', antes: 0, despues: 80, linea: 240 }) : '';
  return celdaXml(4985, arriba
    + parrafoXml(runXml('______________________________________', { color: '595959' }), { alinear: 'center', antes: arriba ? 0 : 480, despues: 0, linea: 240 })
    + parrafoXml(runXml(f.nombre || ' ', { campo: !!f.nombre, subrayar: false, tam: f.nombre ? 0 : 21 }), { alinear: 'center', antes: 20, despues: 0, linea: 240 })
    + parrafoXml(runXml(f.rol, { negrita: true, color: COLOR_GRIS, tam: 16 }), { alinear: 'center', antes: 0, despues: sello ? 0 : 80, linea: 240 })
    + sello);
}
function filaFirmasXml(a: FirmanteDoc, b?: FirmanteDoc) {
  return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${celdaFirmaXml(a)}${b ? celdaFirmaXml(b) : celdaXml(4985, parrafoXml(''))}</w:tr>`;
}
// Two per row; a single one (renuncia) goes centered.
function firmasXml(firmas: FirmanteDoc[]) {
  if (firmas.length === 1) return tablaXml([4985], [`<w:tr><w:trPr><w:cantSplit/></w:trPr>${celdaFirmaXml(firmas[0])}</w:tr>`]);
  const filas: string[] = [];
  for (let i = 0; i < firmas.length; i += 2) filas.push(filaFirmasXml(firmas[i], firmas[i + 1]));
  return tablaXml([4985, 4985], filas);
}
// Pairs each signer of the format with its on-screen signature (by position).
function firmantesCon(m: Modelo, firmas?: FirmaDoc[] | null): FirmanteDoc[] {
  return m.firmas.map((f, i) => ({ ...f, n: i + 1, firma: (firmas && firmas[i]) || null }));
}
export function documentXml(d: ActaDatos, { firmas = null }: { firmas?: FirmaDoc[] | null } = {}) {
  const m = modelo(d);
  const cuerpo = m.parrafos.map((p) => (p.titulo
    ? seccionXml(p.runs.map((r) => r.t).join(''))
    : parrafoXml(p.runs.map((r) => runXml(r.t, { campo: r.campo, largo: r.largo, negrita: p.negrita })).join(''),
      { alinear: p.alinear || 'both', ...(p.antes != null ? { antes: p.antes } : {}), ...(p.despues != null ? { despues: p.despues } : {}) }))).join('');
  const bloqueFirmas = (m.carta ? parrafoXml('', { antes: 120, despues: 0 }) : seccionXml('FIRMAS')) + firmasXml(firmantesCon(m, firmas))
    + (m.nota ? parrafoXml(runXml(m.nota, { color: COLOR_GRIS, tam: 16 }), { alinear: 'left', antes: 160, despues: 0, linea: 240 }) : '');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>'
    + (m.resumen ? resumenXml(m.resumen) + parrafoXml('', { despues: 60, linea: 240 }) : '') + cuerpo + bloqueFirmas
    + `<w:sectPr><w:headerReference w:type="default" r:id="rId4"/><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="${m.carta ? 1418 : 1330}" w:right="1134" w:bottom="1134" w:left="1134" w:header="510" w:footer="510" w:gutter="0"/></w:sectPr>`
    + '</w:body></w:document>';
}
export function pngTamano(bytes?: Uint8Array | null) {
  if (!bytes || bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const leer = (i: number) => ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
  return { ancho: leer(16), alto: leer(20) };
}
// Header: logo on the left (when available) and title on the right, with a
// red band below. The renuncia is the worker's letter: empty header.
function headerXml(logo: Uint8Array | null, m: Modelo) {
  const NS = '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">';
  if (m.carta) return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + NS + '<w:p/></w:hdr>';
  const tam = pngTamano(logo);
  const cy = Math.round(EMU * 0.42), cx = tam ? Math.round((cy * tam.ancho) / tam.alto) : 0;
  const imagen = tam ? imagenXml('rIdLogo', 1, 'Logo OXXO', cx, cy) : runXml('OXXO', { negrita: true, color: COLOR_ROJO, tam: 32 });
  const titulo = parrafoXml(runXml(m.titulo, { negrita: true, color: '1A1A1A', tam: 30 }), { alinear: 'right', despues: 0, linea: 240 })
    + (m.subtitulo ? parrafoXml(runXml(m.subtitulo, { negrita: true, color: COLOR_ROJO, tam: 18 }), { alinear: 'right', despues: 0, linea: 240 }) : '')
    + parrafoXml(runXml('Cadena Comercial OXXO, S.A. de C.V. · Relaciones laborales', { color: COLOR_GRIS, tam: 15 }), { alinear: 'right', despues: 0, linea: 240 });
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + NS
    + tablaXml([3485, 6485], [`<w:tr>${celdaXml(3485, parrafoXml(imagen, { alinear: 'left', despues: 0, linea: 240 }))}<w:tc><w:tcPr><w:tcW w:w="6485" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${titulo}</w:tc></w:tr>`])
    + parrafoXml('', { antes: 60, despues: 0, linea: 120, extra: `<w:pBdr><w:bottom w:val="single" w:sz="18" w:space="1" w:color="${COLOR_ROJO}"/></w:pBdr>` })
    + '</w:hdr>';
}
const PIE_RUN = '<w:r><w:rPr><w:color w:val="6F625D"/><w:sz w:val="15"/></w:rPr>';
const campoPie = (instr: string) => `${PIE_RUN}<w:fldChar w:fldCharType="begin"/></w:r>${PIE_RUN}<w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r>${PIE_RUN}<w:fldChar w:fldCharType="separate"/></w:r>${PIE_RUN}<w:t>1</w:t></w:r>${PIE_RUN}<w:fldChar w:fldCharType="end"/></w:r>`;
const ARCHIVOS_FIJOS: Record<string, string> = {
  '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>',
  '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="es-MX"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>',
  // Justified text without stretching a line that ends in a break (Enter in "Hechos").
  'word/settings.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat><w:doNotExpandShiftReturn/></w:compat></w:settings>',
  // Footer: "OXXO | Uso Interno" on the left and "Pagina X de Y" on the right.
  'word/footer1.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="DED6CF"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="9972"/></w:tabs></w:pPr>'
    + `${PIE_RUN}<w:t xml:space="preserve">OXXO | Uso Interno</w:t></w:r><w:r><w:rPr><w:sz w:val="15"/></w:rPr><w:tab/></w:r>`
    + `${PIE_RUN}<w:t xml:space="preserve">Página </w:t></w:r>${campoPie('PAGE')}${PIE_RUN}<w:t xml:space="preserve"> de </w:t></w:r>${campoPie('NUMPAGES')}</w:p></w:ftr>`,
};

// ── ZIP (stored, no compression) and CRC-32, also used by the PNG encoder ──
const CRC_TABLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes: Uint8Array, inicio = 0xffffffff) {
  let c = inicio;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLA[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function utf8(s: string) {
  return new TextEncoder().encode(s);
}
function zip(archivos: Record<string, string | Uint8Array>) {
  const partes: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number[], n: number) => { v.push(n & 0xff, (n >>> 8) & 0xff); };
  const u32 = (v: number[], n: number) => { v.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff); };
  Object.entries(archivos).forEach(([nombre, contenido]) => {
    const nom = utf8(nombre);
    const datos = typeof contenido === 'string' ? utf8(contenido) : contenido;
    const crc = crc32(datos);
    const cab: number[] = [];
    u32(cab, 0x04034b50); u16(cab, 20); u16(cab, 0x0800); u16(cab, 0); u16(cab, 0); u16(cab, 0x21);
    u32(cab, crc); u32(cab, datos.length); u32(cab, datos.length); u16(cab, nom.length); u16(cab, 0);
    partes.push(Uint8Array.from(cab), nom, datos);
    const cen: number[] = [];
    u32(cen, 0x02014b50); u16(cen, 20); u16(cen, 20); u16(cen, 0x0800); u16(cen, 0); u16(cen, 0); u16(cen, 0x21);
    u32(cen, crc); u32(cen, datos.length); u32(cen, datos.length); u16(cen, nom.length); u16(cen, 0); u16(cen, 0);
    u16(cen, 0); u16(cen, 0); u32(cen, 0); u32(cen, offset);
    central.push(Uint8Array.from(cen), nom);
    offset += cab.length + nom.length + datos.length;
  });
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin: number[] = [];
  u32(fin, 0x06054b50); u16(fin, 0); u16(fin, 0); u16(fin, central.length / 2); u16(fin, central.length / 2);
  u32(fin, tamCentral); u32(fin, offset); u16(fin, 0);
  const todo = [...partes, ...central, Uint8Array.from(fin)];
  const out = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  todo.forEach((p) => { out.set(p, pos); pos += p.length; });
  return out;
}
const REL_IMAGEN = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
function documentRelsXml(conFirma: FirmanteDoc[]) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
    + conFirma.map((f) => `<Relationship Id="rIdFirma${f.n}" Type="${REL_IMAGEN}" Target="media/firma${f.n}.png"/>`).join('') + '</Relationships>';
}
// logo: header PNG bytes (optional; without it "OXXO" is written as text).
// firmas: on-screen signatures, in the order of modelo(d).firmas (optional).
export function docx(d: ActaDatos, { logo = null, firmas = null }: { logo?: Uint8Array | null; firmas?: FirmaDoc[] | null } = {}) {
  const conLogo = pngTamano(logo);
  const m = modelo(d);
  // A signature that is not a readable PNG is treated as "signed by hand".
  const firmantes = firmantesCon(m, firmas);
  const conFirma = firmantes.filter((f) => f.firma && 'png' in f.firma && pngTamano(f.firma.png));
  const validas = firmantes.map((f) => (f.firma && ('negada' in f.firma || conFirma.includes(f)) ? f.firma : null));
  return zip({
    ...ARCHIVOS_FIJOS,
    'word/_rels/document.xml.rels': documentRelsXml(conFirma),
    'word/document.xml': documentXml(d, { firmas: validas }),
    'word/header1.xml': headerXml(conLogo ? logo : null, m),
    'word/_rels/header1.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + (conLogo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : '') + '</Relationships>',
    ...(conLogo && logo ? { 'word/media/logo.png': logo } : {}),
    ...Object.fromEntries(conFirma.map((f) => [`word/media/firma${f.n}.png`, (f.firma as { png: Uint8Array }).png])),
  });
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
// Base64 without depending on btoa (not on every JS engine the app runs on).
export function aBase64(bytes: Uint8Array) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]
      + (b === undefined ? '=' : B64[((b & 15) << 2) | ((c ?? 0) >> 6)])
      + (c === undefined ? '=' : B64[c & 63]);
  }
  return out;
}
export function deBase64(texto: string) {
  const b64 = texto.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((b64.length * 3) / 4));
  let bits = 0, acum = 0, j = 0;
  for (let i = 0; i < b64.length; i++) {
    acum = ((acum << 6) | B64.indexOf(b64[i])) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (acum >> bits) & 0xff;
    }
  }
  return out.subarray(0, j);
}
