import { NativeModule, requireNativeModule } from 'expo';

declare class BuklodMlKitTranslationModule extends NativeModule<{}> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<BuklodMlKitTranslationModule>('BuklodMlKitTranslation');
