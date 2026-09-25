const {
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

/*
 * BUKLOD_SOS_QUICK_SETTINGS_R1
 *
 * Adds an Android Quick Settings TileService to the generated native project.
 * The tile is only a fast launcher into BUKLOD's existing Emergency SOS
 * confirmation sheet. It never sends an SOS or captures location by itself.
 */
function withBuklodSosQuickSettings(config) {
  const packageName =
    config.android?.package ||
    'org.mzbministry.buklod';

  config = withAndroidManifest(
    config,
    (config) => {
      const manifest =
        config.modResults.manifest;

      const application =
        manifest.application?.[0];

      if (!application) {
        throw new Error(
          'BUKLOD SOS tile: Android application manifest node missing.'
        );
      }

      application.service =
        application.service || [];

      const serviceName =
        packageName +
        '.BuklodSosTileService';

      application.service =
        application.service.filter(
          (service) => {
            const name =
              service?.$?.['android:name'];

            return (
              name !== serviceName &&
              name !== '.BuklodSosTileService'
            );
          }
        );

      application.service.push({
        $: {
          'android:name':
            serviceName,
          'android:label':
            'BUKLOD SOS',
          'android:icon':
            '@drawable/buklod_sos_tile',
          'android:permission':
            'android.permission.BIND_QUICK_SETTINGS_TILE',
          'android:exported':
            'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.service.quicksettings.action.QS_TILE',
                },
              },
            ],
          },
        ],
      });

      return config;
    }
  );

  config = withDangerousMod(
    config,
    [
      'android',
      async (config) => {
        const projectRoot =
          config.modRequest.platformProjectRoot;

        const packagePath =
          packageName.split('.');

        const javaDir =
          path.join(
            projectRoot,
            'app',
            'src',
            'main',
            'java',
            ...packagePath,
          );

        const drawableDir =
          path.join(
            projectRoot,
            'app',
            'src',
            'main',
            'res',
            'drawable',
          );

        fs.mkdirSync(
          javaDir,
          { recursive: true }
        );

        fs.mkdirSync(
          drawableDir,
          { recursive: true }
        );

        const kotlin = `package ${packageName}

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/*
 * BUKLOD_SOS_QUICK_SETTINGS_R1
 *
 * Quick Settings is a launcher only. Emergency dispatch still requires the
 * explicit authenticated + hold-to-send confirmation inside BUKLOD.
 */
class BuklodSosTileService : TileService() {

  override fun onStartListening() {
    super.onStartListening()

    qsTile?.apply {
      state = Tile.STATE_ACTIVE
      label = "BUKLOD SOS"
      contentDescription = "Open BUKLOD Emergency SOS"
      updateTile()
    }
  }

  override fun onClick() {
    super.onClick()

    val launchIntent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("buklod://buklod?sos=1")
    ).apply {
      setPackage(packageName)
      addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP
      )
    }

    val launch = Runnable {
      if (
        Build.VERSION.SDK_INT >=
          Build.VERSION_CODES.UPSIDE_DOWN_CAKE
      ) {
        val pendingIntent =
          PendingIntent.getActivity(
            this,
            7319,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or
              PendingIntent.FLAG_IMMUTABLE
          )

        startActivityAndCollapse(
          pendingIntent
        )
      } else {
        @Suppress("DEPRECATION")
        startActivityAndCollapse(
          launchIntent
        )
      }
    }

    if (isSecure && isLocked) {
      unlockAndRun(launch)
    } else {
      launch.run()
    }
  }
}
`;

        fs.writeFileSync(
          path.join(
            javaDir,
            'BuklodSosTileService.kt'
          ),
          kotlin,
          'utf8'
        );

        const vector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
  <path
      android:fillColor="#FFFFFFFF"
      android:pathData="M11,2h2v7h-2zM11,15h2v2h-2zM4,21a2,2 0,0 1,-1.73,-3L10.27,4a2,2 0,0 1,3.46 0l8,14A2,2 0,0 1,20 21H4zM4,19h16L12,5 4,19z" />
</vector>
`;

        fs.writeFileSync(
          path.join(
            drawableDir,
            'buklod_sos_tile.xml'
          ),
          vector,
          'utf8'
        );

        return config;
      },
    ]
  );

  return config;
}

module.exports =
  withBuklodSosQuickSettings;
