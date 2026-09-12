const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

function write(path, text) {
  fs.writeFileSync(path, text, 'utf8');
}

function replaceOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`R18 anchor missing: ${label}`);
  if (text.indexOf(from, first + from.length) >= 0) {
    throw new Error(`R18 anchor is not unique: ${label}`);
  }
  return text.slice(0, first) + to + text.slice(first + from.length);
}

function replaceRegexOnce(text, re, to, label) {
  const matches = [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))];
  if (matches.length !== 1) throw new Error(`R18 regex anchor ${label} matched ${matches.length} times`);
  return text.replace(re, to);
}

const nativePath = 'src/app/igpat/create.tsx';
let native = read(nativePath);
native = replaceOnce(native, '  Platform,\n', '', 'native Platform import');
native = replaceOnce(native, "import * as ImagePicker from 'expo-image-picker';\n", '', 'native static ImagePicker import');

const pendingBlock = `  useEffect(() => {\n    if (Platform.OS !== 'android') return;\n\n    let cancelled = false;\n    void ImagePicker.getPendingResultAsync()\n      .then(async result => {\n        if (cancelled || !result) return;\n        await handlePickerResult(result);\n      })\n      .catch(error => {\n        console.warn(\n          'BUKLOD IGPAT pending picker result:',\n          String((error as any)?.message ?? error)\n        );\n      });\n\n    return () => {\n      cancelled = true;\n    };\n  }, []);\n\n`;
native = replaceOnce(native, pendingBlock, '', 'mount-time pending ImagePicker recovery');

native = replaceOnce(
  native,
  '      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();\n',
  `      // Load the native picker only after explicit user action. This keeps\n      // /igpat/create mount-compatible with older production binaries and\n      // turns native-module drift into a caught error instead of an app crash.\n      const ImagePicker = await import('expo-image-picker');\n      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();\n`,
  'native lazy library picker'
);

native = replaceOnce(
  native,
  '      const permission = await ImagePicker.requestCameraPermissionsAsync();\n',
  `      // Same compatibility rule as SELECT: never require ImagePicker native\n      // methods merely by opening the IGPAT creator.\n      const ImagePicker = await import('expo-image-picker');\n      const permission = await ImagePicker.requestCameraPermissionsAsync();\n`,
  'native lazy camera picker'
);

native = replaceOnce(
  native,
  `      Alert.alert(\n        'Could Not Open Videos',\n        error?.message ?? 'Please try selecting the video again.'\n      );\n`,
  `      Alert.alert(\n        'Could Not Open Videos',\n        error?.message ??\n          'Video selection is not available in this installed app version. Please update the app before trying again.'\n      );\n`,
  'native library compatibility message'
);

native = replaceOnce(
  native,
  `      Alert.alert(\n        'Could Not Record Video',\n        error?.message ?? 'The camera could not return the recorded video safely. Please try again.'\n      );\n`,
  `      Alert.alert(\n        'Could Not Record Video',\n        error?.message ??\n          'Camera video recording is not available in this installed app version. Please update the app before trying again.'\n      );\n`,
  'native camera compatibility message'
);
write(nativePath, native);

const feedPath = 'src/app/igpat/index.tsx';
let feed = read(feedPath);
feed = replaceOnce(feed, '        data={rows}\n', '        data={rows}\n        extraData={activeIndex}\n', 'feed active index extraData');
feed = replaceOnce(feed, '        maxToRenderPerBatch={2}\n', '        maxToRenderPerBatch={1}\n', 'feed render batch');
feed = replaceOnce(feed, '        windowSize={3}\n', '        windowSize={2}\n', 'feed window size');
feed = replaceOnce(
  feed,
  `              {!!item.media_url && (\n                <IgpatVideo uri={item.media_url} active={index === activeIndex} />\n              )}\n`,
  `              {!!item.media_url && index === activeIndex ? (\n                <IgpatVideo uri={item.media_url} active />\n              ) : null}\n`,
  'single active native video player'
);
write(feedPath, feed);

