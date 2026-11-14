# HIMIG STUDIO — MASTER ENGINEERING BLUEPRINT v1.0
**Date:** 2026-11-14 · **Product:** Independent Expo Web music-production app · **Project:** `@faust_0612/himig-studio` · **EAS ID:** `05e7dab7-a7fd-490c-af52-a54a3609ec35`
**Owner's immutable goal:** Given the actual recorded draft (sung voice + guitar/piano) and owner-approved lyrics, produce a coherent complete polished song that preserves the author's melody, words, phrasing and musical identity. Genre, arrangement, voice timbre and instrumentation are configurable. Deliver editable stems, chord/key/tempo notes, before/after comparison and professional WAV/MP3 export. Never invent replacement lyrics, overwrite the melody without permission, or export an unverified draft as a completed master.

## 0. Honest status and release boundaries
- **Existing Expo Web v0.2.1:** Successfully deployed, runs basic spectral key/tempo estimation, generates **synthetic sine/harmonic instrument notes** in an offline JS worker, applies basic EQ/compression/delay, and combines original voice with backing. Stereo WAV/MP3 code exists. This was a *technical demo*, not a studio-quality music model.
- **Failure mode:** Simple note synthesis can sound like a ringtone; monophonic source mixing cannot cleanly distinguish guitar and voice; unsupported variations may yield wrong harmony. A successful 3:51 rendering test demonstrates completion/non-silence, **not musical validity**.
- **NO** guarantee of 100% automatic pitch/chords/lyrics or mastering, regardless of vendor. Confidence and listening approval are mandatory; certain rough recordings require rerecording/human editing.
- **Release boundary:** Keep BUKLOD Main source, Supabase and native OTA untouched; Himig is isolated under a dedicated path/branch and Expo EAS project. Do not deploy an audio-quality claim without listening QA on real input.

## 1. Product behavior (contract)
1. Owner uploads original 16/24-bit WAV, FLAC, M4A or MP3; large recording handled by resumable uploads. No raw audio automatically leaves the device without explicit processing consent.
2. Owner enters **approved** Tagalog/multilingual lyrics, specifies preferred voice mode: preserve original voice (default), clean/tune original, or consented alternative singer/voice conversion; optional gender/texture/range without impersonating anyone.
3. Choose target genre, intensity, natural instrumentation, key/BPM locked or suggested, guitar retention/remake preference, intro/verse/pre-chorus/chorus/bridge/outro.
4. Preview detected voice/guitar stems, tempo map, chord map, phrase/melody notes, and *uncertain sections*. Owner can correct notes/chords/lyrics timing before generation.
5. Generate at least two arrangement candidates **without modifying approved words**. Preview stems and A/B switch original vs candidate. Adjust per instrument.
6. Apply vocal correction conservatively; export only after full listening approval + automated quality gates. Deliver WAV 44.1/48 kHz stereo, MP3, individual stems, tempo/chord chart, version ID and settings.
7. On weak network, show incremental upload progress and accurate job state; cancel does not corrupt assets; retry uses the same idempotent job.

## 2. End-to-end architecture
```mermaid
flowchart LR
  U[Expo Router Web UI] -->|consented resumable upload| S[Private signed storage]
  U --> A[Authenticated API]
  A --> Q[Job queue + idempotency]
  Q --> P[GPU preprocessing: separation and analysis]
  P --> H[Human-correctable score, lyrics and harmony]
  H --> G[Constrained accompaniment generation]
  G --> M[Vocal restoration + multitrack mix]
  M --> V[Automated audio QC and owner listening gate]
  V -->|approved| E[WAV, MP3, stems, notes export]
  V -->|rejected| H
```
- **Expo Web frontend:** UI, uploads, audio player/stem mixer, lyrics/chords review, feedback, approve/export. Browser performs *lightweight* preview only; no multiminute PCM rendering/AI inference on phone main thread.
- **Secure API:** TypeScript or Python FastAPI; `POST /v1/projects`, `POST /v1/uploads/init`, `POST /v1/jobs` (idempotency key), `GET /v1/jobs/{id}`, `POST /v1/jobs/{id}/cancel`, `POST /v1/jobs/{id}/review`, `POST /v1/exports`. Server owns provider credentials; never expose GPU/model API keys in browser.
- **Storage/queue:** Per-user private object keys, encrypted blobs, short-lived signed PUT/GET, upload resume/checksum, immutable `original.wav`; task records with `QUEUED/ANALYZING/REVIEW_REQUIRED/GENERATING/MIXING/QC/READY/FAILED/CANCELLED`. Retries bounded and stage-idempotent; atomic result publication; expiry/delete user assets.
- **GPU audio workers:** Isolated Python workers with ffmpeg, torch/torchaudio, librosa, vetted separator and transcription models, GPU provider. CPU fallback only for preview/analysis. GPU budgets, concurrency caps, OOM recovery and backpressure.
- **Mixing/exports:** DAW-grade multitrack engine with 32-bit floating-point internals, licensed natural sample libraries/VST or professionally captured/generated audio stems, transparent mastering profiles.

