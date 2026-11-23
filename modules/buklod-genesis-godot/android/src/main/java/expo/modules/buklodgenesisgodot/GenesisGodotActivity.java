package expo.modules.buklodgenesisgodot;

import org.godotengine.godot.GodotActivity;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Genesis v2.0.6: same signed staging APK, same non-exported Godot 4.7.2 host.
 * Bundled ZIP remains an offline fallback. OTA content enters only via a
 * SHA-256 checked private ZIP staged by BuklodGenesisGodotModule.
 */
public final class GenesisGodotActivity extends GodotActivity {
  static final String EXTRA_APPROVED_PACK = "buklod_genesis_approved_pack";
  static final String EXTRA_BUNDLED_ARENA = "buklod_native_arena";
  static final String EXTRA_BUNDLED_WORLD = "buklod_native_world";
  private static final String BUNDLED_ARENA_ASSET = "godot/empire-arena.zip";
  private static final String BUNDLED_MAIN_PACK = "res://" + BUNDLED_ARENA_ASSET;
  private static final long MAX_PACK_BYTES = 256L * 1024L * 1024L;

  private static boolean isAllowedWorld(String world) {
    return world == null || "arena".equals(world) || "kingdom".equals(world)
        || "community".equals(world) || "house".equals(world);
  }

  private static void selectWorld(List<String> args, String world) {
    if ("kingdom".equals(world) || "community".equals(world) || "house".equals(world)) {
      args.add("--scene");
      args.add("res://scenes/WorldPreview.tscn");
      args.add("--");
      args.add("--buklod-world=" + world);
    }
  }

  @Override
  public List<String> getCommandLine() {
    List<String> result = new ArrayList<>(super.getCommandLine());
    if (getIntent() == null) return result;
    String world = getIntent().getStringExtra(EXTRA_BUNDLED_WORLD);
    if (!isAllowedWorld(world)) return result;

    String path = getIntent().getStringExtra(EXTRA_APPROVED_PACK);
    if (path != null) {
      // No file:// URLs, symlinks, external storage, arbitrary scene or remote execution.
      try {
        File root = new File(getFilesDir(), "buklod-genesis-approved-packs").getCanonicalFile();
        File approved = new File(path).getCanonicalFile();
        if (approved.isFile() && root.equals(approved.getParentFile())
            && approved.getName().matches("[0-9a-f]{64}\\.zip")
            && approved.length() > 0L && approved.length() <= MAX_PACK_BYTES) {
          result.add("--main-pack");
          result.add(approved.getAbsolutePath());
          selectWorld(result, world);
        }
      } catch (Exception ignored) {
        // Stage/canonical-path checks fail closed. No untrusted external pack fallback.
      }
      return result;
    }

    if (getIntent().getBooleanExtra(EXTRA_BUNDLED_ARENA, false) || world != null) {
      try (java.io.InputStream resource = getAssets().open(BUNDLED_ARENA_ASSET)) {
        if (resource.read() < 0) return result;
        result.add("--main-pack");
        result.add(BUNDLED_MAIN_PACK);
        selectWorld(result, world);
      } catch (java.io.IOException ignored) {
        // Never fall back to a remote package when built-in assets are absent.
      }
    }
    return result;
  }
}
