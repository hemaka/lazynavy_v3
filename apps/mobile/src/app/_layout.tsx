import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" translucent />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#e0f7ff' } }} />
    </>
  )
}
