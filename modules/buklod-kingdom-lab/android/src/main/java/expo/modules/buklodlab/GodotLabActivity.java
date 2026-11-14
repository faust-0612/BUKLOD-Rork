package expo.modules.buklodlab;

import org.godotengine.godot.GodotActivity;
import java.util.ArrayList;
import java.util.List;

/** One Godot instance in an isolated Android process, native-lab APK only. */
public final class GodotLabActivity extends GodotActivity {
  @Override
  public List<String> getCommandLine() {
    List<String> args = new ArrayList<>(super.getCommandLine());
    args.add("--main-pack");
    args.add("res://buklod_kingdom.zip");
    return args;
  }
}
