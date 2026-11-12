// src/screens/VotacionesScreen.tsx
// Votaciones: secret ballots for places, dates and similar team decisions.
// Everyone sees the open ones meant for them (all, or their store), votes once
// and sees results when it closes (or right after voting when the votación
// shows live results). RH and Gerente de plaza also create, close and delete
// them here. Actions go with the session key (services/sesion.ts); a session
// from before the key existed asks for the PIN once. Data: services/votaciones.ts.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Desplegable } from '../components/Visual';
import { getJson, storageKeys } from '../services/appStorage';
import { leerLlave, obtenerLlave, olvidarLlave, puedePublicar } from '../services/sesion';
import { cargarTiendas, normalizarTienda, sugerirTiendas, Tienda } from '../services/tiendas';
import {
  borrarVotacion,
  cerrarVotacion,
  crearVotacion,
  EstadoVoto,
  listarVotaciones,
  ListaVotaciones,
  MENSAJE_VOTO,
  NuevaVotacion,
  votar,
  Votacion,
} from '../services/votaciones';
import { colors, gradients, radii, shadows, type } from '../theme/tokens';
import { confirmAlert, showAlert } from '../utils/alert';

const fechaHora = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fechaCorta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

function cuandoCierra(d: Date) {
  const horas = (d.getTime() - Date.now()) / 36e5;
  if (horas < 1) return 'Cierra en menos de una hora';
  if (horas < 24) return `Cierra en ${Math.round(horas)} h`;
  return `Cierra ${fechaHora.format(d)}`;
}

const votosTxt = (n: number) => `${n} ${n === 1 ? 'voto' : 'votos'}`;

// Closing presets: that many days from today, at 23:59.
const CIERRES = [
  { etiqueta: 'Mañana', dias: 1 },
  { etiqueta: '3 días', dias: 3 },
  { etiqueta: '1 semana', dias: 7 },
  { etiqueta: '2 semanas', dias: 14 },
];
function finDelDia(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(23, 59, 0, 0);
  return d;
}

// An action that needs the session key, and what to say when it's done.
type Accion = {
  hacer: (llave: string) => Promise<EstadoVoto>;
  listo: string;
};

