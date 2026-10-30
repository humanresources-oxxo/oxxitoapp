export type PreferenceKey = 'push' | 'privacy' | 'biometric';

export const employeeProfile = {
  name: 'Juan Perez',
  role: 'Colaborador de tienda',
  store: 'Conoxxo Plaza Oaxaca',
  employeeId: '123456',
  area: 'Operación',
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
    title: 'Acceso rápido',
    desc: 'Usar biometría cuando el dispositivo lo permita.',
    icon: 'fingerprint',
  },
];
