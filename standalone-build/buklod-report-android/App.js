import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, BackHandler, SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import REPORT_HTML from './reportHtml';

const APP_ORIGIN = 'https://buklod-report.local/';
const SUPABASE_ORIGIN = 'https://yhanxndaqbmuzbdqlblu.supabase.co';

SplashScreen.preventAutoHideAsync().catch(() => {});

function safeFileName(name) {
  return String(name || 'BUKLOD-Report-export')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

export default function App() {
  const webRef = useRef(null);
  const canGoBackRef = useRef(false);
  const splashHiddenRef = useRef(false);

  const hideSplashOnce = useCallback(() => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const saveAndShareBase64 = useCallback(async ({ name, mime, base64 }) => {
    try {
      const fileName = safeFileName(name);
      const uri = `${FileSystem.cacheDirectory}${Date.now()}-${fileName}`;
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: mime || 'application/octet-stream',
          dialogTitle: `Save / share ${fileName}`,
        });
      } else {
        Alert.alert('Export ready', `Saved temporarily at ${uri}`);
      }
    } catch (error) {
      Alert.alert('Export failed', error?.message || String(error));
    }
  }, []);

  const saveAndShareText = useCallback(async ({ name, mime, text }) => {
    try {
      const fileName = safeFileName(name);
      const uri = `${FileSystem.cacheDirectory}${Date.now()}-${fileName}`;
      await FileSystem.writeAsStringAsync(uri, String(text ?? ''), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: mime || 'text/plain',
          dialogTitle: `Save / share ${fileName}`,
        });
      } else {
        Alert.alert('Export ready', `Saved temporarily at ${uri}`);
      }
    } catch (error) {
      Alert.alert('Export failed', error?.message || String(error));
    }
  }, []);

  const printAndShare = useCallback(async ({ name, html }) => {
    try {
      const result = await Print.printToFileAsync({ html: String(html || '') });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save / share ${safeFileName(name || 'BUKLOD-Report.pdf')}`,
        });
      } else {
        Alert.alert('PDF ready', `Saved temporarily at ${result.uri}`);
      }
    } catch (error) {
      Alert.alert('PDF export failed', error?.message || String(error));
    }
  }, []);

  const onMessage = useCallback(
    async (event) => {
      try {
        const payload = JSON.parse(event.nativeEvent.data || '{}');
        if (payload.type === 'save') return saveAndShareBase64(payload);
        if (payload.type === 'saveText') return saveAndShareText(payload);
        if (payload.type === 'print') return printAndShare(payload);
      } catch {
        // Ignore non-bridge messages from the embedded Report app.
      }
    },
    [printAndShare, saveAndShareBase64, saveAndShareText]
  );

  useEffect(() => {
    const handler = () => {
      if (canGoBackRef.current && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" backgroundColor="#08AEF3" />
      <View style={styles.webWrap} renderToHardwareTextureAndroid collapsable={false}>
        <WebView
          ref={webRef}
          source={{ html: REPORT_HTML, baseUrl: APP_ORIGIN }}
          originWhitelist={['https://*', 'http://*', 'buklodreport://*']}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          cacheMode="LOAD_DEFAULT"
          incognito={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          allowsFullscreenVideo={false}
          mediaPlaybackRequiresUserAction
          pullToRefreshEnabled={false}
          overScrollMode="never"
          androidLayerType="hardware"
          textZoom={100}
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          allowFileAccess
          allowContentAccess
          onLoadEnd={hideSplashOnce}
          onError={hideSplashOnce}
          onHttpError={hideSplashOnce}
          onMessage={onMessage}
          onNavigationStateChange={(nav) => {
            canGoBackRef.current = Boolean(nav.canGoBack);
          }}
          onShouldStartLoadWithRequest={(req) => {
            const url = String(req.url || '');
            if (url.startsWith(APP_ORIGIN) || url.startsWith(SUPABASE_ORIGIN)) return true;
            if (/^https:\/\//i.test(url) || /^http:\/\//i.test(url)) return true;
            if (/^buklodreport:\/\//i.test(url)) return true;
            return false;
          }}
          onRenderProcessGone={() => webRef.current?.reload()}
          style={styles.web}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08AEF3' },
  webWrap: { flex: 1, backgroundColor: '#F3F7F4' },
  web: { flex: 1, backgroundColor: '#F3F7F4' },
});
