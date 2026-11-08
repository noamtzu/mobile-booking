export const router = {
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  back: jest.fn(),
};

export const useRouter = () => router;
export const useLocalSearchParams = jest.fn(() => ({}));
export const Stack = { Screen: () => null };
