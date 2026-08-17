import { registerWebModule, NativeModule } from 'expo';

// BuklodMlKitTranslationModule is not available on the web platform.
class BuklodMlKitTranslationModule extends NativeModule<{}> {}

export default registerWebModule(BuklodMlKitTranslationModule, 'BuklodMlKitTranslationModule');
