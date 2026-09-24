export const APP_UPDATE_CONFIG = {
  latestVersion: "1.5.0",
  minimumVersion: "1.3.0",

  androidUrl:
    "https://play.google.com/store/apps/details?id=com.paasora.partner",

  iosUrl:
    "https://apps.apple.com/app/YOUR_OWNER_APP_ID",

  // No `title`/`message` here on purpose. AppUpdateChecker forwards whatever
  // this object carries straight into AppUpdateModal, and English literals
  // would override the modal's translated defaults (updSoftTitle /
  // updSoftDesc / updHardTitle / updHardDesc) — which is how the update dialog
  // stayed English while the rest of the app was in Hindi. A real backend that
  // returns already-localised copy can still supply these fields and they will
  // be used.
};
