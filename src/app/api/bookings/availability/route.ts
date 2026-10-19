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

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ValidationError('A valid date in YYYY-MM-DD format is required');
    }

    const availability = await getStationAvailability(stationId, date, duration, zone);

    return apiSuccess(availability);
  } catch (error) {
    return handleApiError(error);
  }
}
