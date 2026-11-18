# Operational information visibility

Operational diagnostics belong to administrators. Students and instructors retain the learning, account and communication actions relevant to their role.

- Email connection settings, last SMTP acceptance, worker timestamps, tests, raw delivery states and delivery logs are administrator-only. The API enforces access independently of page navigation.
- Instructors can preview and schedule messages for their own courses. They receive scheduling availability and their own campaign history; SMTP configuration flags and delivery diagnostic counts are omitted. An unavailable service gives a plain instruction to contact administration.
- Personal security settings retain account controls and session guidance. Environment labels and pre-launch hosting checks are administrator-only.
- Student checkout and payment guidance uses customer-facing instructions. Server verification details remain in the administrator view.
- Instructor video guidance describes uploading lessons and contacting administration when uploading is unavailable. Storage and stream configuration explanations remain administrative.
- Guardians retain masked absence notifications and subscription preferences. Provider identifiers, error codes and retry counts are omitted by the API; operational status explanations remain administrative.
- Student quiz guidance explains the deadline and saving answers without server implementation details. The server still enforces attempt timing.

Validation: email workflow and extension regression suites cover server-side role enforcement and diagnostic redaction. Browser checks exercise student and instructor communication/security pages and denied administrative routes, plus administrator diagnostics. Test data and SMTP traffic stay local.

Production rollout uses a separate deployment receipt. A source commit or local test does not confirm publication.
