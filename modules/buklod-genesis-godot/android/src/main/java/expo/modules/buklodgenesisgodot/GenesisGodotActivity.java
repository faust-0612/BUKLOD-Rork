package expo.modules.buklodgenesisgodot;

import org.godotengine.godot.GodotActivity;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * App-private, verified Godot pack only. Not exported, runs in dedicated process.
 * Does not load or display any unapproved 3D characters or placeholder map.
 */
public final class GenesisGodotActivity extends GodotActivity {
  static final String EXTRA_APPROVED_PACK = "buklod_genesis_approved_pack";
  static final String EXTRA_BUNDLED_ARENA = "buklod_native_arena";
  static final String EXTRA_BUNDLED_WORLD = "buklod_native_world";
  private static final String BUNDLED_ARENA_ASSET = "godot/empire-arena.zip";
  // GodotHost uses a resource URL for main packs embedded in APK assets.
  private static final String BUNDLED_MAIN_PACK = "res://" + BUNDLED_ARENA_ASSET;

  @Override
  public List<String> getCommandLine() {
    List<String> result = new ArrayList<>(super.getCommandLine());
    if (getIntent().getBooleanExtra(EXTRA_BUNDLED_ARENA, false)) {
      // Official Godot Android embedding supports --main-pack relative to APK assets.
      // No fallback to an untrusted external path if the embedded ZIP is absent.
      try (java.io.InputStream resource = getAssets().open(BUNDLED_ARENA_ASSET)) {
        if (resource.read() < 0) return result;
        result.add("--main-pack");
        result.add(BUNDLED_MAIN_PACK);
      } catch (java.io.IOException ignored) {
        // Fail closed. The Expo entrypoint checks asset presence before launch.
      }
      return result;
    }
    String world = getIntent().getStringExtra(EXTRA_BUNDLED_WORLD);
    if (world != null) {
      if (!world.equals("kingdom") && !world.equals("community") && !world.equals("house")) {
        return result;
      }
      try (java.io.InputStream resource = getAssets().open(BUNDLED_ARENA_ASSET)) {
        if (resource.read() < 0) return result;
        result.add("--main-pack");
        result.add(BUNDLED_MAIN_PACK);
        result.add("--scene");
        result.add("res://scenes/WorldPreview.tscn");
        result.add("--");
        result.add("--buklod-world=" + world);
      } catch (java.io.IOException ignored) {
        // No fallback to internet or untrusted scene paths.
      }
      return result;
    }
    String path = getIntent().getStringExtra(EXTRA_APPROVED_PACK);
    if (path == null) return result;
    try {
      File root = new File(getFilesDir(), "buklod-genesis-approved-packs").getCanonicalFile();
      File file = new File(path).getCanonicalFile();
      if (file.isFile() && file.getParentFile().equals(root) && file.getName().matches("[0-9a-f]{64}\\.pck")) {
        result.add("--main-pack");
        result.add(file.getAbsolutePath());
      }
    } catch (Exception ignored) {
      // Do not fall back to external files or untrusted packs.
    }
    return result;
  }
}
