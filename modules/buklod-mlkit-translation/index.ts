import {
  requireOptionalNativeModule,
} from 'expo-modules-core';

type NativeTranslationModule = {
  getSupportedLanguages():
    string[];

  identifyLanguage(
    text: string
  ): Promise<string>;

  translate(
    text: string,
    sourceLanguageTag: string,
    targetLanguageTag: string,
    wifiOnly: boolean
  ): Promise<string>;

  translateAuto(
    text: string,
    targetLanguageTag: string,
    wifiOnly: boolean
  ): Promise<string>;

  downloadModel(
    languageTag: string,
    wifiOnly: boolean
  ): Promise<boolean>;

  deleteModel(
    languageTag: string
  ): Promise<boolean>;

  getDownloadedModels():
    Promise<string[]>;
};

const native =
  requireOptionalNativeModule<
    NativeTranslationModule
  >(
    'BuklodMlKitTranslation'
  );

function moduleOrThrow() {

  if (!native) {
    throw new Error(
      'BUKLOD ML Kit Translation is not available in this native build.'
    );
  }

  return native;
}

export function
getSupportedTranslationLanguages() {

  return moduleOrThrow()
    .getSupportedLanguages();
}

export async function identifyLanguage(
  text: string
) {

  return moduleOrThrow()
    .identifyLanguage(
      text
    );
}

export async function translateText(
  text: string,
  sourceLanguageTag: string,
  targetLanguageTag: string,
  wifiOnly = true
) {

  return moduleOrThrow()
    .translate(
      text,
      sourceLanguageTag,
      targetLanguageTag,
      wifiOnly
    );
}

export async function translateTextAuto(
  text: string,
  targetLanguageTag: string,
  wifiOnly = true
) {

  return moduleOrThrow()
    .translateAuto(
      text,
      targetLanguageTag,
      wifiOnly
    );
}

export async function downloadTranslationModel(
  languageTag: string,
  wifiOnly = true
) {

  return moduleOrThrow()
    .downloadModel(
      languageTag,
      wifiOnly
    );
}

export async function deleteTranslationModel(
  languageTag: string
) {

  return moduleOrThrow()
    .deleteModel(
      languageTag
    );
}

export async function
getDownloadedTranslationModels() {

  return moduleOrThrow()
    .getDownloadedModels();
}