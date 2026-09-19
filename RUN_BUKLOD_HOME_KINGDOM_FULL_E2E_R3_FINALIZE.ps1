$ErrorActionPreference = "Stop"

$QaRoot = "$HOME\BUKLOD_WORKSPACE\QA\HOME_KINGDOM_STANDALONE_R1"
$EvidencePath = "$HOME\Downloads\BUKLOD_HOME_KINGDOM_R3_AUTOMATED_PASS.txt"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " BUKLOD HOME + KINGDOM FULL E2E R3 - AUTHENTICATED FINALIZER" -ForegroundColor Cyan
Write-Host " ALL BUTTON FAMILIES + ALL 13 GAMES / NO SKIP / NO PROD DEPLOY" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan

if (-not (Test-Path $QaRoot)) { throw "QA clone missing: $QaRoot" }
if (-not (Test-Path $EvidencePath)) { throw "R3 automated PASS evidence missing. Run RUN_BUKLOD_HOME_KINGDOM_FULL_E2E_R3.ps1 first." }

Set-Location $QaRoot
$Head = (git rev-parse HEAD).Trim()
$Evidence = Get-Content $EvidencePath
$EvidenceHead = (($Evidence | Where-Object { $_ -like "HEAD=*" }) -replace "^HEAD=","").Trim()

if (-not ($Evidence -contains "BUKLOD HOME + KINGDOM R3 AUTOMATED = PASS")) {
  throw "Automated evidence is not PASS."
}
if ($EvidenceHead -ne $Head) {
  throw "HEAD moved after automated R3. Evidence=$EvidenceHead Current=$Head. Re-run automated R3."
}

function Require-Pass([string]$Id,[string]$Text,[string]$Url="") {
  Write-Host ""
  Write-Host "[$Id] $Text" -ForegroundColor Yellow
  if ($Url) {
    Write-Host "URL: $Url" -ForegroundColor DarkGray
  }
  $answer = (Read-Host "Type PASS only after executing EVERY action above; anything else stops").Trim().ToUpperInvariant()
  if ($answer -ne "PASS") {
    throw "FINALIZER STOPPED at $Id. This release candidate is NOT DONE."
  }
  Write-Host "PASS: $Id" -ForegroundColor Green
}

Write-Host "Exact automated HEAD confirmed: $Head" -ForegroundColor Green
Write-Host "Use QA-prefixed test values only. Do not enter sensitive personal information." -ForegroundColor DarkGray
Start-Process "http://127.0.0.1:8081"

Require-Pass "H1" "Sign in to local BUKLOD Main. Open HOME. Confirm same account appears, destination is 127.0.0.1:4173, buklod_surface_token_hash disappears, and no access/refresh token is present in the URL."
Require-Pass "H2" "Refresh Home. Confirm session persists and there is no white screen. Use browser Back/Forward once and confirm navigation remains sensible."
Require-Pass "H3" "Open 127.0.0.1:4173 in a private/incognito context with no standalone session. Confirm the Open from BUKLOD Main guard appears and its BUKLOD MAIN button returns to Main."

