// src/screens/ActasScreen.tsx
// Actas y Formatos: the RH formats (acta administrativa, probidad, ultimátum,
// retroalimentación, hechos, renuncia) filled on the phone, signed with the
// finger, sent to RH by email (with the Word attached and logged in RH's
// register) or shared as a Word. Same formats and texts as the DashboardsOxxo
// web page, so both produce the same document.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardTypeOptions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { SignaturePad, SignatureStrokes } from '../components/SignaturePad';
import { getJson, removeItem, setJson, storageKeys } from '../services/appStorage';
import { compartirWord, enviarActa, RegistroActa } from '../services/actas';
import { lookupEmployee } from '../services/auth';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';
import { showAlert } from '../utils/alert';
import {
  ActaDatos,
  ActaTipo,
  CAMPOS_COMUNES,
  faltantes,
  FirmaDoc,
  Firmante,
  limpio,
  modelo,
  PARTICIPANTES,
  TIPOS,
  TIPOS_ORDEN,
  tipoDe,
  VACIO,
} from '../utils/actaDocx';
import { firmaPng, Trazo } from '../utils/firmaPng';

const LOGO = require('../../assets/images/oxxo-logo-acta.png');

type Tipo = 'texto' | 'fecha' | 'hora' | 'largo' | 'numero' | 'correo';
type Campo = { key: string; label: string; tipo?: Tipo; placeholder?: string; ayuda?: string };

const GRUPOS: Array<{ titulo: string; campos: Campo[] }> = [
  {
    titulo: '1 · Lugar y fecha',
    campos: [
      { key: 'tienda', label: 'Tienda (OXXO)', placeholder: 'Nombre de la tienda' },
      { key: 'ciudad', label: 'Ciudad' },
      { key: 'domicilio', label: 'Domicilio de la tienda', placeholder: 'Calle, número y colonia' },
      { key: 'cp', label: 'C.P.', tipo: 'numero' },
      { key: 'municipio', label: 'Municipio' },
      { key: 'fecha', label: 'Fecha', tipo: 'fecha' },
      { key: 'horaInicio', label: 'Hora de inicio', tipo: 'hora' },
    ],
  },
  {
    titulo: '2 · Participantes',
    campos: [
      { key: 'representante', label: 'Representante del patrón' },
      { key: 'funcion', label: 'Función' },
      {
        key: 'numEmpleado',
        label: 'Número de empleado del trabajador',
        tipo: 'numero',
        ayuda: 'Toca la lupa para llenar nombre y puesto desde la nómina.',
      },
      { key: 'trabajador', label: 'Trabajador', placeholder: 'Nombre completo' },
      { key: 'puesto', label: 'Puesto' },
      { key: 'horaEntrada', label: 'Horario: entrada', tipo: 'hora' },
      { key: 'horaSalida', label: 'Horario: salida', tipo: 'hora' },
      { key: 'fechaIngreso', label: 'Fecha de ingreso', tipo: 'fecha' },
      { key: 'testigo1', label: 'Testigo 1' },
      { key: 'testigo2', label: 'Testigo 2' },
      ...Array.from({ length: PARTICIPANTES }, (_, i) => [
        { key: `participante${i + 1}`, label: `Presente ${i + 1}: nombre` },
        { key: `funcionP${i + 1}`, label: `Presente ${i + 1}: función`, placeholder: 'Ej. Asesor de Tienda, Responsable de RH' },
      ]).flat(),
    ],
  },
  {
    titulo: '3 · Hechos',
    campos: [
      { key: 'fechaHechos', label: 'Fecha de los hechos', tipo: 'fecha' },
      { key: 'horaCierre', label: 'Hora de cierre', tipo: 'hora' },
      { key: 'falta', label: 'Falta al reglamento (proceso) / motivo', placeholder: 'Ej. Resultados de pulsos' },
      {
        key: 'hechos',
        label: 'Hechos',
        tipo: 'largo',
        placeholder: 'Describe qué pasó y las evidencias (evaluaciones, retroalimentaciones, visitas, resultados).',
      },
      { key: 'manifiesta', label: 'Lo que manifiesta el trabajador', tipo: 'largo', placeholder: 'Lo que dice el trabajador sobre los hechos.' },
      { key: 'compromisos', label: 'Y se compromete a', tipo: 'largo', placeholder: 'Compromisos del trabajador.' },
    ],
  },
];
const CAMPOS_FECHA = GRUPOS.flatMap((g) => g.campos).filter((c) => c.tipo === 'fecha').map((c) => c.key);