## 3. Required production audio pipeline
**A. Ingest & quality diagnostic:** MIME/codec sniff, duration, corrupt header, peak/clipping, noise, stereo phase, room reverb, silence and tempo drift. Preserve raw upload verbatim; normalize analysis copy only.
**B. Source separation:** Candidate vocal/accompaniment separation (Demucs/modern UVR variants as replaceable modules). If voice/guitar bleed or watery artifacts: keep original vocal and request stems/new recording; never silently destroy consonants.
**C. Transcription & structure:** Detect singing F0, phrase boundaries, guitar chord/chroma, beat/downbeat and tempo map across song; identify repeated verses/choruses. Spotify Basic Pitch is a *helper for pitch/MIDI*, not a full audio-producer. Provide confidence per bar and mark ambiguous chords as editable.
**D. Lyric alignment:** Only approved words accepted. Force-align lyrics to a real vocal where feasible; cross-check syllables/phonemes for Filipino/Tagalog; ASR is advisory (singing recognition frequently wrong). No autogenerated lyric substitutions.
**E. Correction:** Transparent pitch/time processing with edit limits and bypass A/B; preserve vibrato, slides, breath and prosody. Lock melody and harmonic rhythm unless owner authorizes alterations. Avoid robotic quantization and artificial consonants.
**F. Arrangement:** Two production paths:
  - Primary high-control path: corrected chord/key/tempo/structure events --> professionally licensed multisampled / modeled instruments and drum performances --> editable multitrack audio. Avoid basic oscillator timbres and monotonous repeated four-bar accompaniment.
  - Optional generative path: a licensed official audio-to-audio API, e.g. **Stable Audio 3.0** candidate (verify terms, price, reference conditioning and exact requested capability). Use short sections/stems, not a one-click whole-song black box; reject outputs that change source melody or words.
**G. Voices:** Default **original vocal only** cleaned/tuned/mixed. Alternate voice modes only with licensed/consented source voice and identity permissions; RVC/SVC only changes timbre and **cannot be assumed to fix Tagalog diction, lyrics or musical timing**.
**H. Mix/master:** Gain staging, de-essing, tonal EQ, multiband compression where needed, transient control, room matching, vocal intelligibility, bus processing, appropriate stereo placement, true-peak limiter and loudness target for chosen profile. Delivery 44.1/48 kHz 24-bit WAV or lossless float internal; high bitrate MP3, stems/chords/lyrics metadata.

## 4. Recommended technologies and caveats (2026)
- **Demucs:** useful reference separator, Meta archive read-only since 2025; evaluate maintained derivatives and model-weight licensing instead of blindly adopting old package.
- **Basic Pitch:** permissively available transcription helper; works best one instrument at a time; needs confidence checks.
- **MusicGen/AudioCraft:** research/prototype reference. **Model weights CC BY-NC 4.0**; do not ship commercially under an assumed permissive license. Musical conditioning does not guarantee exact source arrangement.
- **Udio:** official Help Center states no public API; do not architect production around unverified third-party wrappers.
- **Suno:** do not assume third-party sites called "Suno API" are official or permit requested commercial/voice use; require contractual vendor verification.
- **Stable Audio 3.0:** official audio-to-audio API announced May 2026, up to six minutes; viable *evaluation candidate*, not a proven exact melody/lyric lock. Check costs and data-use terms before sending recordings.
- **RVC / So-VITS-SVC:** consent, licensing and evaluation essential. Not a replacement for vocal pronunciation or fully natural expressive singing.

## 5. Quality gates — zero false "studio master" claims
**Pre-generation:** Original source immutable hash; ownership/consent confirmed; lyrics explicit approval; confidence thresholds per bar; unresolved harmony flagged for manual correction; preserve or reject low-quality separation.
**Arrangement:** Chords/key agree with reviewed reference; no unexplained tempo or structure drift; no missing words or rearranged lyrics; no generated voice unless opt-in; audible natural instruments; no endless repeated ringtone pattern.
**DSP tests:** No clipped sample, suitable true peak (often <= -1 dBTP for streaming), reasonable LUFS by target, no silent gap/truncation, healthy stereo phase, no sudden volume jumps, no sibilant/vocal artifacts, no runaway distortion, latency alignment within reviewed tolerance.
**User gate:** Listen to selected segments and full song on speakers/headphones; compare original vs draft, answer explicit *melody preserved? lyrics complete? natural instruments? Tagalog clearly articulated?* Reject returns to edit with recorded feedback. Auto score is not proof of professional musical taste.
**Acceptance benchmark:** Curate at least 20 consented **real** guitar+voice songs including noisy/weak-network/Tagalog cases; evaluate separation bleed, melody transcription error, alignment, chord accuracy, naturalness by blind listening, perceived vocal quality, output reproducibility, cancellation and restore. No full-production status until acceptance passes owner-defined listening threshold.

