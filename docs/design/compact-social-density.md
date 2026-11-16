# BUKLOD compact layout density standard (2026-11-16)

Facebook is a reference for social-feed **density**, not a copied design.
All new screen work must reuse shared tokens in `buklodVisual.space`:
10dp screen inset, 8dp section rhythm, 10dp card inset, 6dp inline gap,
4dp micro gap. DB defaults in `buklodDesignTokens` must agree.

**Do not stack duplicate gutters** in nested cards; avoid ornamental hero space
and arbitrary tall empty sections. Content determines a note/status height.
Across scrollable avatar rails, bottom-align columns (avatar/name/rank remain
level) and let notes grow naturally up to five text lines. Do not hardcode
108/216dp placeholders merely to align short notes.

Do not remove functional clearances: Android status/nav/keyboard safe area,
minimum 44-48dp touch zones, font-scale-driven multiline text, media/map
aspect ratio, ad inventory and viewability, scroll windowing and accessibility.

The required Engineering Regression Gate now reviews **added** `src/` diff
lines. New literal `padding*` >24dp, `margin*` >20dp, or `gap` >16dp
is blocked until the author changes it or adds a directly adjacent
`layout-density-exception: <meaningful specific reason>`.
Existing legacy large spacing remains for subsequent separately-tested fixes;
this gate does not rewrite or fail unchanged baseline screens.

Release acceptance: compare Android and web on Home, Cluster, Wall, Connect,
Profile, light/dark, normal/large text, no-note/five-line/editing note,
keyboard, image/video/ad first-view and bottom navigation. Verify device
render, ads, insets and navigation **before** DEV → RC → production OTA.
Source checks alone never qualify as device/production proof.
