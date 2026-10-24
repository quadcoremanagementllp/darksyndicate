import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReportCustomRange } from '../src/lib/reportDateRange';

test('custom report range includes both India calendar dates', () => {
  const range = parseReportCustomRange('2026-10-24', '2026-10-25');
  assert.ok(range);
  assert.equal(range.startDate.toISOString(), '2026-10-23T18:30:00.000Z');
  assert.equal(range.endDate.toISOString(), '2026-10-25T18:30:00.000Z');
  assert.equal(range.calendarStartDate.toISOString(), '2026-10-24T00:00:00.000Z');
  assert.equal(range.calendarEndDate.toISOString(), '2026-10-26T00:00:00.000Z');
});

test('custom report range rejects invalid and reversed dates', () => {
  assert.equal(parseReportCustomRange('2026-02-30', '2026-03-01'), null);
  assert.equal(parseReportCustomRange('2026-10-25', '2026-10-24'), null);
  assert.equal(parseReportCustomRange('', '2026-10-24'), null);
});
