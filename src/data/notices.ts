export type NoticeKind = 'policy' | 'training' | 'schedule' | 'benefit';
export type NoticeFilter = 'all' | 'unread' | NoticeKind;

export type Notice = {
  id: string;
  title: string;
  body: string;
  date: string;
  kind: NoticeKind;
  read: boolean;
  priority?: boolean;
};

export const noticeKindMeta: Record<
  NoticeKind,
  { label: string; icon: string; accent: 'oxGrad' | 'blue' | 'green' | 'purple' }
> = {
  policy: { label: 'Política', icon: 'doc', accent: 'oxGrad' },
  training: { label: 'Capacitación', icon: 'book', accent: 'blue' },
  schedule: { label: 'Turnos', icon: 'calendar', accent: 'green' },
  benefit: { label: 'Beneficio', icon: 'gift', accent: 'purple' },
};

export const noticeFilters: Array<{ key: NoticeFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'unread', label: 'Sin leer' },
  { key: 'policy', label: 'Políticas' },
  { key: 'training', label: 'Capacitación' },
  { key: 'schedule', label: 'Turnos' },
];
