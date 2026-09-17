const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');

const TILE_SERVICE = '.emergency.BuklodSosTileService';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function withBuklodEmergencyManifest(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.service = ensureArray(application.service);

    const existing = application.service.find(
      (entry) => entry?.$?.['android:name'] === TILE_SERVICE,
    );

    if (!existing) {
      application.service.push({
        $: {
          'android:name': TILE_SERVICE,
          'android:label': 'BUKLOD SOS',
          'android:icon': '@mipmap/ic_launcher',
          'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.quicksettings.action.QS_TILE',
                },
              },
            ],
          },
        ],
      });
    }

    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    mainActivity['meta-data'] = ensureArray(mainActivity['meta-data']);
    const shortcutMetadata = mainActivity['meta-data'].find(
      (entry) => entry?.$?.['android:name'] === 'android.app.shortcuts',
    );
    if (!shortcutMetadata) {
      mainActivity['meta-data'].push({
        $: {
          'android:name': 'android.app.shortcuts',
          'android:resource': '@xml/buklod_shortcuts',
        },
      });
    }

    return mod;
  });
}

function withBuklodEmergencyNativeFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const androidRoot = path.join(projectRoot, 'android');
      const packageName =
        mod.android?.package ||
        mod.modRequest.projectName ||
        config.android?.package ||
        'org.mzbministry.buklod';

      const packagePath = packageName.replace(/\./g, path.sep);
      const javaDir = path.join(
        androidRoot,
        'app',
        'src',
        'main',
        'java',
        packagePath,
        'emergency',
      );
      fs.mkdirSync(javaDir, { recursive: true });

      const kotlin = `package ${packageName}.emergency

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class BuklodSosTileService : TileService() {
    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            state = Tile.STATE_ACTIVE
            label = "BUKLOD SOS"
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()

        val intent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("buklod://sos?trigger=quick_tile")
        ).apply {
            setPackage(applicationContext.packageName)
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val pendingIntent = PendingIntent.getActivity(
                this,
                41021,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            startActivityAndCollapse(pendingIntent)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
`;

      fs.writeFileSync(
        path.join(javaDir, 'BuklodSosTileService.kt'),
        kotlin,
        'utf8',
      );

      const xmlDir = path.join(
        androidRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      fs.mkdirSync(xmlDir, { recursive: true });

      const mainActivityClass = `${packageName}.MainActivity`;
      const shortcuts = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
    <shortcut
        android:shortcutId="buklod_emergency_sos"
        android:enabled="true"
        android:icon="@mipmap/ic_launcher"
        android:shortcutShortLabel="SOS"
        android:shortcutLongLabel="BUKLOD Emergency SOS">
        <intent
            android:action="android.intent.action.VIEW"
            android:targetPackage="${packageName}"
            android:targetClass="${mainActivityClass}"
            android:data="buklod://sos?trigger=app_shortcut" />
    </shortcut>
</shortcuts>
`;

      fs.writeFileSync(
        path.join(xmlDir, 'buklod_shortcuts.xml'),
        shortcuts,
        'utf8',
      );

      return mod;
    },
  ]);
}

function withBuklodEmergencyTriggers(config) {
  config = withBuklodEmergencyManifest(config);
  config = withBuklodEmergencyNativeFiles(config);
  return config;
}

module.exports = withBuklodEmergencyTriggers;
