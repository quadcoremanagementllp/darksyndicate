export function to24HourTime(hour12: number, minute: number, period: 'AM' | 'PM'): string | null {
  if (!Number.isInteger(hour12) || hour12 < 1 || hour12 > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }

  const hour24 = (hour12 % 12) + (period === 'PM' ? 12 : 0);
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function bookingEndTime(startTime: string, durationMinutes: number): { time: string; nextDay: boolean } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(startTime);
  if (!match || !Number.isInteger(durationMinutes) || durationMinutes <= 0) return null;

  const endMinutes = Number(match[1]) * 60 + Number(match[2]) + durationMinutes;
  const timeInDay = endMinutes % 1440;
  return {
    time: `${String(Math.floor(timeInDay / 60)).padStart(2, '0')}:${String(timeInDay % 60).padStart(2, '0')}`,
    nextDay: endMinutes >= 1440,
  };
}
