import { screen } from '@testing-library/react-native';
import BookingConfirmationScreen from '@/app/booking/[id]';
import { api } from '@/lib/api';
import { scheduleBookingReminder } from '@/lib/notifications';
import { makeBooking, makeService, renderScreen } from '../test/render';
import { router, useLocalSearchParams } from '../test/expo-router-mock';

const mockApi = jest.mocked(api);
const service = makeService({ name: 'Coaching session' });
const booking = makeBooking(service, '2030-01-07T09:00:00.000Z');

beforeEach(() => {
  useLocalSearchParams.mockReturnValue({ id: booking.id });
  mockApi.booking.mockResolvedValue(booking);
});

describe('Booking confirmation', () => {
  it('shows the booking in local time', async () => {
    await renderScreen(<BookingConfirmationScreen />);
    expect(await screen.findByText("You're booked")).toBeOnTheScreen();
    expect(screen.getByText('Mon, Jan 7 · 9:00 AM to 10:00 AM')).toBeOnTheScreen();
  });

  it('schedules a local reminder', async () => {
    jest.mocked(scheduleBookingReminder).mockResolvedValue('scheduled');
    const { user } = await renderScreen(<BookingConfirmationScreen />);

    await user.press(await screen.findByRole('button', { name: 'Remind me 1 hour before' }));
    expect(await screen.findByText("Reminder set. We'll notify you 1 hour before.")).toBeOnTheScreen();
    expect(scheduleBookingReminder).toHaveBeenCalledWith(booking);
  });

  it('explains when notifications are turned off', async () => {
    jest.mocked(scheduleBookingReminder).mockResolvedValue('denied');
    const { user } = await renderScreen(<BookingConfirmationScreen />);
    await user.press(await screen.findByRole('button', { name: 'Remind me 1 hour before' }));
    expect(await screen.findByText(/Notifications are turned off/)).toBeOnTheScreen();
  });

  it('returns to My bookings', async () => {
    const { user } = await renderScreen(<BookingConfirmationScreen />);
    await user.press(await screen.findByRole('button', { name: 'Done' }));
    expect(router.replace).toHaveBeenCalledWith('/bookings');
  });
});
