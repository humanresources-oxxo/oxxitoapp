export type PreferenceKey = 'push' | 'privacy' | 'biometric';

export const employeeProfile = {
  name: 'Juan Perez',
  role: 'Colaborador de tienda',
  store: 'Oxxito Plaza Oaxaca',
  employeeId: '123456',
  area: 'Operacion',
  since: 'Mar 2024',
};

export const profileSettings: Array<{
  key: PreferenceKey;
  title: string;
  desc: string;
  icon: string;
}> = [
  {
    key: 'push',
    title: 'Notificaciones',
    desc: 'Recibir avisos importantes de reglamento y turnos.',
    icon: 'bell',
  },
  {
    key: 'privacy',
    title: 'Privacidad reforzada',
    desc: 'Ocultar contenido sensible al volver a abrir la app.',
    icon: 'shieldCheck',
  },
  {
    key: 'biometric',
    title: 'Acceso rapido',
    desc: 'Usar biometria cuando el dispositivo lo permita.',
    icon: 'fingerprint',
  },
];
