package expo.modules.buklodgenesisime;

import org.godotengine.godot.GodotActivity;
import java.util.ArrayList;
import java.util.List;

/** Genesis native engine, bundled project pack, isolated from social app process. */
public final class GodotGenesisActivity extends GodotActivity {
  @Override
  public List<String> getCommandLine() {
    List<String> args = new ArrayList<>(super.getCommandLine());
    args.add("--main-pack");
    args.add("res://buklod_genesis_kingdom.zip");
    return args;
  }
}