// Dates are typed as DD/MM/AAAA and stored that way in the form; the
// document model takes ISO (AAAA-MM-DD).
const dos = (n: number) => String(n).padStart(2, '0');
const hoyTexto = (x = new Date()) => `${dos(x.getDate())}/${dos(x.getMonth() + 1)}/${x.getFullYear()}`;
const horaTexto = (x = new Date()) => `${dos(x.getHours())}:${dos(x.getMinutes())}`;
const ahora = () => `${hoyTexto()} ${horaTexto()}`;
function aIso(texto?: string) {
  const m = limpio(texto).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const [d, mes, a] = [+m[1], +m[2], +m[3]];
  const f = new Date(a, mes - 1, d);
  return f.getFullYear() === a && f.getMonth() === mes - 1 && f.getDate() === d ? `${a}-${dos(mes)}-${dos(d)}` : '';
}
function mascaraFecha(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 8);
  return [n.slice(0, 2), n.slice(2, 4), n.slice(4)].filter(Boolean).join('/');
}
function mascaraHora(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 4);
  return n.length > 2 ? `${n.slice(0, 2)}:${n.slice(2)}` : n;
}
function aDatos(form: Record<string, string>): ActaDatos {
  const d: ActaDatos = { ...form };
  CAMPOS_FECHA.forEach((k) => {
    d[k] = aIso(form[k]);
  });
  return d;
}

type Firma = { clave: string; trazos: Trazo[]; cuando: string } | { clave: string; negada: true; cuando: string };
const claveFirma = (f: Firmante, i: number) => `${i}|${f.rol}|${f.nombre}`;

function confirmar(titulo: string, mensaje: string, accion: string, alAceptar: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) alAceptar();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: 'Cancelar', style: 'cancel' },
    { text: accion, style: 'destructive', onPress: alAceptar },
  ]);
}

type Sesion = { numeroEmpleado?: string; nombre?: string; tienda?: string; puesto?: string } | null;

function valoresIniciales(sesion: Sesion, copia = ''): Record<string, string> {
  return {
    tipo: 'administrativa',
    fecha: hoyTexto(),
    horaInicio: horaTexto(),
    ciudad: 'Oaxaca de Juárez',
    funcion: 'Asesor Tienda',
    tienda: sesion?.tienda ?? '',
    // Whoever fills the acta is usually the AT: the employer's representative
    // and first person present in the formats that list them.
    representante: sesion?.nombre ?? '',
    participante1: sesion?.nombre ?? '',
    funcionP1: 'Asesor de Tienda',
    copia,
  };
}

type Aviso = { texto: string; tipo: 'info' | 'ok' | 'error' } | null;

