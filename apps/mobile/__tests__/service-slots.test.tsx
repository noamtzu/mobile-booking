import { screen, waitFor } from '@testing-library/react-native';
import ServiceSlotsScreen from '@/app/service/[id]';
import { ApiError, api } from '@/lib/api';
import { makeBooking, makeService, makeSlot, renderScreen } from '../test/render';
import { router, useLocalSearchParams } from '../test/expo-router-mock';

const mockApi = jest.mocked(api);
const service = makeService({ name: 'Coaching session' });

// Tests run with TZ=UTC (see test/global-setup.js).
const monday9 = makeSlot(service.id, '2030-01-07T09:00:00.000Z');
const monday10 = makeSlot(service.id, '2030-01-07T10:00:00.000Z', { available: false });
const tuesday14 = makeSlot(service.id, '2030-01-08T14:00:00.000Z');

beforeEach(() => {
  useLocalSearchParams.mockReturnValue({ id: service.id });
  mockApi.service.mockResolvedValue(service);
});

describe('Slot picker', () => {
  it('groups slots by local day and marks booked times', async () => {
    mockApi.slots.mockResolvedValue([monday9, monday10, tuesday14]);
    await renderScreen(<ServiceSlotsScreen />);

    expect(await screen.findByText('Mon, Jan 7')).toBeOnTheScreen();
    expect(screen.getByText('Tue, Jan 8')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '9:00 AM' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '10:00 AM, booked' })).toBeDisabled();
    expect(screen.getByText('Times are shown in your time zone (UTC).')).toBeOnTheScreen();
  });

  it('books the selected time and opens the confirmation', async () => {
    mockApi.slots.mockResolvedValue([monday9, tuesday14]);
    const booking = makeBooking(service, monday9.startsAt);
    mockApi.book.mockResolvedValue(booking);
    const { user } = await renderScreen(<ServiceSlotsScreen />);

    await user.press(await screen.findByRole('button', { name: '9:00 AM' }));
    expect(screen.getByText('Mon, Jan 7, 9:00 AM')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Book this time' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/booking/${booking.id}`));
    expect(mockApi.book.mock.calls[0]?.[0]).toBe(monday9.id);
  });

  it('explains when someone else got the slot first and refreshes the list', async () => {
    mockApi.slots.mockResolvedValue([monday9]);
    mockApi.book.mockRejectedValue(new ApiError(409, 'SLOT_TAKEN', 'Someone just booked this slot.'));
    const { user } = await renderScreen(<ServiceSlotsScreen />);

    await user.press(await screen.findByRole('button', { name: '9:00 AM' }));
    await user.press(screen.getByRole('button', { name: 'Book this time' }));

    expect(await screen.findByText('Someone just booked that time. Please pick another.')).toBeOnTheScreen();
    await waitFor(() => expect(mockApi.slots).toHaveBeenCalledTimes(2));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('shows an empty state when everything is booked', async () => {
    mockApi.slots.mockResolvedValue([monday10]);
    await renderScreen(<ServiceSlotsScreen />);
    expect(await screen.findByText('No open times')).toBeOnTheScreen();
  });
});
