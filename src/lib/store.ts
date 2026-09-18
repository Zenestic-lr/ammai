// Simple localStorage storage for history + reminders (this phone only).

export type Answer = {
  title: string;
  steps: string[];
  spoken: string;
  videoQuery: string;
};

export type HistoryItem = Answer & {
  id: string;
  question: string;
  at: number;
};

export type Reminder = {
  id: string;
  text: string;
  time: string;
  done: boolean;
  at: number;
};

const HISTORY_KEY = "amma_history_v1";
const REMINDER_KEY = "amma_reminders_v1";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadHistory = () => read<HistoryItem>(HISTORY_KEY);
export const saveHistory = (items: HistoryItem[]) => write(HISTORY_KEY, items.slice(0, 50));
export const loadReminders = () => read<Reminder>(REMINDER_KEY);
export const saveReminders = (items: Reminder[]) => write(REMINDER_KEY, items);

export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const youtubeSearchUrl = (query: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} தமிழ்`)}`;
