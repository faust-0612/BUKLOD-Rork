# BUKLOD Classroom — Golden Production Baseline

Locked on 2026-09-09 after explicit user confirmation.

## Canonical live baseline

- EAS project: `@faust_0612/buklod-classroom`
- EAS project ID: `14100ed1-7f25-4551-9627-09d280498241`
- Immutable deployment ID: `37uiyahswg`
- Production URL: `https://buklod-classroom.expo.app`
- Canonical presentation: direct Classroom / Faculty Classroom experience. It MUST NOT render the BUKLOD Main desktop shell or an Extension landing page.

## Required visible/embedded identity markers

The canonical locked bundle was verified to contain these markers:

- `FACULTY CLASSROOM`
- `Active Students`
- `Active Faculty`
- `ENROLL STUDENT`
- `ADD FACULTY`
- `Faculty Team`
- `Classroom Tools`
- `Materials`
- `Assessments`
- `Group Activities`

## Forbidden production markers

Any candidate Classroom production build MUST fail before deployment if it contains any of these presentation markers:

- `BUKLOD EXTENSION APP`
- `Open BUKLOD Main`
- `Return to the Main BUKLOD ecosystem`
- `BUKLOD Main is the structure, doorway and session authority`

The Classroom production app must also not expose the BUKLOD Main desktop shell, including Main navigation/sidebar or Sponsored panel as the Classroom root experience.

## Release rule

Future Classroom work may change features, data, logic and presentation inside the Classroom product, but the direct Classroom identity above is the non-regression baseline. Do not use branch names, latest commits, Main source, or an Extension app shell as the source of truth for presentation. Before production promotion, export the candidate and verify the required Classroom identity and absence of all forbidden Main/Extension markers.

If a candidate fails this contract, do not deploy it. Keep production on `37uiyahswg` until a corrected candidate passes.
