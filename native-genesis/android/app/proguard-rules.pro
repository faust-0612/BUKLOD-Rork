# Engine entry point and Native/JNI callbacks must survive R8.
-keep class org.godotengine.godot.** { *; }
-keep class org.mzbministry.buklod.genesis.nativeapp.GenesisGameActivity { *; }
