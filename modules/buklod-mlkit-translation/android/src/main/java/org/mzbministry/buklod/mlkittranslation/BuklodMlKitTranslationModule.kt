package org.mzbministry.buklod.mlkittranslation

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.TranslateRemoteModel
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BuklodMlKitTranslationModule : Module() {

  private val translators =
    mutableMapOf<String, Translator>()

  private val translatorLock =
    Any()

  private val languageIdentifier =
    LanguageIdentification.getClient()

  private val modelManager =
    RemoteModelManager.getInstance()

  private fun languageFromTag(
    tag: String
  ): String? {
    return TranslateLanguage.fromLanguageTag(
      tag
        .trim()
        .lowercase()
    )
  }

  private fun getTranslator(
    source: String,
    target: String
  ): Translator {

    val key =
      "$source->$target"

    synchronized(translatorLock) {

      translators[key]?.let {
        return it
      }

      val options =
        TranslatorOptions
          .Builder()
          .setSourceLanguage(source)
          .setTargetLanguage(target)
          .build()

      val translator =
        Translation.getClient(options)

      translators[key] =
        translator

      return translator
    }
  }

  private fun downloadConditions(
    wifiOnly: Boolean
  ): DownloadConditions {

    val builder =
      DownloadConditions.Builder()

    if (wifiOnly) {
      builder.requireWifi()
    }

    return builder.build()
  }

  private fun rejectInvalid(
    promise: Promise,
    code: String,
    message: String
  ) {

    promise.reject(
      code,
      message,
      IllegalArgumentException(message)
    )
  }

  private fun translateInternal(
    text: String,
    source: String,
    target: String,
    wifiOnly: Boolean,
    promise: Promise
  ) {

    if (text.isEmpty()) {
      promise.resolve("")
      return
    }

    if (source == target) {
      promise.resolve(text)
      return
    }

    val translator =
      getTranslator(
        source,
        target
      )

    translator
      .downloadModelIfNeeded(
        downloadConditions(
          wifiOnly
        )
      )
      .addOnSuccessListener {

        translator
          .translate(text)
          .addOnSuccessListener {
              translatedText ->

            promise.resolve(
              translatedText
            )
          }
          .addOnFailureListener {
              error ->

            promise.reject(
              "E_MLKIT_TRANSLATE",
              error.message
                ?: "Translation failed.",
              error
            )
          }
      }
      .addOnFailureListener {
          error ->

        promise.reject(
          "E_MLKIT_MODEL",
          error.message
            ?: "Translation model download failed.",
          error
        )
      }
  }

  override fun definition() =
    ModuleDefinition {

      Name(
        "BuklodMlKitTranslation"
      )

      Function(
        "getSupportedLanguages"
      ) {

        TranslateLanguage
          .getAllLanguages()
      }

      AsyncFunction(
        "identifyLanguage"
      ) {
          text: String,
          promise: Promise ->

        if (
          text
            .trim()
            .isEmpty()
        ) {
          promise.resolve("und")
          return@AsyncFunction
        }

        languageIdentifier
          .identifyLanguage(text)
          .addOnSuccessListener {
              languageTag ->

            promise.resolve(
              languageTag
            )
          }
          .addOnFailureListener {
              error ->

            promise.reject(
              "E_MLKIT_LANGUAGE_ID",
              error.message
                ?: "Language identification failed.",
              error
            )
          }
      }

      AsyncFunction(
        "translate"
      ) {
          text: String,
          sourceLanguageTag: String,
          targetLanguageTag: String,
          wifiOnly: Boolean,
          promise: Promise ->

        val source =
          languageFromTag(
            sourceLanguageTag
          )

        if (source == null) {

          rejectInvalid(
            promise,
            "E_MLKIT_SOURCE_LANGUAGE",
            "Unsupported source language: $sourceLanguageTag"
          )

          return@AsyncFunction
        }

        val target =
          languageFromTag(
            targetLanguageTag
          )

        if (target == null) {

          rejectInvalid(
            promise,
            "E_MLKIT_TARGET_LANGUAGE",
            "Unsupported target language: $targetLanguageTag"
          )

          return@AsyncFunction
        }

        translateInternal(
          text,
          source,
          target,
          wifiOnly,
          promise
        )
      }

      AsyncFunction(
        "translateAuto"
      ) {
          text: String,
          targetLanguageTag: String,
          wifiOnly: Boolean,
          promise: Promise ->

        val target =
          languageFromTag(
            targetLanguageTag
          )

        if (target == null) {

          rejectInvalid(
            promise,
            "E_MLKIT_TARGET_LANGUAGE",
            "Unsupported target language: $targetLanguageTag"
          )

          return@AsyncFunction
        }

        if (
          text
            .trim()
            .isEmpty()
        ) {
          promise.resolve(text)
          return@AsyncFunction
        }

        languageIdentifier
          .identifyLanguage(text)
          .addOnSuccessListener {
              detectedTag ->

            if (
              detectedTag ==
              "und"
            ) {

              rejectInvalid(
                promise,
                "E_MLKIT_LANGUAGE_UNDETERMINED",
                "Could not determine the source language."
              )

              return@addOnSuccessListener
            }

            val source =
              languageFromTag(
                detectedTag
              )

            if (source == null) {

              rejectInvalid(
                promise,
                "E_MLKIT_SOURCE_LANGUAGE",
                "Detected language is not supported: $detectedTag"
              )

              return@addOnSuccessListener
            }

            translateInternal(
              text,
              source,
              target,
              wifiOnly,
              promise
            )
          }
          .addOnFailureListener {
              error ->

            promise.reject(
              "E_MLKIT_LANGUAGE_ID",
              error.message
                ?: "Language identification failed.",
              error
            )
          }
      }

      AsyncFunction(
        "downloadModel"
      ) {
          languageTag: String,
          wifiOnly: Boolean,
          promise: Promise ->

        val language =
          languageFromTag(
            languageTag
          )

        if (language == null) {

          rejectInvalid(
            promise,
            "E_MLKIT_LANGUAGE",
            "Unsupported language: $languageTag"
          )

          return@AsyncFunction
        }

        if (
          language ==
          TranslateLanguage.ENGLISH
        ) {
          promise.resolve(true)
          return@AsyncFunction
        }

        val model =
          TranslateRemoteModel
            .Builder(language)
            .build()

        modelManager
          .download(
            model,
            downloadConditions(
              wifiOnly
            )
          )
          .addOnSuccessListener {

            promise.resolve(true)
          }
          .addOnFailureListener {
              error ->

            promise.reject(
              "E_MLKIT_MODEL_DOWNLOAD",
              error.message
                ?: "Model download failed.",
              error
            )
          }
      }

      AsyncFunction(
        "deleteModel"
      ) {
          languageTag: String,
          promise: Promise ->

        val language =
          languageFromTag(
            languageTag
          )

        if (language == null) {

          rejectInvalid(
            promise,
            "E_MLKIT_LANGUAGE",
            "Unsupported language: $languageTag"
          )

          return@AsyncFunction
        }

        if (
          language ==
          TranslateLanguage.ENGLISH
        ) {
          promise.resolve(false)
          return@AsyncFunction
        }

        val model =
          TranslateRemoteModel
            .Builder(language)
            .build()

        modelManager
          .deleteDownloadedModel(
            model
          )
          .addOnSuccessListener {

            promise.resolve(true)
          }
          .addOnFailureListener {
              error ->

            promise.reject(
              "E_MLKIT_MODEL_DELETE",
              error.message
                ?: "Model deletion failed.",
              error
            )
          }
      }

      AsyncFunction(
        "getDownloadedModels"
      ) {
          promise: Promise ->

        modelManager
          .getDownloadedModels(
            TranslateRemoteModel::class.java
          )
          .addOnSuccessListener {
              models ->

            val languages =
              models
                .map {
                  it.language
                }
                .toMutableSet()

            languages.add(
              TranslateLanguage.ENGLISH
            )

            promise.resolve(
              languages.sorted()
            )
          }
          .addOnFailureListener {
              error ->

            promise.reject(
              "E_MLKIT_MODEL_LIST",
              error.message
                ?: "Could not read downloaded models.",
              error
            )
          }
      }

      OnDestroy {

        synchronized(
          translatorLock
        ) {

          translators
            .values
            .forEach {
                translator ->

              translator.close()
            }

          translators.clear()
        }

        languageIdentifier.close()
      }
    }
}