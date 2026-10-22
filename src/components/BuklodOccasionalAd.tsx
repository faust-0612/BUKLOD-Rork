import React, {
  useEffect,
  useState,
} from 'react';

import AsyncStorage
  from '@react-native-async-storage/async-storage';

import BuklodAdMobBanner
  from '@/components/BuklodAdMobBanner';

import {
  BuklodAdPlacement,
} from '@/lib/buklodAdUnits';


const COUNT_KEY =
  '@buklod/ad/content-view-count';

const LAST_KEY =
  '@buklod/ad/content-last-shown';

const MIN_GAP_MS =
  20 * 60 * 1000;


export default function BuklodOccasionalAd({
  placement,
}: {
  placement:
    Extract<
      BuklodAdPlacement,
      'bible' |
      'devotion'
    >;
}) {

  const [
    visible,
    setVisible,
  ] = useState(false);


  useEffect(
    () => {

      let mounted =
        true;


      void (
        async () => {

          try {
            const [
              rawCount,
              rawLast,
            ] =
              await AsyncStorage
                .multiGet([
                  COUNT_KEY,
                  LAST_KEY,
                ]);


            const count =
              Number(
                rawCount[1] ??
                '0'
              ) + 1;


            const last =
              Number(
                rawLast[1] ??
                '0'
              );


            await AsyncStorage
              .setItem(
                COUNT_KEY,
                String(count)
              );


            const eligible =
              count % 3 === 0 &&
              Date.now() -
                last >=
                MIN_GAP_MS;


            if (!eligible) {
              return;
            }


            await AsyncStorage
              .setItem(
                LAST_KEY,
                String(
                  Date.now()
                )
              );


            if (mounted) {
              setVisible(true);
            }
          }
          catch (error) {
            console.warn(
              'BUKLOD occasional ad:',
              error
            );
          }
        }
      )();


      return () => {
        mounted = false;
      };
    },
    []
  );


  if (!visible) {
    return null;
  }


  return (
    <BuklodAdMobBanner
      placement={
        placement
      }
      compact
    />
  );
}