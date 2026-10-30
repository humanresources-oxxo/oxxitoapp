// src/services/actas.ts
// Actas y Formatos: who can use it, sending to RH and sharing the Word.
// Sending goes through the same public Apps Script action the DashboardsOxxo
// web form uses ("enviarActa"): it always mails RH's fixed recipients and logs
// the acta in RH's private register, so app and web actas land in one place.
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ACTA_LOGO_BASE64 } from '../data/actaLogo';
import { aBase64, ActaDatos, deBase64, docx, FirmaDoc, limpio, modelo, nombreArchivo, TIPOS, tipoDe } from '../utils/actaDocx';

// DashboardsOxxo js/config.js -> ADMIN_UPLOAD_URL.
const ACTAS_URL =
  'https://script.google.com/macros/s/AKfycbwe_RcnVRkZy9x1YcRuum4qdLucIWLTVsnTZcMvQDyobo6f3ot-YG0Lv00hYS-1XEg/exec';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Puestos (employees.puesto) that see Actas y Formatos. Matched without
// accents or case, as a prefix: "ASESOR TIENDA" also covers "ASESOR TIENDA CV".
export const PUESTOS_ACTAS = [
  'ASESOR TIENDA',
  'RESPONSABLE RECURSOS HUMANOS',
  'GERENTE PLAZA',
  'ANALISTA EXPERIENCIA COLABORADOR',
  'PRACTICANTE',
];

const normalizar = (s?: string) =>
  limpio(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ');

export function puedeLevantarActas(puesto?: string) {
  const p = normalizar(puesto);
  return !!p && PUESTOS_ACTAS.some((permitido) => p.startsWith(normalizar(permitido)));
}

let logo: Uint8Array | null = null;
const logoActa = () => (logo ??= deBase64(ACTA_LOGO_BASE64));

export function generarWord(d: ActaDatos, firmas: FirmaDoc[]) {
  return docx(d, { logo: logoActa(), firmas });
}

// Native: writes the Word to the cache and opens the share sheet (WhatsApp,
// mail, Files, print...). Web: downloads it.
export async function compartirWord(d: ActaDatos, firmas: FirmaDoc[]) {
  const bytes = generarWord(d, firmas);
  const nombre = nombreArchivo(d);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: DOCX_MIME }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  const archivo = new File(Paths.cache, nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(bytes);
  if (!(await Sharing.isAvailableAsync())) throw new Error('este teléfono no permite compartir archivos');
  await Sharing.shareAsync(archivo.uri, { mimeType: DOCX_MIME, UTI: 'org.openxmlformats.wordprocessingml.document', dialogTitle: nombre });
}

export type RegistroActa = { ok?: boolean; error?: string; actasEnTienda?: number; actasTotal?: number; mismoTipo?: number };
export type EnvioActa = { enviadoA: string; registro: RegistroActa | null };

export async function enviarActa(d: ActaDatos, firmas: FirmaDoc[], { crTienda = '' } = {}): Promise<EnvioActa> {
  const tipo = TIPOS[tipoDe(d)];
  const cuerpo = JSON.stringify({
    action: 'enviarActa',
    archivo: nombreArchivo(d),
    docx: aBase64(generarWord(d, firmas)),
    copia: limpio(d.copia),
    tipo: tipo.nombre,
    tienda: limpio(d.tienda),
    trabajador: limpio(d.trabajador),
    fecha: limpio(d.fecha),
    representante: limpio(tipo.campos.includes('representante') ? d.representante : d.participante1),
    // For RH's register (private Apps Script workbook).
    crTienda,
    numEmpleado: limpio(d.numEmpleado),
    puesto: limpio(d.puesto),
    fechaHechos: limpio(tipo.campos.includes('fechaHechos') ? d.fechaHechos : d.fecha),
    falta: limpio(d.falta),
    // For the register's "Firmas" column (the Word already has the signatures).
    firmantes: modelo(d).firmas.length,
    firmasPantalla: firmas.filter((f) => f && 'png' in f).length,
    firmasNegadas: firmas.filter((f) => f && 'negada' in f).length,
  });
  // text/plain avoids the CORS preflight Apps Script does not answer (web).
  const r = await fetch(ACTAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: cuerpo });
  const datos = await r.json().catch(() => null);
  if (!r.ok || !datos || datos.ok === false) {
    const motivo = (datos && datos.error) || 'el servidor no respondió';
    throw new Error(/no autorizado/i.test(motivo) ? 'el envío por correo aún no está activado en el Apps Script' : motivo);
  }
  return { enviadoA: datos.enviadoA || 'RH', registro: datos.registro || null };
}
