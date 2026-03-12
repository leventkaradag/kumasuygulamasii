import type {
  SummaryBucketMeta,
  SummaryDateRange,
  SummaryRangePreset,
  SummaryTimeScale,
} from "@/lib/summary/summaryTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

const createDate = (
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  milliseconds: number
) => new Date(year, month, day, hours, minutes, seconds, milliseconds);

export const startOfDay = (date: Date) =>
  createDate(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

export const endOfDay = (date: Date) =>
  createDate(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

export const startOfMonth = (date: Date) =>
  createDate(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);

export const endOfMonth = (date: Date) =>
  createDate(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

export const startOfYear = (date: Date) =>
  createDate(date.getFullYear(), 0, 1, 0, 0, 0, 0);

export const endOfYear = (date: Date) =>
  createDate(date.getFullYear(), 11, 31, 23, 59, 59, 999);

export const addDays = (date: Date, amount: number) =>
  createDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + amount,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );

export const addMonths = (date: Date, amount: number) =>
  createDate(
    date.getFullYear(),
    date.getMonth() + amount,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );

export const addYears = (date: Date, amount: number) =>
  createDate(
    date.getFullYear() + amount,
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );

export const normalizeDateRange = (range: SummaryDateRange): SummaryDateRange => {
  if (range.start.getTime() <= range.end.getTime()) return range;
  return { start: range.end, end: range.start };
};

export const buildRangeForPreset = (
  preset: SummaryRangePreset,
  referenceDate = new Date()
): SummaryDateRange => {
  const todayEnd = endOfDay(referenceDate);

  switch (preset) {
    case "THIS_MONTH":
      return {
        start: startOfMonth(referenceDate),
        end: todayEnd,
      };
    case "PREVIOUS_MONTH": {
      const previousMonth = addMonths(referenceDate, -1);
      return {
        start: startOfMonth(previousMonth),
        end: endOfMonth(previousMonth),
      };
    }
    case "LAST_3_MONTHS":
      return {
        start: startOfMonth(addMonths(referenceDate, -2)),
        end: todayEnd,
      };
    case "LAST_12_MONTHS":
      return {
        start: startOfMonth(addMonths(referenceDate, -11)),
        end: todayEnd,
      };
    case "THIS_YEAR":
      return {
        start: startOfYear(referenceDate),
        end: todayEnd,
      };
    case "CUSTOM":
    default:
      return {
        start: startOfMonth(referenceDate),
        end: todayEnd,
      };
  }
};

export const shiftDateRange = (
  range: SummaryDateRange,
  preset: SummaryRangePreset,
  direction: -1 | 1
): SummaryDateRange => {
  switch (preset) {
    case "THIS_MONTH":
    case "PREVIOUS_MONTH":
      return {
        start: startOfMonth(addMonths(range.start, direction)),
        end: endOfMonth(addMonths(range.end, direction)),
      };
    case "LAST_3_MONTHS":
      return {
        start: startOfMonth(addMonths(range.start, direction * 3)),
        end: endOfDay(addMonths(range.end, direction * 3)),
      };
    case "LAST_12_MONTHS":
      return {
        start: startOfMonth(addMonths(range.start, direction * 12)),
        end: endOfDay(addMonths(range.end, direction * 12)),
      };
    case "THIS_YEAR":
      return {
        start: startOfYear(addYears(range.start, direction)),
        end: endOfYear(addYears(range.end, direction)),
      };
    case "CUSTOM":
    default: {
      const normalized = normalizeDateRange(range);
      const spanDays =
        Math.max(
          1,
          Math.round(
            (endOfDay(normalized.end).getTime() - startOfDay(normalized.start).getTime()) / DAY_MS
          ) + 1
        ) * direction;

      return {
        start: startOfDay(addDays(normalized.start, spanDays)),
        end: endOfDay(addDays(normalized.end, spanDays)),
      };
    }
  }
};

export const formatDateInputValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const parseDateInputValue = (value: string): Date | null => {
  const trimmed = value.trim();
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const parsed = createDate(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const isDateInRange = (value: Date | string, range: SummaryDateRange) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const normalized = normalizeDateRange(range);
  const timestamp = date.getTime();
  return (
    timestamp >= startOfDay(normalized.start).getTime() &&
    timestamp <= endOfDay(normalized.end).getTime()
  );
};

const formatMonthLong = (date: Date) =>
  date.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

const formatMonthShort = (date: Date) =>
  date.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });

const formatDayLong = (date: Date) =>
  date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatDayShort = (date: Date) =>
  date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });

export const formatRangeLabel = (range: SummaryDateRange, scale: SummaryTimeScale) => {
  const normalized = normalizeDateRange(range);

  if (scale === "DAY") {
    return `${formatDayLong(normalized.start)} - ${formatDayLong(normalized.end)}`;
  }
  if (scale === "MONTH") {
    return `${formatMonthLong(normalized.start)} - ${formatMonthLong(normalized.end)}`;
  }
  return `${normalized.start.getFullYear()} - ${normalized.end.getFullYear()}`;
};

export const getBucketKey = (date: Date, scale: SummaryTimeScale) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (scale === "DAY") {
    return `${date.getFullYear()}-${month}-${day}`;
  }
  if (scale === "MONTH") {
    return `${date.getFullYear()}-${month}`;
  }
  return `${date.getFullYear()}`;
};

export const createTimeBuckets = (
  range: SummaryDateRange,
  scale: SummaryTimeScale
): SummaryBucketMeta[] => {
  const normalized = normalizeDateRange(range);
  const buckets: SummaryBucketMeta[] = [];

  let cursor =
    scale === "DAY"
      ? startOfDay(normalized.start)
      : scale === "MONTH"
        ? startOfMonth(normalized.start)
        : startOfYear(normalized.start);

  const limit =
    scale === "DAY"
      ? startOfDay(normalized.end)
      : scale === "MONTH"
        ? startOfMonth(normalized.end)
        : startOfYear(normalized.end);

  while (cursor.getTime() <= limit.getTime()) {
    const bucketStart =
      scale === "DAY"
        ? startOfDay(cursor)
        : scale === "MONTH"
          ? startOfMonth(cursor)
          : startOfYear(cursor);
    const bucketEnd =
      scale === "DAY"
        ? endOfDay(cursor)
        : scale === "MONTH"
          ? endOfMonth(cursor)
          : endOfYear(cursor);

    buckets.push({
      key: getBucketKey(cursor, scale),
      label:
        scale === "DAY"
          ? formatDayLong(cursor)
          : scale === "MONTH"
            ? formatMonthLong(cursor)
            : String(cursor.getFullYear()),
      shortLabel:
        scale === "DAY"
          ? formatDayShort(cursor)
          : scale === "MONTH"
            ? formatMonthShort(cursor)
            : String(cursor.getFullYear()),
      start: bucketStart,
      end: bucketEnd,
    });

    cursor =
      scale === "DAY"
        ? addDays(cursor, 1)
        : scale === "MONTH"
          ? addMonths(cursor, 1)
          : addYears(cursor, 1);
  }

  return buckets;
};

export const clampShare = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};
