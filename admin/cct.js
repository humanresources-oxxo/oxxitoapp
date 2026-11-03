// admin/cct.js
// Contratos colectivos (CCT): turns the sheets of the CCT Excel ("Data colectiva
// Tiendas OXXO") into the rows the app reads (migration 32, admin_replace_cct).
// Only indicators are kept: the names of the responsables and the SharePoint
// links stay out. Percentages come mixed ("4.7%", 0.047, 65) and are stored as
// fractions; dates as AAAA-MM-DD; "NA"/"N/A" as null.
// Input: { [sheetName]: rows as objects by header } (XLSX.utils.sheet_to_json).
(function (global) {
  const sinAcentos = (v) => String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const clave = (v) => sinAcentos(v).toLowerCase().replace(/[^a-z0-9%]/g, '');
  const vacio = (v) => v == null || /^\s*(n\/?a|na|-|)\s*$/i.test(String(v));

  function txt(v) {
    if (vacio(v)) return null;
    return String(v).replace(/\s+/g, ' ').trim();
  }
  function num(v) {
    if (vacio(v)) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const m = String(v).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  }
  // "4.7%" -> 0.047 · 0.047 -> 0.047 · 65 (participation written as 65) -> 0.65
  function pct(v) {
    if (vacio(v)) return null;
    const conSigno = typeof v === 'string' && v.includes('%');
    const n = num(v);
    if (n == null) return null;
    const f = conSigno || Math.abs(n) > 1.5 ? n / 100 : n;
    return Math.round(f * 100000) / 100000;
  }
  const dos = (n) => String(n).padStart(2, '0');
  function fecha(v) {
    if (vacio(v)) return null;
    if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${dos(v.getMonth() + 1)}-${dos(v.getDate())}`;
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      // Excel serial date
      const d = new Date(Math.round((v - 25569) * 86400000));
      return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? `${m[3]}-${dos(m[2])}-${dos(m[1])}` : null;
  }
  // Long union names: keep the acronym on the first line ("CONASIM\nSindicato Nacional...").
  function sindicato(v) {
    const t = txt(String(v == null ? '' : v).split(/\r?\n/)[0]);
    return t;
  }
  function doc(v) {
    const t = txt(v);
    if (!t) return null;
    if (/^s[ií]$/i.test(t)) return 'SI';
    if (/^no$/i.test(t)) return 'NO';
    if (/^p(dte|endiente)/i.test(t)) return 'Pendiente';
    return t;
  }

  // [key, header aliases, converter]
  const CAMPOS = [
    ['anio', ['AÑO'], num],
    ['udn', ['UdN'], txt],
    ['cluster', ['CLUSTER'], txt],
    ['base', ['BASE'], txt],
    ['plaza', ['PLAZA'], txt],
    ['tipo', ['TIPO'], txt],
    ['entidad', ['ENTIDAD FEDERATIVA'], txt],
    ['localidad', ['LOCALIDAD'], txt],
    ['hc', ['HC'], num],
    ['cts', ['CTs'], num],
    ['zona', ['ZONA SALARIAL'], txt],
    ['sindicato', ['SINDICATO'], sindicato],
    ['expediente', ['#CCT/EXPEDIENTE', 'CCT/EXPEDIENTE'], txt],
    ['vencimiento', ['FECHA DE VENCIMIENTO'], fecha],
    ['tipoRevision', ['TIPO DE REVISIÓN', 'TIPO DE REVISIÓN 2026', 'TIPO DE REVISIÓN 2027', 'TIPO DE REVISIÓN 2028'], txt],
    ['estatusRevision', ['ESTATUS REVISION'], txt],
    ['fechaRevision', ['FECHA REVISIÓN'], fecha],
    ['diasRevision', ['DIAS REV VS VENCIMIENTO'], num],
    ['pctSalarioNominal', ['% Salario nominal'], pct],
    ['pctSalario', ['% Salario'], pct],
    ['pctPrestaciones', ['% Prestaciones'], pct],
    ['ultimoAnioCct', ['ULTIMO AÑO CCT'], num],
    ['estatusConsulta', ['ESTATUS CONSULTA'], txt],
    ['fechaConsulta', ['FECHA CONSULTA'], fecha],
    ['diasConsulta', ['DIAS CONSULTA VS REVISION'], num],
    ['formaCreacion', ['FORMA DE CREACIÓN'], txt],
    ['antiguedad', ['ANTIGÜEDAD CCT'], num],
    ['anioLegitimacion', ['AÑO LEGITIMACION / CREACIÓN'], num],
    ['participacionLeg', ['% PARTICIPACION LEG/REP', 'PARTICIPACION LEG/REP'], pct],
    ['aprobacionLeg', ['% APROBACIÓN LEG/REP', 'APROBACIÓN LEG/REP'], pct],
    ['participacion', ['% PARTICIPACIÓN'], pct],
    ['aprobacion', ['% APROBACIÓN'], pct],
    ['docConstancia', ['DOC. CONSTANCIA LEG/REP'], doc],
    ['docCct', ['DOC. CCT'], doc],
    ['docResolucionIntegral', ['DOC. RESOLUCION POSITIVA INTEGRAL'], doc],
    ['docResolucionSalarial', ['DOC. RESOLUCION POSITIVA SALARIAL'], doc],
    ['docConvenioSalarial', ['DOC. CONVENIO SAL'], doc],
    ['docConvenioIntegral', ['DOC. CONVENIO INT'], doc],
    ['nivelCompliance', ['NIVEL COMPLIANCE (3/5)', 'NIVEL COMPLIANCE'], num],
    ['pctCompliance', ['% COMPLIANCE'], pct],
    ['fondoAhorro', ['Fondo de Ahorro'], txt],
    ['valesMin', ['Vales Despensa (min)', 'Vales Despensa'], num],
    ['valesMax', ['Vales Despensa (max)'], num],
    ['aguinaldoDias', ['Aguinaldo'], num],
    ['primaVacacional', ['Prima Vacacional'], pct],
    ['primaDominical', ['Prima Dominical'], pct],
    ['salarioBase', ['Salario Base'], num],
    ['salarioPromedio', ['Salario Promedio'], num],
  ];
  // Never sent: RESPONSABLE LABORAL, RESPONSABLE SINDICAL, EXPEDIENTE COLECTIVO,
  // LIGA CCT, LIGA RIT, RESOLUCION CFCRL... (names and links).

  function tipoHoja(nombre, encabezados) {
    const n = clave(nombre);
    if (n.includes('ejercicio')) return 'ejercicio';
    const h = encabezados.map(clave);
    if (h.includes(clave('#CCT/EXPEDIENTE')) && h.some((x) => x.startsWith(clave('TIPO DE REVISIÓN')))) return 'historico';
    return null;
  }

  function normalizarCct(hojas) {
    const filas = [];
    const resumen = {};
    Object.entries(hojas || {}).forEach(([nombre, rows]) => {
      const lista = (rows || []).filter((r) => r && Object.values(r).some((v) => !vacio(v)));
      if (!lista.length) return;
      const encabezados = Object.keys(lista[0]);
      const hoja = tipoHoja(nombre, encabezados);
      if (!hoja) return;
      // Header lookup without accents/case/spaces; '% Salario' must not take '% Salario nominal'.
      const porClave = new Map();
      lista.forEach((r) => Object.keys(r).forEach((h) => { if (!porClave.has(clave(h))) porClave.set(clave(h), h); }));
      const col = CAMPOS.map(([key, alias, fn]) => [key, alias.map((a) => porClave.get(clave(a))).find(Boolean), fn]);
      let n = 0;
      lista.forEach((r) => {
        const datos = {};
        col.forEach(([key, h, fn]) => { if (h) { const v = fn(r[h]); if (v != null) datos[key] = v; } });
        if (!datos.plaza && !datos.entidad) return;
        if (!datos.anio && hoja === 'ejercicio') datos.anio = num(nombre);
        filas.push({ hoja, datos });
        n++;
      });
      resumen[hoja] = (resumen[hoja] || 0) + n;
    });
    if (!filas.length) throw new Error('No encontré las hojas del CCT ("CCTs Tiendas" y "CCT ejercicio ...").');
    return { filas, resumen };
  }

  global.OXXO_CCT = { normalizarCct, pct, fecha };
  if (typeof module !== 'undefined') module.exports = global.OXXO_CCT;
})(typeof window !== 'undefined' ? window : globalThis);
