const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const net = require('node:net');
const fs = require('node:fs/promises');
const { createLocalDatabase, registerLocalDatabaseHandlers } = require('./local-db.cjs');
const { createLanServer, registerLanServerHandlers } = require('./lan-server.cjs');

let mainWindow;
let localDatabase;
let lanServer;
let updateStatus = {
  state: 'idle',
  message: 'Update check not started',
  version: app.getVersion(),
  updateUrl: process.env.GI_UPDATE_URL || 'https://goldensea.gihostings.in/updates/win',
};

const CURRENCY = 'Rs.';
const APP_NAME = 'GI POS Restaurant';
const UPDATE_URL = process.env.GI_UPDATE_URL || 'https://goldensea.gihostings.in/updates/win';

function getAppIconPath() {
  return process.env.VITE_DEV_SERVER_URL
    ? path.join(__dirname, '..', 'public', 'app_icon.ico')
    : path.join(__dirname, '..', 'dist', 'app_icon.ico');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 650,
    minWidth: 1120,
    minHeight: 620,
    backgroundColor: '#f3f4f6',
    title: APP_NAME,
    icon: getAppIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.maximize();
}

app.whenReady().then(async () => {
  app.setName(APP_NAME);
  localDatabase = await createLocalDatabase(app);
  registerLocalDatabaseHandlers(ipcMain, () => localDatabase);
  if (shouldStartLanServer(localDatabase)) {
    lanServer = await createLanServer({
      app,
      getDatabase: () => localDatabase,
      printKot: printKotFromLanServer,
    });
  }
  registerLanServerHandlers(ipcMain, () => lanServer);
  registerUpdaterHandlers();
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (lanServer) {
    void lanServer.close();
  }

  if (localDatabase) {
    localDatabase.close();
  }
});

ipcMain.handle('printer:list', async () => {
  if (!mainWindow) {
    return [];
  }

  const printers = await mainWindow.webContents.getPrintersAsync();
  return printers.map((printer) => ({
    name: printer.name,
    displayName: printer.displayName || printer.name,
    isDefault: printer.isDefault,
    status: printer.status,
  }));
});

function registerUpdaterHandlers() {
  ipcMain.handle('updater:status', async () => updateStatus);
  ipcMain.handle('updater:check', async () => {
    if (!canUseAutoUpdater()) {
      setUpdateStatus('disabled', 'Auto update works only in the installed Windows app.');
      return updateStatus;
    }

    try {
      setUpdateStatus('checking', 'Checking for updates...');
      await autoUpdater.checkForUpdates();
    } catch (error) {
      setUpdateStatus('error', getUpdateErrorMessage(error));
    }

    return updateStatus;
  });
  ipcMain.handle('updater:install', async () => {
    if (updateStatus.state !== 'downloaded') {
      return updateStatus;
    }

    setUpdateStatus('installing', 'Installing update and restarting...');
    autoUpdater.quitAndInstall(false, true);
    return updateStatus;
  });
}

