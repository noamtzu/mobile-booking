import { Tabs } from 'expo-router';
import { type ColorValue, Text } from 'react-native';
import { useAuth } from '@/lib/auth';

// Simple text glyphs keep the demo free of an icon-font dependency.
const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return (
      <Text style={{ color, fontSize: 18 }} importantForAccessibility="no">
        {glyph}
      </Text>
    );
  };

export default function TabsLayout() {
  const { session } = useAuth();
  const isAdmin = session?.user.role === 'admin';
  return (
    <Tabs screenOptions={{ headerTitleAlign: 'left' }}>
      <Tabs.Screen name="index" options={{ title: 'Book', tabBarIcon: icon('◷') }} />
      <Tabs.Screen name="bookings" options={{ title: 'My bookings', tabBarIcon: icon('☰') }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin', tabBarIcon: icon('⚙'), href: isAdmin ? undefined : null }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('◉') }} />
    </Tabs>
  );
}
