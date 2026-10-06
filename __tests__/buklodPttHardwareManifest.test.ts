import fs from 'fs';
import path from 'path';

describe(
  'PTT Android hardware manifest contract',
  () => {
    const pluginPath =
      path.join(
        process.cwd(),
        'plugins',
        'withBuklodPttHardwareFoundation.js'
      );

    const source =
      fs.readFileSync(
        pluginPath,
        'utf8'
      );

    it(
      'does not declare connected-device foreground service permission',
      () => {
        expect(
          source.includes(
            'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE'
          )
        ).toBe(false);
      }
    );

    it(
      'preserves BLE and nearby device permissions used by the hardware foundation',
      () => {
        expect(
          source
        ).toContain(
          'android.permission.BLUETOOTH_SCAN'
        );

        expect(
          source
        ).toContain(
          'android.permission.BLUETOOTH_CONNECT'
        );

        expect(
          source
        ).toContain(
          'android.permission.NEARBY_WIFI_DEVICES'
        );
      }
    );
  }
);
