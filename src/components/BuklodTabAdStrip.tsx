import React, {
  useEffect,
} from 'react';

import {
  usePathname,
} from 'expo-router';

import BuklodAdMobBanner
  from '@/components/BuklodAdMobBanner';

import {
  warmBuklodInterstitial,
} from '@/lib/buklodAds';


export default function BuklodTabAdStrip() {

  const pathname =
    usePathname();


  useEffect(
    () => {
      /*
       * Preload only.
       * Does NOT show an interstitial.
       */
      warmBuklodInterstitial();
    },
    []
  );


  if (
    pathname === '/home'
  ) {
    return (
      <BuklodAdMobBanner
        placement="home"
      />
    );
  }


  if (
    pathname === '/buklod'
  ) {
    return (
      <BuklodAdMobBanner
        placement="community"
      />
    );
  }


  if (
    pathname === '/prayer'
  ) {
    return (
      <BuklodAdMobBanner
        placement="prayer"
      />
    );
  }


  /*
   * Exact route only.
   * No ad inside an opened private conversation.
   */
  if (
    pathname === '/messages'
  ) {
    return (
      <BuklodAdMobBanner
        placement="messages"
      />
    );
  }
  if (
    pathname === '/me' ||
    pathname.startsWith('/me/')
  ) {
    return (
      <BuklodAdMobBanner
        placement="me"
      />
    );
  }


  return null;
}