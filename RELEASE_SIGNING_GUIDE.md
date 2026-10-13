# Android release signing

Release builds must use CI-provided signing material. Never commit keystores, Base64 exports, passwords, aliases, or other signing credentials.

## GitHub Actions secrets

Configure these repository secrets without placing their values in source files:

- `ANDROID_KEYSTORE_BASE64_CLIENT`
- `ANDROID_KEYSTORE_BASE64_DRIVER`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS_CLIENT`
- `ANDROID_KEY_ALIAS_DRIVER`
- `ANDROID_KEY_PASSWORD`

The client mobile workflow decodes the client keystore and builds an Android App Bundle (`.aab`). Both Android projects require the four `ANDROID_KEYSTORE_*` / `ANDROID_KEY_*` environment variables consumed by Gradle; a release build stops if a required value is blank or the keystore file is missing. Debug builds continue to use the Android debug signing config.

Run the release configuration checks with `node --test scripts/release-signing.test.cjs`.

Local copies of release keystores and Base64 exports are ignored by Git and remain on disk when removed from the index. Keep them in a secure password manager or approved secret store.

Removing these files from the current Git index does not erase earlier Git history and does not rotate a signing key. Verify the relevant history and Play Store signing state separately before deciding whether a controlled history cleanup or key operation is needed.
