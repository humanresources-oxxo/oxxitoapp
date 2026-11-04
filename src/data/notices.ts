export type NoticeKind = 'policy' | 'training' | 'schedule' | 'benefit' | 'vote';
export type NoticeFilter = 'all' | 'unread' | NoticeKind;

// Image of an aviso (migration 36): size only; the data loads apart
// (services/notices.ts cargarImagenAviso).
export type NoticeImage = { id: string; width: number; height: number };

export type Notice = {
  id: string;
  title: string;
  body: string;
  date: string;
  kind: NoticeKind;
  read: boolean;
  priority?: boolean;
  images?: NoticeImage[];
};

export const noticeKindMeta: Record<
  NoticeKind,
  { label: string; icon: string; accent: 'oxGrad' | 'blue' | 'green' | 'purple' }
> = {
  policy: { label: 'Política', icon: 'doc', accent: 'oxGrad' },
  training: { label: 'Capacitación', icon: 'book', accent: 'blue' },
  schedule: { label: 'Turnos', icon: 'calendar', accent: 'green' },
  benefit: { label: 'Beneficio', icon: 'gift', accent: 'purple' },
  // Published automatically when RH opens a votación for everyone.
  vote: { label: 'Votación', icon: 'check', accent: 'green' },
};

export const noticeFilters: Array<{ key: NoticeFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'unread', label: 'Sin leer' },
  { key: 'policy', label: 'Políticas' },
  { key: 'training', label: 'Capacitación' },
  { key: 'schedule', label: 'Turnos' },
  { key: 'benefit', label: 'Beneficios' },
  { key: 'vote', label: 'Votaciones' },
];
