// src/components/PinDeSesion.tsx
// For screens that read DashboardsOxxo data through the Apps Script with the
// session key (services/gviz.ts leerDatos): when it rejects the session
// (SIN_SESION), the error card asks for the PIN once and the screen retries.
import React, { useEffect, useState } from 'react';
import { PinUnaVez } from './PinUnaVez';
import { getJson, storageKeys } from '../services/appStorage';
import { esSinSesion } from '../services/sesion';

type Aviso = { titulo: string; texto: string; accion: { texto: string; onPress: () => void } };

export function usePinDeSesion(reintentar: () => void) {
  const [numero, setNumero] = useState('');
  const [abierto, setAbierto] = useState(false);
  // PIN already confirmed here: if the server still rejects the session, the
  // problem is on its side (it couldn't check it), not the PIN.
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    getJson<{ numeroEmpleado?: string } | null>(storageKeys.session, null).then((s) => setNumero(s?.numeroEmpleado ?? ''));
  }, []);

  // The card for a load error: the PIN one when the session was the problem,
  // otherwise `normal`.
  const aviso = (error: unknown, normal: Aviso): Aviso => {
    if (!esSinSesion(error)) return normal;
    if (confirmado) {
      return {
        titulo: 'No pudimos verificar tu sesión',
        texto: 'Tu PIN es correcto, pero el servidor no pudo confirmar tu sesión. Avisa a RH o a Soporte de la App e intenta más tarde.',
        accion: { texto: 'Reintentar', onPress: reintentar },
      };
    }
    return { titulo: 'Confirma tu PIN', texto: 'Para ver esta información, confirma tu PIN una vez.', accion: { texto: 'Confirmar PIN', onPress: () => setAbierto(true) } };
  };

  const modal = abierto ? (
    <PinUnaVez
      numero={numero}
      onCerrar={() => setAbierto(false)}
      onListo={() => {
        setAbierto(false);
        setConfirmado(true);
        reintentar();
      }}
    />
  ) : null;

  return { aviso, modal };
}