Require-Pass "B1" "Bahay header/switcher: use Refresh; switch between available homes; press New; press PHYSICAL and VIRTUAL type chips; exercise CREATE/CREATE BAHAY with QA-prefixed disposable data if needed."
Require-Pass "B2" "Open and Back out of ALL 10 Bahay room tiles: Sala, Kitchen, Kwarto, Shared Drawer, Calendar, Bills & Home Care, Garden, House Rules, Kasambahay, Compound/Subdivision."
Require-Pass "B3" "Sala: send a message; create a poll with 2+ options; vote; toggle an item done/pending; verify visible timestamps/counts update and realtime refresh does not duplicate rows."
Require-Pass "B4" "Kitchen: exercise due chips NONE/1H/TONIGHT/TOMORROW/WEEK, recurrence NONE/DAILY/WEEKLY/MONTHLY, rotation toggle, confirmation toggle, unassigned/member assignment, TASK/GROCERY/MEAL presets, item completion, and Recipe bridge."
Require-Pass "B5" "Confirmation controls: create/use a confirmation-required QA task. Exercise REJECT, complete again, then CONFIRM from another adult account. Confirm no repeated Garden Energy for toggling the same task and no duplicate recurring successor."
Require-Pass "B6" "Kwarto: exercise PRIVATE content/file path, upload a QA file, open it, and use the Reminders bridge. Confirm another member cannot see the private item/file."
Require-Pass "B7" "Shared Drawer: exercise SHARED upload/open and ADULTS upload/open. Confirm adult visibility works and a child/non-adult test account cannot see ADULTS content when available."
Require-Pass "B8" "Garden: press every plant-type chip, plant one QA plant, water it, and verify stage/energy change. Confirm standalone WEB does NOT display a fake rewarded-ad claim button."
Require-Pass "B9" "Kasambahay: press every role chip ADULT/TEEN/CHILD/HELPER/GUEST/ADMIN; exercise Invite. Toggle Quiet Hours, Messages, Tasks, Due notifications and SAVE. Exercise ACCEPT and DECLINE on QA invitations when available."
Require-Pass "B10" "Community: press COMPOUND/SUBDIVISION/VIRTUAL kinds; parent None and a parent option when available; Create Community; Join by code; select community; Add Goal; Send Message; verify linked-home data refreshes."
Require-Pass "B11" "Calendar: exercise EVENT and REMINDER composer paths, due choices, create items, toggle item state, and verify rendering after refresh."
Require-Pass "B12" "Bills & Home Care: exercise BILL, INVENTORY, MAINTENANCE, amount/detail/due fields, create/toggle items, and PERSONAL BUDGET TOOL bridge."
Require-Pass "B13" "House Rules: exercise RULE, NOTICE, EMERGENCY composer paths and item toggle behavior."
Require-Pass "B14" "Bahay root utilities: press Media, Recipe, Budget, Reminder. Confirm every bridge opens its correct standalone Home tool."
Require-Pass "B15" "Trigger at least one harmless validation/server error (for example an invalid invite or incomplete form). Confirm the error is visible, not a white screen, and the error banner dismiss button works."

Require-Pass "T1" "Recipe tool: exercise Back, inputs/options, Generate, successful AI result, local persistence after refresh/reopen, and visible error handling for an invalid/failed request." "http://127.0.0.1:4173/personal-home/recipe"
Require-Pass "T2" "Budget tool: exercise Back, EXPENSE/INCOME choice, fields, Add entry, delete/remove, persistence after refresh, and Points/Rewards bridge back to Main." "http://127.0.0.1:4173/personal-home/budget"
Require-Pass "T3" "Reminders tool: exercise Back, every preset/time option, Schedule Reminder, delete/remove, persistence after refresh, and web-safe reminder behavior." "http://127.0.0.1:4173/personal-home/reminders"
Require-Pass "T4" "Media tool: exercise Back and ALL 6 cards: BUKLOD IGPAT, Community Wall, Internet Radio, Spotify, YouTube Music, YouTube. Confirm internal cards bridge to Main and external providers open safely." "http://127.0.0.1:4173/personal-home/media"

Require-Pass "K1" "Return to local Main and open KINGDOM. Confirm same account, destination 127.0.0.1:4174, token hash is cleaned, then refresh with no white screen."
Require-Pass "K2" "Kingdom map: exercise Back; inspect KXP/stage/cleared/mastered display; confirm unlocked stations are clickable and Circle-Rank locked stations are visibly locked and cannot be opened from the map."
Require-Pass "K3" "Open 127.0.0.1:4174 in a private/incognito context without a standalone session. Confirm Open from BUKLOD Main guard appears."
Require-Pass "K4" "On Kingdom, test EN/TL language control/guide and return it to the preferred language. Confirm map labels remain readable and no overlay blocks station buttons."

