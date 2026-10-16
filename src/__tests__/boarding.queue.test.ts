import { parseDriverPack, parsePassengerPack, parseSyncAnswers } from '../boarding/parsers';
import { BACKOFF_MS, MemoryQueueStorage, SyncQueue } from '../boarding/queue';
import type { SyncAnswer, SyncEvent } from '../boarding/types';

describe('pack parsers', () => {
  it('reads the passenger pack and falls back to the support number', () => {
    const pack = parsePassengerPack(
      {
        booking_id: 'bk-1',
        ride_id: 'ride-1',
        pack_version: 'v3',
        key: { alg: 'Ed25519', kid: 'k1', public_key: 'abc', token_prefix: 'S2G1' },
        my_qr: 'S2G1.x.y',
        boarding_code: '7788',
        driver: {
          user_id: 'drv-1',
          name: 'Chinedu.O',
          verified: true,
          photo: null,
          vehicle: { make: 'Toyota', model: 'Sienna', colour: 'Silver', plate: 'KJA-482LS' },
        },
        boarding: { boarded: false, held_for_review: false },
      },
      120,
    );
    expect(pack.driver.vehicle.plate).toBe('KJA-482LS');
    expect(pack.supportPhone).toBe('+2349053451158');
    expect(pack.clockOffsetSeconds).toBe(120);
    expect(pack.boarding.boarded).toBe(false);
  });

  it('reads the driver pack passengers', () => {
    const pack = parseDriverPack({
      ride_id: 'ride-1',
      trip_qr: 'S2G1.t.s',
      support_phone: '+2340000',
      passengers: [
        {
          booking_id: 'bk-1',
          passenger_id: 'pax-1',
          passenger_name: 'Aisha.B',
          children: 2,
          driver_code: '4821',
        },
      ],
    });
    expect(pack.passengers[0]).toMatchObject({
      bookingId: 'bk-1',
      name: 'Aisha.B',
      children: 2,
      driverCode: '4821',
    });
    expect(pack.supportPhone).toBe('+2340000');
  });

  it('maps sync answers and treats unknown statuses as refused', () => {
    expect(
      parseSyncAnswers({
        events: [
          { event_id: 'a', status: 'applied' },
          { event_id: 'b', status: 'refused', error: 'qr_invalid' },
          { event_id: 'c', status: 'weird' },
        ],
      }),
    ).toEqual([
      { eventId: 'a', status: 'applied', error: null },
      { eventId: 'b', status: 'refused', error: 'qr_invalid' },
      { eventId: 'c', status: 'refused', error: null },
    ]);
  });
});

describe('SyncQueue', () => {
  const event = {
    bookingId: 'bk-1',
    side: 'passenger' as const,
    scanned: 'S2G1.x.y',
    faceMatched: true,
  };

  it('keeps events until the server confirms them, then drops them', async () => {
    const storage = new MemoryQueueStorage();
    const sent: SyncEvent[][] = [];
    const q = new SyncQueue(storage, async (events) => {
      sent.push(events);
      return events.map<SyncAnswer>((e) => ({
        eventId: e.eventId,
        status: 'applied',
        error: null,
      }));
    });
    await q.add(event);
    await q.add({ ...event, faceMatched: false, reason: 'Different person' });
    expect((await q.pending()).length).toBe(2);
    expect(await q.flush()).toBeNull();
    expect(sent[0]?.length).toBe(2);
    expect(sent[0]?.[1]?.reason).toBe('Different person');
    expect(await q.pending()).toEqual([]);
  });

  it('backs off after a failed send and retries later', async () => {
    const storage = new MemoryQueueStorage();
    let fail = true;
    const q = new SyncQueue(storage, async (events) => {
      if (fail) throw new Error('offline');
      return events.map<SyncAnswer>((e) => ({
        eventId: e.eventId,
        status: 'duplicate',
        error: null,
      }));
    });
    await q.add(event);
    expect(await q.flush()).toBe(BACKOFF_MS[0]);
    expect(await q.flush()).toBe(BACKOFF_MS[1]);
    expect((await q.pending()).length).toBe(1);
    fail = false;
    expect(await q.flush()).toBeNull();
  });

  it('drops refused events too (never resend) and keeps unanswered ones', async () => {
    const storage = new MemoryQueueStorage();
    const q = new SyncQueue(storage, async (events) => [
      { eventId: events[0]?.eventId ?? '', status: 'refused', error: 'not_found' },
    ]);
    await q.add(event);
    await q.add(event);
    await q.flush();
    expect((await q.pending()).length).toBe(1);
  });
});
