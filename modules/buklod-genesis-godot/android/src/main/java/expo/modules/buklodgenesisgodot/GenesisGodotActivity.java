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

  @Override
  public List<String> getCommandLine() {
    List<String> result = new ArrayList<>(super.getCommandLine());
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