Require-Pass "G1" "ACE Rescue Grid: open the route, exercise all current unique game controls (minimum source surface: 3), drive the game to a result, verify no white screen on refresh, then Back." "http://127.0.0.1:4174/games/ace-rescue-grid"
Require-Pass "G2" "ANGEL Kingdom Treasury: exercise all current unique game controls (minimum: 8), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/angel-kingdom-treasury"
Require-Pass "G3" "CHRISTIAN Civic Leadership: exercise all current unique game controls (minimum: 2), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/christian-civic-leadership"
Require-Pass "G4" "ELESUR Village Builder: exercise all current unique game controls (minimum: 2), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/elesur-village-builder"
Require-Pass "G5" "JAWO Forest Trail: exercise all current unique game controls (minimum: 4), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/jawo-forest-trail"
Require-Pass "G6" "LHEN Rhythm Journey: exercise all current unique game controls (minimum: 3), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/lhen-rhythm-journey"
Require-Pass "G7" "MITCH Restore the Mural: exercise all current unique game controls (minimum: 1), drive to the completion result, refresh, then Back." "http://127.0.0.1:4174/games/mitch-restore-mural"
Require-Pass "G8" "NIEL Mission Trail: exercise all current unique game controls (minimum: 2), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/niel-mission-trail"
Require-Pass "G9" "PHAN Enterprise Builder: exercise all current unique game controls (minimum: 5), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/phan-enterprise-builder"
Require-Pass "G10" "QUIN Discovery Expedition: exercise all current unique game controls (minimum: 2), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/quin-discovery-expedition"
Require-Pass "G11" "TRUDICE Wonder Path: exercise all current unique game controls (minimum: 3), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/trudice-playground-memory"
Require-Pass "G12" "VAN Living City Dispatch: exercise all current unique game controls (minimum: 2), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/van-living-city-dispatch"
Require-Pass "G13" "VHEN Farm to Market: exercise all current unique game controls (minimum: 10), drive to a result, refresh, then Back." "http://127.0.0.1:4174/games/vhen-farm-to-market"

Require-Pass "K5" "For at least one UNLOCKED Kingdom game, record map level/KXP before play, finish a valid result, return to map, and confirm server-backed current level/cleared state/reward display changes and survives refresh."
Require-Pass "K6" "Attempt a Circle-Rank LOCKED station from the map and confirm it stays disabled. Direct-route UI may render for QA, but the backend must not grant locked progression/rewards."
Require-Pass "K7" "Enter an invalid standalone Kingdom game URL and invalid Home tool URL. Confirm each redirects safely to its standalone root instead of a white screen."
Require-Pass "K8" "Across Home and Kingdom, repeat representative browser Back, Forward, hard Refresh, and direct URL navigation. Confirm no white screens, stuck loaders, or uncaught visible errors."

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host " AUTHENTICATED ALL-BUTTON FINALIZER = PASS" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green

$FinalEvidencePath = "$HOME\Downloads\BUKLOD_HOME_KINGDOM_R3_FINALIZER_PASS.txt"
@(
  "BUKLOD HOME + KINGDOM R3 FINALIZER = PASS",
  "HEAD=$Head",
  "ALL_PROMPTS=PASS",
  "NO_SKIP=TRUE",
  "NO_PRODUCTION_DEPLOY=TRUE",
  "MARK_DONE_IN_CHAT=REQUIRED"
) | Set-Content $FinalEvidencePath

Write-Host "Finalizer evidence: $FinalEvidencePath" -ForegroundColor DarkGray
Write-Host "SEND THIS FINALIZER OUTPUT BACK TO CHAT." -ForegroundColor Yellow
Write-Host "Do not merge/release yet; ChatGPT must verify exact-head evidence before marking DONE." -ForegroundColor Yellow
