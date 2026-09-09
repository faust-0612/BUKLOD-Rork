import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const REPORT_URL = 'https://buklod-report-efmagaj-6311s-projects.vercel.app';
const REPORT_ICON = require('./assets/source-icon.jpg');

export default function App() {
  const webRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3f7f4" />
      <WebView
        ref={webRef}
        source={{ uri: REPORT_URL }}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        overScrollMode="never"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        pullToRefreshEnabled={false}
        onLoadStart={() => {
          setFailed(false);
          setReady(false);
        }}
        onLoadEnd={() => setReady(true)}
        onError={() => {
          setFailed(true);
          setReady(true);
        }}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.statusCode >= 400) setFailed(true);
        }}
        onNavigationStateChange={(state) => setCanGoBack(Boolean(state.canGoBack))}
        style={styles.web}
      />

      {!ready && (
        <View style={styles.splash} pointerEvents="none">
          <Image source={REPORT_ICON} style={styles.icon} />
          <Text style={styles.title}>BUKLOD Report</Text>
          <Text style={styles.subtitle}>Opening your reporting workspace…</Text>
          <ActivityIndicator style={styles.spinner} />
        </View>
      )}

      {failed && (
        <View style={styles.error} pointerEvents="none">
          <Image source={REPORT_ICON} style={styles.smallIcon} />
          <Text style={styles.errorTitle}>BUKLOD Report</Text>
          <Text style={styles.errorText}>Unable to reach the report service. Check your internet connection and reopen the app.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f7f4' },
  web: { flex: 1, backgroundColor: '#f3f7f4' },
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f3f7f4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  icon: { width: 118, height: 118, borderRadius: 28 },
  title: { marginTop: 18, fontSize: 26, fontWeight: '900', color: '#173329' },
  subtitle: { marginTop: 6, fontSize: 13, color: '#6b7c74', textAlign: 'center' },
  spinner: { marginTop: 18 },
  error: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f3f7f4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  smallIcon: { width: 86, height: 86, borderRadius: 22 },
  errorTitle: { marginTop: 16, fontSize: 22, fontWeight: '900', color: '#173329' },
  errorText: { marginTop: 8, maxWidth: 320, fontSize: 13, lineHeight: 19, color: '#6b7c74', textAlign: 'center' },
});