const webPath = 'src/app/igpat/create.web.tsx';
let web = read(webPath);
web = replaceOnce(web, "import * as ImagePicker from 'expo-image-picker';\n", '', 'web ImagePicker import');
web = replaceOnce(web, "import { VideoView, useVideoPlayer } from 'expo-video';\n", '', 'web expo-video import');

web = replaceRegexOnce(
  web,
  /function Preview\(\{ uri \}: \{ uri: string \}\) \{[\s\S]*?\n\}\n\nfunction extensionForMime/,
  `function Preview({ uri }: { uri: string }) {\n  return React.createElement('video', {\n    src: uri,\n    controls: true,\n    playsInline: true,\n    preload: 'metadata',\n    style: {\n      width: '100%',\n      height: 420,\n      objectFit: 'contain',\n      backgroundColor: '#000000',\n    },\n  });\n}\n\nfunction extensionForMime`,
  'web browser-native preview'
);

web = replaceRegexOnce(
  web,
  /  const chooseVideo = async \(\) => \{[\s\S]*?\n  \};\n\n  const publish = async \(\) => \{/,
  `  const chooseVideo = async () => {\n    try {\n      const file = await new Promise<File | null>(resolve => {\n        const input = document.createElement('input');\n        input.type = 'file';\n        input.accept = 'video/*';\n        input.multiple = false;\n        input.onchange = () => resolve(input.files?.[0] ?? null);\n        input.click();\n      });\n\n      if (!file) return;\n\n      const uri = URL.createObjectURL(file);\n      try {\n        const durationSeconds = await new Promise<number>((resolve, reject) => {\n          const probe = document.createElement('video');\n          const timeout = window.setTimeout(() => {\n            probe.removeAttribute('src');\n            reject(new Error('Could not read the selected video duration.'));\n          }, 12000);\n\n          probe.preload = 'metadata';\n          probe.onloadedmetadata = () => {\n            window.clearTimeout(timeout);\n            const seconds = Math.ceil(Number(probe.duration || 0));\n            probe.removeAttribute('src');\n            if (!seconds || seconds < 1) {\n              reject(new Error('Could not determine the selected video duration.'));\n              return;\n            }\n            resolve(seconds);\n          };\n          probe.onerror = () => {\n            window.clearTimeout(timeout);\n            probe.removeAttribute('src');\n            reject(new Error('The selected video could not be read by this browser.'));\n          };\n          probe.src = uri;\n        });\n\n        if (durationSeconds > BUKLOD_REEL_MAX_DURATION_SECONDS) {\n          throw new Error(\n            \\`This video is \\${durationSeconds} seconds. IGPAT videos may be up to 60 seconds only.\\`\n          );\n        }\n\n        const sizeBytes = Number(file.size || 0);\n        const validationError = validateCommunityVideoUpload({\n          durationSeconds,\n          sizeBytes,\n          isReel: true,\n        });\n        if (validationError) throw new Error(validationError);\n\n        const mimeType = String(file.type || 'video/mp4').toLowerCase();\n        disposeDraft();\n        setDraft({\n          uri,\n          durationSeconds,\n          sizeBytes,\n          mimeType:\n            mimeType === 'video/quicktime' || mimeType === 'video/webm'\n              ? mimeType\n              : 'video/mp4',\n          fileName: file.name || \\`igpat.\\${extensionForMime(mimeType)}\\`,\n          revokeOnDispose: true,\n        });\n      } catch (error) {\n        URL.revokeObjectURL(uri);\n        throw error;\n      }\n    } catch (error: any) {\n      console.warn('BUKLOD IGPAT browser file picker:', String(error?.message ?? error));\n      Alert.alert(\n        'Could Not Prepare Video',\n        error?.message ?? 'Please choose the video again.'\n      );\n    }\n  };\n\n  const publish = async () => {`,
  'web browser-native file selection'
);
write(webPath, web);

// The patcher is intentionally temporary. Remove it so the final branch diff
// contains product files only after the caller stages this deletion.
try { fs.unlinkSync(__filename); } catch {}

console.log('IGPAT R18 runtime-compat patch applied.');
console.log('Changed product files:');
console.log(' - src/app/igpat/create.tsx');
console.log(' - src/app/igpat/index.tsx');
console.log(' - src/app/igpat/create.web.tsx');