export function VotacionesScreen({ onBack, onCambio }: { onBack: () => void; onCambio?: () => void }) {
  const [numero, setNumero] = useState('');
  const [esRh, setEsRh] = useState(false);
  const [lista, setLista] = useState<ListaVotaciones | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const [eleccion, setEleccion] = useState<Record<string, string>>({});
  // Action waiting for the one-time PIN (no session key yet).
  const [pedirPin, setPedirPin] = useState<Accion | null>(null);
  const [nueva, setNueva] = useState(false);

  useEffect(() => {
    getJson<{ numeroEmpleado?: string; puesto?: string } | null>(storageKeys.session, null).then((s) => {
      setNumero(s?.numeroEmpleado ?? '');
      setEsRh(puedePublicar(s?.puesto));
    });
  }, []);

  useEffect(() => {
    if (!numero) return;
    let activo = true;
    setError(false);
    listarVotaciones()
      .then((l) => activo && setLista(l))
      .catch(() => activo && setError(true));
    return () => {
      activo = false;
    };
  }, [numero, intento]);

  const recargar = useCallback(() => {
    setIntento((i) => i + 1);
    onCambio?.();
  }, [onCambio]);

  // Runs an action with the session key; without one (or with one the server
  // no longer accepts) asks for the PIN once and then runs it.
  const conLlave = async (a: Accion) => {
    const llave = await leerLlave();
    if (llave) {
      try {
        const r = await a.hacer(llave);
        if (r !== 'no_session') return terminar(a, r);
      } catch {
        return showAlert('Sin conexión', 'No pudimos conectar. Intenta de nuevo.');
      }
      await olvidarLlave();
    }
    setPedirPin(a);
  };

  const terminar = (p: Accion, r: EstadoVoto) => {
    if (r === 'ok') {
      if (p.listo) showAlert('Listo', p.listo);
    } else {
      showAlert('No se pudo', MENSAJE_VOTO[r] || 'Intenta de nuevo.');
    }
    recargar();
  };

  const votaciones = lista?.votaciones ?? [];
  const admin = esRh || !!lista?.puedeAdministrar;
  const abiertas = votaciones.filter((v) => v.abierta);
  const cerradas = votaciones.filter((v) => !v.abierta);
  const pendientes = abiertas.filter((v) => v.puedeVotar && !v.yaVoto).length;

  const onVotar = async (v: Votacion) => {
    const opcion = v.opciones.find((o) => o.id === eleccion[v.id]);
    if (!opcion) return;
    if (!(await confirmAlert('Confirma tu voto', `Vas a votar por "${opcion.texto}". Tu voto es secreto y no se puede cambiar.`, 'Votar'))) return;
    conLlave({
      hacer: (llave) => votar(llave, v.id, opcion.id),
      listo: v.resultadosEnVivo ? 'Tu voto quedó registrado. Ya puedes ver cómo va.' : 'Tu voto quedó registrado. Verás el resultado cuando cierre.',
    });
  };

  const onCerrar = async (v: Votacion) => {
    if (!(await confirmAlert('Cerrar votación', `"${v.titulo}" deja de recibir votos y todos ven el resultado.`, 'Cerrar'))) return;
    conLlave({ hacer: (llave) => cerrarVotacion(llave, v.id), listo: '' });
  };

  const onBorrar = async (v: Votacion) => {
    if (!(await confirmAlert('Borrar votación', `"${v.titulo}" y sus votos se borran para todos. No se puede deshacer.`, 'Borrar'))) return;
    conLlave({ hacer: (llave) => borrarVotacion(llave, v.id), listo: '' });
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#FFF7F0', colors.bg, '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" style={styles.headerButton} onPress={onBack} accessibilityLabel="Regresar">
            <Icon name="chevL" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Voto secreto</Text>
            <Text style={styles.title}>Votaciones</Text>
          </View>
        </View>
      </SafeAreaView>

      {error ? (
        <View style={styles.content}>
          <Aviso titulo="No se pudieron cargar las votaciones" texto="Revisa tu conexión e intenta de nuevo." accion={{ texto: 'Reintentar', onPress: () => setIntento((i) => i + 1) }} />
        </View>
      ) : !lista ? (
        <View style={styles.cargando}>
          <ActivityIndicator color={colors.oxRed} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.oxGrad.colors} start={gradients.oxGrad.start} end={gradients.oxGrad.end} style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>{pendientes ? 'Por votar' : 'Estás al día'}</Text>
              <Text style={styles.heroNumero}>{pendientes}</Text>
              <Text style={styles.heroBody}>
                {abiertas.length
                  ? `${abiertas.length} ${abiertas.length === 1 ? 'votación abierta' : 'votaciones abiertas'}`
                  : 'No hay votaciones abiertas'}
              </Text>
            </View>
            <View style={styles.heroIcono}>
              <Icon name="check" size={30} color="#fff" />
            </View>
          </LinearGradient>

          {admin ? (
            <Pressable style={[styles.card, styles.nueva]} onPress={() => setNueva(true)} accessibilityRole="button">
              <View style={styles.nuevaIcono}>
                <Icon name="edit" size={18} color={colors.oxRed} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nuevaTitulo}>Nueva votación</Text>
                <Text style={styles.nuevaTexto}>Para toda la plaza o solo algunas tiendas</Text>
              </View>
              <Icon name="chevR" size={18} color={colors.ink3} />
            </Pressable>
          ) : null}

          {abiertas.length ? (
            abiertas.map((v) => (
              <TarjetaVotacion
                key={v.id}
                v={v}
                admin={admin}
                elegida={eleccion[v.id]}
                onElegir={(o) => setEleccion((e) => ({ ...e, [v.id]: o }))}
                onVotar={() => onVotar(v)}
                onCerrar={() => onCerrar(v)}
                onBorrar={() => onBorrar(v)}
              />
            ))
          ) : (
            <Aviso titulo="Sin votaciones abiertas" texto="Cuando RH abra una votación para ti, aparecerá aquí y te llegará un aviso." icono="check" />
          )}

          {cerradas.length ? (
            <Desplegable
              titulo="Resultados"
              resumen={`${cerradas.length} ${cerradas.length === 1 ? 'votación cerrada' : 'votaciones cerradas'} en los últimos 60 días`}
              icono="chart"
            >
              {cerradas.map((v, i) => (
                <View key={v.id} style={[{ gap: 8, paddingVertical: 10 }, i < cerradas.length - 1 && styles.linea]}>
                  <Text style={styles.cerradaTitulo}>{v.titulo}</Text>
                  <Text style={styles.meta}>
                    Cerró {fechaCorta.format(v.cierraEn)} · {votosTxt(v.participantes)}
                  </Text>
                  <Resultados v={v} />
                  {admin ? (
                    <View style={styles.adminFila}>
                      <BotonChico texto="Borrar" icono="close" onPress={() => onBorrar(v)} />
                    </View>
                  ) : null}
                </View>
              ))}
            </Desplegable>
          ) : null}

          <Text style={styles.nota}>
            Tu voto es secreto: se guarda que ya votaste, pero no por quién, y nadie puede ver quién votó qué. Solo puedes votar una vez. Votaciones para
            lugares, fechas y decisiones del equipo; no son votaciones sindicales.
          </Text>
        </ScrollView>
      )}

      {pedirPin ? (
        <PinModal
          numero={numero}
          accion={pedirPin}
          onCerrar={() => setPedirPin(null)}
          onListo={(r) => {
            const p = pedirPin;
            setPedirPin(null);
            terminar(p, r);
          }}
        />
      ) : null}

      <NuevaVotacionModal
        visible={nueva}
        numero={numero}
        onClose={() => setNueva(false)}
        onPublicar={async (llave, datos) => {
          const r = await crearVotacion(llave, datos);
          if (r === 'ok') {
            setNueva(false);
            showAlert(
              'Votación publicada',
              datos.tiendas.length ? 'Ya la ven las tiendas que elegiste.' : 'Ya la ve toda la plaza y se publicó un aviso.'
            );
            recargar();
          }
          return r;
        }}
      />
    </View>
  );
}

