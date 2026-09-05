import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './src/stores/authStore';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  const initialize = useAuthStore(state => state.initialize);

  useEffect(() => {
    initialize();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}