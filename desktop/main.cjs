const { app, BrowserWindow, dialog, net, protocol, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { APP_ORIGIN, APP_SCHEME, isTrustedAppUrl, resolveBundlePath } = require("./security.cjs");

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      codeCache: true,
    },
  },
]);

function isSafeExternalUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function labelSerialPort(port) {
  const name = port.displayName || port.portName || "Serial device";
  const details = [port.vendorId && `VID ${port.vendorId}`, port.productId && `PID ${port.productId}`].filter(Boolean).join(" · ");
  return details ? `${name} — ${details}` : name;
}

async function chooseSerialPort(portList, callback) {
  if (!portList.length) return callback("");
  if (portList.length === 1) return callback(portList[0].portId);

  const response = await dialog.showMessageBox({
    type: "question",
    title: "Choose OpenBCI serial device",
    message: "Choose the serial device Flux EEG should use.",
    detail: "Select the OpenBCI dongle or board connected to this computer.",
    buttons: [...portList.map(labelSerialPort), "Cancel"],
    cancelId: portList.length,
    defaultId: 0,
    noLink: true,
  });
  callback(response.response < portList.length ? portList[response.response].portId : "");
}

function configureSession(ses) {
  ses.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    return permission === "serial" && isTrustedAppUrl(requestingOrigin);
  });
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL();
    callback(permission === "serial" && isTrustedAppUrl(requestingUrl));
  });
  ses.setDevicePermissionHandler(details => {
    return details.deviceType === "serial" && isTrustedAppUrl(details.origin);
  });
  ses.on("select-serial-port", (event, portList, webContents, callback) => {
    event.preventDefault();
    if (!isTrustedAppUrl(webContents.getURL())) return callback("");
    chooseSerialPort(portList, callback).catch(() => callback(""));
  });
}

function registerAppProtocol() {
  const bundleRoot = path.join(app.getAppPath(), "dist", "client");
  protocol.handle(APP_SCHEME, request => {
    let target = resolveBundlePath(bundleRoot, request.url);
    if (!target) return new Response("Not found", { status: 404 });
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      const requestPath = new URL(request.url).pathname;
      if (path.extname(requestPath)) return new Response("Not found", { status: 404 });
      target = path.join(bundleRoot, "index.html");
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}

function createWindow() {
  const smokeTest = process.argv.includes("--smoke-test");
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#061421",
    title: "Flux EEG",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(APP_ORIGIN)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) shell.openExternal(url);
  });
  mainWindow.webContents.once("did-fail-load", (_event, code, description) => {
    if (!smokeTest) return;
    console.error(`Desktop smoke test failed to load: ${code} ${description}`);
    process.exitCode = 1;
    app.quit();
  });
  mainWindow.webContents.once("did-finish-load", async () => {
    if (!smokeTest) return;
    const result = await mainWindow.webContents.executeJavaScript(`({
      title: document.title,
      hasRoot: Boolean(document.getElementById("root")?.textContent?.includes("Flux EEG")),
      hasWebSerial: typeof navigator.serial !== "undefined",
      secureContext: window.isSecureContext
    })`);
    console.log(`Desktop smoke test: ${JSON.stringify(result)}`);
    if (result.title !== "Flux EEG" || !result.hasRoot || !result.hasWebSerial || !result.secureContext) process.exitCode = 1;
    app.quit();
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(`${APP_ORIGIN}/`);
  return mainWindow;
}

app.setName("Flux EEG");
app.setAppUserModelId("org.fluxeeg.desktop");

app.whenReady().then(() => {
  registerAppProtocol();
  configureSession(session.defaultSession);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
