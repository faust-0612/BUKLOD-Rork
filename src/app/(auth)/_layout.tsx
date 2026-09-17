import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      {/* Recover Account belongs to this auth navigator. Keep it here so
          Login -> recovery stays on the auth stack instead of bouncing. */}
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
