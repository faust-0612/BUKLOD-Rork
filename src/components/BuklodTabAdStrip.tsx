import React from 'react';

import {
  usePathname,
} from 'expo-router';

import BuklodAdMobBanner
  from '@/components/BuklodAdMobBanner';



export default function BuklodTabAdStrip() {

  const pathname =
    usePathname();



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