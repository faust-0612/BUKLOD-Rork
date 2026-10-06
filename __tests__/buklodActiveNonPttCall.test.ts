import {
  findActiveNonPttCall,
  getBuklodCallSurfaceMode,
  isBuklodAcceptedNonPttCall,
  isBuklodActiveNonPttCall,
  minimizeBuklodCallSurface,
  resetBuklodCallSurface,
  restoreActiveNonPttCallIfAny,
} from '../src/lib/buklodActiveNonPttCall';

function fakeCall(
  state: string,
  type = 'default',
  ringing = false
) {
  return {
    type,
    ringing,
    state: {
      callingState: state,
    },
  } as any;
}

describe(
  'buklodActiveNonPttCall',
  () => {
    afterEach(() => {
      resetBuklodCallSurface();
    });

    test.each([
      'ringing',
      'joining',
      'joined',
      'reconnecting',
      'migrating',
    ])(
      'treats %s as live',
      state => {
        expect(
          isBuklodActiveNonPttCall(
            fakeCall(state)
          )
        ).toBe(true);
      }
    );

    test.each([
      'idle',
      'left',
      'offline',
      'reconnecting-failed',
      'reconnecting_failed',
    ])(
      'treats %s as terminal',
      state => {
        expect(
          isBuklodActiveNonPttCall(
            fakeCall(
              state,
              'default',
              true
            )
          )
        ).toBe(false);
      }
    );

    test(
      'excludes PTT',
      () => {
        expect(
          isBuklodActiveNonPttCall(
            fakeCall(
              'joined',
              'buklod_ptt'
            )
          )
        ).toBe(false);
      }
    );

    test(
      'uses ringing fallback only for unknown non-terminal SDK state',
      () => {
        expect(
          isBuklodActiveNonPttCall(
            fakeCall(
              '',
              'default',
              true
            )
          )
        ).toBe(true);

        expect(
          isBuklodActiveNonPttCall(
            fakeCall(
              'unknown',
              'default',
              true
            )
          )
        ).toBe(true);

        expect(
          isBuklodActiveNonPttCall(
            fakeCall(
              'unknown',
              'default',
              false
            )
          )
        ).toBe(false);
      }
    );

    test(
      'accepted call includes joined/reconnecting/migrating only',
      () => {
        expect(
          isBuklodAcceptedNonPttCall(
            fakeCall('joined')
          )
        ).toBe(true);

        expect(
          isBuklodAcceptedNonPttCall(
            fakeCall('reconnecting')
          )
        ).toBe(true);

        expect(
          isBuklodAcceptedNonPttCall(
            fakeCall('migrating')
          )
        ).toBe(true);

        expect(
          isBuklodAcceptedNonPttCall(
            fakeCall('ringing')
          )
        ).toBe(false);
      }
    );

    test(
      'finds first live normal call',
      () => {
        const joined =
          fakeCall('joined');

        expect(
          findActiveNonPttCall([
            fakeCall(
              'joined',
              'buklod_ptt'
            ),
            fakeCall('left'),
            joined,
          ])
        ).toBe(joined);
      }
    );

    test(
      'restore reveals existing call instead of requiring a new call',
      () => {
        minimizeBuklodCallSurface();

        expect(
          getBuklodCallSurfaceMode()
        ).toBe('minimized');

        const call =
          fakeCall('joined');

        expect(
          restoreActiveNonPttCallIfAny([
            call,
          ])
        ).toBe(call);

        expect(
          getBuklodCallSurfaceMode()
        ).toBe('visible');
      }
    );
  }
);
