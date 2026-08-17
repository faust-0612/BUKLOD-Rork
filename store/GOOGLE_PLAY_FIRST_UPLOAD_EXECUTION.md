# Google Play First Upload Execution Sheet

App: BUKLOD
Package: `org.mzbministry.buklod`

Google Play Developer Account owner: ______________________
Play Console app created: YES / NO
EAS Google Service Account uploaded: YES / NO
Service credential verified by: ___________________________

## Exact build
Version: 1.0.0
EAS Build ID: ____________________________________________
EAS Build URL: ___________________________________________
Command Center Release Candidate ID/reference: ____________

## Recommended first upload
Use the draft submission profile:

```bash
eas submit --platform android --profile google-play-draft
```

Result:
Submission ID: ___________________________________________
Play Console track shown: _________________________________
Release status: __________________________________________
Upload date/time: ________________________________________

## Before internal tester availability
- [ ] Privacy Policy URL entered.
- [ ] App access instructions entered.
- [ ] Data Safety started/reviewed.
- [ ] Content rating completed if required for tester distribution.
- [ ] Internal tester list/group prepared.
- [ ] Store/test listing shows the correct BUKLOD branding.

## Optional internal-test release
Only when intentional:

```bash
eas submit --platform android --profile google-play-internal
```

This profile explicitly targets `internal` with release status `completed`.

Internal release date/time: _______________________________
Tester group: ____________________________________________
Result: __________________________________________________
