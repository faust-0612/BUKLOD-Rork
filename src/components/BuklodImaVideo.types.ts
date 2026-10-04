import type { ViewStyle } from 'react-native';

export type BuklodImaAdEvent = {
  type?: string;
  message?: string;
};

export type BuklodImaPlaybackError = {
  code?: string;
  message?: string;
};

export type BuklodImaVideoProps = {
  contentUrl: string;
  adTagUrl: string;
  autoPlay?: boolean;
  active?: boolean;
  contentFit?: 'cover' | 'contain';
  showCompanion?: boolean;
  style?: ViewStyle;
  onAdEvent?: (
    event: {
      nativeEvent: BuklodImaAdEvent;
    }
  ) => void;
  onPlaybackError?: (
    event: {
      nativeEvent: BuklodImaPlaybackError;
    }
  ) => void;
  onPlaybackState?: (
    event: {
      nativeEvent: {
        state?: string;
        isPlayingAd?: boolean;
      };
    }
  ) => void;
};