## 6. Mobile UX and reliability requirements
- Upload card must scroll normally on Android while touching/swiping; invisible file input must **never** be a full-card touch interceptor; explicit label-to-file-input semantics with accessible focus.
- Selecting a file must not immediately block scroll or trigger expensive PCM analysis; detect file metadata quickly, then upload/preview asynchronously with progress and cancel.
- Resumable chunk upload and idempotent processing; no all-in-memory multi-minute PCM copies. Handle foreground/background, offline/connection drop, backpressure, timeouts, OOM, invalid codec and multiple rapid selections.
- Audio and export state persist when navigating; one renderer per project; pause/cancel safely; revoke object URLs after use.
- Unit and integration checks + actual Android browser touch-scroll acceptance required; static CSS tests are necessary but insufficient.

## 7. Milestone gates and planned execution
- **P0 UI/engineering repair:** Touch scroll and hidden overlay fix, cooperative chunk preparation, memory copy removal, pinned Expo project identity, CI tests. Status: implementation subject to CI + Android acceptance.
- **P1 Honest prototype:** Freeze synthetic generator as "Demo / Experimental" only; label its output as draft; no "studio-quality" claim; revalidate WAV/MP3 and format.
- **P2 Real preprocessing service:** Signed storage, API/queue, GPU worker, source separation, temporal/pitch/harmony map; owner correction screen and immutable lyric contract.
- **P3 Real instrument/singer system:** licensed sample-based natural backing and optionally licensed A2A model with melody/chord constraints; stem controls and arrangement candidates.
- **P4 DSP + quality gates:** vocal correction, mixing/mastering, loudness/phase tests, listening reviews, consented voices and Tagalog phoneme/word checks.
- **P5 Release/operations:** staging tests on same browser/runtime as production, measured cost per song, provider quota protection, privacy deletion, workload metrics, rollback, production Expo publish + live API smoke + real-song listener signoff.

## 8. Costs, owners and explicit limitations
- **Can develop:** frontend, backend, queue, adapters, tests, observability, CI/CD and Expo releases with the connected engineering tools.
- **Cannot honestly guarantee:** an arbitrary raw song turning into exactly faithful, perfectly natural "studio-quality" music fully automatically. Access to high-quality models, GPU inference or paid APIs/rights and real listening tests are external dependencies.
- **No unlimited free usage:** Running inference costs GPU/API credits/storage, even if admin UI access is free. Set credits per processing job, daily cap, budget alarm, no retry storm, and price disclosure before launch.
- **Security:** Never expose API tokens; role-scoped storage, limited signed URLs, malware/content probing, logs without raw recordings, user-approved deletion policy and no training on uploads without explicit consent.
- **Independent release:** Expo Hosting project `05e7dab7-a7fd-490c-af52-a54a3609ec35`; BUKLOD Main untouched. Reconcile versioned source and only promote after all acceptance gates pass.

## 9. Definition of DONE
**Frontend done** = deployed Expo build + actual Android scroll/render/export tests.  
**AI engine done** = real stem extraction, constrained arrangement, voice preservation, per-song quality gate with owned recording samples.  
**Product done** = repeated real-song blind listening acceptance and secure reliable exports, not just a unit-test pass or an accessible website URL.

**Important:** This document is the authorized target architecture, not a claim that the AI backend has been built.

