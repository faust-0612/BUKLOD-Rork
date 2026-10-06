import fs from 'fs';
import path from 'path';

function read(relative: string) {
  return fs.readFileSync(
    path.join(process.cwd(), relative),
    'utf8',
  );
}

describe('V24 native consolidation contract', () => {
  it('keeps complete Offline Nearby permissions and foreground service types', () => {
    const plugin = read('plugins/withBuklodPttHardwareFoundation.js');
    const manifest = read(
      'modules/buklod-nearby-ptt/android/src/main/AndroidManifest.xml',
    );

    for (const permission of [
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_ADVERTISE',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.NEARBY_WIFI_DEVICES',
      'android.permission.ACCESS_WIFI_STATE',
      'android.permission.CHANGE_WIFI_STATE',
      'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
    ]) {
      expect(plugin + manifest).toContain(permission);
    }

    expect(manifest).toContain(
      'android:foregroundServiceType="connectedDevice|microphone"',
    );
  });

  it('contains a real Nearby Connections discovery and audio transport', () => {
    const gradle = read(
      'modules/buklod-nearby-ptt/android/build.gradle',
    );
    const native = read(
      'modules/buklod-nearby-ptt/android/src/main/java/org/mzbministry/buklod/nearbyptt/BuklodNearbyPttModule.kt',
    );

    expect(gradle).toContain(
      "com.google.android.gms:play-services-nearby:19.5.1",
    );
    expect(native).toContain('startAdvertising');
    expect(native).toContain('startDiscovery');
    expect(native).toContain('requestConnection');
    expect(native).toContain('acceptConnection');
    expect(native).toContain('AudioRecord');
    expect(native).toContain('AudioTrack');
    expect(native).toContain('sendPayload');
    expect(native).toContain('Strategy.P2P_CLUSTER');
  });

  it('keeps calling and screen-share native dependencies/config enabled', () => {
    const pkg = JSON.parse(read('package.json'));
    const config = read('app.config.js');

    expect(
      pkg.dependencies['@stream-io/react-native-callingx'],
    ).toBeTruthy();
    expect(
      pkg.dependencies['@stream-io/react-native-webrtc'],
    ).toBeTruthy();
    expect(
      pkg.dependencies['@stream-io/video-react-native-sdk'],
    ).toBeTruthy();

    expect(config).toContain('enableScreenshare: true');
    expect(config).toContain('androidKeepCallAlive: true');
    expect(config).toContain('ringing: true');
    expect(config).toContain('addNoiseCancellation: true');
  });

  it('wires Nearby mode to the native bridge instead of fake peers', () => {
    const screen = read('src/app/personal-home/ptt.tsx');
    const bridge = read('src/ptt/buklodNearbyPtt.ts');

    expect(screen).toContain('startBuklodNearbyPtt(');
    expect(screen).toContain('getBuklodNearbyPttPeers()');
    expect(screen).toContain('startBuklodNearbyPttTransmit()');
    expect(screen).toContain("routeMode === 'INTERNET'");
    expect(bridge).toContain("'BuklodNearbyPtt'");
  });
});
