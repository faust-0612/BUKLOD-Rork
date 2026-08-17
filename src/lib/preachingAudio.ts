import {
  setAudioModeAsync,
} from 'expo-audio';

let configurePromise:
  Promise<void> | null = null;

export function configurePreachingAudioMode() {
  if (!configurePromise) {
    configurePromise =
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,

        /*
         * Required for reliable lock-screen
         * media controls with expo-audio.
         */
        interruptionMode:
          'doNotMix',

        shouldRouteThroughEarpiece:
          false,
      })
        .catch(error => {
          configurePromise =
            null;

          throw error;
        });
  }

  return configurePromise;
}