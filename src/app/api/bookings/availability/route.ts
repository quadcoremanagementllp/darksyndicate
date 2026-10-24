import { NextRequest } from 'next/server';
import { getStationAvailability } from '@/services/availability.service';
import { apiSuccess, handleApiError, ValidationError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stationId = searchParams.get('stationId');
    const zone = searchParams.get('zone');
    const date = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration') || '60', 10);
    const startTime = searchParams.get('startTime');

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ValidationError('A valid date in YYYY-MM-DD format is required');
    }
    if (!Number.isInteger(duration) || duration < 30 || duration > 720) {
      throw new ValidationError('Duration must be between 30 and 720 minutes');
    }
    if (startTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
      throw new ValidationError('A valid custom time in HH:mm format is required');
    }

    const availability = await getStationAvailability(stationId, date, duration, zone, startTime);

    return apiSuccess(availability);
  } catch (error) {
    return handleApiError(error);
  }
}