export function ActasScreen({ onBack }: { onBack: () => void }) {
  const [sesion, setSesion] = useState<Sesion>(null);
  const [form, setForm] = useState<Record<string, string>>(() => valoresIniciales(null));
  const [firmas, setFirmas] = useState<Array<Firma | null>>([]);
  const [vista, setVista] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [enviando, setEnviando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const cargado = useRef(false);
  const scroll = useRef<ScrollView>(null);

  // Draft and session on open; the draft never includes signatures.
  useEffect(() => {
    let activo = true;
    Promise.all([getJson<Sesion>(storageKeys.session, null), getJson<Record<string, string> | null>(storageKeys.actaDraft, null)]).then(
      ([s, borrador]) => {
        if (!activo) return;
        setSesion(s);
        setForm({ ...valoresIniciales(s), ...(borrador || {}) });
        cargado.current = true;
      }
    );
    return () => {
      activo = false;
    };
  }, []);
  useEffect(() => {
    if (cargado.current) setJson(storageKeys.actaDraft, form);
  }, [form]);

  const datos = useMemo(() => aDatos(form), [form]);
  const m = useMemo(() => modelo(datos), [datos]);
  const tipo = tipoDe(datos);
  const def = TIPOS[tipo];
  const visibles = useMemo(() => new Set([...CAMPOS_COMUNES, ...def.campos]), [def]);
  const obligatorios = useMemo(() => new Set(def.obligatorios), [def]);

  // Keeps each signature with its signer (position, role and name); a signer
  // that changes loses the signature instead of moving it to someone else.
  const claves = m.firmas.map(claveFirma);
  const firmasActuales = claves.map((c) => firmas.find((f) => f && f.clave === c) || null);
  const hayFirmas = firmasActuales.some(Boolean);

  const cambiar = (key: string, valor: string) => setForm((f) => ({ ...f, [key]: valor }));

  const setFirma = (i: number, firma: Firma | null) =>
    setFirmas((actuales) => [...actuales.filter((f) => f && f.clave !== claves[i]), ...(firma ? [firma] : [])]);

  const firmasDoc = (): FirmaDoc[] =>
    firmasActuales.map((f) => (!f ? null : 'negada' in f ? { negada: true, cuando: f.cuando } : { png: firmaPng(f.trazos), cuando: f.cuando }));

  const textoFirmas = () => {
    const n = firmasActuales.filter((f) => f && 'trazos' in f).length;
    const neg = firmasActuales.filter((f) => f && 'negada' in f).length;
    return (n ? ` con ${n} firma${n === 1 ? '' : 's'} en pantalla` : '') + (neg ? `${n ? ' y' : ' con'} ${neg} negativa${neg === 1 ? '' : 's'} a firmar` : '');
  };

  const buscarTrabajador = async () => {
    const numero = limpio(form.numEmpleado);
    if (!numero) return showAlert('Número de empleado', 'Escribe el número de empleado del trabajador.');
    setBuscando(true);
    try {
      const r = await lookupEmployee(numero);
      if (!r.exists) return showAlert('No encontrado', `No hay nadie con el número ${numero} en la nómina. Llena los datos a mano.`);
      setForm((f) => ({
        ...f,
        trabajador: r.nombre || f.trabajador || '',
        puesto: r.puesto || f.puesto || '',
        tienda: f.tienda || r.tienda || '',
      }));
    } catch {
      showAlert('Sin conexión', 'No se pudo consultar la nómina. Llena los datos a mano.');
    } finally {
      setBuscando(false);
    }
  };

  const validar = () => {
    const falta = faltantes(datos);
    CAMPOS_FECHA.forEach((k) => {
      if (visibles.has(k) && limpio(form[k]) && !datos[k]) falta.push(`fecha válida en "${GRUPOS.flatMap((g) => g.campos).find((c) => c.key === k)?.label}"`);
    });
    if (falta.length) {
      setAviso({ texto: `Faltan datos: ${falta.join(', ')}.`, tipo: 'error' });
      return false;
    }
    return true;
  };

  const limpiarDocumento = (conservarCopia: boolean) => {
    setFirmas([]);
    setForm(valoresIniciales(sesion, conservarCopia ? form.copia ?? '' : ''));
    if (!conservarCopia) removeItem(storageKeys.actaDraft);
  };

  const enviar = async () => {
    if (!validar()) return;
    setEnviando(true);
    setAviso({ texto: `Enviando ${def.nombre.toLowerCase()} por correo…`, tipo: 'info' });
    try {
      const r = await enviarActa(datos, firmasDoc());
      const reg: RegistroActa | null = r.registro;
      const conteo = reg && reg.ok && !reg.actasEnTienda
        ? ' Quedó en el registro.'
        : reg && reg.ok
          ? ` Quedó en el registro: ${limpio(datos.trabajador) || 'este documento'} lleva ${reg.actasEnTienda} documento${reg.actasEnTienda === 1 ? '' : 's'} en esta tienda`
            + (reg.mismoTipo ? ` (${reg.mismoTipo} de tipo "${def.nombre}")` : '')
            + ((reg.actasTotal ?? 0) > (reg.actasEnTienda ?? 0) ? `, ${reg.actasTotal} en total.` : '.')
          : reg && reg.error ? ' Ojo: no se pudo guardar en el registro de actas; avisa a RH.' : '';
      limpiarDocumento(true);
      setAviso({
        texto: `${def.nombre} enviada a ${r.enviadoA}${textoFirmas()}.${conteo} El formulario quedó limpio para el siguiente.`,
        tipo: reg && reg.error ? 'error' : 'ok',
      });
    } catch (e) {
      setAviso({ texto: `No se pudo enviar: ${(e as Error).message}. Comparte el Word y mándalo por correo.`, tipo: 'error' });
    } finally {
      setEnviando(false);
    }
  };

  const compartir = async () => {
    if (!validar()) return;
    try {
      await compartirWord(datos, firmasDoc());
      setAviso({ texto: `Word generado${textoFirmas()}. No queda en el registro de RH: para eso usa "Enviar a RH".`, tipo: 'ok' });
    } catch (e) {
      setAviso({ texto: `No se pudo generar el Word: ${(e as Error).message}.`, tipo: 'error' });
    }
  };

  const renderCampo = (c: Campo) => {
    if (!visibles.has(c.key)) return null;
    // With signatures the data is locked (that text was signed); the email copy is not part of it.
    const bloqueado = hayFirmas && c.key !== 'copia';
    const valor = form[c.key] ?? '';
    const teclado: KeyboardTypeOptions = c.tipo === 'numero' || c.tipo === 'fecha' || c.tipo === 'hora' ? 'number-pad' : c.tipo === 'correo' ? 'email-address' : 'default';
    const alCambiar = (v: string) => cambiar(c.key, c.tipo === 'fecha' ? mascaraFecha(v) : c.tipo === 'hora' ? mascaraHora(v) : v);
    return (
      <View key={c.key} style={styles.campo}>
        <Text style={styles.label}>
          {c.label}
          {obligatorios.has(c.key) ? <Text style={styles.req}> *</Text> : null}
        </Text>
        <View style={[styles.inputWrap, c.tipo === 'largo' && styles.inputWrapLargo, bloqueado && styles.inputBloqueado]}>
          <TextInput
            style={[styles.input, c.tipo === 'largo' && styles.inputLargo]}
            value={valor}
            onChangeText={alCambiar}
            accessibilityLabel={c.label}
            placeholder={c.placeholder ?? (c.tipo === 'fecha' ? 'DD/MM/AAAA' : c.tipo === 'hora' ? 'HH:MM' : undefined)}
            placeholderTextColor={colors.ink3}
            editable={!bloqueado}
            keyboardType={teclado}
            multiline={c.tipo === 'largo'}
            autoCapitalize={c.tipo === 'correo' ? 'none' : 'sentences'}
            autoCorrect={c.tipo === 'largo'}
            maxLength={c.key === 'cp' ? 5 : c.tipo === 'fecha' ? 10 : c.tipo === 'hora' ? 5 : undefined}
          />
          {c.key === 'numEmpleado' && !bloqueado ? (
            <Pressable style={styles.inputBoton} onPress={buscarTrabajador} accessibilityLabel="Buscar en la nómina">
              {buscando ? <ActivityIndicator color={colors.oxRed} /> : <Icon name="search" size={19} color={colors.oxRed} />}
            </Pressable>
          ) : null}
        </View>
        {c.ayuda ? <Text style={styles.ayuda}>{c.ayuda}</Text> : null}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#FFF7F0', colors.bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={onBack} accessibilityLabel="Regresar">
            <Icon name="chevL" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Relaciones laborales</Text>
            <Text style={styles.title}>Actas y Formatos</Text>
          </View>
          <Pressable style={styles.headerButton} onPress={() => setVista(true)} accessibilityLabel="Vista previa">
            <Icon name="eye" size={20} color={colors.ink} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Elige el tipo de documento, llena los datos, revisa la vista previa, firmen en pantalla (o a mano, ya impreso) y envíalo a RH.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tipo de documento</Text>
          <View style={styles.chips}>
            {TIPOS_ORDEN.map((t: ActaTipo) => {
              const activo = t === tipo;
              return (
                <Pressable
                  key={t}
                  disabled={hayFirmas}
                  onPress={() => cambiar('tipo', t)}
                  style={[styles.chip, activo && styles.chipActivo, hayFirmas && !activo && styles.chipBloqueado]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                >
                  <Text style={[styles.chipText, activo && styles.chipTextActivo]}>{TIPOS[t].nombre}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.ayuda}>{def.carta ? 'La renuncia sale como carta del trabajador, sin membrete.' : `Se genera el formato "${def.nombre}".`}</Text>
        </View>

        {GRUPOS.map((g) => {
          const campos = g.campos.map(renderCampo).filter(Boolean);
          if (!campos.length) return null;
          return (
            <View key={g.titulo} style={styles.card}>
              <Text style={styles.cardTitle}>{g.titulo}</Text>
              {campos}
            </View>
          );
        })}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>4 · Firmas</Text>
          <Text style={styles.ayuda}>
            Opcional. Cada persona firma con el dedo en su recuadro y su firma sale en el Word. Si prefieren firmar a mano, déjalo en blanco e imprime el documento.
          </Text>
          {hayFirmas ? (
            <View style={styles.bloqueo}>
              <Text style={styles.bloqueoText}>El documento ya tiene firmas: sus datos quedan bloqueados para que nadie cambie lo que se firmó.</Text>
              <Pressable
                style={styles.botonSuave}
                onPress={() =>
                  confirmar('Borrar firmas', '¿Borrar todas las firmas para poder corregir el documento? Tendrán que volver a firmar.', 'Borrar', () => {
                    setFirmas([]);
                    setAviso({ texto: 'Se borraron las firmas. Ya puedes corregir el documento.', tipo: 'info' });
                  })
                }
              >
                <Text style={styles.botonSuaveText}>Borrar firmas y editar</Text>
              </Pressable>
            </View>
          ) : null}
          {m.firmas.map((f, i) => {
            const s = firmasActuales[i];
            return (
              <View key={claves[i]} style={styles.firma}>
                <Text style={styles.firmaNombre}>{f.nombre || 'Sin nombre'}</Text>
                <Text style={styles.firmaRol}>{f.rol || 'Firma'}</Text>
                {!f.nombre ? (
                  <Text style={styles.ayuda}>Escribe su nombre en los datos para que pueda firmar aquí.</Text>
                ) : s && 'negada' in s ? (
                  <View style={styles.negada}>
                    <Text style={styles.negadaText}>SE NEGÓ A FIRMAR</Text>
                  </View>
                ) : (
                  <SignaturePad
                    trazos={s && 'trazos' in s ? s.trazos : []}
                    onChange={(trazos) => setFirma(i, { clave: claves[i], trazos, cuando: ahora() })}
                  />
                )}
                {f.nombre ? (
                  <View style={styles.firmaPie}>
                    <Text style={styles.firmaEstado}>
                      {s && 'trazos' in s ? `Firmado · ${s.cuando}` : s ? `Se negó a firmar · ${s.cuando}` : 'Sin firmar'}
                    </Text>
                    <Pressable onPress={() => setFirma(i, null)} hitSlop={8}>
                      <Text style={styles.firmaAccion}>Borrar</Text>
                    </Pressable>
                    {!m.carta ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() => setFirma(i, s && 'negada' in s ? null : { clave: claves[i], negada: true, cuando: ahora() })}
                      >
                        <Text style={styles.firmaAccion}>{s && 'negada' in s ? 'Quitar negativa' : 'Se negó a firmar'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>5 · Enviar</Text>
          {renderCampo({ key: 'copia', label: 'Enviar copia a (opcional)', tipo: 'correo', placeholder: 'tu.correo@empresa.com' })}
          <Text style={styles.ayuda}>El documento siempre se envía al correo de RH. Aquí puedes agregar tu correo para recibir copia.</Text>

          <Pressable onPress={enviar} disabled={enviando} style={({ pressed }) => [styles.botonPrincipalWrap, pressed && styles.pressed]}>
            <LinearGradient colors={gradients.oxGrad.colors} start={gradients.oxGrad.start} end={gradients.oxGrad.end} style={[styles.botonPrincipal, enviando && styles.botonDeshabilitado]}>
              {enviando ? <ActivityIndicator color="#fff" /> : <Icon name="send" size={19} color="#fff" />}
              <Text style={styles.botonPrincipalText}>Enviar a RH</Text>
            </LinearGradient>
          </Pressable>
          <View style={styles.botonesFila}>
            <Pressable style={[styles.botonSecundario, { flex: 1 }]} onPress={compartir}>
              <Icon name="doc" size={18} color={colors.oxRedDark} />
              <Text style={styles.botonSecundarioText}>{Platform.OS === 'web' ? 'Descargar Word' : 'Compartir Word'}</Text>
            </Pressable>
            <Pressable
              style={styles.botonSecundario}
              onPress={() =>
                confirmar(
                  'Limpiar',
                  hayFirmas ? '¿Borrar todos los datos y las firmas del documento?' : '¿Borrar todos los datos del documento?',
                  'Limpiar',
                  () => {
                    limpiarDocumento(false);
                    setAviso(null);
                  }
                )
              }
            >
              <Text style={styles.botonSecundarioText}>Limpiar</Text>
            </Pressable>
          </View>
          <Text style={styles.ayuda}>
            Al enviarlo a RH, el documento queda anotado en el registro de RH (cuántos lleva el empleado en su tienda). "{Platform.OS === 'web' ? 'Descargar' : 'Compartir'} Word" no lo registra.
          </Text>
          {aviso ? (
            <View style={[styles.aviso, aviso.tipo === 'ok' && styles.avisoOk, aviso.tipo === 'error' && styles.avisoError]}>
              <Text style={styles.avisoText}>{aviso.texto}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={vista} animationType="slide" onRequestClose={() => setVista(false)}>
        <SafeAreaView style={styles.vistaScreen} edges={['top', 'bottom']}>
          <View style={styles.vistaHeader}>
            <Text style={styles.vistaTitulo}>Vista previa</Text>
            <Pressable style={styles.headerButton} onPress={() => setVista(false)} accessibilityLabel="Cerrar vista previa">
              <Icon name="check" size={20} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.vistaContent}>
            <VistaPrevia datos={datos} firmas={firmasActuales} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// Same document as the Word, on screen: blanks as underscores, filled data in navy.
function VistaPrevia({ datos, firmas }: { datos: ActaDatos; firmas: Array<Firma | null> }) {
  const m = modelo(datos);
  return (
    <View style={styles.hoja}>
      {!m.carta ? (
        <View style={styles.hojaEncabezado}>
          <Image source={LOGO} style={styles.hojaLogo} resizeMode="contain" />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.hojaTitulo}>{m.titulo}</Text>
            {m.subtitulo ? <Text style={styles.hojaSubtitulo}>{m.subtitulo}</Text> : null}
            <Text style={styles.hojaEmpresa}>Cadena Comercial OXXO, S.A. de C.V. · Relaciones laborales</Text>
          </View>
        </View>
      ) : null}
      {m.resumen ? (
        <View style={styles.resumen}>
          {m.resumen.flat().map(([etq, v]) => (
            <View key={etq} style={styles.resumenCelda}>
              <Text style={styles.resumenEtq}>{etq}</Text>
              <Text style={v ? styles.dato : styles.hueco}>{v || VACIO}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {m.parrafos.map((p, i) =>
        p.titulo ? (
          <Text key={i} style={styles.hojaSeccion}>
            {p.runs.map((r) => r.t).join('')}
          </Text>
        ) : (
          <Text
            key={i}
            style={[
              styles.hojaParrafo,
              p.negrita && { fontFamily: 'PlusJakartaSans_700Bold' },
              p.alinear === 'right' ? { textAlign: 'right' } : p.alinear === 'center' ? { textAlign: 'center' } : p.alinear === 'left' ? { textAlign: 'left' } : null,
            ]}
          >
            {p.runs.map((r, k) =>
              r.campo ? (
                <Text key={k} style={r.t ? (r.largo ? styles.datoLargo : styles.dato) : styles.hueco}>
                  {r.t || VACIO}
                </Text>
              ) : (
                r.t
              )
            )}
          </Text>
        )
      )}
      {!m.carta ? <Text style={styles.hojaSeccion}>FIRMAS</Text> : null}
      <View style={styles.hojaFirmas}>
        {m.firmas.map((f, i) => {
          const s = firmas[i];
          return (
            <View key={i} style={[styles.hojaFirma, m.firmas.length === 1 && { width: '70%' }]}>
              <View style={styles.hojaFirmaImg}>
                {s && 'trazos' in s ? <SignatureStrokes trazos={s.trazos} /> : null}
                {s && 'negada' in s ? <Text style={styles.negadaText}>SE NEGÓ A FIRMAR</Text> : null}
              </View>
              <View style={styles.hojaFirmaLinea} />
              <Text style={f.nombre ? styles.dato : styles.hojaParrafo}>{f.nombre || ' '}</Text>
              <Text style={styles.hojaFirmaRol}>{f.rol}</Text>
              {s ? (
                <Text style={styles.hojaSello}>
                  {'negada' in s ? 'Negativa asentada' : 'Firmado en pantalla'} el {s.cuando}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      {m.nota ? <Text style={styles.hojaNota}>{m.nota}</Text> : null}
      <View style={styles.hojaPie}>
        <Text style={styles.hojaPieText}>OXXO | Uso Interno</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingBottom: 108 },
  safeTop: { backgroundColor: 'rgba(255,255,255,.56)' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1 },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  eyebrow: { ...type.eyebrowSm, color: colors.oxRed, marginBottom: 3 },
  title: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 25, lineHeight: 29, color: colors.ink },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  intro: { ...type.caption, color: colors.ink2, marginBottom: 2 },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 4,
    ...shadows.card,
  },
  cardTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line },
  chipActivo: { backgroundColor: colors.oxRed, borderColor: colors.oxRed },
  chipBloqueado: { opacity: 0.45 },
  chipText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink2 },
  chipTextActivo: { color: colors.white },
  campo: { marginBottom: 10 },
  label: { ...type.label, color: colors.ink, marginBottom: 6 },
  req: { color: colors.oxRed },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.line2,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  inputWrapLargo: { alignItems: 'flex-start', paddingVertical: 10 },
  inputBloqueado: { backgroundColor: colors.field, borderColor: colors.line },
  input: { flex: 1, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15.5, color: colors.ink, paddingVertical: 10 },
  inputLargo: { minHeight: 110, textAlignVertical: 'top', paddingVertical: 0 },
  inputBoton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  ayuda: { ...type.caption, fontSize: 12.5, lineHeight: 18, color: colors.ink3, marginTop: 4 },
  bloqueo: { backgroundColor: '#FFF4E5', borderColor: '#FFD9A8', borderWidth: 1, borderRadius: radii.md, padding: 12, gap: 10, marginTop: 8 },
  bloqueoText: { ...type.caption, color: colors.ink },
  firma: { marginTop: 12 },
  firmaNombre: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14.5, color: colors.ink },
  firmaRol: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.ink3, textTransform: 'uppercase', marginBottom: 6 },
  firmaPie: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  firmaEstado: { flex: 1, ...type.caption, fontSize: 12, color: colors.ink2 },
  firmaAccion: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5, color: colors.oxRed },
  negada: {
    width: '100%',
    aspectRatio: 3,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#F3C3BF',
    backgroundColor: '#FFF0EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  negadaText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: '#B5121B', letterSpacing: 0.5 },
  botonPrincipalWrap: { marginTop: 12 },
  botonPrincipal: { height: 54, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, ...shadows.button },
  botonDeshabilitado: { opacity: 0.7 },
  botonPrincipalText: { ...type.button, color: colors.white },
  botonesFila: { flexDirection: 'row', gap: 10, marginTop: 10 },
  botonSecundario: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.line2,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botonSecundarioText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14.5, color: colors.oxRedDark },
  botonSuave: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line2 },
  botonSuaveText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.oxRedDark },
  pressed: { opacity: 0.85 },
  aviso: { marginTop: 12, borderRadius: radii.md, padding: 12, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line },
  avisoOk: { backgroundColor: '#EAF7F0', borderColor: '#BFE6D1' },
  avisoError: { backgroundColor: '#FFF0EE', borderColor: '#F3C3BF' },
  avisoText: { ...type.caption, color: colors.ink },
  vistaScreen: { flex: 1, backgroundColor: '#E9E2DC' },
  vistaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  vistaTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.ink },
  vistaContent: { padding: 12, paddingBottom: 40 },
  hoja: { backgroundColor: colors.white, borderRadius: 6, padding: 18, ...shadows.card },
  hojaEncabezado: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 3, borderBottomColor: '#B5121B', paddingBottom: 10, marginBottom: 12 },
  hojaLogo: { width: 70, height: 36 },
  hojaTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, color: '#1A1A1A', textAlign: 'right' },
  hojaSubtitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: '#B5121B' },
  hojaEmpresa: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 8.5, color: '#6F625D', textAlign: 'right' },
  resumen: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: '#DED6CF', backgroundColor: '#FAF6F1', marginBottom: 10 },
  resumenCelda: { width: '33.33%', padding: 6, borderWidth: 0.5, borderColor: '#DED6CF' },
  resumenEtq: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 8, color: '#6F625D', textTransform: 'uppercase' },
  hojaSeccion: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    color: '#B5121B',
    borderBottomWidth: 1,
    borderBottomColor: '#DED6CF',
    paddingBottom: 2,
    marginTop: 10,
    marginBottom: 6,
  },
  hojaParrafo: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, lineHeight: 17, color: '#262626', textAlign: 'justify', marginBottom: 6 },
  dato: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11.5, color: '#1F3B70', textDecorationLine: 'underline' },
  datoLargo: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11.5, color: '#1F3B70' },
  hueco: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 11.5, color: '#9A9A9A' },
  hojaFirmas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: 14 },
  hojaFirma: { width: '50%', alignItems: 'center', paddingHorizontal: 6 },
  hojaFirmaImg: { width: '100%', aspectRatio: 3, alignItems: 'center', justifyContent: 'flex-end' },
  hojaFirmaLinea: { width: '100%', height: 1, backgroundColor: '#595959', marginBottom: 3 },
  hojaFirmaRol: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 8.5, color: '#6F625D', textAlign: 'center' },
  hojaSello: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 7.5, color: '#6F625D', textAlign: 'center' },
  hojaNota: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 9, color: '#6F625D', marginTop: 10 },
  hojaPie: { borderTopWidth: 1, borderTopColor: '#DED6CF', marginTop: 16, paddingTop: 6 },
  hojaPieText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 8, color: '#6F625D' },
});
