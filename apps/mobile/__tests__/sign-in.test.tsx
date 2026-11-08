import { screen, waitFor } from '@testing-library/react-native';
import SignInScreen from '@/app/sign-in';
import { ApiError, api } from '@/lib/api';
import { customer, renderScreen } from '../test/render';

const mockApi = jest.mocked(api);

describe('Sign-in screen', () => {
  it('validates the email before calling the API', async () => {
    const { user } = await renderScreen(<SignInScreen />, { session: null });
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.press(screen.getByRole('button', { name: 'Email me a code' }));

    expect(await screen.findByText('Enter a valid email address')).toBeOnTheScreen();
    expect(mockApi.requestCode).not.toHaveBeenCalled();
  });

  it('requests a code, then signs in with it', async () => {
    mockApi.requestCode.mockResolvedValue(undefined);
    mockApi.verifyCode.mockResolvedValue({ token: 'jwt', user: customer });
    const { auth, user } = await renderScreen(<SignInScreen />, { session: null });

    await user.type(screen.getByLabelText('Email'), ' Pat@Example.com ');
    await user.press(screen.getByRole('button', { name: 'Email me a code' }));

    expect(await screen.findByText('We sent a 6-digit code to pat@example.com.')).toBeOnTheScreen();
    expect(mockApi.requestCode.mock.calls[0]?.[0]).toEqual({ email: 'pat@example.com' });

    await user.type(screen.getByLabelText('Sign-in code'), '123456');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith({ token: 'jwt', user: customer }));
    expect(mockApi.verifyCode.mock.calls[0]?.[0]).toEqual({ email: 'pat@example.com', code: '123456' });
  });

  it('shows the server message when the code is wrong', async () => {
    mockApi.requestCode.mockResolvedValue(undefined);
    mockApi.verifyCode.mockRejectedValue(new ApiError(401, 'INVALID_CODE', 'That code is wrong or has expired'));
    const { user } = await renderScreen(<SignInScreen />, { session: null });

    await user.type(screen.getByLabelText('Email'), 'pat@example.com');
    await user.press(screen.getByRole('button', { name: 'Email me a code' }));
    await user.type(await screen.findByLabelText('Sign-in code'), '000000');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('That code is wrong or has expired')).toBeOnTheScreen();
  });

  it('rejects codes that are not 6 digits', async () => {
    mockApi.requestCode.mockResolvedValue(undefined);
    const { user } = await renderScreen(<SignInScreen />, { session: null });
    await user.type(screen.getByLabelText('Email'), 'pat@example.com');
    await user.press(screen.getByRole('button', { name: 'Email me a code' }));
    await user.type(await screen.findByLabelText('Sign-in code'), '12');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('The code has 6 digits')).toBeOnTheScreen();
    expect(mockApi.verifyCode).not.toHaveBeenCalled();
  });
});