ipcMain.handle('lan-server:stop', async () => {
  if (lanServer) {
    await lanServer.close();
    lanServer = null;
  }

  return { ok: true };
});

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: UPDATE_URL,
  });

  autoUpdater.on('checking-for-update', () => {
    setUpdateStatus('checking', 'Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    setUpdateStatus('available', `Version ${info.version} available. Downloading...`, {
      latestVersion: info.version,
      updateInfo: pickUpdateInfo(info),
    });
    autoUpdater.downloadUpdate().catch((error) => {
      setUpdateStatus('error', getUpdateErrorMessage(error));
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    setUpdateStatus('not-available', 'You are using the latest version.', {
      latestVersion: info.version,
      updateInfo: pickUpdateInfo(info),
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(Number(progress.percent || 0));
    setUpdateStatus('downloading', `Downloading update ${percent}%...`, {
      percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateStatus('downloaded', `Version ${info.version} downloaded. Restart to install.`, {
      latestVersion: info.version,
      updateInfo: pickUpdateInfo(info),
      percent: 100,
    });
  });

  autoUpdater.on('error', (error) => {
    setUpdateStatus('error', getUpdateErrorMessage(error));
  });
}

function canUseAutoUpdater() {
  return app.isPackaged && process.platform === 'win32';
}

function shouldStartLanServer(database) {
  try {
    const snapshot = database?.getSnapshot?.();
    const appMode = parseJsonValue(snapshot?.values?.['pos-app-mode'], 'cloud');
    return appMode !== 'offline';
  } catch {
    return true;
  }
}

function parseJsonValue(value, fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value || fallback;
  }
}

function setUpdateStatus(state, message, extra = {}) {
  updateStatus = {
    ...updateStatus,
    ...extra,
    state,
    message,
    version: app.getVersion(),
    updateUrl: UPDATE_URL,
    updatedAt: new Date().toISOString(),
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', updateStatus);
  }
}

function pickUpdateInfo(info = {}) {
  return {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseName: info.releaseName,
  };
}

function getUpdateErrorMessage(error) {
  return error?.message || 'Update check failed';
}

function sanitizeFileName(value) {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || 'GI POS Report.pdf';
}

ipcMain.handle('receipt:print', async (_event, payload) => {
  const settings = payload?.settings || {};

  if (settings.mode === 'network') {
    await printNetworkReceipt(payload);
    return { ok: true, mode: 'network' };
  }

  await printSystemReceipt(payload);
  return { ok: true, mode: 'system' };
});

ipcMain.handle('receipt:print-test', async (_event, settings) => {
  const payload = {
    settings,
    order: {
      billNo: 'TEST',
      orderType: 'Printer Test',
      table: 'T1',
      cashier: 'Admin',
      paymentMethod: 'Cash',
      items: [
        { name: 'Chicken Biriyani', qty: 1, price: 150, total: 150 },
        { name: 'Green Salad', qty: 1, price: 70, total: 70 },
      ],
      subtotal: 220,
      discount: 0,
      tax: 0,
      serviceCharge: 0,
      total: 220,
      paid: 220,
      balance: 0,
      createdAt: new Date().toISOString(),
    },
  };

  if (settings?.mode === 'network') {
    await printNetworkReceipt(payload);
    return { ok: true, mode: 'network' };
  }

  await printSystemReceipt(payload);
  return { ok: true, mode: 'system' };
});

ipcMain.handle('report:print', async (_event, payload) => {
  const settings = payload?.settings || {};

  if (settings.mode === 'network') {
    await printNetworkReport(payload);
    return { ok: true, mode: 'network' };
  }

  await printSystemReport(payload);
  return { ok: true, mode: 'system' };
});

ipcMain.handle('report:export-pdf', async (_event, payload) => {
  const html = String(payload?.html || '');
  const defaultFileName = sanitizeFileName(String(payload?.defaultFileName || 'GI POS Report.pdf'));

  if (!html.trim()) {
    throw new Error('Report content is empty');
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Report PDF',
    defaultPath: defaultFileName.endsWith('.pdf') ? defaultFileName : `${defaultFileName}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  await exportHtmlToPdf(html, result.filePath);
  return { ok: true, path: result.filePath };
});

ipcMain.handle('kot:print', async (_event, payload) => {
  const settings = payload?.settings || {};

  if (settings.mode === 'network') {
    await printNetworkKot(payload);
    return { ok: true, mode: 'network' };
  }

  await printSystemKot(payload);
  return { ok: true, mode: 'system' };
});

ipcMain.handle('kot:print-test', async (_event, payload) => {
  const settings = payload?.settings || {};
  const station = payload?.station || 'Kitchen';
  const testPayload = {
    settings,
    kot: {
      billNo: 'TEST',
      station,
      orderType: 'Dining',
      table: 'T1',
      cashier: 'Admin',
      items: [
        { name: 'Chicken Biriyani', qty: 1, description: 'Less spicy' },
        { name: 'Fresh Lime', qty: 2, description: 'No ice' },
      ],
      createdAt: new Date().toISOString(),
    },
  };

  if (settings.mode === 'network') {
    await printNetworkKot(testPayload);
    return { ok: true, mode: 'network' };
  }

  await printSystemKot(testPayload);
  return { ok: true, mode: 'system' };
});

async function printKotFromLanServer(payload) {
  const settings = payload?.settings || {};

  if (settings.mode === 'network') {
    await printNetworkKot(payload);
    return { ok: true, mode: 'network' };
  }

  await printSystemKot(payload);
  return { ok: true, mode: 'system' };
}

function printSystemReceipt(payload) {
  return printSystemHtml(payload, buildReceiptHtml(payload), 'Printer rejected the print job');
}

function printSystemKot(payload) {
  return printSystemHtml(payload, buildKotHtml(payload), 'Printer rejected the KOT print job');
}

function printSystemReport(payload) {
  return printSystemHtml(payload, buildReportHtml(payload), 'Printer rejected the report print job');
}

function exportHtmlToPdf(html, filePath) {
  return new Promise((resolve, reject) => {
    const pdfWindow = new BrowserWindow({
      width: 900,
      height: 1200,
      show: false,
      webPreferences: {
        sandbox: true,
      },
    });

    pdfWindow.webContents.once('did-finish-load', async () => {
      try {
        const pdf = await pdfWindow.webContents.printToPDF({
          printBackground: true,
          margins: {
            marginType: 'custom',
            top: 0.35,
            bottom: 0.35,
            left: 0.35,
            right: 0.35,
          },
          pageSize: 'A4',
          landscape: false,
        });
        await fs.writeFile(filePath, pdf);
        pdfWindow.close();
        resolve();
      } catch (error) {
        pdfWindow.close();
        reject(error);
      }
    });

    pdfWindow.webContents.once('did-fail-load', (_event, _errorCode, errorDescription) => {
      pdfWindow.close();
      reject(new Error(errorDescription || 'Failed to render report PDF'));
    });

    pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}

function printSystemHtml(payload, html, rejectionMessage) {
  const settings = payload?.settings || {};
  const deviceName = settings.deviceName || '';

  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      width: 420,
      height: 700,
      show: false,
      webPreferences: {
        sandbox: true,
      },
    });

    printWindow.webContents.once('did-finish-load', async () => {
      try {
        const options = {
          silent: true,
          printBackground: true,
          margins: { marginType: 'none' },
          deviceName,
          pageSize: {
            width: getPaperWidthMicrons(settings),
            height: await getPrintContentHeightMicrons(printWindow),
          },
        };

        printWindow.webContents.print(options, (success, errorType) => {
          printWindow.close();
          if (success) {
            resolve();
          } else {
            reject(new Error(errorType || rejectionMessage));
          }
        });
      } catch (error) {
        printWindow.close();
        reject(error);
      }
    });

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}

async function getPrintContentHeightMicrons(printWindow) {
  const contentHeightPx = await printWindow.webContents.executeJavaScript(
    `
      Math.ceil(Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      ))
    `,
    true,
  );
  const safeHeightPx = Math.max(Number(contentHeightPx || 0), 120);
  const micronsPerCssPixel = 25400 / 96;
  const feedMarginMicrons = 6000;

  return Math.ceil(safeHeightPx * micronsPerCssPixel + feedMarginMicrons);
}

function getPaperWidthMicrons(settings) {
  return settings.paperWidth === '58' ? 58000 : 80000;
}

function getPrintableHtmlWidthMm(paperWidth) {
  return paperWidth === 58 ? 44 : 64;
}

function getEscPosColumns(settings) {
  return settings?.paperWidth === '58' ? 28 : 40;
}

function printNetworkReceipt(payload) {
  const settings = payload?.settings || {};
  const host = settings.ipAddress;
  const port = Number(settings.port || 9100);

  if (!host) {
    throw new Error('Printer IP address is required for network printing');
  }

  const body = buildEscPosReceipt(payload);

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    socket.setTimeout(6000);
    socket.once('timeout', () => finish(new Error('Network printer timed out')));
    socket.once('error', finish);
    socket.connect(port, host, () => {
      socket.write(body, (error) => {
        if (error) {
          finish(error);
          return;
        }
        socket.end();
      });
    });
    socket.once('close', () => finish());
  });
}

function printNetworkReport(payload) {
  const settings = payload?.settings || {};
  const host = settings.ipAddress;
  const port = Number(settings.port || 9100);

  if (!host) {
    throw new Error('Printer IP address is required for network report printing');
  }

  const body = buildEscPosReport(payload);

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    socket.setTimeout(6000);
    socket.once('timeout', () => finish(new Error('Network report printer timed out')));
    socket.once('error', finish);
    socket.connect(port, host, () => {
      socket.write(body, (error) => {
        if (error) {
          finish(error);
          return;
        }
        socket.end();
      });
    });
    socket.once('close', () => finish());
  });
}

function printNetworkKot(payload) {
  const settings = payload?.settings || {};
  const host = settings.ipAddress;
  const port = Number(settings.port || 9100);

  if (!host) {
    throw new Error('Printer IP address is required for network KOT printing');
  }

  const body = buildEscPosKot(payload);

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    socket.setTimeout(6000);
    socket.once('timeout', () => finish(new Error('Network KOT printer timed out')));
    socket.once('error', finish);
    socket.connect(port, host, () => {
      socket.write(body, (error) => {
        if (error) {
          finish(error);
          return;
        }
        socket.end();
      });
    });
    socket.once('close', () => finish());
  });
}

function buildReceiptHtml(payload) {
  const { order } = payload;
  const business = order.business || {};
  const businessName = business.name || 'Restaurant';
  const businessLines = [
    business.branch || 'Main Branch',
    business.address,
    business.phone ? `Phone: ${business.phone}` : '',
    business.email ? `Email: ${business.email}` : '',
    business.gstin ? `GSTIN: ${business.gstin}` : '',
  ]
    .filter(Boolean)
    .map((lineText) => `<div class="muted">${escapeHtml(lineText)}</div>`)
    .join('');
  const logo = business.logoDataUrl
    ? `<img class="logo" src="${escapeHtml(business.logoDataUrl)}" alt="" />`
    : '';
  const footerNote = business.footerNote || 'Thank you. Visit again.';
  const paperWidth = payload?.settings?.paperWidth === '58' ? 58 : 80;
  const printableWidth = getPrintableHtmlWidthMm(paperWidth);
  const now = new Date(order.createdAt || Date.now());
  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${formatQty(item.qty)} x ${money(item.price)}</span>
          </td>
          <td>${money(item.total)}</td>
        </tr>
      `,
    )
    .join('');
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 0; size: ${paperWidth}mm auto; }
          * { box-sizing: border-box; }
          body {
            margin: 0 auto;
            padding: 1.5mm 1.5mm 4mm;
            width: ${printableWidth}mm;
            color: #111;
            font-family: "Arial", "Segoe UI", sans-serif;
            font-size: ${paperWidth === 58 ? 9 : 11}px;
            overflow: visible;
          }
          .center { text-align: center; }
          .logo { width: ${paperWidth === 58 ? 34 : 44}px; height: ${paperWidth === 58 ? 34 : 44}px; object-fit: contain; margin-bottom: 4px; }
          .shop { font-size: ${paperWidth === 58 ? 14 : 17}px; font-weight: 800; letter-spacing: .3px; }
          .muted { color: #333; }
          .rule { border-top: 1px dashed #111; margin: 8px 0; }
          .meta, .totals { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .meta td, .totals td { padding: 2px 0; vertical-align: top; }
          .meta td:first-child { width: 34%; }
          .meta td:last-child { width: 66%; text-align: right; overflow-wrap: anywhere; }
          .totals td:first-child { width: 46%; }
          .totals td:last-child { width: 54%; text-align: right; white-space: nowrap; padding-left: 3px; }
          table.items { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .items td { padding: 5px 0; border-bottom: 1px dotted #999; vertical-align: top; }
          .items td:first-child { width: 64%; padding-right: 3px; overflow-wrap: anywhere; }
          .items td:last-child { width: 36%; text-align: right; white-space: nowrap; padding-left: 3px; }
          .items span { display: block; color: #444; margin-top: 1px; }
          .grand td { font-size: ${paperWidth === 58 ? 11 : 14}px; font-weight: 800; border-top: 1px solid #111; padding-top: 6px; }
          .thanks { margin-top: 10px; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="center">
          ${logo}
          <div class="shop">${escapeHtml(businessName)}</div>
          ${businessLines}
        </div>
        <div class="rule"></div>
        <table class="meta">
          <tr><td>Bill</td><td>${escapeHtml(order.billNo)}</td></tr>
          <tr><td>Date</td><td>${escapeHtml(formatDateTime(now))}</td></tr>
          <tr><td>Order</td><td>${escapeHtml(order.orderType)} ${order.table ? `/ ${escapeHtml(order.table)}` : ''}</td></tr>
          <tr><td>Cashier</td><td>${escapeHtml(order.cashier || 'Admin')}</td></tr>
        </table>
        <div class="rule"></div>
        <table class="items">${itemRows}</table>
        <div class="rule"></div>
        <table class="totals">
          <tr><td>Subtotal</td><td>${money(order.subtotal)}</td></tr>
          ${order.discount > 0 ? `<tr><td>Discount</td><td>-${money(order.discount)}</td></tr>` : ''}
          ${order.tax > 0 ? `
            <tr><td>CGST</td><td>${money(order.tax / 2)}</td></tr>
            <tr><td>SGST</td><td>${money(order.tax / 2)}</td></tr>
          ` : ''}
          ${order.serviceCharge > 0 ? `<tr><td>Service Charge</td><td>${money(order.serviceCharge)}</td></tr>` : ''}
          <tr class="grand"><td>Total</td><td>${money(order.total)}</td></tr>
        </table>
        <div class="rule"></div>
        <div class="center thanks">${escapeHtml(footerNote)}</div>
      </body>
    </html>
  `;
}

function buildReportHtml(payload) {
  const report = payload.report || {};
  const business = report.business || {};
  const businessName = business.name || 'Restaurant';
  const paperWidth = payload?.settings?.paperWidth === '58' ? 58 : 80;
  const printableWidth = getPrintableHtmlWidthMm(paperWidth);
  const generatedAt = new Date(report.generatedAt || Date.now());
  const orderTypeRows = (report.orderTypeRows || [])
    .map((row) => `<tr><td>${escapeHtml(row.label)} x ${Number(row.count || 0)}</td><td>${money(row.total)}</td></tr>`)
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 0; size: ${paperWidth}mm auto; }
          * { box-sizing: border-box; }
          body {
            margin: 0 auto;
            padding: 1.5mm 1.5mm 4mm;
            width: ${printableWidth}mm;
            color: #111;
            font-family: "Arial", "Segoe UI", sans-serif;
            font-size: ${paperWidth === 58 ? 9 : 11}px;
            overflow: visible;
          }
          .center { text-align: center; }
          .shop { font-size: ${paperWidth === 58 ? 14 : 17}px; font-weight: 800; }
          .title { margin-top: 4px; font-size: ${paperWidth === 58 ? 12 : 14}px; font-weight: 800; }
          .muted { color: #333; }
          .rule { border-top: 1px dashed #111; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          td { padding: 2px 0; vertical-align: top; }
          td:first-child { width: 54%; overflow-wrap: anywhere; }
          td:last-child { width: 46%; text-align: right; white-space: nowrap; padding-left: 3px; font-variant-numeric: tabular-nums; }
          .grand td { font-size: ${paperWidth === 58 ? 11 : 14}px; font-weight: 800; border-top: 1px solid #111; padding-top: 6px; }
          .section { margin-top: 8px; font-weight: 800; }
          .thanks { margin-top: 10px; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="shop">${escapeHtml(businessName)}</div>
          ${business.branch ? `<div class="muted">${escapeHtml(business.branch)}</div>` : ''}
          ${business.phone ? `<div class="muted">Phone: ${escapeHtml(business.phone)}</div>` : ''}
          <div class="title">${escapeHtml(report.title || 'Sales Report')}</div>
          <div class="muted">${escapeHtml(report.periodLabel || '')}</div>
          <div class="muted">${escapeHtml(formatDateTime(generatedAt))}</div>
        </div>
        <div class="rule"></div>
        <table>
          <tr class="grand"><td>Total Sales</td><td>${money(report.salesTotal)}</td></tr>
          <tr><td>Paid Bills</td><td>${Number(report.paidCount || 0)}</td></tr>
          <tr><td>Opening Cash</td><td>${money(report.openingCash)}</td></tr>
          <tr><td>Cash In Hand</td><td>${money(report.cashInHand)}</td></tr>
          <tr><td>UPI</td><td>${money(report.upiTotal)}</td></tr>
          <tr><td>Card</td><td>${money(report.cardTotal)}</td></tr>
          <tr><td>Bank</td><td>${money(report.bankTotal)}</td></tr>
          <tr><td>Due / Credit</td><td>${money(report.balanceTotal)}</td></tr>
          <tr><td>Discount</td><td>${money(report.discountTotal)}</td></tr>
          <tr><td>Expense</td><td>${money(report.expenseTotal)}</td></tr>
          <tr><td>Cash Expense</td><td>${money(report.cashExpenseTotal)}</td></tr>
          <tr><td>Bank Expense</td><td>${money(report.bankExpenseTotal)}</td></tr>
          <tr class="grand"><td>Net Amount</td><td>${money(report.netTotal)}</td></tr>
          <tr><td>Open Amount</td><td>${money(report.openTotal)}</td></tr>
          <tr><td>Open Bills</td><td>${Number(report.openCount || 0)}</td></tr>
        </table>
        <div class="rule"></div>
        <div class="section">Order Type</div>
        <table>${orderTypeRows || '<tr><td>No orders</td><td>0.00</td></tr>'}</table>
        <div class="rule"></div>
        <div class="center thanks">End of report</div>
      </body>
    </html>
  `;
}

function buildKotHtml(payload) {
  const kot = payload.kot || {};
  const paperWidth = payload?.settings?.paperWidth === '58' ? 58 : 80;
  const printableWidth = getPrintableHtmlWidthMm(paperWidth);
  const now = new Date(kot.createdAt || Date.now());
  const itemRows = (kot.items || [])
    .map(
      (item) => `
        <tr>
          <td class="qty">${formatQty(item.qty)}</td>
          <td>
            <strong>${escapeHtml(item.name)}</strong>
            ${item.description ? `<span>${escapeHtml(item.description)}</span>` : ''}
          </td>
        </tr>
      `,
    )
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 0; size: ${paperWidth}mm auto; }
          * { box-sizing: border-box; }
          body {
            margin: 0 auto;
            padding: 1.5mm 1.5mm 4mm;
            width: ${printableWidth}mm;
            color: #111;
            font-family: "Arial", "Segoe UI", sans-serif;
            font-size: ${paperWidth === 58 ? 11 : 13}px;
            overflow: visible;
          }
          .center { text-align: center; }
          .title { font-size: ${paperWidth === 58 ? 18 : 22}px; font-weight: 900; letter-spacing: .8px; }
          .station { margin-top: 2px; font-size: ${paperWidth === 58 ? 14 : 16}px; font-weight: 800; }
          .rule { border-top: 1px dashed #111; margin: 8px 0; }
          .meta { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .meta td { padding: 2px 0; vertical-align: top; }
          .meta td:first-child { width: 38%; }
          .meta td:last-child { width: 62%; text-align: right; overflow-wrap: anywhere; }
          table.items { width: 100%; border-collapse: collapse; }
          .items td { padding: 7px 0; border-bottom: 1px dotted #999; vertical-align: top; }
          .items .qty { width: 34px; font-size: ${paperWidth === 58 ? 17 : 20}px; font-weight: 900; text-align: center; }
          .items strong { display: block; font-size: ${paperWidth === 58 ? 13 : 15}px; }
          .items span { display: block; margin-top: 2px; color: #333; }
          .footer { margin-top: 10px; text-align: center; font-weight: 800; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="title">KOT</div>
          <div class="station">${escapeHtml(kot.station || 'Kitchen')}</div>
        </div>
        <div class="rule"></div>
        <table class="meta">
          <tr><td>Bill</td><td>${escapeHtml(kot.billNo || '')}</td></tr>
          <tr><td>Date</td><td>${escapeHtml(formatDateTime(now))}</td></tr>
          <tr><td>Order</td><td>${escapeHtml(kot.orderType || '')} ${kot.table ? `/ ${escapeHtml(kot.table)}` : ''}</td></tr>
          <tr><td>Cashier</td><td>${escapeHtml(kot.cashier || 'Admin')}</td></tr>
        </table>
        <div class="rule"></div>
        <table class="items">${itemRows}</table>
        <div class="rule"></div>
        <div class="footer">Kitchen Order Ticket</div>
      </body>
    </html>
  `;
}

function buildEscPosReceipt(payload) {
  const order = payload.order;
  const business = order.business || {};
  const businessName = business.name || 'Restaurant';
  const businessLines = [
    business.branch || 'Main Branch',
    business.address,
    business.phone ? `Phone: ${business.phone}` : '',
    business.email ? `Email: ${business.email}` : '',
    business.gstin ? `GSTIN: ${business.gstin}` : '',
  ].filter(Boolean);
  const footerNote = business.footerNote || 'Thank you. Visit again.';
  const columns = getEscPosColumns(payload?.settings);
  const parts = [];

  push(parts, [0x1b, 0x40]);
  align(parts, 1);
  size(parts, 0x11);
  text(parts, `${businessName}\n`);
  size(parts, 0x00);
  for (const businessLine of businessLines) {
    text(parts, `${businessLine}\n`);
  }
  text(parts, line(columns));
  align(parts, 0);
  text(parts, twoCol('Bill', order.billNo, columns));
  text(parts, twoCol('Date', formatDateTime(new Date(order.createdAt || Date.now())), columns));
  text(parts, twoCol('Order', `${order.orderType}${order.table ? ` / ${order.table}` : ''}`, columns));
  text(parts, twoCol('Cashier', order.cashier || 'Admin', columns));
  text(parts, line(columns));

  for (const item of order.items) {
    for (const wrapped of wrapText(item.name, columns - 12)) {
      text(parts, wrapped + '\n');
    }
    text(parts, twoCol(`${formatQty(item.qty)} x ${money(item.price)}`, money(item.total), columns));
  }

  text(parts, line(columns));
  text(parts, twoCol('Subtotal', money(order.subtotal), columns));
  if (order.discount > 0) {
    text(parts, twoCol('Discount', `-${money(order.discount)}`, columns));
  }
  if (order.tax > 0) {
    text(parts, twoCol('CGST', money(order.tax / 2), columns));
    text(parts, twoCol('SGST', money(order.tax / 2), columns));
  }
  if (order.serviceCharge > 0) {
    text(parts, twoCol('Service Charge', money(order.serviceCharge), columns));
  }
  text(parts, line(columns));
  bold(parts, true);
  text(parts, twoCol('TOTAL', money(order.total), columns));
  bold(parts, false);
  text(parts, line(columns));
  align(parts, 1);
  text(parts, `${footerNote}\n\n\n`);
  push(parts, [0x1d, 0x56, 0x42, 0x00]);

  return Buffer.concat(parts);
}

function buildEscPosKot(payload) {
  const kot = payload.kot || {};
  const columns = getEscPosColumns(payload?.settings);
  const parts = [];

  push(parts, [0x1b, 0x40]);
  align(parts, 1);
  size(parts, 0x11);
  text(parts, 'KOT\n');
  size(parts, 0x00);
  bold(parts, true);
  text(parts, `${kot.station || 'Kitchen'}\n`);
  bold(parts, false);
  text(parts, line(columns));
  align(parts, 0);
  text(parts, twoCol('Bill', kot.billNo || '', columns));
  text(parts, twoCol('Date', formatDateTime(new Date(kot.createdAt || Date.now())), columns));
  text(parts, twoCol('Order', `${kot.orderType || ''}${kot.table ? ` / ${kot.table}` : ''}`, columns));
  text(parts, twoCol('Cashier', kot.cashier || 'Admin', columns));
  text(parts, line(columns));

  for (const item of kot.items || []) {
    bold(parts, true);
    text(parts, `${formatQty(item.qty)} x ${item.name}\n`);
    bold(parts, false);
    if (item.description) {
      for (const wrapped of wrapText(`Note: ${item.description}`, columns)) {
        text(parts, wrapped + '\n');
      }
    }
  }

  text(parts, line(columns));
  align(parts, 1);
  text(parts, 'Kitchen Order Ticket\n\n\n');
  push(parts, [0x1d, 0x56, 0x42, 0x00]);

  return Buffer.concat(parts);
}

function buildEscPosReport(payload) {
  const report = payload.report || {};
  const business = report.business || {};
  const businessName = business.name || 'Restaurant';
  const columns = getEscPosColumns(payload?.settings);
  const parts = [];

  push(parts, [0x1b, 0x40]);
  align(parts, 1);
  size(parts, 0x11);
  text(parts, `${businessName}\n`);
  size(parts, 0x00);
  bold(parts, true);
  text(parts, `${report.title || 'Sales Report'}\n`);
  bold(parts, false);
  text(parts, `${report.periodLabel || ''}\n`);
  text(parts, `${formatDateTime(new Date(report.generatedAt || Date.now()))}\n`);
  text(parts, line(columns));
  align(parts, 0);
  bold(parts, true);
  text(parts, twoCol('Total Sales', money(report.salesTotal), columns));
  bold(parts, false);
  text(parts, twoCol('Paid Bills', String(Number(report.paidCount || 0)), columns));
  text(parts, twoCol('Opening Cash', money(report.openingCash), columns));
  text(parts, twoCol('Cash In Hand', money(report.cashInHand), columns));
  text(parts, twoCol('UPI', money(report.upiTotal), columns));
  text(parts, twoCol('Card', money(report.cardTotal), columns));
  text(parts, twoCol('Bank', money(report.bankTotal), columns));
  text(parts, twoCol('Due / Credit', money(report.balanceTotal), columns));
  text(parts, twoCol('Discount', money(report.discountTotal), columns));
  text(parts, twoCol('Expense', money(report.expenseTotal), columns));
  text(parts, twoCol('Cash Expense', money(report.cashExpenseTotal), columns));
  text(parts, twoCol('Bank Expense', money(report.bankExpenseTotal), columns));
  text(parts, twoCol('Net Amount', money(report.netTotal), columns));
  text(parts, twoCol('Open Amount', money(report.openTotal), columns));
  text(parts, twoCol('Open Bills', String(Number(report.openCount || 0)), columns));
  text(parts, line(columns));

  bold(parts, true);
  text(parts, 'Order Type\n');
  bold(parts, false);
  for (const row of report.orderTypeRows || []) {
    text(parts, twoCol(`${row.label} x ${Number(row.count || 0)}`, money(row.total), columns));
  }

  text(parts, line(columns));
  align(parts, 1);
  text(parts, 'End of report\n\n\n');
  push(parts, [0x1d, 0x56, 0x42, 0x00]);

  return Buffer.concat(parts);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value) {
  return `${CURRENCY} ${Number(value || 0).toFixed(2)}`;
}

function formatQty(value) {
  return Number(value || 0).toFixed(0);
}

function formatDateTime(value) {
  return value.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function push(parts, bytes) {
  parts.push(Buffer.from(bytes));
}

function text(parts, value) {
  parts.push(Buffer.from(ascii(value), 'ascii'));
}

function ascii(value) {
  return String(value ?? '').replace(/[^\x20-\x7E\n\r]/g, '');
}

function align(parts, value) {
  push(parts, [0x1b, 0x61, value]);
}

function bold(parts, enabled) {
  push(parts, [0x1b, 0x45, enabled ? 1 : 0]);
}

function size(parts, value) {
  push(parts, [0x1d, 0x21, value]);
}

function line(columns) {
  return `${'-'.repeat(columns)}\n`;
}

function twoCol(left, right, columns) {
  const safeLeft = ascii(left);
  const safeRight = ascii(right);
  const width = Math.max(1, columns - safeRight.length);
  const trimmedLeft = safeLeft.length > width ? safeLeft.slice(0, width - 1) : safeLeft;
  return `${trimmedLeft}${' '.repeat(Math.max(1, columns - trimmedLeft.length - safeRight.length))}${safeRight}\n`;
}

function wrapText(value, width) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let lineText = '';

  for (const word of words) {
    const next = lineText ? `${lineText} ${word}` : word;
    if (next.length > width) {
      if (lineText) {
        lines.push(lineText);
      }
      lineText = word;
    } else {
      lineText = next;
    }
  }

  if (lineText) {
    lines.push(lineText);
  }

  return lines.length ? lines : [''];
}
