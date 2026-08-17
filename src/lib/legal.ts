export const PRIVACY_NOTICE_VERSION = '1.0';
export const COMMUNITY_GUIDELINES_VERSION = '1.0';
export const PASTORAL_CARE_NOTICE_VERSION = '1.0';

export const privacyNotice = `
BUKLOD PRIVACY NOTICE — DRAFT FOR PRE-LAUNCH REVIEW
Version ${PRIVACY_NOTICE_VERSION}

BUKLOD is a devotional, discipleship, church-community, and pastoral-care application
operated for MZB Ministry Inc. This draft notice must be reviewed and completed by the
ministry's authorized privacy lead/DPO before public launch.

WHO CONTROLS THE DATA
Personal Information Controller:
MZB Ministry Inc.
Contact: [OFFICIAL PRIVACY/DPO EMAIL — REQUIRED BEFORE LAUNCH]
Address: [OFFICIAL ORGANIZATION ADDRESS — REQUIRED BEFORE LAUNCH]

WHAT BUKLOD MAY PROCESS
Depending on the feature used, BUKLOD may process account/profile information,
approved local church and BUKLOD-group membership, devotional participation,
reflections according to the privacy option chosen by the member, prayer requests
according to the visibility chosen by the member, learning progress, church event
participation, ministry assignments, directory preferences, visitor/follow-up records,
and limited pastoral-care records accessible only to authorized roles.

WHY THE DATA IS USED
Data is used to operate the app, deliver devotional and discipleship content, support
church communication, facilitate prayer/community interaction, manage member-selected
directory visibility, administer church activities, provide caring pastoral follow-up,
protect the community from abuse, maintain security, and generate authorized operational
reports.

PASTORAL PARTICIPATION SIGNALS
BUKLOD may calculate participation indicators such as devotional completion or periods
of inactivity. These are intended to help leaders know when a caring check-in may be
appropriate. They are not a measure of holiness, salvation, spiritual worth, or God's
approval of a person.

WHO MAY SEE DATA
Access depends on role and member-selected privacy settings. Some information may be
visible only to the member; some may be shared with an assigned BUKLOD leader, group,
local church, pastor/local administrator, or system administrator. Private reflections
and private prayer requests are not intended for ordinary leadership access.

RETENTION
BUKLOD should retain personal data only for as long as reasonably necessary for the
declared ministry/operational purpose, applicable legal requirements, or legitimate
recordkeeping needs. The ministry must publish a specific retention schedule before
production launch.

DATA SUBJECT RIGHTS
Users may submit requests concerning access, correction, objection, erasure/blocking,
data portability, or withdrawal of consent where applicable. Requests may be made in
the app under Account → Privacy & Data Rights or through the official privacy contact.

SECURITY
BUKLOD uses role-based access controls and database row-level security. No system can
guarantee absolute security. Members should use a strong password and should not share
sensitive prayer or pastoral information beyond what is necessary.

THIRD-PARTY SERVICE PROVIDERS
BUKLOD is designed to use service providers such as Expo and Supabase for app delivery,
authentication, database, notifications, and related infrastructure. Any additional
providers used in production must be listed in the final notice with the relevant
processing purpose.

CHANGES TO THIS NOTICE
When a required policy version changes, BUKLOD may ask the user to review the updated
notice before continuing.

This notice is a product draft, not a substitute for legal/privacy review.
`;

export const communityGuidelines = `
BUKLOD COMMUNITY GUIDELINES — Version ${COMMUNITY_GUIDELINES_VERSION}

1. Use BUKLOD to encourage, pray, learn, testify, and build up the church community.
2. Do not harass, shame, threaten, impersonate, or deliberately humiliate another person.
3. Do not post another person's private prayer concern, pastoral matter, contact details,
   photo, or personal information without an appropriate basis/permission.
4. Do not use BUKLOD to publicly rank another person's spirituality.
5. Keep disagreements respectful and focused on the topic.
6. Do not spam, scam, solicit fraudulently, or post malicious links.
7. Use the Report function when content may violate privacy or community safety.
8. Moderators may hide content while reviewing a report.
9. Pastoral care should prioritize direct human conversation over assumptions made from
   app activity.
10. Serious safety, legal, or safeguarding concerns should be handled through the
    ministry's appropriate offline procedures, not only through app comments.
`;

export const pastoralCareNotice = `
PASTORAL CARE & PARTICIPATION NOTICE — Version ${PASTORAL_CARE_NOTICE_VERSION}

BUKLOD records selected participation information so authorized leaders can support
discipleship and caring follow-up. Examples may include devotional completion dates,
learning progress, attendance records, and open follow-up status.

BUKLOD does not calculate a holiness score, salvation score, or spiritual-worth score.
A missed devotional can happen for many ordinary reasons such as work, illness, travel,
internet problems, or personal circumstances. Leaders are expected to use participation
signals as a reason to ask and listen—not as proof of a spiritual conclusion.

Pastoral notes are restricted leadership records and should contain only information
reasonably necessary for pastoral care. Sensitive or intimate details should not be
recorded merely because the system permits a note field.
`;
