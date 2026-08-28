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
   * Messages inbox is ad-free — no tab-strip banner.
   */


  return null;
}