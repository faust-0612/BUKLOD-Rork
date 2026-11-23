plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val localKeystore = System.getenv("GENESIS_NATIVE_KEYSTORE_PATH").orEmpty()

android {
    namespace = "org.mzbministry.buklod.genesis.nativeapp"
    compileSdk = 36
    defaultConfig {
        applicationId = "org.mzbministry.buklod.genesis.nativeapp"
        minSdk = 28
        targetSdk = 35
        versionCode = 1
        versionName = "0.0.1-native-dev"
    }
    signingConfigs {
        create("ownerLocal") {
            if (localKeystore.isNotEmpty()) {
                storeFile = file(localKeystore)
                storePassword = System.getenv("GENESIS_NATIVE_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("GENESIS_NATIVE_KEY_ALIAS")
                keyPassword = System.getenv("GENESIS_NATIVE_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("debug") { isDebuggable = true }
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("ownerLocal")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    androidResources { noCompress += listOf("pck", "zip") }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("org.godotengine:godot:4.7.2.stable")
    implementation("androidx.core:core-ktx:1.17.0")
}
