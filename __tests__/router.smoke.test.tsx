import React from 'react';
import { Text } from 'react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

describe('Expo Router test harness', () => {
  it('can render the BUKLOD login route in memory', () => {
    renderRouter(
      {
        index: () => <Text>BUKLOD</Text>,
        '(auth)/login': () => <Text>LOG IN</Text>,
        '(auth)/register': () => <Text>Create BUKLOD Account</Text>,
      },
      { initialUrl: '/(auth)/login' }
    );

    // Route groups are organizational only and are omitted from the public pathname.
    (expect(screen) as any).toHavePathname('/login');
    expect(screen.getByText('LOG IN')).toBeTruthy();
  });
});