function TarjetaVotacion({
  v,
  admin,
  elegida,
  onElegir,
  onVotar,
  onCerrar,
  onBorrar,
}: {
  v: Votacion;
  admin: boolean;
  elegida?: string;
  onElegir: (opcion: string) => void;
  onVotar: () => void;
  onCerrar: () => void;
  onBorrar: () => void;
}) {
  const puedeVotar = v.puedeVotar && !v.yaVoto;
  return (
    <View style={[styles.card, { gap: 12 }]}>
      <View style={styles.etiquetas}>
        <View style={[styles.pill, styles.pillAbierta]}>
          <View style={styles.punto} />
          <Text style={[styles.pillTexto, { color: colors.ok }]}>{cuandoCierra(v.cierraEn)}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillTexto}>{v.paraTodos ? 'Toda la plaza' : 'Algunas tiendas'}</Text>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={styles.cardTitle}>{v.titulo}</Text>
        {v.descripcion ? <Text style={styles.descripcion}>{v.descripcion}</Text> : null}
      </View>

      {puedeVotar ? (
        <>
          <View style={{ gap: 8 }}>
            {v.opciones.map((o) => {
              const activa = elegida === o.id;
              return (
                <Pressable
                  key={o.id}
                  style={[styles.opcion, activa && styles.opcionActiva]}
                  onPress={() => onElegir(o.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: activa }}
                >
                  <View style={[styles.radio, activa && styles.radioActivo]}>{activa ? <View style={styles.radioPunto} /> : null}</View>
                  <Text style={[styles.opcionTexto, activa && { color: colors.ink }]}>{o.texto}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.boton, !elegida && styles.botonApagado]}
            onPress={onVotar}
            disabled={!elegida}
            accessibilityRole="button"
          >
            <Icon name="lock" size={16} color={colors.white} />
            <Text style={styles.botonTexto}>Votar</Text>
          </Pressable>
        </>
      ) : v.yaVoto ? (
        <View style={styles.yaVoto}>
          <Icon name="check" size={18} color={colors.ok} />
          <Text style={styles.yaVotoTexto}>Ya votaste</Text>
        </View>
      ) : (
        <Text style={styles.meta}>Es para otras tiendas: tú no votas en esta.</Text>
      )}

      {v.verResultados ? (
        <View style={{ gap: 8 }}>
          {admin && !v.yaVoto ? <Text style={styles.subTitulo}>Cómo va (solo RH lo ve)</Text> : <Text style={styles.subTitulo}>Cómo va</Text>}
          <Resultados v={v} />
        </View>
      ) : v.yaVoto ? (
        <Text style={styles.meta}>Los resultados se ven cuando cierre la votación.</Text>
      ) : null}

      <View style={styles.pie}>
        <Text style={styles.meta}>{votosTxt(v.participantes)} hasta ahora</Text>
        {admin ? (
          <View style={styles.adminFila}>
            <BotonChico texto="Cerrar ahora" icono="clock" onPress={onCerrar} />
            <BotonChico texto="Borrar" icono="close" onPress={onBorrar} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Bars per option, most voted first; the winner (or tie) in red once closed.
function Resultados({ v }: { v: Votacion }) {
  const total = v.opciones.reduce((s, o) => s + (o.votos ?? 0), 0);
  const max = Math.max(0, ...v.opciones.map((o) => o.votos ?? 0));
  const filas = [...v.opciones].sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0));
  if (!total) return <Text style={styles.meta}>Nadie votó.</Text>;
  return (
    <View style={{ gap: 10 }}>
      {filas.map((o) => {
        const n = o.votos ?? 0;
        const gana = !v.abierta && n === max && n > 0;
        const pct = Math.round((n / total) * 100);
        return (
          <View key={o.id} style={{ gap: 5 }}>
            <View style={styles.resTop}>
              <Text style={[styles.resEtq, gana && { color: colors.oxRed }]} numberOfLines={2}>
                {gana ? '🏆 ' : ''}
                {o.texto}
              </Text>
              <Text style={styles.resValor}>
                {pct}% · {n}
              </Text>
            </View>
            <View style={styles.resFondo}>
              <View style={[styles.resLlena, gana && { backgroundColor: colors.oxRed }, { width: `${Math.max(2, (n / (max || 1)) * 100)}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// One-time PIN for a session from before session keys: trades it for a key
// and runs the waiting action.
function PinModal({ numero, accion, onCerrar, onListo }: { numero: string; accion: Accion; onCerrar: () => void; onListo: (r: EstadoVoto) => void }) {
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const enviar = async () => {
    if (pin.length !== 4 || enviando) return;
    setEnviando(true);
    setError('');
    try {
      const st = await obtenerLlave(numero, pin);
      if (st === 'ok') {
        onListo(await accion.hacer((await leerLlave()) ?? ''));
      } else {
        setError(MENSAJE_VOTO[st as EstadoVoto] || MENSAJE_VOTO.wrong_pin);
        setPin('');
      }
    } catch {
      setError('No pudimos conectar. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.modalFondo}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={onCerrar} />
        <BlurView intensity={36} tint="light" style={styles.hoja}>
          <View style={styles.asa} />
          <Text style={styles.hojaTitulo}>Confirma tu PIN</Text>
          <Text style={styles.descripcion}>Solo esta vez: con tu PIN la app queda lista y no te lo vuelve a pedir.</Text>
          <Text style={styles.etiqueta}>Tu PIN</Text>
          <TextInput
            style={[styles.input, styles.inputPin]}
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            placeholderTextColor={colors.ink3}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
            autoComplete="off"
            onSubmitEditing={enviar}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" style={[styles.boton, { marginTop: 16 }, pin.length !== 4 && styles.botonApagado]} onPress={enviar} disabled={pin.length !== 4 || enviando}>
            <Text style={styles.botonTexto}>{enviando ? 'Enviando…' : 'Confirmar'}</Text>
          </Pressable>
        </BlurView>
      </View>
    </Modal>
  );
}

function NuevaVotacionModal({
  visible,
  numero,
  onClose,
  onPublicar,
}: {
  visible: boolean;
  numero: string;
  onClose: () => void;
  onPublicar: (llave: string, v: NuevaVotacion) => Promise<EstadoVoto>;
}) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [opciones, setOpciones] = useState(['', '']);
  const [dias, setDias] = useState(3);
  const [soloTiendas, setSoloTiendas] = useState(false);
  const [tiendas, setTiendas] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [catalogo, setCatalogo] = useState<Tienda[]>([]);
  const [enVivo, setEnVivo] = useState(false);
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Without a session key the form asks for the PIN (only this once).
  const [sinLlave, setSinLlave] = useState(false);

  useEffect(() => {
    if (visible) leerLlave().then((l) => setSinLlave(!l));
  }, [visible]);

  useEffect(() => {
    if (soloTiendas && !catalogo.length) cargarTiendas().then(setCatalogo).catch(() => {});
  }, [soloTiendas]);

  const sugeridas = useMemo(
    () => sugerirTiendas(catalogo, busca, 6).filter((t) => !tiendas.some((x) => normalizarTienda(x) === normalizarTienda(t.tienda))),
    [catalogo, busca, tiendas]
  );
  const llenas = opciones.map((o) => o.trim()).filter(Boolean);
  const listo =
    titulo.trim().length >= 3 && llenas.length >= 2 && (!soloTiendas || tiendas.length > 0) && (!sinLlave || pin.length === 4);
  const cierre = finDelDia(dias);

  const limpiar = () => {
    setTitulo('');
    setDescripcion('');
    setOpciones(['', '']);
    setDias(3);
    setSoloTiendas(false);
    setTiendas([]);
    setBusca('');
    setEnVivo(false);
    setPin('');
    setError('');
  };

  const publicar = async () => {
    if (!listo || enviando) return;
    setEnviando(true);
    setError('');
    try {
      if (sinLlave) {
        const st = await obtenerLlave(numero, pin);
        if (st !== 'ok') {
          setError(MENSAJE_VOTO[st as EstadoVoto] || MENSAJE_VOTO.wrong_pin);
          setPin('');
          return;
        }
        setSinLlave(false);
      }
      const r = await onPublicar((await leerLlave()) ?? '', {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        opciones: llenas,
        tiendas: soloTiendas ? tiendas : [],
        cierraEn: cierre,
        enVivo,
      });
      if (r === 'ok') limpiar();
      else if (r === 'no_session') {
        await olvidarLlave();
        setSinLlave(true);
        setError(MENSAJE_VOTO.no_session);
      } else setError(MENSAJE_VOTO[r] || 'No se pudo publicar.');
    } catch {
      setError('No pudimos conectar. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalFondo}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" style={StyleSheet.absoluteFill} onPress={onClose} />
        <BlurView intensity={36} tint="light" style={[styles.hoja, { maxHeight: '90%' }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.asa} />
            <Text style={styles.hojaTitulo}>Nueva votación</Text>

            <Text style={styles.etiqueta}>Pregunta</Text>
            <TextInput
              style={styles.input}
              value={titulo}
              onChangeText={setTitulo}
              placeholder="Ej. ¿Dónde hacemos la posada?"
              placeholderTextColor={colors.ink3}
              maxLength={120}
            />

            <Text style={styles.etiqueta}>Detalle (opcional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Fecha del evento, presupuesto, lo que deban saber"
              placeholderTextColor={colors.ink3}
              multiline
              maxLength={600}
            />

            <Text style={styles.etiqueta}>Opciones</Text>
            <View style={{ gap: 8 }}>
              {opciones.map((o, i) => (
                <View key={i} style={styles.opcionEdit}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={o}
                    onChangeText={(t) => setOpciones((xs) => xs.map((x, j) => (j === i ? t : x)))}
                    placeholder={`Opción ${i + 1}`}
                    placeholderTextColor={colors.ink3}
                    maxLength={80}
                  />
                  {opciones.length > 2 ? (
                    <Pressable accessibilityRole="button"
                      style={styles.quitar}
                      onPress={() => setOpciones((xs) => xs.filter((_, j) => j !== i))}
                      accessibilityLabel={`Quitar opción ${i + 1}`}
                    >
                      <Icon name="close" size={16} color={colors.ink2} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {opciones.length < 10 ? (
                <Pressable style={styles.agregar} onPress={() => setOpciones((xs) => [...xs, ''])} accessibilityRole="button">
                  <Text style={styles.agregarTexto}>+ Agregar opción</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.etiqueta}>Cierra</Text>
            <View style={styles.chips}>
              {CIERRES.map((c) => (
                <Chip key={c.dias} texto={c.etiqueta} activo={dias === c.dias} onPress={() => setDias(c.dias)} />
              ))}
            </View>
            <Text style={[styles.meta, { marginTop: 6 }]}>{fechaHora.format(cierre)}</Text>

            <Text style={styles.etiqueta}>¿Quién vota?</Text>
            <View style={styles.chips}>
              <Chip texto="Toda la plaza" activo={!soloTiendas} onPress={() => setSoloTiendas(false)} />
              <Chip texto="Solo algunas tiendas" activo={soloTiendas} onPress={() => setSoloTiendas(true)} />
            </View>
            {soloTiendas ? (
              <View style={{ gap: 8, marginTop: 10 }}>
                {tiendas.length ? (
                  <View style={styles.chips}>
                    {tiendas.map((t) => (
                      <Pressable accessibilityRole="button" key={t} style={[styles.chip, styles.chipActivo, styles.chipQuitar]} onPress={() => setTiendas((xs) => xs.filter((x) => x !== t))}>
                        <Text style={[styles.chipTexto, { color: colors.white }]}>{t}</Text>
                        <Icon name="close" size={13} color={colors.white} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <TextInput
                  style={styles.input}
                  value={busca}
                  onChangeText={setBusca}
                  placeholder={catalogo.length ? 'Busca la tienda por nombre o CR' : 'Cargando tiendas…'}
                  placeholderTextColor={colors.ink3}
                  autoCorrect={false}
                />
                {sugeridas.map((t) => (
                  <Pressable accessibilityRole="button"
                    key={t.cr}
                    style={styles.sugerida}
                    onPress={() => {
                      setTiendas((xs) => [...xs, t.tienda]);
                      setBusca('');
                    }}
                  >
                    <Text style={styles.opcionTexto}>{t.tienda}</Text>
                    <Text style={styles.meta}>{t.cr}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={[styles.meta, { marginTop: 6 }]}>También se publica un aviso para todos.</Text>
            )}

            <Pressable style={styles.casilla} onPress={() => setEnVivo((x) => !x)} accessibilityRole="checkbox" accessibilityState={{ checked: enVivo }}>
              <View style={[styles.check, !enVivo && styles.checkVacio]}>{enVivo ? <Icon name="check" size={14} color="#fff" /> : null}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.opcionTexto}>Mostrar resultados al votar</Text>
                <Text style={styles.meta}>Si no, se ven hasta que cierre.</Text>
              </View>
            </Pressable>

            {sinLlave ? (
              <>
                <Text style={styles.etiqueta}>Tu PIN (solo esta vez)</Text>
                <TextInput
                  style={[styles.input, styles.inputPin]}
                  value={pin}
                  onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  placeholderTextColor={colors.ink3}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  autoComplete="off"
                />
              </>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable accessibilityRole="button" style={[styles.boton, { marginTop: 18 }, !listo && styles.botonApagado]} onPress={publicar} disabled={!listo || enviando}>
              <Text style={styles.botonTexto}>{enviando ? 'Publicando…' : 'Publicar votación'}</Text>
            </Pressable>
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
}

function Chip({ texto, activo, onPress }: { texto: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" style={[styles.chip, activo && styles.chipActivo]} onPress={onPress} accessibilityState={{ selected: activo }}>
      <Text style={[styles.chipTexto, activo && { color: colors.white }]}>{texto}</Text>
    </Pressable>
  );
}

function BotonChico({ texto, icono, onPress }: { texto: string; icono: string; onPress: () => void }) {
  return (
    <Pressable style={styles.botonChico} onPress={onPress} accessibilityRole="button">
      <Icon name={icono} size={13} color={colors.ink2} />
      <Text style={styles.botonChicoTexto}>{texto}</Text>
    </Pressable>
  );
}

function Aviso({ titulo, texto, icono = 'alert', accion }: { titulo: string; texto: string; icono?: string; accion?: { texto: string; onPress: () => void } }) {
  return (
    <View style={[styles.card, styles.aviso]}>
      <Icon name={icono} size={26} color={colors.oxRed} />
      <Text style={styles.avisoTitulo}>{titulo}</Text>
      <Text style={styles.avisoTexto}>{texto}</Text>
      {accion ? (
        <Pressable accessibilityRole="button" style={styles.avisoBoton} onPress={accion.onPress}>
          <Text style={styles.avisoBotonTexto}>{accion.texto}</Text>
        </Pressable>
      ) : null}
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
  cargando: { paddingVertical: 48, alignItems: 'center' },
  nota: { ...type.caption, color: colors.ink2 },
  hero: { borderRadius: 24, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, ...shadows.hero },
  heroKicker: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: 'rgba(255,255,255,.84)', textTransform: 'uppercase' },
  heroNumero: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 52, lineHeight: 60, color: colors.white },
  heroBody: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,.9)' },
  heroIcono: { width: 64, height: 64, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radii.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 16, ...shadows.card },
  cardTitle: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 17, lineHeight: 22, color: colors.ink },
  descripcion: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  meta: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: colors.ink3 },
  subTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 11.5, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.8 },
  linea: { borderBottomWidth: 1, borderBottomColor: colors.line },
  nueva: { flexDirection: 'row', alignItems: 'center', gap: 12, borderStyle: 'dashed', borderColor: '#F3B8B0', borderWidth: 1.5 },
  nuevaIcono: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF0EC', alignItems: 'center', justifyContent: 'center' },
  nuevaTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15.5, color: colors.ink },
  nuevaTexto: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, color: colors.ink2, marginTop: 2 },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.field },
  pillAbierta: { backgroundColor: '#E6F4EC' },
  pillTexto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11.5, color: colors.ink2 },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ok },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.line2,
    backgroundColor: colors.white,
  },
  opcionActiva: { borderColor: colors.oxRed, backgroundColor: '#FFF5F3' },
  opcionTexto: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: colors.ink2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  radioActivo: { borderColor: colors.oxRed },
  radioPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.oxRed },
  boton: { minHeight: 50, borderRadius: 16, backgroundColor: colors.oxRed, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  botonApagado: { opacity: 0.45 },
  botonTexto: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14.5, color: colors.white },
  yaVoto: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radii.lg, backgroundColor: '#E6F4EC' },
  yaVotoTexto: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.ok },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  adminFila: { flexDirection: 'row', gap: 6 },
  botonChico: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.white,
  },
  botonChicoTexto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: colors.ink2 },
  cerradaTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14.5, color: colors.ink },
  resTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  resEtq: { flex: 1, fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink },
  resValor: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: colors.ink2 },
  resFondo: { height: 10, borderRadius: 5, backgroundColor: colors.field, overflow: 'hidden' },
  resLlena: { height: 10, borderRadius: 5, backgroundColor: '#F6C4BE' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.line },
  chipActivo: { backgroundColor: colors.oxRed, borderColor: colors.oxRed },
  chipQuitar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipTexto: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 13, color: colors.ink2 },
  sugerida: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.line },
  modalFondo: { flex: 1, backgroundColor: 'rgba(36,26,23,.24)', justifyContent: 'flex-end', padding: 14 },
  hoja: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.96)',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    ...shadows.sheet,
  },
  asa: { alignSelf: 'center', width: 42, height: 5, borderRadius: radii.pill, backgroundColor: colors.line2, marginBottom: 14 },
  hojaTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 20, color: colors.ink, marginBottom: 8 },
  etiqueta: { ...type.label, color: colors.ink, marginBottom: 8, marginTop: 14 },
  input: {
    minHeight: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.line2,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14.5,
    color: colors.ink,
  },
  inputPin: { letterSpacing: 8, fontSize: 20, textAlign: 'center' },
  opcionEdit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quitar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.field },
  agregar: { paddingVertical: 10, alignItems: 'center', borderRadius: radii.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  agregarTexto: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13.5, color: colors.oxRed },
  casilla: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  check: { width: 22, height: 22, borderRadius: 7, backgroundColor: colors.oxRed, alignItems: 'center', justifyContent: 'center' },
  checkVacio: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.line2 },
  error: { ...type.caption, color: colors.oxRed, marginTop: 10 },
  aviso: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  avisoTitulo: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.ink, textAlign: 'center' },
  avisoTexto: { ...type.caption, color: colors.ink2, textAlign: 'center' },
  avisoBoton: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.oxRed },
  avisoBotonTexto: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13.5, color: colors.white },
});
