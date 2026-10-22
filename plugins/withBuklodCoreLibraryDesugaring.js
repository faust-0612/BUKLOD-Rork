const {
  withAppBuildGradle,
} = require('expo/config-plugins');

const MARKER =
  'BUKLOD_CORE_LIBRARY_DESUGARING_R1';

const DESUGAR_COORDINATE =
  'com.android.tools:desugar_jdk_libs:2.1.5';

function withBuklodCoreLibraryDesugaring(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        `${MARKER}: expected Groovy android/app/build.gradle`
      );
    }

    let contents = config.modResults.contents;

    const enabledPattern =
      /coreLibraryDesugaringEnabled\s*(?:=\s*)?true/;

    if (!enabledPattern.test(contents)) {
      const compileOptionsPattern =
        /compileOptions\s*\{/;

      if (compileOptionsPattern.test(contents)) {
        contents = contents.replace(
          compileOptionsPattern,
          (match) =>
            `${match}\n        // ${MARKER}\n` +
            '        coreLibraryDesugaringEnabled true'
        );
      } else {
        const androidPattern =
          /android\s*\{/;

        if (!androidPattern.test(contents)) {
          throw new Error(
            `${MARKER}: android block not found`
          );
        }

        contents = contents.replace(
          androidPattern,
          (match) =>
            `${match}\n` +
            `    // ${MARKER}\n` +
            '    compileOptions {\n' +
            '        coreLibraryDesugaringEnabled true\n' +
            '    }\n'
        );
      }
    }

    const dependencyPattern =
      /coreLibraryDesugaring\s*(?:\(\s*)?['"]com\.android\.tools:desugar_jdk_libs:[^'"]+['"]\s*\)?/;

    if (!dependencyPattern.test(contents)) {
      const dependenciesPattern =
        /dependencies\s*\{/;

      if (!dependenciesPattern.test(contents)) {
        throw new Error(
          `${MARKER}: dependencies block not found`
        );
      }

      contents = contents.replace(
        dependenciesPattern,
        (match) =>
          `${match}\n    // ${MARKER}\n` +
          `    coreLibraryDesugaring '${DESUGAR_COORDINATE}'`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports =
  withBuklodCoreLibraryDesugaring;
