# BUKLOD Visual Transformation — forensic root cause, 13 November 2026

**The staging visual OTA was published, but not visually accepted.** Source: `00f532050343c4fee597c89ed637faa1c2131010`; Android runtime `1.3.2`. The native eight-screen visual acceptance matrix remained **0/8**.

## Primary defect (confirmed in exact published source)
A new `BuklodHomeDestinations.tsx` component introduced six big Home navigation cards: Community (Wall), Connect, My Cluster, My Profile, Bible, My Drawer. Four directly duplicate the persistent five-tab bottom navigation. It was rendered above the Home's actual data, pushing useful content down. A Return to Community Wall card at the bottom repeated Wall, and desktop Home duplicated Cluster, Connect, and Wall through its own cards.

These are deliberate code branches, **not** a weak-signal, cached OTA or renderer issue.

## Five root process failures
1. **No pixel/region design contract.** The approved Navigation 2.0 mockup showed dark premium header, side drawer, refined bottom nav and a social-feed-first hierarchy. The implementation mapped its visual-navigation goal to adding a launcher grid. The relationship of `/hub` Home vs `/buklod` Wall was not explicitly reconciled to the mockup.
2. **Additive, minimal source changes presented as wholesale transformation.** The original PR #791 changed the Wall screen by only +15/-1 lines, and the Marites component by +5/-4; the latter mostly dimensions. Fonts and radii were changed, not the fundamental composition.
3. **Misaligned tests.** Responsive column tests actually legitimized the duplicate launcher; others checked source tokens, compiled types, retained routes and successful exports. No negative assertion enforced unique nav ownership or verified image layout.
4. **No native rendered evidence.** The 16 successful browser diagnostic PNGs were unauthenticated web login/gate views. They showed that a web bundle rendered, not that the post-login Android UI looked like the expected reference. Native visual acceptance was correctly 0/8 but was not resolved.
5. **Release delivery confused with design completion.** EAS staging update was server-verified, not Android interaction- or visual-accepted. Using a successful publication as a "finished UI" signal was unjustified.

## Scoped DEV correction
Removed the default Home duplicate launcher, extra mobile Wall button and duplicate desktop Cluster/Connect/Wall shortcuts. Preserved underlying content, ads, feature search, QMP, notifications, native media, private Drawer, Bible, PTT, map, help, Health, Kingdom and all five canonical tab destinations. Added explicit rejection tests.

**Not a full eight-screen visual redesign.** Must compare authenticated Android BEFORE/AFTER renders against each approved reference (360px/430px widths, normal and enlarged fonts), correct actual mismatches, and test menu/navigation, keyboard, posts/comments/GIF, video, weak-signal states and scoped permissions. Never count web login screenshots or source compilation as native visual acceptance. This DEV correction is NOT published to staging or production.
