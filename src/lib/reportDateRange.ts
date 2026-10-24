const INDIA_OFFSET_MS = 330 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function parseReportCustomRange(from: string | null, to: string | null) {
  if (!from || !to) return null;
  const calendarStartDate = parseCalendarDate(from);
  const lastCalendarDate = parseCalendarDate(to);
  if (!calendarStartDate || !lastCalendarDate || calendarStartDate > lastCalendarDate) return null;

  const calendarEndDate = new Date(lastCalendarDate.getTime() + DAY_MS);
  return {
    startDate: new Date(calendarStartDate.getTime() - INDIA_OFFSET_MS),
    endDate: new Date(calendarEndDate.getTime() - INDIA_OFFSET_MS),
    calendarStartDate,
    calendarEndDate,
  };
}
