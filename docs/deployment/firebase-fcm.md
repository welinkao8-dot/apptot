# Firebase Cloud Messaging — TOT Driver

## Firebase project

- Project name: `TOT Angola`
- Project ID: `apptot-angola`
- Firebase plan: no billing plan was enabled.
- Android app IDs:
  - Driver: `com.taxitot.driver` (`1:427170349828:android:11b1f5b578992a9fe40651`)
  - Client: `com.taxitot.client` (`1:427170349828:android:897c37f5e1ce4c06e40651`)
- Android SDK config files are in each native app module: `driver-portal/mobile/android/app/google-services.json` and `client-portal/mobile/android/app/google-services.json`.

## Current implementation

- The driver Android app uses React Native Firebase App + Messaging. The Google Services Gradle plugin is configured and the `trip_offers` high-importance notification channel is created natively.
- When the driver signs in, the app registers the FCM device token through the authenticated Driver API. Token refresh is synchronized. Logout attempts to remove the server registration and deletes the local FCM token.
- On Android 13+, the driver must grant notification permission before switching online. If Firebase cannot provide or register a token, the app does not switch online.
- The Driver API stores tokens in `driver_fcm_tokens`, tied to the authenticated driver. Another account cannot claim an already registered token.
- Dispatch now considers all active drivers who are online and have a recent valid location, even when they have no active Socket.IO connection. Each persisted offer is sent to that driver's FCM tokens and still emitted over Socket.IO for foreground clients.
- Push payload contains only the trip ID and generic text; pickup address and customer details are fetched through the authenticated API after opening the app. Push TTL is 15 seconds, matching the current offer expiry.

## Required server secret before real delivery

The Driver API reads the raw service-account JSON from `FIREBASE_SERVICE_ACCOUNT_JSON`. Do not commit this key, paste it into a chat, or put it in a normal `.env` file that may be committed. Store it as a protected secret on the Driver API in Coolify.

To prepare that secret:

1. In Firebase project settings, open **Service accounts** and generate a private key for the Admin SDK service account.
2. Ensure the service account has the **Firebase Cloud Messaging API Admin** role (`roles/firebasecloudmessaging.admin`) on `apptot-angola`.
3. Ensure the **Firebase Cloud Messaging API (HTTP v1)** is enabled for this project.
4. Add the JSON key contents to the Driver API's protected `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable in Coolify. Do not add it to Git.

Official references: [send with the Admin SDK](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk), [service-account setup](https://firebase.google.com/docs/admin/setup), [FCM IAM roles](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging).

When the key is absent, the API still starts and stores device tokens, but skips FCM delivery. The Socket.IO path remains available while the app is connected.

## Database rollout

A Prisma migration creates `driver_fcm_tokens`. Apply it to the production database before the Driver API version that uses this model is started. The migration has not been applied to any remote database.

## Scope and verification

- Android driver offers are wired to FCM. Client push notifications are not implemented. iOS push still needs an iOS Firebase app, APNs credentials, native setup and device testing.
- Driver mobile Jest: 23 suites / 120 tests passed.
- Driver API Jest: 15 suites / 126 tests passed.
- Driver API Nest build passed.
- Prisma schema validation passed.
- No APK/Gradle/Metro/mobile-device build or test, secret creation, database migration, Coolify change, deploy, push or commit was performed.
- End-to-end delivery still requires the server secret, migration, GitHub APK build and a real Android notification test.


## Coolify rollout checklist and current blockers

Before updating the Driver API in Coolify:

1. Enable **Firebase Cloud Messaging API (HTTP v1)** in Google Cloud project `apptot-angola`.
2. Grant the Driver API service account **Firebase Cloud Messaging API Admin** (`roles/firebasecloudmessaging.admin`) on that project and verify the binding.
3. Store its service-account JSON only as the protected `FIREBASE_SERVICE_ACCOUNT_JSON` secret on the Driver API in Coolify.
4. Apply all pending Prisma migrations to the confirmed target database, in order, before starting the API version that queries `driver_fcm_tokens`.
5. Verify real delivery with a GitHub-built Android APK in foreground, background, and terminated-app cases.

**Verified status (2026-10-15):** migration `20261015220000_driver_fcm_tokens` is present in source but unapplied. `prisma migrate status` against local `tot_database` reported four pending migrations (`20261015190000_driver_location_accuracy`, `20261015200000_driver_vehicle_category`, `20261015210000_trip_quotes_service_fk`, and `20261015220000_driver_fcm_tokens`); all four were subsequently applied to local `tot_database`, and Prisma now reports the schema up to date. No remote database was changed. The IAM role has not been granted or verified: the authenticated Google account cannot view service accounts in this project. No private key was generated. Do not treat FCM as production-ready until all checklist items pass.
