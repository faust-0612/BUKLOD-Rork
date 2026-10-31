import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { useAudioPlayerStatus } from 'expo-audio';

import {
  getDzasPlayer,
  pauseDzasRadio,
  playDzasRadio,
} from '@/lib/buklodDzasRadio';
import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import DzasSignalDeck from '@/components/dzas/DzasSignalDeck';

const DZAS_FAVORITE_KEY = 'buklod.radio.favorite.702dzas';

export default function BuklodRadioScreen() {
  const player = useMemo(() => getDzasPlayer(), []);
  const status = useAudioPlayerStatus(player);

  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const playing = Boolean(status?.playing);

  useEffect(() => {
    let mounted = true;

    void AsyncStorage.getItem(DZAS_FAVORITE_KEY).then((value) => {
      if (mounted) setFavorite(value === '1');
    });

    return () => {
      mounted = false;
    };
  }, []);

  const play = async (forceReload = false) => {
    setBusy(true);
    setError('');

    try {
      await playDzasRadio(forceReload);
    } catch (playError: any) {
      const message =
        String(
          playError?.message ??
          ''
        ).trim();

      setError(
        message ||
          'Hindi mabuksan ang DZAS stream ngayon.'
      );
    } finally {
      setBusy(false);
    }
  };

  const pause = () => {
    pauseDzasRadio();
  };

  const toggleFavorite = () => {
    const next = !favorite;

    setFavorite(next);

    void AsyncStorage.setItem(
      DZAS_FAVORITE_KEY,
      next ? '1' : '0',
    );
  };

  return (
    <DzasSignalDeck
      playing={playing}
      busy={busy}
      buffering={Boolean(status?.isBuffering)}
      error={error}
      favorite={favorite}
      onPlay={() => void play(false)}
      onPause={pause}
      onRetry={() => void play(true)}
      onFavorite={toggleFavorite}
      ad={(
        <BuklodAdMobBanner
          placement="content"
          placementId="dzas_radio_medium_rectangle"
          format="mediumRectangle"
          requireViewport
          showLabel
        />
      )}
    />
  );
}
