import { Tabs } from 'expo-router';

import { CustomTabBar } from '@/components/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="food" />
      <Tabs.Screen name="workout" />
      <Tabs.Screen name="body" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
