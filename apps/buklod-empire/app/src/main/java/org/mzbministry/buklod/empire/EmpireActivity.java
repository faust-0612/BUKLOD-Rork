package org.mzbministry.buklod.empire;
import org.godotengine.godot.GodotActivity;
import java.util.ArrayList;
import java.util.List;

/** Standalone native Godot host. No external Intent data, startup overrides,
 * Expo, browser, external pack downloads or account credentials. */
public final class EmpireActivity extends GodotActivity {
  @Override public List<String> getCommandLine() {
    // Default Godot Android startup reads project settings from APK assets.
    // No --main-pack, --scene, or caller-provided flags.
    return new ArrayList<>();
  }
}
