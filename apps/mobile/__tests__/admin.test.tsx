import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AdminScreen from '@/app/(tabs)/admin';
import { api } from '@/lib/api';
import { serviceFormSchema } from '@/lib/forms';
import { admin, makeService, renderScreen } from '../test/render';

const mockApi = jest.mocked(api);

describe('Admin screen', () => {
  it('is closed to customers', async () => {
    await renderScreen(<AdminScreen />);
    expect(screen.getByText('Admins only')).toBeOnTheScreen();
    expect(mockApi.admin.services).not.toHaveBeenCalled();
  });

  it('creates a service from form input', async () => {
    mockApi.admin.services.mockResolvedValue([makeService({ name: 'Intro call' })]);
    mockApi.admin.createService.mockResolvedValue(makeService({ name: 'Mobility class' }));
    const { user } = await renderScreen(<AdminScreen />, { session: { token: 't', user: admin } });

    expect(await screen.findByText('Intro call')).toBeOnTheScreen();
    await user.type(screen.getByLabelText('Name'), 'Mobility class');
    await user.clear(screen.getByLabelText('Minutes'));
    await user.type(screen.getByLabelText('Minutes'), '45');
    await user.type(screen.getByLabelText('Price (USD)'), '25.50');
    await user.press(screen.getByRole('button', { name: 'Add service' }));

    await waitFor(() =>
      expect(mockApi.admin.createService.mock.calls[0]?.[0]).toEqual({
        name: 'Mobility class',
        description: '',
        durationMinutes: 45,
        priceCents: 2550,
      }),
    );
  });

  it('toggles whether customers can see a service', async () => {
    const service = makeService({ name: 'Intro call' });
    mockApi.admin.services.mockResolvedValue([service]);
    mockApi.admin.updateService.mockResolvedValue({ ...service, active: false });
    await renderScreen(<AdminScreen />, { session: { token: 't', user: admin } });

    await fireEvent(await screen.findByLabelText('Intro call visible to customers'), 'valueChange', false);
    await waitFor(() => expect(mockApi.admin.updateService).toHaveBeenCalledWith(service.id, { active: false }));
  });
});

describe('serviceFormSchema', () => {
  it('turns form strings into API values', () => {
    expect(serviceFormSchema.parse({ name: 'Yoga', description: '', duration: '60', price: '12.5' })).toEqual({
      name: 'Yoga',
      description: '',
      duration: 60,
      price: 1250,
    });
  });

  it('reports friendly errors', () => {
    const result = serviceFormSchema.safeParse({ name: 'Yoga', description: '', duration: 'abc', price: '1.999' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.message)).toEqual(['Whole minutes, e.g. 45', 'A price like 45 or 45.50']);
  });
});
