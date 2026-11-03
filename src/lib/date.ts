import type { ISODate } from "@/lib/domain/types";

const TZ = "Asia/Seoul";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 오늘 날짜 (Asia/Seoul) */
export function todayKST(): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toUTC(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

/** b - a (일) */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

/** 월요일 시작 주의 첫날 */
export function startOfWeek(date: ISODate): ISODate {
  const dow = toUTC(date).getUTCDay(); // 0=일
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export function weekDates(date: ISODate): ISODate[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function weekdayLabel(date: ISODate): string {
  return WEEKDAYS[toUTC(date).getUTCDay()];
}

export function dayOfMonth(date: ISODate): number {
  return toUTC(date).getUTCDate();
}

export function monthOf(date: ISODate): number {
  return toUTC(date).getUTCMonth() + 1;
}

/** 11월 3일 화요일 */
export function formatLongDate(date: ISODate): string {
  return `${monthOf(date)}월 ${dayOfMonth(date)}일 ${weekdayLabel(date)}요일`;
}

/** 11/3 (화) */
export function formatShortDate(date: ISODate): string {
  return `${monthOf(date)}/${dayOfMonth(date)} (${weekdayLabel(date)})`;
}

/** 11/3 */
export function formatMD(date: ISODate): string {
  return `${monthOf(date)}/${dayOfMonth(date)}`;
}

export function isSameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function isISODate(v: string | null | undefined): v is ISODate {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toUTC(v).getTime());
}

/** 오늘 기준 상대 표현: 오늘, 내일, 어제, 11/5 (수) */
export function relativeDayLabel(date: ISODate, today: ISODate): string {
  const d = diffDays(today, date);
  if (d === 0) return "오늘";
  if (d === 1) return "내일";
  if (d === -1) return "어제";
  return formatShortDate(date);
}
