const path = require("node:path");

const APP_SCHEME = "flux-eeg";
const APP_HOST = "app";
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

function isTrustedAppUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === `${APP_SCHEME}:` && parsed.host === APP_HOST;
  } catch {
    return false;
  }
}

function resolveBundlePath(root, requestUrl) {
  let parsed;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }
  if (!isTrustedAppUrl(parsed.href)) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  const relativeRequest = pathname.replace(/^[/\\]+/, "") || "index.html";
  const target = path.resolve(root, relativeRequest);
  const relativeTarget = path.relative(path.resolve(root), target);
  if (!relativeTarget || relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    return relativeRequest === "index.html" ? target : null;
  }
  return target;
}

module.exports = { APP_HOST, APP_ORIGIN, APP_SCHEME, isTrustedAppUrl, resolveBundlePath };
