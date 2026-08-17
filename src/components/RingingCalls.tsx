import BuklodAcceptedCallContent from '@/components/BuklodAcceptedCallContent';
import {
  RingingCallContent,
  StreamCall,
  useCalls,
} from '@/lib/streamVideoSdk';

import {
  StyleSheet,
  View,
} from 'react-native';

import {
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';


export function RingingCalls() {
  const calls =
    useCalls();

  const insets =
    useSafeAreaInsets();


  const ringingCall =
    calls.find(
      call =>
        call.ringing
    );


  if (!ringingCall) {
    return null;
  }


  return (
    <View
      style={
        s.overlay
      }
    >
      {/*
        Local forced gesture root.

        The whole app already has
        GestureHandlerRootView, but
        Stream's ringing/call UI uses
        GestureDetector internally.

        unstable_forceActive keeps
        Android native views from
        stealing gesture ownership.
      */}
      <GestureHandlerRootView
        unstable_forceActive
        style={
          s.gestureRoot
        }
      >
        <View
          style={[
            s.safeCallArea,
            {
              paddingBottom:
                Math.max(
                  insets.bottom,
                  16
                ) + 8,
            },
          ]}
        >
          <StreamCall
            call={
              ringingCall
            }
          >
            <RingingCallContent CallContent={BuklodAcceptedCallContent} />
          </StreamCall>
        </View>
      </GestureHandlerRootView>
    </View>
  );
}


const s =
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFill,

      zIndex: 10000,
      elevation: 10000,
    },

    gestureRoot: {
      flex: 1,
    },

    safeCallArea: {
      flex: 1,

      /*
       * Prevent Stream call controls
       * from sitting under Android's
       * bottom navigation area.
       */
      backgroundColor:
        '#000000',
    },
  });

