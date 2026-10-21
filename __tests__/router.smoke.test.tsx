import React from 'react';
import { Text } from 'react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

describe('Expo Router test harness', () => {
  it('can render the BUKLOD login route in memory', () => {
    const rendered = renderRouter(
      {
        index: () => <Text>BUKLOD</Text>,
        '(auth)/login': () => <Text>LOG IN</Text>,
        '(auth)/register': () => <Text>Create BUKLOD Account</Text>,
      },
      { initialUrl: '/(auth)/login' }
    );

    // @ts-expect-error Expo Router matcher exists at runtime but is missing from installed typings
    expect(screen).toHavePathname('/login');
    // Route groups select the screen but are omitted from the public pathname.
    expect(rendered.getSegments()).toEqual(['(auth)', 'login']);
    expect(screen.getByText('LOG IN')).toBeTruthy();
  });
});
