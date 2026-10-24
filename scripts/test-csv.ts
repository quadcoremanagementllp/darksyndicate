import assert from 'node:assert/strict';
import { serializeCsv } from '../src/lib/csv';

assert.equal(
  serializeCsv([['Name', 'Amount'], ['A, B', 100], ['=SUM(1,2)', 'quoted "value"']]),
  'Name,Amount\r\n"A, B",100\r\n"\'=SUM(1,2)","quoted ""value"""',
);
console.log('CSV serialization passed');
