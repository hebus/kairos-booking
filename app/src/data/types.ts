export interface Appointment {
  id: string;
  client_id: string;
  day: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: 'confirmed' | 'cancelled';
  seen_by_admin: boolean;
  created_at: string;
}

export interface Slot {
  start: string; // HH:MM
  end: string;
}

export type DayMode = 'full' | 'slots';

export interface TimeRange {
  start_time: string; // HH:MM
  end_time: string;
}

export interface DayConfig {
  weekday: number; // 0 = dimanche … 6 = samedi
  worked: boolean;
  mode: DayMode;
  start_time: string; // HH:MM
  end_time: string;
  slots: TimeRange[];
}
