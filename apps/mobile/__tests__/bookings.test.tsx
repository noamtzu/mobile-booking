import { screen, waitFor } from '@testing-library/react-native';
import BookingsScreen from '@/app/(tabs)/bookings';
import { api } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { makeBooking, makeService, renderScreen } from '../test/render';
import { router } from '../test/expo-router-mock';

jest.mock('@/lib/confirm', () => ({ confirmAction: jest.fn() }));

const mockApi = jest.mocked(api);
const mockConfirm = jest.mocked(confirmAction);
const service = makeService({ name: 'Coaching session' });

describe('My bookings', () => {
  it('shows an empty state that leads back to services', async () => {
    mockApi.bookings.mockResolvedValue([]);
    const { user } = await renderScreen(<BookingsScreen />);

    await user.press(await screen.findByRole('button', { name: 'Browse services' }));
    expect(router.navigate).toHaveBeenCalledWith('/');
  });

  it('splits upcoming from past and cancelled bookings', async () => {
    mockApi.bookings.mockResolvedValue([
      makeBooking(service, '2030-01-07T09:00:00.000Z'),
      makeBooking(service, '2020-01-07T09:00:00.000Z'),
      makeBooking(service, '2030-02-01T09:00:00.000Z', { status: 'cancelled' }),
    ]);
    await renderScreen(<BookingsScreen />);

    expect(await screen.findByText('Upcoming')).toBeOnTheScreen();
    expect(screen.getByText('Past and cancelled')).toBeOnTheScreen();
    expect(screen.getByText('Cancelled')).toBeOnTheScreen();
    // Only the upcoming confirmed booking can be cancelled.
    expect(screen.getAllByRole('button', { name: /^Cancel / })).toHaveLength(1);
  });

  it('cancels after the user confirms', async () => {
    const booking = makeBooking(service, '2030-01-07T09:00:00.000Z');
    mockApi.bookings.mockResolvedValue([booking]);
    mockApi.cancel.mockResolvedValue({ ...booking, status: 'cancelled' });
    mockConfirm.mockResolvedValue(true);
    const { user } = await renderScreen(<BookingsScreen />);

    await user.press(await screen.findByRole('button', { name: 'Cancel Coaching session, Mon, Jan 7 · 9:00 AM' }));

    await waitFor(() => expect(mockApi.cancel.mock.calls[0]?.[0]).toBe(booking.id));
    expect(await screen.findByText('Cancelled')).toBeOnTheScreen();
  });

  it('does nothing when the user keeps the booking', async () => {
    mockApi.bookings.mockResolvedValue([makeBooking(service, '2030-01-07T09:00:00.000Z')]);
    mockConfirm.mockResolvedValue(false);
    const { user } = await renderScreen(<BookingsScreen />);

    await user.press(await screen.findByRole('button', { name: /^Cancel / }));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockApi.cancel).not.toHaveBeenCalled();
  });
});
