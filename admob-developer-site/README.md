# BUKLOD separate developer website RC

Isolated static Firebase Hosting candidate. No project binding, credentials, billing setup, backend, app export, or publication. Homepage links to unchanged https://buklod.expo.app. Exact single publisher record has no trailing newline.

Cloud CI runs the official Hosting emulator with the demo-buklod-admob project ID; it never calls deploy. The RC artifact contains a SHA-256 manifest and HTTP/robots checks. Emulator success is not live Firebase or AdMob verification.

Before publication: confirm authorized Firebase project ownership, Spark/no billing, target site, existing content, and deploy permission. Do not overwrite an existing developer site. A new project/site requires owner approval. Publish/test preview only after access and scope are confirmed; promote the exact tested Firebase version to live after applicable approval. Then live-check HTTPS /app-ads.txt, content-type, exact bytes, robots, and non-file 404. Only after owner approves and changes the Play developer website to the actual verified hostname can AdMob recrawl it. No listing change is authorized by this RC.
