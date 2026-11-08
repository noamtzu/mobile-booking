import { groupSlotsByDay } from '@/lib/slots';
import { makeService, makeSlot } from '../test/render';

describe('groupSlotsByDay', () => {
  const service = makeService();
  const lateEvening = makeSlot(service.id, '2030-01-07T23:30:00.000Z');
  const nextMorning = makeSlot(service.id, '2030-01-08T09:00:00.000Z');

  it('puts a late UTC slot on the next local day east of UTC', () => {
    const days = groupSlotsByDay([lateEvening, nextMorning], 'Asia/Tokyo', 'en-US');
    expect(days).toHaveLength(1);
    expect(days[0]?.label).toBe('Tue, Jan 8');
  });

  it('keeps them on separate days in New York', () => {
    const days = groupSlotsByDay([lateEvening, nextMorning], 'America/New_York', 'en-US');
    expect(days.map((d) => d.label)).toEqual(['Mon, Jan 7', 'Tue, Jan 8']);
  });
});
