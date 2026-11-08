import type { Service } from '@booking/shared';
import { act, screen } from '@testing-library/react-native';
import ServicesScreen from '@/app/(tabs)/index';
import { ApiError, api } from '@/lib/api';
import { makeService, renderScreen } from '../test/render';
import { router } from '../test/expo-router-mock';

const mockApi = jest.mocked(api);

describe('Services screen', () => {
  it('shows a loading state, then the services', async () => {
    let respond: (services: Service[]) => void = () => {};
    mockApi.services.mockReturnValue(new Promise((resolve) => (respond = resolve)));
    await renderScreen(<ServicesScreen />);

    expect(screen.getByLabelText('Loading services')).toBeOnTheScreen();
    await act(async () =>
      respond([makeService({ name: 'Intro call', durationMinutes: 30, priceCents: 0 }), makeService({ name: 'Coaching session' })]),
    );
    expect(await screen.findByText('Intro call')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Intro call, 30 min · Free' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Coaching session, 1 h · $90.00' })).toBeOnTheScreen();
  });

  it('shows an empty state when there are no services', async () => {
    mockApi.services.mockResolvedValue([]);
    await renderScreen(<ServicesScreen />);
    expect(await screen.findByText('No services yet')).toBeOnTheScreen();
  });

  it('shows an error with a working retry', async () => {
    mockApi.services
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection and try again."))
      .mockResolvedValueOnce([makeService({ name: 'Intro call' })]);
    const { user } = await renderScreen(<ServicesScreen />);

    expect(await screen.findByText("Can't reach the server. Check your connection and try again.")).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Intro call')).toBeOnTheScreen();
  });

  it('opens the slot picker for a service', async () => {
    const service = makeService({ name: 'Intro call', priceCents: 0, durationMinutes: 30 });
    mockApi.services.mockResolvedValue([service]);
    const { user } = await renderScreen(<ServicesScreen />);

    await user.press(await screen.findByRole('button', { name: 'Intro call, 30 min · Free' }));
    expect(router.push).toHaveBeenCalledWith(`/service/${service.id}`);
  });
});