## 10. Codex's measurable gates — implementation reconciliation (2026-11-14)
This addendum is authoritative for release claims:
1. **Vocal regeneration:** BANNED by default. The browser prototype only processes/mixes source PCM (which currently contains any guitar bleed). Verified no new AI singer. True vocal-only cleanup needs upstream separation.
2. **Locks:** Source audio and lyric text stay unchanged; target key and BPM require manual selection before an experimental WAV/MP3 export. Exact source pitch/lyric timing are NOT verified until source stem + alignment models are available.
3. **Stem separator:** Demucs or BS-Roformer implementation NOT DEPLOYED. The debug `source-cleanup` stage is **not** a vocal stem. Do not present it as one.
4. **Stage artifacts:** Original file, generated source-cleanup WAV + QC JSON, generated synthetic-instrument backing WAV + QC JSON, previewed mix and JSON gate report. A separated voice stem is unavailable and must be marked so. These download on demand to limit Android memory; no private cloud upload.
5. **Quality metrics:** Actual output PCM sample clipping, sample peak, approximate gated integrated LUFS, RMS and stereo correlation. True peak, sung-F0 drift, artifact detection and Whisper word matching return NOT_MEASURED. Never coerce UNKNOWN into PASS.
6. **Fallback:** A failed measured mix gate is rejected: no generated final mix is downloadable; raw original remains previewable/downloadable. A passing *measured* gate still produces REVIEW_REQUIRED, never certified. Only user-accepted experimental draft can be exported, with confirmed key/BPM.
7. **Test set:** `reports/real-song-acceptance.json` starts at 0/5; one known-bad prior export has real FFmpeg measurements but does **not** count as an owned source recording pair. Actual 5–10 original demos and their lyrics/owner permission are required to produce a truthfully completed report.
8. **Android:** GitHub node/Expo tests are automation; physical Infinix Android upload-scroll, playback, WAV/MP3 export and owner listening remain pending until actually performed.
9. **No mocks:** `qualityGate.ts` calculates real sample metrics; `songWorker.ts` still synthesizes instruments with oscillators; separation/ASR/generative audio backend are not running. Public app is labelled prototype, never studio master.
**Promotion gate:** Only the verified UI/safety improvements can be released under the Expo project. Reject any claim that the professional engine or real-song acceptance is DONE without evidence.

## 11. Server-side AI integration (current engineering scope)
Expo Router EAS Hosting runs Cloudflare Worker API routes in `web.output=server` mode. All model keys must stay in server-only `+api.ts` and `src/server/audioAi.ts` (never `EXPO_PUBLIC_` or browser bundle).
- `GET /api/ai/status`: live owner-adapter capabilities and disabled reason (public status, no secrets).
- `POST /api/ai/upload`: **owner bearer auth**, explicit consent, WAV/MP3/FLAC allowlist and 60MB limit, signs fal CDN upload; browser directly PUTs to vendor after consent.
- `POST /api/ai/separate`: locked owner bearer auth and **paid model enablement**, SAM Audio queue with singing-voice target, no synthesis of lyrics or singer. Queue returns an ID, never fake results.
- `GET /api/ai/job`: owner auth, validated fal queue URLs, progress/result. Output stems are not auto-approved; artifact, ASR and pitch checks remain NOT_MEASURED.
- `POST /api/ai/cancel`: owner-only cancellation (cannot guarantee refund).
- **Enablement guard:** `HIMIG_OWNER_TOKEN` (32+ random chars), `FAL_KEY`, `HIMIG_ENABLE_PAID_AI=true` must all be set in **private Expo Hosting server environment**. Without them, all paid endpoints return HTTP 503 and make **zero model calls**. This is a blocker, not a fake integration.
- Media privacy: vendor CDN URLs may be public and transient; user must opt in. Do not submit sensitive songs without a provider retention agreement.
- **Cost warning:** SAM Audio incurs per-request charges; no unlimited free inference. A shared multi-user API is NOT production-safe until persistent quotas, identity, isolated storage, lifecycle/cleanup and audit log are deployed. Keep owner-only until then.
- **Pilot status:** No real-source stem-job, Whisper alignment, high-fidelity accompaniment or native Android playback has been verified yet. This implementation is an authenticated vendor adapter, not a complete recording-to-studio-song generator.

## 12. Provider contract hardening and release evidence — 2026-11-14
- CDN input/output host allowlist supports both official `v3.fal.media` and `v3b.fal.media` for exact fal media paths. Never accept arbitrary `https:` URLs as finished stems.
- Changed signed upload initiation from alpha to stable `rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3`. Direct browser PUT honors validated vendor-requested signed-upload headers; no fal API key ever goes to the client.
- Job status and cancellation no longer trust client-supplied status/response/cancel URLs. Server reconstructs canonical queue URLs using a validated UUID, then checks full origin and path.
- Frontend includes safe job-ID recovery for weak network or reload: re-check the *same* charged request, rather than silently submitting another paid request. A synchronous in-flight lock prevents double taps. While the paid submit is pending, upload cancel is disabled to avoid hiding a job that may already have been accepted by fal.
- Route-level tests use mocked HTTP responses for input validation, upload initiation, queue submission, job result allowlists and cancellation. **They do not call or charge fal**.
- The user's fal account is currently out of credits. This is a real operational blocker, not a bug or mock. External paid inference is not claimed complete.
