package expo.modules.buklodgenesisgodot;

import android.content.Context;
import android.content.Intent;
import org.godotengine.godot.GodotActivity;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Keep Godot's release path restrictions enabled. Boot trusted APK resources
 * first, then mount the verified private content through the runtime API. */
public final class GenesisGodotActivity extends GodotActivity {
  static final String EXTRA_APPROVED_PACK = "buklod_genesis_approved_pack";
  static final String EXTRA_BUNDLED_ARENA = "buklod_native_arena";
  static final String EXTRA_BUNDLED_WORLD = "buklod_native_world";
  static final String EXTRA_LAUNCH_TOKEN = "buklod_launch_token";
  static final String BUNDLED_ARENA_ASSET = "godot/empire-arena.zip";
  private static final String BUNDLED_MAIN_PACK = "res://" + BUNDLED_ARENA_ASSET;
  private static final long MAX_PACK_BYTES = 256L * 1024L * 1024L;
  static final String RECEIPT_DIR = "buklod-genesis-launch";
  static boolean isAllowedWorld(String world) {
    return "arena".equals(world) || "kingdom".equals(world)
        || "community".equals(world) || "house".equals(world);
  }

  static Intent launchIntent(Context context, String world, File approved) throws Exception {
    if (!isAllowedWorld(world)) throw new IllegalArgumentException("Invalid world");
    File dir = new File(context.getFilesDir(), RECEIPT_DIR);
    if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Receipt storage unavailable");
    File[] old = dir.listFiles();
    if (old != null) {
      java.util.Arrays.sort(old, (a,b) -> Long.compare(b.lastModified(), a.lastModified()));
      for (int i=8; i<old.length; i++) if (old[i].isFile()) old[i].delete();
    }
    String token = UUID.randomUUID().toString();
    Intent intent = new Intent(context, GenesisGodotActivity.class)
        .putExtra(EXTRA_BUNDLED_WORLD, world)
        .putExtra(EXTRA_LAUNCH_TOKEN, token);
    if (approved != null) intent.putExtra(EXTRA_APPROVED_PACK, approved.getAbsolutePath());
    if (!context.getSharedPreferences("buklod-genesis-launch", Context.MODE_PRIVATE)
        .edit().putString("latest", token).commit()) throw new IllegalStateException("Receipt token unavailable");
    return intent;
  }

  @Override public List<String> getCommandLine() {
    List<String> result = new ArrayList<>(super.getCommandLine());
    // Never pass a filesystem path or scene override to Godot Main::setup.
    result.add("--main-pack");
    result.add(BUNDLED_MAIN_PACK);
    result.add("--");
    String world = getIntent() == null ? null : getIntent().getStringExtra(EXTRA_BUNDLED_WORLD);
    if (!isAllowedWorld(world)) world = "arena";
    result.add("--buklod-world=" + world);
    if (getIntent() == null) return result;
    String token = getIntent().getStringExtra(EXTRA_LAUNCH_TOKEN);
    if (token != null && token.matches("[0-9a-f-]{36}")) {
      result.add("--buklod-launch-token=" + token);
      result.add("--buklod-receipt=" + new File(new File(getFilesDir(), RECEIPT_DIR), token + ".json").getAbsolutePath());
    }
    String path = getIntent().getStringExtra(EXTRA_APPROVED_PACK);
    if (path != null) {
      try {
        File root = new File(getFilesDir(), "buklod-genesis-approved-packs").getCanonicalFile();
        File approved = new File(path).getCanonicalFile();
        if (approved.isFile() && root.equals(approved.getParentFile())
            && approved.getName().matches("[0-9a-f]{64}\\.zip")
            && approved.length() > 0L && approved.length() <= MAX_PACK_BYTES) {
          result.add("--buklod-content=" + approved.getAbsolutePath());
        } else {
          result.add("--buklod-content-rejected");
        }
      } catch (Exception ignored) {
        result.add("--buklod-content-rejected");
      }
    }
    return result;
  }
}
