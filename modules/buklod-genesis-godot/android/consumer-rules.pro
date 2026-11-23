# BUKLOD Genesis embedded Godot 4.7.2: engine C++ JNI resolves Java names/method signatures.
# Keep only the embedded Godot engine namespace and BUKLOD's Activity entrypoint.
# Retain normal release R8 shrinking for all other React Native and Android modules.
-keep class org.godotengine.godot.** { *; }
-keep class expo.modules.buklodgenesisgodot.GenesisGodotActivity { *; }
