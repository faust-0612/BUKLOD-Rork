import { Image } from 'react-native';

/**
 * Official BUKLOD Report Crown of Thorns logo supplied by the project owner.
 * Stored as a bundled asset so Expo web/iOS/Android render the same deterministic mark.
 */
export const BUKLOD_REPORT_ICON_SOURCE = require('../../assets/branding/buklod-report-logo.jpg');
export const BUKLOD_REPORT_ICON_URI = Image.resolveAssetSource(BUKLOD_REPORT_ICON_SOURCE).uri;
