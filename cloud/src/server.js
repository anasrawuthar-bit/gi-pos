const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createPool } = require('./db');
const { enforceUserLimit, parseUserLimit } = require('./user-limits');
const {
  getPlatformLoginError,
  normalizeAppPlatform,
  planSupportsPlatform,
  restaurantSupportsPlatform,
} = require('./platform-access');

const PORT = Number(process.env.PORT || 8080);
const ADMIN_TOKEN = process.env.GI_CLOUD_ADMIN_TOKEN || '';
const CLIENT_TOKEN_SECRET = process.env.GI_CLIENT_TOKEN_SECRET || ADMIN_TOKEN || 'gi-pos-local-client-secret';
const OFFLINE_LICENSE_SECRET = process.env.GI_OFFLINE_LICENSE_SECRET || ADMIN_TOKEN || 'gi-pos-local-offline-secret';
const UPDATE_DIR = process.env.GI_UPDATE_DIR || path.join(__dirname, '..', 'updates', 'win');
const ANDROID_UPDATE_DIR = process.env.GI_ANDROID_UPDATE_DIR || path.join(__dirname, '..', 'updates', 'android');
const DEFAULT_PAIRING_MINUTES = 30;
const UNLIMITED_DEVICE_LIMIT = 999999;
const CLIENT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const STAFF_DIRECTORY_KEY = 'pos-staff-user-directory';
const STAFF_PIN_RESET_KEY = 'pos-staff-pin-reset-commands';
const MAIN_APP_DEVICE_NAME = 'Main App';
const MAX_UPDATE_UPLOAD_BYTES = Number(process.env.GI_MAX_UPDATE_UPLOAD_BYTES || 350 * 1024 * 1024);
const PUBLIC_BASE_URL = normalizePublicBaseUrl(process.env.GI_PUBLIC_BASE_URL || '');
const pool = createPool();

const PLAN_CATALOG = [
  {
    id: 'premium',
    name: 'Premium',
    subtitle: 'Single counter cloud POS',
    maxDevices: 1,
    counterLabel: '1 counter only',
    localPos: false,
    platforms: ['windows'],
    deviceLimits: { windows: 1, android: 0 },
    capabilities: {
      billing: true, tables: true, menuManagement: true, customers: true, dues: true,
      reports: true, bluetoothPrinting: false, networkPrinting: true, cloudSync: true,
      localPosServer: false, qrOrdering: false,
    },
    features: [
      'One Windows billing counter',
      'Cloud backup and restore',
      'Client portal and app download',
      'Portal password and staff PIN reset',
    ],
  },
  {
    id: 'gold',
    name: 'Gold',
    subtitle: 'Local POS server plus cloud',
    maxDevices: UNLIMITED_DEVICE_LIMIT,
    counterLabel: 'Main PC plus local counters',
    localPos: true,
    platforms: ['windows'],
    deviceLimits: { windows: UNLIMITED_DEVICE_LIMIT, android: 0 },
    capabilities: {
      billing: true, tables: true, menuManagement: true, customers: true, dues: true,
      reports: true, bluetoothPrinting: false, networkPrinting: true, cloudSync: true,
      localPosServer: true, qrOrdering: true,
    },
    features: [
      'Main PC local POS server included',
      'Other PCs and mobile devices can work through Main PC on LAN',
      'Cloud backup and restore',
      'Client portal, app download, and staff PIN reset',
    ],
  },
  {
    id: 'offline',
    name: 'Offline',
    subtitle: 'Single PC local POS',
    maxDevices: 1,
    counterLabel: '1 offline PC',
    localPos: false,
    platforms: ['windows'],
    deviceLimits: { windows: 1, android: 0 },
    capabilities: {
      billing: true, tables: true, menuManagement: true, customers: true, dues: true,
      reports: true, bluetoothPrinting: false, networkPrinting: true, cloudSync: false,
      localPosServer: false, qrOrdering: false,
    },
    features: [
      'One Windows billing counter',
      'One-time cloud activation and restore',
      'Local SQLite billing after activation',
      'No cloud backup, local POS server, or QR order portal',
    ],
  },
  {
    id: 'android',
    name: 'Android',
    subtitle: 'Native mobile POS with offline billing',
    maxDevices: 1,
    counterLabel: '1 Android device',
    localPos: false,
    platforms: ['android'],
    deviceLimits: { windows: 0, android: 1 },
    capabilities: {
      billing: true, tables: true, menuManagement: true, customers: true, dues: true,
      reports: true, bluetoothPrinting: true, networkPrinting: true, cloudSync: true,
      localPosServer: false, qrOrdering: false,
    },
    features: [
      'One native Android phone or tablet',
      'Offline-first SQLite billing after activation',
      'Bluetooth and network thermal printing',
      'Cloud backup and sync when internet is available',
      'Tables, menu, customers, dues, and reports',
    ],
  },
];
const PLAN_CATALOG_JSON = JSON.stringify(PLAN_CATALOG);
const PLAN_CARDS_HTML = PLAN_CATALOG.map(
  (plan) => `
    <article class="plan-card ${plan.id === 'gold' ? 'featured' : ''}">
      <h3>${plan.name}<span class="badge ${plan.id === 'gold' ? 'good' : ''}">${plan.counterLabel}</span></h3>
      <p>${plan.subtitle}</p>
      <div class="plan-meta">
        <span class="badge">${plan.platforms.map((platform) => platform === 'android' ? 'Android' : 'Windows').join(' + ')}</span>
        <span class="badge ${plan.localPos ? 'good' : 'warn'}">${plan.localPos ? 'Local POS included' : 'Local POS not included'}</span>
        <span class="badge">Yearly / custom expiry</span>
      </div>
      <ul>${plan.features.map((feature) => `<li>${feature}</li>`).join('')}</ul>
    </article>
  `,
).join('');

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'OPTIONS') {
      sendJson(response, 204, {});
      return;
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, service: 'gi-pos-cloud' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/public/config') {
      sendJson(response, 200, getPublicConfig(request));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/connect') {
      sendHtml(response, createConnectHtml(request));
      return;
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/signup')) {
      sendHtml(response, SIGNUP_HTML);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/portal') {
      sendHtml(response, PORTAL_HTML);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/admin') {
      sendHtml(response, ADMIN_HTML);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/download/windows') {
      await serveWindowsDownload(response);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/download/android') {
      await serveAndroidDownload(response);
      return;
    }

    if (request.method === 'GET' && url.pathname.startsWith('/updates/win/')) {
      await serveUpdateFile(response, url.pathname);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/signup') {
      await handleSignup(request, response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/client/login') {
      await handleClientLogin(request, response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/client/password/reset') {
      await handleClientPasswordReset(request, response);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/client/me') {
      await withClient(request, response, async (context) => handleClientMe(response, context));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/client/password/change') {
      await withClient(request, response, async (context) => handleClientPasswordChange(request, response, context));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/client/recovery-code') {
      await withClient(request, response, async (context) => handleClientRecoveryCode(response, context));
      return;
    }

    const clientPairingMatch = url.pathname.match(/^\/api\/v1\/client\/restaurants\/([^/]+)\/pairing-codes$/);
    if (request.method === 'POST' && clientPairingMatch) {
      await withClient(request, response, async (context) =>
        handleClientPairingCode(request, response, context, clientPairingMatch[1]),
      );
      return;
    }

    const clientDeviceActivateMatch = url.pathname.match(/^\/api\/v1\/client\/restaurants\/([^/]+)\/devices\/activate$/);
    if (request.method === 'POST' && clientDeviceActivateMatch) {
      await withClient(request, response, async (context) =>
        handleClientDeviceActivate(request, response, context, clientDeviceActivateMatch[1]),
      );
      return;
    }

    const clientStaffPinResetMatch = url.pathname.match(/^\/api\/v1\/client\/restaurants\/([^/]+)\/staff-pin-reset$/);
    if (request.method === 'POST' && clientStaffPinResetMatch) {
      await withClient(request, response, async (context) =>
        handleClientStaffPinReset(request, response, context, clientStaffPinResetMatch[1]),
      );
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/devices/register') {
      await handleDeviceRegister(request, response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/devices/pair') {
      await handleDevicePair(request, response);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/admin/restaurants') {
      requireAdmin(request);
      await handleAdminRestaurants(response);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/admin/updates/windows') {
      requireAdmin(request);
      await handleAdminUpdateStatus(response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/admin/updates/windows') {
      requireAdmin(request);
      await handleAdminUpdateUpload(request, response);
      return;
    }

    const approveMatch = url.pathname.match(/^\/api\/v1\/admin\/restaurants\/([^/]+)\/approve$/);
    if (request.method === 'POST' && approveMatch) {
      requireAdmin(request);
      await handleAdminApprove(request, response, approveMatch[1]);
      return;
    }

    const suspendMatch = url.pathname.match(/^\/api\/v1\/admin\/restaurants\/([^/]+)\/suspend$/);
    if (request.method === 'POST' && suspendMatch) {
      requireAdmin(request);
      await handleAdminSuspend(response, suspendMatch[1]);
      return;
    }

    const adminPasswordResetMatch = url.pathname.match(/^\/api\/v1\/admin\/restaurants\/([^/]+)\/password-reset$/);
    if (request.method === 'POST' && adminPasswordResetMatch) {
      requireAdmin(request);
      await handleAdminPasswordReset(request, response, adminPasswordResetMatch[1]);
      return;
    }

    const pairingMatch = url.pathname.match(/^\/api\/v1\/admin\/restaurants\/([^/]+)\/pairing-codes$/);
    if (request.method === 'POST' && pairingMatch) {
      requireAdmin(request);
      await handleAdminPairingCode(request, response, pairingMatch[1]);
      return;
    }

    const deviceStatusMatch = url.pathname.match(/^\/api\/v1\/admin\/devices\/([^/]+)\/status$/);
    if (request.method === 'POST' && deviceStatusMatch) {
      requireAdmin(request);
      await handleAdminDeviceStatus(request, response, deviceStatusMatch[1]);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/sync/push') {
      await withDevice(request, response, async (context) => handleSyncPush(request, response, context));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/sync/pull') {
      await withDevice(request, response, async (context) => handleSyncPull(response, context, url.searchParams));
      return;
    }

    sendJson(response, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    sendJson(response, error.statusCode || 500, { ok: false, error: error.message || 'Server error' });
  }
});

async function handleSignup(request, response) {
  const body = await readJson(request);
  const businessName = String(body.businessName || '').trim();
  const ownerName = String(body.ownerName || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!businessName || !ownerName) {
    sendJson(response, 400, { ok: false, error: 'Business name and owner name are required' });
    return;
  }

  if (!phone && !email) {
    sendJson(response, 400, { ok: false, error: 'Phone or email is required' });
    return;
  }

  if (password.length < 6) {
    sendJson(response, 400, { ok: false, error: 'Password must be at least 6 characters' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const duplicate = await client.query(
      `
        SELECT id
        FROM accounts
        WHERE ($1 <> '' AND lower(email) = lower($1))
           OR ($2 <> '' AND phone = $2)
        LIMIT 1
      `,
      [email, phone],
    );

    if (duplicate.rows[0]) {
      await client.query('ROLLBACK');
      sendJson(response, 409, { ok: false, error: 'A signup already exists for this phone/email' });
      return;
    }

    const accountResult = await client.query(
      `
        INSERT INTO accounts (owner_name, phone, email, password_hash, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id, owner_name, phone, email, status, created_at
      `,
      [ownerName, phone, email, hashPassword(password)],
    );
    const account = accountResult.rows[0];
    const restaurantResult = await client.query(
      `
        INSERT INTO restaurants (account_id, name, owner_name, phone, email, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING id, name, owner_name, phone, email, status, created_at
      `,
      [account.id, businessName, ownerName, phone, email],
    );
    await client.query('COMMIT');

    sendJson(response, 201, {
      ok: true,
      message: 'Signup received. GI admin approval is required before connecting the POS app.',
      account,
      restaurant: restaurantResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function handleClientLogin(request, response) {
  const body = await readJson(request);
  const login = String(body.login || '').trim().toLowerCase();
  const password = String(body.password || '');
  const appPlatform = normalizeAppPlatform(body.appPlatform);

  if (!login || !password) {
    sendJson(response, 400, { ok: false, error: 'Login and password are required' });
    return;
  }

  const result = await pool.query(
    `
      SELECT id, owner_name, phone, email, password_hash, status, created_at
      FROM accounts
      WHERE lower(email) = lower($1) OR phone = $1
      LIMIT 1
    `,
    [login],
  );
  const account = result.rows[0];

  if (!account || !verifyPassword(password, account.password_hash)) {
    sendJson(response, 403, { ok: false, error: 'Invalid login or password' });
    return;
  }

  if (appPlatform) {
    const compatibleRestaurants = await getAccountRestaurants(account.id, appPlatform);
    if (compatibleRestaurants.length === 0) {
      sendJson(response, 403, { ok: false, error: getPlatformLoginError(appPlatform) });
      return;
    }
  }

  sendJson(response, 200, {
    ok: true,
    token: createClientToken(account.id, appPlatform),
    appPlatform,
    account: publicAccount(account),
  });
}

async function handleClientPasswordReset(request, response) {
  const body = await readJson(request);
  const login = String(body.login || '').trim().toLowerCase();
  const recoveryCode = normalizeRecoveryCode(String(body.recoveryCode || ''));
  const newPassword = String(body.newPassword || '');

  if (!login || !recoveryCode || !newPassword) {
    sendJson(response, 400, { ok: false, error: 'Login, recovery code, and new password are required' });
    return;
  }

  if (newPassword.length < 6) {
    sendJson(response, 400, { ok: false, error: 'Password must be at least 6 characters' });
    return;
  }

  const result = await pool.query(
    `
      SELECT id, recovery_code_hash
      FROM accounts
      WHERE lower(email) = lower($1) OR phone = $1
      LIMIT 1
    `,
    [login],
  );
  const account = result.rows[0];

  if (!account || !account.recovery_code_hash || account.recovery_code_hash !== hashSecret(recoveryCode)) {
    sendJson(response, 403, { ok: false, error: 'Invalid recovery code' });
    return;
  }

  await pool.query(
    `
      UPDATE accounts
      SET password_hash = $1,
          recovery_code_hash = '',
          recovery_code_set_at = NULL,
          updated_at = now()
      WHERE id = $2
    `,
    [hashPassword(newPassword), account.id],
  );

  sendJson(response, 200, { ok: true, message: 'Password reset successfully. Login with the new password.' });
}

async function handleClientMe(response, context) {
  sendJson(response, 200, {
    ok: true,
    account: publicAccount(context.account),
    restaurants: await getAccountRestaurants(context.account.id, context.appPlatform),
    planCatalog: PLAN_CATALOG,
    payment: {
      enabled: false,
      message: 'Online payment is not enabled yet. Subscription payment is handled manually by GI.',
    },
  });
}

async function handleClientPasswordChange(request, response, context) {
  const body = await readJson(request);
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');

  if (!currentPassword || !newPassword) {
    sendJson(response, 400, { ok: false, error: 'Current password and new password are required' });
    return;
  }

  if (newPassword.length < 6) {
    sendJson(response, 400, { ok: false, error: 'Password must be at least 6 characters' });
    return;
  }

  if (!verifyPassword(currentPassword, context.account.password_hash)) {
    sendJson(response, 403, { ok: false, error: 'Current password is wrong' });
    return;
  }

  await pool.query('UPDATE accounts SET password_hash = $1, updated_at = now() WHERE id = $2', [
    hashPassword(newPassword),
    context.account.id,
  ]);

  sendJson(response, 200, { ok: true, message: 'Password changed successfully' });
}

async function handleClientRecoveryCode(response, context) {
  const code = createRecoveryCode();

  await pool.query(
    `
      UPDATE accounts
      SET recovery_code_hash = $1,
          recovery_code_set_at = now(),
          updated_at = now()
      WHERE id = $2
    `,
    [hashSecret(code), context.account.id],
  );

  sendJson(response, 201, {
    ok: true,
    code,
    message: 'Recovery code generated. Save it safely; it is shown only once.',
  });
}

async function handleClientPairingCode(request, response, context, restaurantId) {
  const body = await readJson(request);
  const deviceName = String(body.deviceName || MAIN_APP_DEVICE_NAME).trim();
  const restaurant = await getAccountRestaurant(context.account.id, restaurantId);

  if (!restaurant) {
    sendJson(response, 404, { ok: false, error: 'Restaurant not found for this account' });
    return;
  }

  await createPairingCodeForRestaurant(response, restaurantId, deviceName || MAIN_APP_DEVICE_NAME);
}

async function handleClientDeviceActivate(request, response, context, restaurantId) {
  const body = await readJson(request);
  const deviceName = String(body.deviceName || MAIN_APP_DEVICE_NAME).trim() || MAIN_APP_DEVICE_NAME;
  const devicePlatform = normalizeDevicePlatform(body.platform, deviceName);
  const transferCode = String(body.transferCode || '').replace(/\D/g, '');
  const deviceFingerprint = String(body.deviceFingerprint || '').trim();

  if (!context.appPlatform) {
    sendJson(response, 403, { ok: false, error: 'POS application login is required before activating a device' });
    return;
  }

  if (devicePlatform !== context.appPlatform) {
    sendJson(response, 403, { ok: false, error: 'The signed-in application platform does not match this device' });
    return;
  }

  if (transferCode && !/^\d{6}$/.test(transferCode)) {
    sendJson(response, 400, { ok: false, error: 'Valid 6 digit transfer code is required' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const restaurantResult = await client.query(
      `
        SELECT id, name, owner_name, phone, email, status
        FROM restaurants
        WHERE id = $1 AND account_id = $2
        LIMIT 1
      `,
      [restaurantId, context.account.id],
    );
    const restaurant = restaurantResult.rows[0];

    if (!restaurant) {
      await client.query('ROLLBACK');
      sendJson(response, 404, { ok: false, error: 'Restaurant not found for this account' });
      return;
    }

    if (restaurant.status !== 'approved') {
      await client.query('ROLLBACK');
      sendJson(response, 403, { ok: false, error: 'Restaurant account is not approved yet' });
      return;
    }

    const subscription = await getActiveSubscription(client, restaurantId);

    if (!subscription) {
      await client.query('ROLLBACK');
      sendJson(response, 402, { ok: false, error: 'Subscription is not active or expired' });
      return;
    }
    const decoratedSubscription = decorateSubscription(subscription);
    if (!decoratedSubscription.plan_platforms.includes(devicePlatform)) {
      await client.query('ROLLBACK');
      const requestedApp = devicePlatform === 'android' ? 'Android app' : 'Windows app';
      sendJson(response, 403, {
        ok: false,
        error: `${decoratedSubscription.plan_name} plan does not include the ${requestedApp}. Select a compatible plan in GI Cloud Admin.`,
      });
      return;
    }
    const activationMode = decoratedSubscription.plan_id === 'offline' ? 'offline' : 'cloud';

    let transferPairing = null;
    let loggedOutDevices = [];

    if (transferCode) {
      const transferResult = await client.query(
        `
          SELECT id, device_name, platform
          FROM pairing_codes
          WHERE restaurant_id = $1
            AND code_hash = $2
            AND used_at IS NULL
            AND expires_at > now()
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [restaurantId, hashSecret(transferCode)],
      );
      transferPairing = transferResult.rows[0] || null;

      if (!transferPairing) {
        await client.query('ROLLBACK');
        sendJson(response, 403, { ok: false, error: 'Transfer code is invalid or expired' });
        return;
      }

      if (transferPairing.platform !== devicePlatform) {
        await client.query('ROLLBACK');
        sendJson(response, 403, { ok: false, error: `This transfer code is for ${transferPairing.platform}, not ${devicePlatform}` });
        return;
      }

      const logoutResult = await client.query(
        `
          UPDATE devices
          SET active = false, updated_at = now()
          WHERE restaurant_id = $1
            AND active = true
          RETURNING id, name
        `,
        [restaurantId],
      );
      loggedOutDevices = logoutResult.rows;
    }

    if (!transferPairing) {
      await enforcePlanDeviceLimit(client, restaurantId, decoratedSubscription, devicePlatform);
    }

    const apiKey = createApiKey();
    const deviceResult = await client.query(
      `
        INSERT INTO devices (restaurant_id, name, platform, api_key_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, restaurant_id, name, platform, active, last_seen_at, created_at
      `,
      [restaurantId, deviceName, devicePlatform, hashSecret(apiKey)],
    );
    const device = deviceResult.rows[0];

    if (transferPairing) {
      await client.query('UPDATE pairing_codes SET used_at = now(), used_by_device = $1 WHERE id = $2', [
        device.id,
        transferPairing.id,
      ]);
    }

    const offlineLicense =
      activationMode === 'offline'
        ? createOfflineLicensePayload({
            id: subscription.id,
            licenseKey: `GI-${decoratedSubscription.plan_id.toUpperCase()}-${String(restaurant.id).slice(0, 8).toUpperCase()}`,
            businessName: restaurant.name,
            phone: restaurant.phone,
            deviceFingerprint: deviceFingerprint || String(device.id),
            deviceName: device.name,
            activatedAt: new Date().toISOString(),
            expiresAt: subscription.expires_at ? new Date(subscription.expires_at).toISOString() : '',
            subscription: decoratedSubscription,
          })
        : null;

    await client.query('COMMIT');

    sendJson(response, 201, {
      ok: true,
      restaurant,
      device,
      subscription: decoratedSubscription,
      apiKey,
      offlineLicense,
      transferApplied: Boolean(transferPairing),
      loggedOutDevices,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function handleClientStaffPinReset(request, response, context, restaurantId) {
  const body = await readJson(request);
  const staffUserId = String(body.staffUserId || '').trim();
  const newPin = String(body.newPin || '');

  if (!staffUserId) {
    sendJson(response, 400, { ok: false, error: 'App user is required' });
    return;
  }

  if (!/^\d{4,8}$/.test(newPin)) {
    sendJson(response, 400, { ok: false, error: 'PIN must be 4 to 8 digits' });
    return;
  }

  const restaurant = await getAccountRestaurant(context.account.id, restaurantId);

  if (!restaurant) {
    sendJson(response, 404, { ok: false, error: 'Restaurant not found for this account' });
    return;
  }

  const directoryResult = await pool.query(
    'SELECT value FROM cloud_kv WHERE restaurant_id = $1 AND key = $2 LIMIT 1',
    [restaurantId, STAFF_DIRECTORY_KEY],
  );
  const staffUsers = normalizeStaffDirectory(directoryResult.rows[0]?.value);
  const staffUser = staffUsers.find((user) => user.id === staffUserId);

  if (!staffUser) {
    sendJson(response, 404, {
      ok: false,
      error: 'App user not found. Run cloud sync once from the desktop app, then refresh portal.',
    });
    return;
  }

  if (staffUser.active === false) {
    sendJson(response, 409, { ok: false, error: 'This app user is disabled in the desktop app' });
    return;
  }

  const pin = hashDesktopPin(newPin);
  const now = new Date().toISOString();
  const command = {
    id: crypto.randomUUID(),
    staffUserId,
    staffUserName: staffUser.name,
    pinSalt: pin.salt,
    pinHash: pin.hash,
    requestedAt: now,
    requestedBy: context.account.owner_name || context.account.phone || context.account.email || 'client portal',
  };
  const existingResult = await pool.query(
    'SELECT value FROM cloud_kv WHERE restaurant_id = $1 AND key = $2 LIMIT 1',
    [restaurantId, STAFF_PIN_RESET_KEY],
  );
  const existingCommands = Array.isArray(existingResult.rows[0]?.value) ? existingResult.rows[0].value : [];
  const nextCommands = [command, ...existingCommands].slice(0, 50);

  await pool.query(
    `
      INSERT INTO cloud_kv (restaurant_id, key, value, updated_by_device)
      VALUES ($1, $2, $3::jsonb, NULL)
      ON CONFLICT (restaurant_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = now(),
        updated_by_device = NULL
    `,
    [restaurantId, STAFF_PIN_RESET_KEY, JSON.stringify(nextCommands)],
  );

  sendJson(response, 201, {
    ok: true,
    message: `PIN reset sent for ${staffUser.name}. Run cloud sync in the desktop app to apply it.`,
    command: {
      id: command.id,
      staffUserId: command.staffUserId,
      staffUserName: command.staffUserName,
      requestedAt: command.requestedAt,
    },
  });
}

async function handleDeviceRegister(request, response) {
  requireAdmin(request);
  const body = await readJson(request);
  const restaurantName = String(body.restaurantName || body.businessName || '').trim();
  const deviceName = String(body.deviceName || MAIN_APP_DEVICE_NAME).trim();
  const ownerName = String(body.ownerName || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const plan = getPlanDefinition(body.planName || 'Premium');
  const maxDevices = plan.maxDevices;
  const expiresAt = parseExpiryDate(body.expiresAt, 365);

  if (!restaurantName) {
    sendJson(response, 400, { ok: false, error: 'restaurantName is required' });
    return;
  }

  const apiKey = createApiKey();
  const apiKeyHash = hashSecret(apiKey);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const restaurantResult = await client.query(
      `
        INSERT INTO restaurants (name, owner_name, phone, email, status)
        VALUES ($1, $2, $3, $4, 'approved')
        RETURNING id, name, owner_name, phone, email, status, created_at
      `,
      [restaurantName, ownerName, phone, email],
    );
    const restaurant = restaurantResult.rows[0];
    const subscriptionResult = await client.query(
      `
        INSERT INTO subscriptions (restaurant_id, plan_name, status, starts_at, expires_at, max_devices)
        VALUES ($1, $2, 'active', now(), $3, $4)
        RETURNING id, plan_name, status, starts_at, expires_at, max_devices
      `,
      [restaurant.id, plan.name, expiresAt, maxDevices],
    );
    const deviceResult = await client.query(
      `
        INSERT INTO devices (restaurant_id, name, platform, api_key_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, platform, active, created_at
      `,
      [restaurant.id, deviceName, plan.platforms[0], apiKeyHash],
    );
    await client.query('COMMIT');

    sendJson(response, 201, {
      ok: true,
      restaurant,
      device: deviceResult.rows[0],
      subscription: decorateSubscription(subscriptionResult.rows[0]),
      apiKey,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function handleAdminRestaurants(response) {
  const restaurantsResult = await pool.query(`
    SELECT
      r.id,
      r.name,
      r.owner_name,
      r.phone,
      r.email,
      r.status,
      r.created_at,
      r.updated_at,
      a.id AS account_id,
      a.status AS account_status,
      s.id AS subscription_id,
      s.plan_name,
      s.status AS subscription_status,
      s.starts_at,
      s.expires_at,
      s.max_devices,
      s.max_users,
      COALESCE(ds.active_devices, 0)::int AS active_devices,
      COALESCE(ds.total_devices, 0)::int AS total_devices,
      COALESCE(us.active_users, 1)::int AS active_users
    FROM restaurants r
    LEFT JOIN accounts a ON a.id = r.account_id
    LEFT JOIN LATERAL (
      SELECT *
      FROM subscriptions latest_s
      WHERE latest_s.restaurant_id = r.id
      ORDER BY latest_s.created_at DESC
      LIMIT 1
    ) s ON true
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE d.active)::int AS active_devices,
        COUNT(*)::int AS total_devices
      FROM devices d
      WHERE d.restaurant_id = r.id
    ) ds ON true
    LEFT JOIN LATERAL (
      SELECT GREATEST(
        1,
        COALESCE(COUNT(*) FILTER (WHERE COALESCE((entry->>'active')::boolean, true)), 0)
      )::int AS active_users
      FROM cloud_kv users_kv
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(users_kv.value) = 'array' THEN users_kv.value ELSE '[]'::jsonb END
      ) entry
      WHERE users_kv.restaurant_id = r.id AND users_kv.key = '${STAFF_DIRECTORY_KEY}'
    ) us ON true
    ORDER BY r.created_at DESC
    LIMIT 200
  `);
  const devicesResult = await pool.query(`
    SELECT id, restaurant_id, name, platform, active, last_seen_at, created_at
    FROM devices
    ORDER BY created_at DESC
    LIMIT 1000
  `);
  const devicesByRestaurant = new Map();

  for (const device of devicesResult.rows) {
    const list = devicesByRestaurant.get(device.restaurant_id) || [];
    list.push(device);
    devicesByRestaurant.set(device.restaurant_id, list);
  }

  sendJson(response, 200, {
    ok: true,
    restaurants: restaurantsResult.rows.map((restaurant) => ({
      ...decorateRestaurantPlanFields(restaurant),
      devices: devicesByRestaurant.get(restaurant.id) || [],
    })),
  });
}

async function handleAdminApprove(request, response, restaurantId) {
  const body = await readJson(request);
  const plan = getPlanDefinition(body.planName || 'Premium');
  const maxDevices = plan.maxDevices;
  const maxUsers = parseUserLimit(body.maxUsers);
  const expiresAt = parseExpiryDate(body.expiresAt, 365);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const restaurantResult = await client.query('SELECT * FROM restaurants WHERE id = $1 FOR UPDATE', [restaurantId]);
    const restaurant = restaurantResult.rows[0];

    if (!restaurant) {
      await client.query('ROLLBACK');
      sendJson(response, 404, { ok: false, error: 'Restaurant not found' });
      return;
    }

    await client.query("UPDATE restaurants SET status = 'approved', updated_at = now() WHERE id = $1", [restaurantId]);

    if (restaurant.account_id) {
      await client.query("UPDATE accounts SET status = 'approved', updated_at = now() WHERE id = $1", [restaurant.account_id]);
    }

    await client.query(
      "UPDATE subscriptions SET status = 'cancelled', updated_at = now() WHERE restaurant_id = $1 AND status IN ('trial', 'active')",
      [restaurantId],
    );
    const subscriptionResult = await client.query(
      `
        INSERT INTO subscriptions (restaurant_id, plan_name, status, starts_at, expires_at, max_devices, max_users)
        VALUES ($1, $2, 'active', now(), $3, $4, $5)
        RETURNING id, plan_name, status, starts_at, expires_at, max_devices, max_users
      `,
      [restaurantId, plan.name, expiresAt, maxDevices, maxUsers],
    );
    await client.query(
      `UPDATE devices SET active = false, updated_at = now() WHERE restaurant_id = $1 AND NOT (platform = ANY($2::text[]))`,
      [restaurantId, plan.platforms],
    );
    await client.query('COMMIT');

    sendJson(response, 200, { ok: true, subscription: decorateSubscription(subscriptionResult.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function handleAdminSuspend(response, restaurantId) {
  const result = await pool.query(
    `
      UPDATE restaurants
      SET status = 'suspended', updated_at = now()
      WHERE id = $1
      RETURNING id, account_id, name, status
    `,
    [restaurantId],
  );
  const restaurant = result.rows[0];

  if (!restaurant) {
    sendJson(response, 404, { ok: false, error: 'Restaurant not found' });
    return;
  }

  if (restaurant.account_id) {
    await pool.query("UPDATE accounts SET status = 'suspended', updated_at = now() WHERE id = $1", [restaurant.account_id]);
  }

  sendJson(response, 200, { ok: true, restaurant });
}

async function handleAdminPasswordReset(request, response, restaurantId) {
  const body = await readJson(request);
  const newPassword = String(body.newPassword || '');

  if (newPassword.length < 6) {
    sendJson(response, 400, { ok: false, error: 'Password must be at least 6 characters' });
    return;
  }

  const restaurantResult = await pool.query(
    `
      SELECT
        r.id,
        r.name,
        r.account_id,
        a.owner_name,
        a.phone,
        a.email
      FROM restaurants r
      LEFT JOIN accounts a ON a.id = r.account_id
      WHERE r.id = $1
      LIMIT 1
    `,
    [restaurantId],
  );
  const restaurant = restaurantResult.rows[0];

  if (!restaurant) {
    sendJson(response, 404, { ok: false, error: 'Restaurant not found' });
    return;
  }

  if (!restaurant.account_id) {
    sendJson(response, 409, { ok: false, error: 'This restaurant has no client portal account' });
    return;
  }

  await pool.query(
    `
      UPDATE accounts
      SET password_hash = $1,
          recovery_code_hash = '',
          recovery_code_set_at = NULL,
          updated_at = now()
      WHERE id = $2
    `,
    [hashPassword(newPassword), restaurant.account_id],
  );

  sendJson(response, 200, {
    ok: true,
    message: 'Client portal password reset successfully. Ask the client to login and generate a new recovery code.',
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
    },
    account: {
      id: restaurant.account_id,
      ownerName: restaurant.owner_name,
      phone: restaurant.phone,
      email: restaurant.email,
    },
  });
}

async function handleAdminPairingCode(request, response, restaurantId) {
  const body = await readJson(request);
  const deviceName = String(body.deviceName || MAIN_APP_DEVICE_NAME).trim();
  await createPairingCodeForRestaurant(response, restaurantId, deviceName || MAIN_APP_DEVICE_NAME, body.expiresMinutes);
}

async function createPairingCodeForRestaurant(response, restaurantId, deviceName, expiresMinutesValue = DEFAULT_PAIRING_MINUTES) {
  const expiresMinutes = clampInteger(expiresMinutesValue, 5, 1440, DEFAULT_PAIRING_MINUTES);
  const expiresAt = new Date(Date.now() + expiresMinutes * 60_000);
  const client = await pool.connect();

  try {
    const restaurantResult = await client.query('SELECT id, name, status FROM restaurants WHERE id = $1', [restaurantId]);
    const restaurant = restaurantResult.rows[0];

    if (!restaurant) {
      sendJson(response, 404, { ok: false, error: 'Restaurant not found' });
      return;
    }

    if (restaurant.status !== 'approved') {
      sendJson(response, 403, { ok: false, error: 'Restaurant must be approved before device transfer' });
      return;
    }

    const subscription = await getActiveSubscription(client, restaurantId);
    if (!subscription) {
      sendJson(response, 402, { ok: false, error: 'No active subscription for this restaurant' });
      return;
    }
    const pairingPlatform = subscription.plan_platforms[0];

    const code = createPairingCode();
    const codeResult = await client.query(
      `
        INSERT INTO pairing_codes (restaurant_id, code_hash, device_name, platform, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, device_name, platform, expires_at, created_at
      `,
      [restaurantId, hashSecret(code), deviceName || MAIN_APP_DEVICE_NAME, pairingPlatform, expiresAt.toISOString()],
    );

    sendJson(response, 201, {
      ok: true,
      code,
      transferCode: code,
      pairingCode: codeResult.rows[0],
      restaurant,
      subscription,
    });
  } finally {
    client.release();
  }
}

async function handleAdminDeviceStatus(request, response, deviceId) {
  const body = await readJson(request);
  const active = Boolean(body.active);
  if (active) {
    const deviceResult = await pool.query('SELECT restaurant_id, platform FROM devices WHERE id = $1 LIMIT 1', [deviceId]);
    const device = deviceResult.rows[0];
    if (!device) {
      sendJson(response, 404, { ok: false, error: 'Device not found' });
      return;
    }
    const subscription = await getActiveSubscription(pool, device.restaurant_id);
    if (!subscription || !subscription.plan_platforms.includes(device.platform)) {
      sendJson(response, 403, { ok: false, error: 'This device platform is not included in the active subscription plan' });
      return;
    }
  }
  const result = await pool.query(
    `
      UPDATE devices
      SET active = $1, updated_at = now()
      WHERE id = $2
      RETURNING id, restaurant_id, name, platform, active, last_seen_at, created_at
    `,
    [active, deviceId],
  );

  if (!result.rows[0]) {
    sendJson(response, 404, { ok: false, error: 'Device not found' });
    return;
  }

  sendJson(response, 200, { ok: true, device: result.rows[0] });
}

async function handleAdminUpdateStatus(response) {
  sendJson(response, 200, { ok: true, updateDir: UPDATE_DIR, ...getUpdateStatusPayload() });
}

async function handleAdminUpdateUpload(request, response) {
  const form = await readMultipartFormData(request, MAX_UPDATE_UPLOAD_BYTES);
  const latestFile = getUploadedFile(form.files, 'latestYml');
  const setupFile = getUploadedFile(form.files, 'setupExe');
  const blockmapFile = getUploadedFile(form.files, 'setupBlockmap');

  if (!latestFile || !setupFile || !blockmapFile) {
    sendJson(response, 400, {
      ok: false,
      error: 'Select latest.yml, setup .exe, and setup .exe.blockmap before uploading.',
    });
    return;
  }

  const latestName = 'latest.yml';
  const setupName = sanitizeUpdateFileName(setupFile.filename);
  const blockmapName = sanitizeUpdateFileName(blockmapFile.filename);

  if (!/\.ya?ml$/i.test(latestFile.filename) && latestFile.filename !== latestName) {
    sendJson(response, 400, { ok: false, error: 'Version file must be latest.yml.' });
    return;
  }

  if (!/\.exe$/i.test(setupName) || !/setup/i.test(setupName)) {
    sendJson(response, 400, { ok: false, error: 'Setup file must be a Windows Setup .exe file.' });
    return;
  }

  if (!/\.exe\.blockmap$/i.test(blockmapName)) {
    sendJson(response, 400, { ok: false, error: 'Blockmap file must end with .exe.blockmap.' });
    return;
  }

  if (blockmapName !== `${setupName}.blockmap`) {
    sendJson(response, 400, {
      ok: false,
      error: `Blockmap filename must match the setup file: ${setupName}.blockmap`,
    });
    return;
  }

  const latestContent = latestFile.data.toString('utf8');
  const manifestSetupName = getSetupFileNameFromLatestContent(latestContent);

  if (!manifestSetupName) {
    sendJson(response, 400, { ok: false, error: 'latest.yml must contain the setup exe path or url.' });
    return;
  }

  if (manifestSetupName !== setupName) {
    sendJson(response, 400, {
      ok: false,
      error: `latest.yml points to ${manifestSetupName}, but selected setup file is ${setupName}.`,
    });
    return;
  }

  fs.mkdirSync(UPDATE_DIR, { recursive: true });

  const uploads = [
    { name: latestName, data: latestFile.data },
    { name: setupName, data: setupFile.data },
    { name: blockmapName, data: blockmapFile.data },
  ];
  const tempFiles = uploads.map((file) => ({
    ...file,
    tempPath: path.join(UPDATE_DIR, `${file.name}.upload-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.tmp`),
    finalPath: path.join(UPDATE_DIR, file.name),
  }));

  try {
    for (const file of tempFiles) {
      fs.writeFileSync(file.tempPath, file.data);
    }

    for (const file of tempFiles) {
      fs.renameSync(file.tempPath, file.finalPath);
    }

    cleanupOldUpdateFiles(new Set(uploads.map((file) => file.name)));
  } finally {
    for (const file of tempFiles) {
      if (fs.existsSync(file.tempPath)) {
        fs.rmSync(file.tempPath, { force: true });
      }
    }
  }

  sendJson(response, 200, {
    ok: true,
    message: 'Windows app update files uploaded successfully.',
    updateDir: UPDATE_DIR,
    ...getUpdateStatusPayload(),
  });
}

async function handleDevicePair(request, response) {
  const body = await readJson(request);
  const code = String(body.code || '').replace(/\D/g, '');
  const deviceName = String(body.deviceName || MAIN_APP_DEVICE_NAME).trim();
  const devicePlatform = normalizeDevicePlatform(body.platform, deviceName);

  if (!/^\d{6}$/.test(code)) {
    sendJson(response, 400, { ok: false, error: 'Valid 6 digit pairing code is required' });
    return;
  }

  const apiKey = createApiKey();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pairingResult = await client.query(
      `
        SELECT
          pc.id AS pairing_id,
          pc.restaurant_id,
          pc.device_name,
          pc.platform,
          r.name AS restaurant_name,
          r.status AS restaurant_status
        FROM pairing_codes pc
        JOIN restaurants r ON r.id = pc.restaurant_id
        WHERE pc.code_hash = $1
          AND pc.used_at IS NULL
          AND pc.expires_at > now()
        ORDER BY pc.created_at DESC
        LIMIT 1
        FOR UPDATE OF pc
      `,
      [hashSecret(code)],
    );
    const pairing = pairingResult.rows[0];

    if (!pairing) {
      await client.query('ROLLBACK');
      sendJson(response, 404, { ok: false, error: 'Pairing code is invalid or expired' });
      return;
    }

    if (pairing.restaurant_status !== 'approved') {
      await client.query('ROLLBACK');
      sendJson(response, 403, { ok: false, error: 'Restaurant is not approved' });
      return;
    }

    if (pairing.platform !== devicePlatform) {
      await client.query('ROLLBACK');
      sendJson(response, 403, { ok: false, error: `This pairing code is for ${pairing.platform}, not ${devicePlatform}` });
      return;
    }

    const subscription = await getActiveSubscription(client, pairing.restaurant_id);
    if (!subscription) {
      await client.query('ROLLBACK');
      sendJson(response, 402, { ok: false, error: 'Subscription is not active' });
      return;
    }

    if (!subscription.plan_platforms.includes(devicePlatform)) {
      await client.query('ROLLBACK');
      sendJson(response, 403, { ok: false, error: 'This device platform is not included in the active subscription plan' });
      return;
    }

    await enforcePlanDeviceLimit(client, pairing.restaurant_id, subscription, devicePlatform);

    const deviceResult = await client.query(
      `
        INSERT INTO devices (restaurant_id, name, platform, api_key_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, platform, active, created_at
      `,
      [pairing.restaurant_id, deviceName || pairing.device_name || MAIN_APP_DEVICE_NAME, devicePlatform, hashSecret(apiKey)],
    );
    const device = deviceResult.rows[0];
    await client.query('UPDATE pairing_codes SET used_at = now(), used_by_device = $1 WHERE id = $2', [
      device.id,
      pairing.pairing_id,
    ]);
    await client.query('COMMIT');

    sendJson(response, 201, {
      ok: true,
      restaurant: {
        id: pairing.restaurant_id,
        name: pairing.restaurant_name,
        status: pairing.restaurant_status,
      },
      device,
      subscription: decorateSubscription(subscription),
      apiKey,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function handleSyncPush(request, response, context) {
  const body = await readJson(request);
  const changes = Array.isArray(body.changes) ? body.changes : [];

  if (!changes.length) {
    sendJson(response, 200, { ok: true, acceptedIds: [], count: 0, subscription: context.subscription });
    return;
  }

  const acceptedIds = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const staffDirectoryChange = changes.find((change) =>
      change?.entityType === 'app_kv' &&
      change?.operation !== 'delete' &&
      change?.payload?.key === STAFF_DIRECTORY_KEY
    );
    if (staffDirectoryChange) {
      enforceUserLimit(context.subscription, staffDirectoryChange.payload.value);
    }
    for (const change of changes) {
      const clientEventId = String(change.id || '').trim();
      const entityType = String(change.entityType || '').trim();
      const entityId = String(change.entityId || '').trim();
      const operation = String(change.operation || 'upsert').trim();
      const payload = change.payload && typeof change.payload === 'object' ? change.payload : {};

      if (!clientEventId || !entityType || !entityId) {
        continue;
      }

      await client.query(
        `
          INSERT INTO sync_events (
            client_event_id, restaurant_id, device_id, entity_type, entity_id, operation, payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          ON CONFLICT (restaurant_id, device_id, client_event_id) DO NOTHING
        `,
        [
          clientEventId,
          context.restaurantId,
          context.deviceId,
          entityType,
          entityId,
          operation,
          JSON.stringify(payload),
        ],
      );

      if (entityType === 'app_kv' && operation === 'upsert' && typeof payload.key === 'string') {
        await client.query(
          `
            INSERT INTO cloud_kv (restaurant_id, key, value, updated_by_device)
            VALUES ($1, $2, $3::jsonb, $4)
            ON CONFLICT (restaurant_id, key) DO UPDATE SET
              value = excluded.value,
              updated_at = now(),
              updated_by_device = excluded.updated_by_device
          `,
          [context.restaurantId, payload.key, safeJsonValue(payload.value), context.deviceId],
        );
      }

      acceptedIds.push(clientEventId);
    }

    await client.query('UPDATE devices SET last_seen_at = now() WHERE id = $1', [context.deviceId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  sendJson(response, 200, { ok: true, acceptedIds, count: acceptedIds.length, subscription: context.subscription });
}

async function handleSyncPull(response, context, searchParams) {
  const since = searchParams.get('since') || '1970-01-01T00:00:00.000Z';
  const result = await pool.query(
    `
      SELECT key, value, updated_at, updated_by_device
      FROM cloud_kv
      WHERE restaurant_id = $1
        AND updated_at > $2::timestamptz
      ORDER BY updated_at ASC
      LIMIT 500
    `,
    [context.restaurantId, since],
  );

  sendJson(response, 200, {
    ok: true,
    serverTime: new Date().toISOString(),
    subscription: context.subscription,
    restaurant: context.restaurant,
    changes: result.rows.map((row) => ({
      key: row.key,
      value: row.value,
      updatedAt: row.updated_at,
      updatedByDevice: row.updated_by_device,
    })),
  });
}

async function withDevice(request, response, handler) {
  const restaurantId = String(request.headers['x-restaurant-id'] || '');
  const deviceId = String(request.headers['x-device-id'] || '');
  const apiKey = String(request.headers['x-api-key'] || '');

  if (!restaurantId || !deviceId || !apiKey) {
    sendJson(response, 401, { ok: false, error: 'Missing device credentials' });
    return;
  }

  const result = await pool.query(
    `
      SELECT
        d.id,
        d.restaurant_id,
        d.api_key_hash,
        d.platform,
        r.name AS restaurant_name,
        r.owner_name,
        r.phone,
        r.email,
        r.status AS restaurant_status
      FROM devices d
      JOIN restaurants r ON r.id = d.restaurant_id
      WHERE d.id = $1 AND d.restaurant_id = $2 AND d.active = true
      LIMIT 1
    `,
    [deviceId, restaurantId],
  );
  const device = result.rows[0];

  if (!device || device.api_key_hash !== hashSecret(apiKey)) {
    sendJson(response, 403, { ok: false, error: 'Invalid device credentials' });
    return;
  }

  if (device.restaurant_status !== 'approved') {
    sendJson(response, 403, { ok: false, error: 'Restaurant account is not approved' });
    return;
  }

  const subscription = await getActiveSubscription(pool, restaurantId);
  if (!subscription) {
    sendJson(response, 402, { ok: false, error: 'Subscription is not active or expired' });
    return;
  }

  if (!planSupportsPlatform(getPlanDefinition(subscription.plan_name, subscription.max_devices), device.platform)) {
    await pool.query('UPDATE devices SET active = false, updated_at = now() WHERE id = $1', [deviceId]);
    sendJson(response, 403, {
      ok: false,
      error: 'This device is no longer included in the current subscription plan. Sign in with a compatible app or contact the administrator.',
    });
    return;
  }

  await handler({
    restaurantId,
    deviceId,
    subscription,
    restaurant: {
      id: device.restaurant_id,
      name: device.restaurant_name,
      owner_name: device.owner_name,
      phone: device.phone,
      email: device.email,
      status: device.restaurant_status,
    },
  });
}

async function withClient(request, response, handler) {
  const token = String(request.headers['x-client-token'] || '').trim();
  const tokenPayload = verifyClientToken(token);

  if (!tokenPayload?.accountId) {
    sendJson(response, 401, { ok: false, error: 'Client login required' });
    return;
  }

  const result = await pool.query(
    `
      SELECT id, owner_name, phone, email, password_hash, recovery_code_hash, recovery_code_set_at, status, created_at
      FROM accounts
      WHERE id = $1
      LIMIT 1
    `,
    [tokenPayload.accountId],
  );
  const account = result.rows[0];

  if (!account) {
    sendJson(response, 401, { ok: false, error: 'Client account not found' });
    return;
  }

  await handler({ account, appPlatform: tokenPayload.appPlatform || null });
}

async function getAccountRestaurants(accountId, appPlatform = null) {
  const restaurantsResult = await pool.query(
    `
      SELECT
        r.id,
        r.name,
        r.owner_name,
        r.phone,
        r.email,
        r.status,
        r.created_at,
        s.id AS subscription_id,
        s.plan_name,
        s.status AS subscription_status,
        s.starts_at,
        s.expires_at,
        s.max_devices,
        s.max_users,
        sd.value AS staff_users,
        COALESCE(ds.active_devices, 0)::int AS active_devices,
        COALESCE(ds.total_devices, 0)::int AS total_devices
      FROM restaurants r
      LEFT JOIN LATERAL (
        SELECT *
        FROM subscriptions latest_s
        WHERE latest_s.restaurant_id = r.id
        ORDER BY latest_s.created_at DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE d.active)::int AS active_devices,
          COUNT(*)::int AS total_devices
        FROM devices d
        WHERE d.restaurant_id = r.id
      ) ds ON true
      LEFT JOIN cloud_kv sd ON sd.restaurant_id = r.id AND sd.key = $2
      WHERE r.account_id = $1
      ORDER BY r.created_at DESC
    `,
    [accountId, STAFF_DIRECTORY_KEY],
  );
  const devicesResult = await pool.query(
    `
      SELECT d.id, d.restaurant_id, d.name, d.platform, d.active, d.last_seen_at, d.created_at
      FROM devices d
      JOIN restaurants r ON r.id = d.restaurant_id
      WHERE r.account_id = $1
      ORDER BY d.created_at DESC
    `,
    [accountId],
  );
  const devicesByRestaurant = new Map();

  for (const device of devicesResult.rows) {
    const list = devicesByRestaurant.get(device.restaurant_id) || [];
    list.push(device);
    devicesByRestaurant.set(device.restaurant_id, list);
  }

  return restaurantsResult.rows
    .filter((restaurant) => restaurantSupportsPlatform(restaurant, appPlatform, getPlanDefinition))
    .map((restaurant) => {
      const { staff_users: staffUsers, ...rest } = restaurant;
      const decoratedRestaurant = decorateRestaurantPlanFields(rest);

      return {
        ...decoratedRestaurant,
        devices: devicesByRestaurant.get(restaurant.id) || [],
        staffUsers: normalizeStaffDirectory(staffUsers),
        active_users: Math.max(1, normalizeStaffDirectory(staffUsers).filter((user) => user.active).length),
      };
    });
}

async function getAccountRestaurant(accountId, restaurantId) {
  const result = await pool.query('SELECT id FROM restaurants WHERE id = $1 AND account_id = $2 LIMIT 1', [
    restaurantId,
    accountId,
  ]);

  return result.rows[0] || null;
}

async function getActiveSubscription(client, restaurantId) {
  const result = await client.query(
    `
      SELECT id, plan_name, status, starts_at, expires_at, max_devices, max_users
      FROM subscriptions
      WHERE restaurant_id = $1
        AND status IN ('trial', 'active')
        AND starts_at <= now()
        AND expires_at >= now()
      ORDER BY expires_at DESC
      LIMIT 1
    `,
    [restaurantId],
  );

  return decorateSubscription(result.rows[0]) || null;
}

function requireAdmin(request) {
  const token = String(request.headers['x-admin-token'] || '');
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    const error = new Error('Invalid admin token');
    error.statusCode = 403;
    throw error;
  }
}

function safeJsonValue(value) {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return JSON.stringify(value);
    }
  }

  return JSON.stringify(value ?? null);
}

function normalizeStaffDirectory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((user) => ({
      id: String(user?.id || '').trim(),
      name: String(user?.name || 'App User').trim() || 'App User',
      active: user?.active !== false,
      updatedAt: String(user?.updatedAt || ''),
      lastLoginAt: user?.lastLoginAt ? String(user.lastLoginAt) : '',
    }))
    .filter((user) => user.id);
}

function createApiKey() {
  return `gipos_${crypto.randomBytes(24).toString('hex')}`;
}

function createPairingCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function createRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

function signOfflineLicensePayload(payload) {
  const stablePayload = JSON.stringify(Object.keys(payload).sort().reduce((acc, key) => {
    acc[key] = payload[key];
    return acc;
  }, {}));
  return crypto.createHmac('sha256', OFFLINE_LICENSE_SECRET).update(stablePayload).digest('hex');
}

function createOfflineLicensePayload({
  id,
  licenseKey,
  businessName,
  phone,
  deviceFingerprint,
  deviceName,
  activatedAt,
  expiresAt,
  subscription,
}) {
  const payload = {
    plan: 'offline',
    licenseId: String(id || ''),
    licenseKey: String(licenseKey || ''),
    businessName: String(businessName || ''),
    phone: String(phone || ''),
    deviceFingerprint: String(deviceFingerprint || ''),
    deviceName: String(deviceName || ''),
    activatedAt: String(activatedAt || ''),
    expiresAt: String(expiresAt || ''),
    issuedAt: new Date().toISOString(),
    subscriptionPlan: String(subscription?.plan_name || subscription?.planName || ''),
    subscriptionStatus: String(subscription?.status || ''),
    subscriptionExpiresAt: String(subscription?.expires_at || expiresAt || ''),
    subscriptionMaxDevices: Number(subscription?.max_devices || 0),
  };

  return { ...payload, signature: signOfflineLicensePayload(payload) };
}

function normalizeRecoveryCode(value) {
  const cleaned = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned.length === 12 ? `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}` : cleaned;
}

function hashSecret(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(String(password), parts[1], expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function hashDesktopPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(`${salt}:${pin}`).digest('hex');
  return { salt, hash };
}

function publicAccount(account) {
  return {
    id: account.id,
    ownerName: account.owner_name,
    phone: account.phone,
    email: account.email,
    status: account.status,
    recoveryCodeSetAt: account.recovery_code_set_at,
    createdAt: account.created_at,
  };
}

function createClientToken(accountId, appPlatform = null) {
  const payload = {
    accountId,
    ...(appPlatform ? { appPlatform } : {}),
    expiresAt: Date.now() + CLIENT_TOKEN_TTL_MS,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenBody(body);
  return `${body}.${signature}`;
}

function verifyClientToken(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature || signature !== signTokenBody(body)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (!payload.accountId || Number(payload.expiresAt || 0) < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function signTokenBody(body) {
  return crypto.createHmac('sha256', CLIENT_TOKEN_SECRET).update(body).digest('base64url');
}

function base64UrlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function parseExpiryDate(value, fallbackDays) {
  if (value) {
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
      return parsed.toISOString();
    }
  }

  return new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000).toISOString();
}

function normalizePlanId(value, maxDevices = 0) {
  const planText = String(value || '').trim().toLowerCase();

  if (planText.includes('gold')) {
    return 'gold';
  }

  if (planText.includes('premium')) {
    return 'premium';
  }

  if (planText.includes('offline')) {
    return 'offline';
  }

  if (planText.includes('android') || planText.includes('mobile')) {
    return 'android';
  }

  if (Number(maxDevices || 0) >= UNLIMITED_DEVICE_LIMIT) {
    return 'gold';
  }

  return 'premium';
}

function getPlanDefinition(value, maxDevices = 0) {
  const planId = normalizePlanId(value, maxDevices);
  return PLAN_CATALOG.find((plan) => plan.id === planId) || PLAN_CATALOG[0];
}

function getPlanMaxDevices(value) {
  return getPlanDefinition(value).maxDevices;
}

function decorateSubscription(subscription) {
  if (!subscription) {
    return null;
  }

  const plan = getPlanDefinition(subscription.plan_name, subscription.max_devices);

  return {
    ...subscription,
    plan_id: plan.id,
    plan_name: plan.name,
    plan_subtitle: plan.subtitle,
    plan_features: plan.features,
    plan_local_pos: plan.localPos,
    plan_counter_label: plan.counterLabel,
    plan_platforms: plan.platforms,
    plan_device_limits: plan.deviceLimits,
    plan_capabilities: plan.capabilities,
    max_devices: Number(subscription.max_devices || plan.maxDevices),
    max_users: subscription.max_users == null ? null : Number(subscription.max_users),
  };
}

function decorateRestaurantPlanFields(restaurant) {
  const subscription = restaurant?.subscription_id
    ? decorateSubscription({
        id: restaurant.subscription_id,
        plan_name: restaurant.plan_name,
        status: restaurant.subscription_status,
        starts_at: restaurant.starts_at,
        expires_at: restaurant.expires_at,
        max_devices: restaurant.max_devices,
        max_users: restaurant.max_users,
      })
    : null;

  if (!subscription) {
    return restaurant;
  }

  return {
    ...restaurant,
    plan_id: subscription.plan_id,
    plan_name: subscription.plan_name,
    plan_subtitle: subscription.plan_subtitle,
    plan_features: subscription.plan_features,
    plan_local_pos: subscription.plan_local_pos,
    plan_counter_label: subscription.plan_counter_label,
    plan_platforms: subscription.plan_platforms,
    plan_device_limits: subscription.plan_device_limits,
    plan_capabilities: subscription.plan_capabilities,
    max_devices: subscription.max_devices,
    max_users: subscription.max_users,
    active_users: Number(restaurant.active_users || 1),
  };
}

function normalizeDevicePlatform(value, deviceName = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'android' || normalized === 'windows') {
    return normalized;
  }
  return /android|mobile/i.test(String(deviceName || '')) ? 'android' : 'windows';
}

async function enforcePlanDeviceLimit(client, restaurantId, subscription, platform = 'windows') {
  const plan = getPlanDefinition(subscription?.plan_name, subscription?.max_devices);
  const maxDevices = Number(plan.deviceLimits?.[platform] ?? subscription?.max_devices ?? plan.maxDevices);
  if (maxDevices >= UNLIMITED_DEVICE_LIMIT) {
    return true;
  }

  const result = await client.query(
    `
      SELECT COUNT(*)::int AS active_devices
      FROM devices
      WHERE restaurant_id = $1
        AND active = true
        AND platform = $2
    `,
    [restaurantId, platform],
  );
  const activeDevices = Number(result.rows[0]?.active_devices || 0);

  if (activeDevices < maxDevices) {
    return true;
  }

  const deviceLabel = platform === 'android' ? 'Android device' : 'Windows counter';
  const error = new Error(`${plan.name} plan allows ${maxDevices} active ${deviceLabel}${maxDevices === 1 ? '' : 's'} only. Deactivate or transfer the existing device before activating another one.`);
  error.statusCode = 409;
  throw error;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request body too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    request.on('error', reject);
  });
}

function readRequestBuffer(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let rejected = false;

    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        rejected = true;
        const error = new Error(`Request body too large. Maximum upload size is ${formatBytes(maxBytes)}.`);
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!rejected) {
        resolve(Buffer.concat(chunks, total));
      }
    });
    request.on('error', reject);
  });
}

async function readMultipartFormData(request, maxBytes) {
  const contentType = String(request.headers['content-type'] || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];

  if (!boundary) {
    const error = new Error('Multipart boundary is missing');
    error.statusCode = 400;
    throw error;
  }

  const buffer = await readRequestBuffer(request, maxBytes);
  return parseMultipartBuffer(buffer, boundary);
}

function parseMultipartBuffer(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from('\r\n\r\n');
  const fields = {};
  const files = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const delimiterStart = buffer.indexOf(delimiter, cursor);
    if (delimiterStart === -1) {
      break;
    }

    let partStart = delimiterStart + delimiter.length;
    if (buffer[partStart] === 45 && buffer[partStart + 1] === 45) {
      break;
    }

    if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) {
      partStart += 2;
    }

    const nextDelimiterStart = buffer.indexOf(delimiter, partStart);
    if (nextDelimiterStart === -1) {
      break;
    }

    let partEnd = nextDelimiterStart;
    if (buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) {
      partEnd -= 2;
    }

    const part = buffer.subarray(partStart, partEnd);
    const headerEnd = part.indexOf(headerSeparator);
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString('utf8');
      const data = part.subarray(headerEnd + headerSeparator.length);
      const disposition = headers.match(/^content-disposition:\s*(.+)$/im)?.[1] || '';
      const name = disposition.match(/name="([^"]+)"/i)?.[1] || '';
      const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || '';

      if (name && filename) {
        files.push({ fieldName: name, filename: path.basename(filename), data });
      } else if (name) {
        fields[name] = data.toString('utf8');
      }
    }

    cursor = nextDelimiterStart;
  }

  return { fields, files };
}

function normalizePublicBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

function getPublicBaseUrl(request) {
  if (PUBLIC_BASE_URL) {
    return PUBLIC_BASE_URL;
  }

  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(request.headers.host || '').split(',')[0].trim() || `localhost:${PORT}`;
  const proto = forwardedProto || (request.socket?.encrypted ? 'https' : 'http');
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function getPublicConfig(request) {
  const baseUrl = getPublicBaseUrl(request);
  const updateStatus = getUpdateStatusPayload();

  return {
    ok: true,
    service: 'gi-pos-cloud',
    baseUrl,
    desktop: {
      cloudUrl: baseUrl,
      updateUrl: `${baseUrl}/updates/win`,
      downloadWindows: `${baseUrl}/download/windows`,
    },
    android: {
      cloudUrl: baseUrl,
      downloadApk: `${baseUrl}/download/android`,
    },
    endpoints: {
      health: `${baseUrl}/health`,
      connect: `${baseUrl}/connect`,
      signup: `${baseUrl}/signup`,
      portal: `${baseUrl}/portal`,
      admin: `${baseUrl}/admin`,
      downloadWindows: `${baseUrl}/download/windows`,
      downloadAndroid: `${baseUrl}/download/android`,
      latestYml: `${baseUrl}/updates/win/latest.yml`,
    },
    updates: {
      ready: updateStatus.ready,
      version: updateStatus.version,
      setup: updateStatus.setup ? updateStatus.setup.name : '',
      blockmap: updateStatus.blockmap ? updateStatus.blockmap.name : '',
    },
    plans: PLAN_CATALOG.map((plan) => ({
      id: plan.id,
      name: plan.name,
      localPos: plan.localPos,
      maxDevices: plan.maxDevices,
      counterLabel: plan.counterLabel,
      platforms: plan.platforms,
      deviceLimits: plan.deviceLimits,
      capabilities: plan.capabilities,
    })),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'access-control-allow-headers': 'content-type, x-admin-token, x-client-token, x-api-key, x-device-id, x-restaurant-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-origin': '*',
    'content-type': 'application/json',
  });
  response.end(statusCode === 204 ? undefined : JSON.stringify(payload));
}

function sendHtml(response, html) {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
  });
  response.end(html);
}

async function serveUpdateFile(response, pathname) {
  const requestedName = decodeURIComponent(pathname.replace('/updates/win/', ''));
  const safeName = path.basename(requestedName);

  if (!safeName || safeName !== requestedName) {
    sendJson(response, 400, { ok: false, error: 'Invalid update file path' });
    return;
  }

  const filePath = path.join(UPDATE_DIR, safeName);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(response, 404, { ok: false, error: 'Update file not found' });
    return;
  }

  response.writeHead(200, {
    'cache-control': safeName === 'latest.yml' ? 'no-store' : 'public, max-age=31536000, immutable',
    'content-type': getUpdateContentType(safeName),
  });
  fs.createReadStream(filePath).pipe(response);
}

async function serveWindowsDownload(response) {
  const downloadFile = findLatestWindowsSetupFile();

  if (!downloadFile) {
    sendJson(response, 404, {
      ok: false,
      error: 'Windows setup file not found. Upload the latest Setup exe to cloud/updates/win.',
    });
    return;
  }

  const stat = fs.statSync(downloadFile.path);

  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-disposition': `attachment; filename="${downloadFile.name.replace(/"/g, '')}"`,
    'content-length': stat.size,
    'content-type': 'application/vnd.microsoft.portable-executable',
  });
  fs.createReadStream(downloadFile.path).pipe(response);
}

async function serveAndroidDownload(response) {
  const downloadFile = findLatestAndroidApk();

  if (!downloadFile) {
    sendJson(response, 404, {
      ok: false,
      error: 'Android APK not found. Copy the latest APK to cloud/updates/android or GI_ANDROID_UPDATE_DIR.',
    });
    return;
  }

  const stat = fs.statSync(downloadFile.path);
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-disposition': `attachment; filename="${downloadFile.name.replace(/"/g, '')}"`,
    'content-length': stat.size,
    'content-type': 'application/vnd.android.package-archive',
  });
  fs.createReadStream(downloadFile.path).pipe(response);
}

function findLatestAndroidApk() {
  if (!fs.existsSync(ANDROID_UPDATE_DIR)) return null;
  const files = fs.readdirSync(ANDROID_UPDATE_DIR)
    .filter((fileName) => /\.apk$/i.test(fileName))
    .map((fileName) => {
      const filePath = path.join(ANDROID_UPDATE_DIR, fileName);
      return { name: fileName, path: filePath, updatedAt: fs.statSync(filePath).mtimeMs };
    })
    .sort((first, second) => second.updatedAt - first.updatedAt);
  return files[0] || null;
}

function findLatestWindowsSetupFile() {
  const searchDirs = [UPDATE_DIR, path.join(__dirname, '..', '..', 'release')];

  for (const directory of searchDirs) {
    const fileFromLatest = getSetupFileFromLatestManifest(directory);

    if (fileFromLatest) {
      return fileFromLatest;
    }
  }

  for (const directory of searchDirs) {
    if (!fs.existsSync(directory)) {
      continue;
    }

    const files = fs
      .readdirSync(directory)
      .filter((fileName) => /\.exe$/i.test(fileName) && /setup/i.test(fileName))
      .map((fileName) => {
        const filePath = path.join(directory, fileName);
        return { name: fileName, path: filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
      })
      .filter((file) => fs.statSync(file.path).isFile())
      .sort((first, second) => second.mtimeMs - first.mtimeMs);

    if (files[0]) {
      return { name: files[0].name, path: files[0].path };
    }
  }

  return null;
}

function getSetupFileFromLatestManifest(directory) {
  const latestPath = path.join(directory, 'latest.yml');

  if (!fs.existsSync(latestPath)) {
    return null;
  }

  const latestContent = fs.readFileSync(latestPath, 'utf8');
  const fileName = getSetupFileNameFromLatestContent(latestContent);

  if (!fileName || !/\.exe$/i.test(fileName) || !/setup/i.test(fileName)) {
    return null;
  }

  const filePath = path.join(directory, fileName);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  return { name: fileName, path: filePath };
}

function getSetupFileNameFromLatestContent(latestContent) {
  const pathMatch = latestContent.match(/^path:\s*['"]?(.+?)['"]?\s*$/m);
  const urlMatch = latestContent.match(/^\s*-\s+url:\s*['"]?(.+?)['"]?\s*$/m);
  const fileName = path.basename(String(pathMatch?.[1] || urlMatch?.[1] || '').trim());

  return fileName || '';
}

function sanitizeUpdateFileName(fileName) {
  const safeName = path.basename(String(fileName || '').trim());

  if (!safeName || safeName !== String(fileName || '').trim()) {
    return '';
  }

  return safeName;
}

function getUploadedFile(files, fieldName) {
  const file = files.find((candidate) => candidate.fieldName === fieldName && candidate.filename && candidate.data?.length);
  if (!file) {
    return null;
  }

  return { ...file, filename: sanitizeUpdateFileName(file.filename) };
}

function getUpdateStatusPayload() {
  const files = listUpdateFiles();
  const setupFile = getSetupFileFromLatestManifest(UPDATE_DIR);
  const latestFile = files.find((file) => file.name === 'latest.yml');
  const blockmapFile = setupFile
    ? files.find((file) => file.name === `${setupFile.name}.blockmap`)
    : files.find((file) => /\.exe\.blockmap$/i.test(file.name));

  return {
    files,
    latest: latestFile || null,
    setup: setupFile ? files.find((file) => file.name === setupFile.name) || setupFile : null,
    blockmap: blockmapFile || null,
    ready: Boolean(latestFile && setupFile && blockmapFile),
    version: latestFile ? getLatestVersionFromFile(latestFile.path) : '',
  };
}

function listUpdateFiles() {
  if (!fs.existsSync(UPDATE_DIR)) {
    return [];
  }

  return fs
    .readdirSync(UPDATE_DIR)
    .filter((fileName) => fileName === 'latest.yml' || /\.exe$/i.test(fileName) || /\.exe\.blockmap$/i.test(fileName))
    .map((fileName) => {
      const filePath = path.join(UPDATE_DIR, fileName);
      const stat = fs.statSync(filePath);
      return {
        name: fileName,
        path: filePath,
        size: stat.size,
        sizeLabel: formatBytes(stat.size),
        updatedAt: stat.mtime.toISOString(),
      };
    })
    .filter((file) => fs.statSync(file.path).isFile())
    .sort((first, second) => first.name.localeCompare(second.name));
}

function getLatestVersionFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return String(content.match(/^version:\s*['"]?(.+?)['"]?\s*$/m)?.[1] || '').trim();
  } catch {
    return '';
  }
}

function cleanupOldUpdateFiles(keepNames) {
  if (!fs.existsSync(UPDATE_DIR)) {
    return;
  }

  for (const fileName of fs.readdirSync(UPDATE_DIR)) {
    if (!keepNames.has(fileName) && (fileName === 'latest.yml' || /\.exe$/i.test(fileName) || /\.exe\.blockmap$/i.test(fileName))) {
      fs.rmSync(path.join(UPDATE_DIR, fileName), { force: true });
    }
  }
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${value} B`;
}

function getUpdateContentType(fileName) {
  if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) {
    return 'application/x-yaml; charset=utf-8';
  }

  if (fileName.endsWith('.exe')) {
    return 'application/vnd.microsoft.portable-executable';
  }

  if (fileName.endsWith('.blockmap')) {
    return 'application/octet-stream';
  }

  return 'application/octet-stream';
}

const BASE_STYLES = `
  :root {
    color-scheme: light;
    font-family: Inter, Segoe UI, Arial, sans-serif;
    color: #08111f;
    background: #eef2f6;
    --ink: #08111f;
    --muted: #5b6677;
    --line: #d7dee8;
    --soft: #f4f7fb;
    --surface: #ffffff;
    --teal: #0f8793;
    --teal-dark: #0b6f78;
    --red: #cb1137;
    --green: #12843b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, rgba(203, 17, 55, .10), transparent 28%),
      radial-gradient(circle at top right, rgba(15, 135, 147, .12), transparent 30%),
      #eef2f6;
  }
  header {
    min-height: 76px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 28px;
    background: rgba(255, 255, 255, .94);
    border-bottom: 1px solid var(--line);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  main { padding: 28px; }
  h1, h2, h3, p { margin: 0; }
  h1 { font-size: 25px; line-height: 1.15; }
  h2 { font-size: 20px; line-height: 1.2; }
  h3 { font-size: 15px; line-height: 1.25; }
  p { color: var(--muted); font-weight: 700; }
  a { color: var(--teal); font-weight: 900; text-decoration: none; }
  a.button, .nav-link {
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 14px;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    background: #fff;
    color: var(--ink);
    font-weight: 900;
  }
  a.button.primary, .nav-link.primary { background: var(--teal); color: #fff; border-color: var(--teal); }
  .brand-lockup { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .brand-mark {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: linear-gradient(135deg, #cb1137, #0f8793);
    color: #fff;
    font-size: 18px;
    font-weight: 950;
    box-shadow: 0 10px 26px rgba(15, 23, 42, .16);
  }
  .nav-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
  .eyebrow { color: var(--teal); font-size: 11px; font-weight: 950; text-transform: uppercase; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 18px 44px rgba(15, 23, 42, .08); }
  .layout { max-width: 1220px; margin: 0 auto; display: grid; gap: 18px; }
  .page-shell { max-width: 1220px; margin: 0 auto; display: grid; gap: 18px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .three-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .panel { padding: 22px; display: grid; gap: 14px; }
  .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .auth-shell { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: minmax(320px, .9fr) minmax(380px, 1.1fr); gap: 18px; align-items: stretch; }
  .hero-panel {
    padding: 30px;
    display: grid;
    align-content: space-between;
    gap: 28px;
    min-height: 460px;
    color: #fff;
    background: linear-gradient(135deg, #cb1137 0%, #0f8793 74%);
    border-color: transparent;
    overflow: hidden;
    position: relative;
  }
  .hero-panel:after {
    content: "";
    position: absolute;
    inset: auto -90px -110px auto;
    width: 240px;
    height: 240px;
    border-radius: 50%;
    background: rgba(255, 255, 255, .14);
  }
  .hero-panel h2 { font-size: 34px; }
  .hero-panel p, .hero-panel small { color: rgba(255, 255, 255, .88); }
  .hero-badges { display: flex; gap: 8px; flex-wrap: wrap; position: relative; z-index: 1; }
  .hero-badges span { padding: 8px 10px; border-radius: 999px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.26); font-weight: 900; }
  .step-list { display: grid; gap: 10px; position: relative; z-index: 1; }
  .step-list div { padding: 12px; border-radius: 8px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.22); font-weight: 900; }
  .form-panel { padding: 28px; display: grid; gap: 16px; }
  .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .stack { display: grid; gap: 12px; }
  .admin-page { padding-top: 22px; }
  .admin-shell { max-width: 1280px; margin: 0 auto; display: grid; gap: 16px; }
  .admin-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(340px, .85fr);
    gap: 18px;
    align-items: stretch;
    padding: 0;
    overflow: hidden;
  }
  .admin-hero-copy {
    padding: 28px;
    display: grid;
    align-content: space-between;
    gap: 22px;
    color: #fff;
    background: linear-gradient(135deg, #111827 0%, #0f8793 68%);
  }
  .admin-hero-copy .eyebrow,
  .admin-hero-copy p { color: rgba(255,255,255,.86); }
  .admin-hero-copy h2 { font-size: 34px; line-height: 1.05; }
  .admin-hero-points { display: flex; gap: 8px; flex-wrap: wrap; }
  .admin-hero-points span { padding: 8px 10px; border: 1px solid rgba(255,255,255,.24); border-radius: 999px; background: rgba(255,255,255,.12); font-weight: 900; }
  .admin-command {
    padding: 22px;
    display: grid;
    gap: 13px;
    align-content: start;
    background: #fff;
  }
  .admin-board { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 16px; align-items: start; }
  .admin-compact-card { min-height: 100%; }
  .admin-release-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .release-upload-card { overflow: hidden; }
  .release-upload-card .section-head { padding-bottom: 2px; border-bottom: 1px solid #e2e8f0; }
  .release-actions { justify-content: space-between; }
  .release-action-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
  .release-upload-card .file-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .release-checklist {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .release-slot {
    display: grid;
    gap: 4px;
    padding: 10px;
    border: 1px solid #dbe3ee;
    border-radius: 9px;
    background: #fff;
  }
  .release-slot strong { color: var(--ink); }
  .release-slot span { color: #64748b; font-size: 12px; font-weight: 850; }
  .release-slot.ok { border-color: #b9efcd; background: #f0fdf4; }
  .release-slot.missing { border-color: #fed7aa; background: #fff7ed; }
  .upload-progress-card {
    display: none;
    gap: 8px;
    padding: 12px;
    border: 1px solid #dbe3ee;
    border-radius: 9px;
    background: #f8fafc;
  }
  .upload-progress-card.active { display: grid; }
  .upload-progress-head { display: flex; justify-content: space-between; gap: 12px; color: #334155; font-size: 12px; font-weight: 900; }
  .upload-progress-track { height: 10px; overflow: hidden; border-radius: 999px; background: #e2e8f0; }
  .upload-progress-fill { width: 0%; height: 100%; background: linear-gradient(90deg, var(--teal), #22c55e); transition: width .18s ease; }
  .upload-progress-meta { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; color: #64748b; font-size: 12px; font-weight: 850; }
  .release-upload-card .file-row {
    min-height: 82px;
    align-content: space-between;
    grid-template-columns: 1fr;
    border-radius: 10px;
  }
  .release-upload-card .file-row > span { justify-self: start; }
  .admin-client-tools { display: grid; grid-template-columns: minmax(240px, 1fr) 180px; gap: 12px; align-items: end; }
  .admin-client-head { align-items: end; }
  .admin-note-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .admin-note-row span { padding: 7px 9px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 900; }
  label { display: grid; gap: 6px; color: #4a5568; font-size: 12px; font-weight: 900; }
  input, select { width: 100%; height: 42px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-weight: 800; outline: none; }
  input[type="file"] { height: auto; min-height: 46px; padding: 7px; background: #f8fafc; }
  input[type="file"]::file-selector-button {
    height: 30px;
    margin-right: 9px;
    padding: 0 10px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #fff;
    color: var(--ink);
    font-weight: 900;
    cursor: pointer;
  }
  input:focus, select:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(15, 135, 147, .16); }
  button { min-height: 42px; padding: 0 14px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: var(--ink); font-weight: 900; cursor: pointer; }
  button.primary { background: var(--teal); color: #fff; border-color: var(--teal); }
  button.primary:hover { background: var(--teal-dark); }
  button.danger { background: var(--red); color: #fff; border-color: var(--red); }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .status { padding: 12px 14px; border-radius: 7px; background: #f4f7fb; border: 1px solid #dbe3ee; color: #334155; font-weight: 800; }
  .status.ok, .status.good { background: #ecfdf3; border-color: #b9efcd; color: #126b36; }
  .status.error { background: #fff1f2; border-color: #fecdd3; color: #a30f2f; }
  .status.warn { background: #fff7ed; border-color: #fed7aa; color: #9a3412; }
  .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .metric { padding: 14px; border: 1px solid #dbe3ee; border-radius: 8px; background: #f8fafc; display: grid; gap: 6px; }
  .metric span { color: #64748b; font-size: 12px; font-weight: 900; }
  .metric strong { font-size: 24px; }
  .plan-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .plan-card { padding: 16px; border: 1px solid #dbe3ee; border-radius: 10px; background: #f8fafc; display: grid; gap: 12px; }
  .plan-card.featured { border-color: rgba(15,135,147,.55); background: #eefafa; }
  .plan-card h3 { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .plan-card ul { margin: 0; padding-left: 18px; color: #475569; font-weight: 800; line-height: 1.55; }
  .plan-card p { line-height: 1.4; }
  .plan-meta { display: flex; gap: 8px; flex-wrap: wrap; }
  .current-plan-card { border-color: rgba(15,135,147,.45); background: #eefafa; }
  .action-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .action-card { padding: 16px; border: 1px solid #dbe3ee; border-radius: 8px; background: #f8fafc; display: grid; gap: 6px; }
  .action-card strong { font-size: 16px; }
  .file-list { display: grid; gap: 8px; }
  .file-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 10px; border: 1px solid #dbe3ee; border-radius: 7px; background: #f8fafc; }
  .file-row strong, .file-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-row span, small { color: #64748b; font-weight: 800; }
  .table-wrap { overflow: auto; border: 1px solid #dbe3ee; border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 11px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
  th { color: #475569; font-size: 11px; text-transform: uppercase; }
  .badge { display: inline-flex; padding: 5px 8px; border-radius: 999px; background: #edf2f7; color: #334155; font-size: 11px; font-weight: 900; }
  .badge.good { background: #dcfce7; color: #166534; }
  .badge.bad { background: #ffe4e6; color: #9f1239; }
  .badge.warn { background: #ffedd5; color: #9a3412; }
  .code-box { font-size: 34px; letter-spacing: .14em; font-weight: 950; color: #0f8793; }
  .restaurant-list { display: grid; gap: 12px; }
  .restaurant-card { border: 1px solid #dbe3ee; border-radius: 10px; background: #fff; padding: 16px; display: grid; gap: 14px; overflow: hidden; }
  .restaurant-card.pending { border-color: #fed7aa; background: #fffaf3; }
  .restaurant-card.suspended { border-color: #fecdd3; background: #fff8f9; }
  .restaurant-main { display: grid; grid-template-columns: minmax(220px, 1.2fr) minmax(160px, .8fr) minmax(220px, 1fr); gap: 14px; align-items: start; }
  .admin-client-card { padding: 0; background: #fff; }
  .admin-client-card .restaurant-main {
    grid-template-columns: minmax(0, .95fr) minmax(220px, .55fr);
    gap: 0;
  }
  .admin-client-card .restaurant-title,
  .admin-client-card .stack,
  .admin-client-card .subscription-box { padding: 16px; }
  .admin-client-card .stack { border-left: 1px solid #e2e8f0; }
  .admin-client-card .subscription-box {
    grid-column: 1 / -1;
    border-right: 0;
    border-bottom: 0;
    border-left: 0;
    border-radius: 0;
    background: #f8fafc;
  }
  .admin-client-card .subscription-edit { grid-template-columns: minmax(120px, 1fr) 110px 145px 130px minmax(126px, auto); }
  .admin-client-card .subscription-box .row { justify-content: flex-end; }
  .restaurant-title { display: grid; gap: 6px; }
  .restaurant-title strong { font-size: 18px; }
  .subscription-box { padding: 12px; border: 1px solid #dbe3ee; border-radius: 8px; background: #f8fafc; display: grid; gap: 10px; }
  .subscription-edit { display: grid; grid-template-columns: minmax(120px, 1fr) 130px 150px auto; gap: 8px; align-items: end; }
  .device-list { color: #64748b; font-size: 12px; font-weight: 800; line-height: 1.45; }
  .empty-state { padding: 22px; border: 1px dashed #cbd5e1; border-radius: 10px; background: #f8fafc; color: #64748b; font-weight: 900; text-align: center; }
  @media (max-width: 1000px) {
    .auth-shell { grid-template-columns: 1fr; }
    .admin-hero, .admin-board { grid-template-columns: 1fr; }
    .hero-panel { min-height: auto; }
    .metric-grid, .action-grid, .three-grid, .plan-grid, .admin-release-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .restaurant-main, .subscription-edit, .admin-client-card .restaurant-main, .admin-client-card .subscription-edit { grid-template-columns: 1fr; }
    .admin-client-card .stack { border-left: 0; border-top: 1px solid #e2e8f0; }
    .admin-client-card .subscription-box { grid-column: auto; }
    .release-upload-card .file-list, .release-checklist { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 680px) {
    header, main { padding-left: 16px; padding-right: 16px; }
    header { align-items: flex-start; }
    .grid, .metric-grid, .action-grid, .three-grid, .plan-grid, .admin-release-grid, .admin-client-tools { grid-template-columns: 1fr; }
    .release-upload-card .file-list, .release-checklist { grid-template-columns: 1fr; }
    .brand-mark { width: 40px; height: 40px; }
    .nav-actions { width: 100%; justify-content: flex-start; }
  }
`;

function createConnectHtml(request) {
  const config = getPublicConfig(request);
  const updateBadgeClass = config.updates.ready ? 'good' : 'warn';
  const updateBadgeText = config.updates.ready
    ? `Windows update ready${config.updates.version ? ` / v${config.updates.version}` : ''}`
    : 'Windows update files missing';
  const endpointCards = [
    ['Cloud URL for app', config.desktop.cloudUrl],
    ['Client signup', config.endpoints.signup],
    ['Client portal', config.endpoints.portal],
    ['GI admin panel', config.endpoints.admin],
    ['Windows download', config.endpoints.downloadWindows || config.desktop.downloadWindows],
    ['Updater feed', config.endpoints.latestYml],
  ];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GI POS Cloud Connection</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <header>
    <div class="brand-lockup">
      <div class="brand-mark">GI</div>
      <div>
        <h1>GI POS Cloud Connect</h1>
        <p>Domain, download, portal, and update check</p>
      </div>
    </div>
    <div class="nav-actions">
      <a class="nav-link primary" href="/portal">Client Portal</a>
      <a class="nav-link" href="/admin">Admin Panel</a>
      <a class="nav-link" href="/signup">Signup</a>
    </div>
  </header>
  <main>
    <div class="layout">
      <section class="card panel">
        <div class="section-head">
          <div class="stack">
            <span class="eyebrow">Connection Ready</span>
            <h2>${escapeHtml(config.baseUrl)}</h2>
            <p>Use this exact domain as the desktop app Cloud URL. Local IP addresses are only for LAN/local-server testing.</p>
          </div>
          <span class="badge good">Cloud API online</span>
        </div>
        <div class="status ok">Health check passed from this server page.</div>
      </section>

      <section class="three-grid">
        <article class="card panel">
          <span class="eyebrow">Desktop App</span>
          <h3>Cloud URL</h3>
          <div class="status">${escapeHtml(config.desktop.cloudUrl)}</div>
          <p>Enter this on first login, reinstall restore, or account change.</p>
        </article>
        <article class="card panel">
          <span class="eyebrow">Auto Update</span>
          <h3>Windows Update</h3>
          <span class="badge ${updateBadgeClass}">${escapeHtml(updateBadgeText)}</span>
          <p>${escapeHtml(config.updates.setup || 'Upload latest.yml, setup exe, and exe.blockmap from admin panel.')}</p>
        </article>
        <article class="card panel">
          <span class="eyebrow">Plans</span>
          <h3>Four subscription plans</h3>
          <p>Premium, Gold, and Offline serve Windows POS. Android is for the native mobile billing app.</p>
        </article>
      </section>

      <section class="card panel">
        <div class="section-head">
          <div>
            <span class="eyebrow">Important URLs</span>
            <h2>Open these links to confirm setup</h2>
          </div>
          <a class="button" href="/api/v1/public/config" target="_blank" rel="noreferrer">JSON Config</a>
        </div>
        <div class="grid">
          ${endpointCards
            .map(
              ([label, href]) => `
                <a class="button" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">
                  <span>${escapeHtml(label)}</span>
                </a>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="card panel">
        <span class="eyebrow">Recommended Flow</span>
        <div class="step-list" style="color:#08111f">
          <div style="background:#f8fafc;border-color:#dbe3ee">1. Client signs up from the public signup page.</div>
          <div style="background:#f8fafc;border-color:#dbe3ee">2. GI admin approves plan and expiry.</div>
          <div style="background:#f8fafc;border-color:#dbe3ee">3. The approved Windows or Android app signs in and activates.</div>
          <div style="background:#f8fafc;border-color:#dbe3ee">4. Enable Auto Sync after first successful restore.</div>
        </div>
      </section>
    </div>
  </main>
</body>
</html>`;
}

const SIGNUP_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GI POS Cloud Signup</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <header>
    <div class="brand-lockup">
      <div class="brand-mark">GI</div>
      <div>
        <h1>GI POS Cloud</h1>
        <p>Restaurant POS signup request</p>
      </div>
    </div>
    <div class="nav-actions">
      <a class="nav-link" href="/portal">Client Portal</a>
      <a class="nav-link" href="/admin">Admin Panel</a>
    </div>
  </header>
  <main>
    <div class="auth-shell">
      <section class="card hero-panel">
        <div class="stack">
          <span class="eyebrow" style="color:#fff">GI Hostings Cloud</span>
          <h2>Start restaurant cloud access with a clean approval flow.</h2>
          <p>Signup creates the client account and business profile. GI admin approves the subscription, then the compatible Windows or Android POS can activate.</p>
        </div>
        <div class="step-list">
          <div>1. Submit business and owner details</div>
          <div>2. Admin approves subscription period</div>
          <div>3. Approved POS app connects with phone/email and password</div>
        </div>
        <div class="hero-badges">
          <span>Local POS</span>
          <span>Cloud Backup</span>
          <span>Client Portal</span>
        </div>
      </section>

      <section class="card form-panel">
        <div class="stack">
          <span class="eyebrow">New Client</span>
          <h2>Client Signup</h2>
          <p>Use real billing details here because the same information can be used for business profile and support.</p>
        </div>
        <div class="grid">
          <label>Business Name <input id="businessName" autocomplete="organization"></label>
          <label>Owner Name <input id="ownerName" autocomplete="name"></label>
          <label>Phone <input id="phone" autocomplete="tel"></label>
          <label>Email <input id="email" autocomplete="email"></label>
          <label>Password <input id="password" type="password" autocomplete="new-password"></label>
        </div>
        <div class="row">
          <button class="primary" id="signupBtn">Submit Signup</button>
          <a class="button" href="/portal">Already approved? Login</a>
        </div>
        <div class="status" id="status">Waiting for signup details.</div>
        <div class="stack">
          <span class="eyebrow">Available Plans</span>
          <div class="plan-grid">${PLAN_CARDS_HTML}</div>
        </div>
      </section>
    </div>
  </main>
  <script>
    const statusEl = document.getElementById('status');
    function setStatus(text, kind) {
      statusEl.className = 'status ' + (kind || '');
      statusEl.textContent = text;
    }
    document.getElementById('signupBtn').addEventListener('click', async function () {
      setStatus('Submitting signup...', '');
      const body = {
        businessName: document.getElementById('businessName').value,
        ownerName: document.getElementById('ownerName').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      };
      try {
        const response = await fetch('/api/v1/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        });
        const result = await response.json();
        if (!response.ok || result.ok === false) throw new Error(result.error || 'Signup failed');
        setStatus('Signup received. Approval pending in GI admin panel.', 'ok');
      } catch (error) {
        setStatus(error.message || 'Signup failed', 'error');
      }
    });
  </script>
</body>
</html>`;

const PORTAL_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GI POS Client Portal</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <header>
    <div class="brand-lockup">
      <div class="brand-mark">GI</div>
      <div>
        <h1>GI POS Client Portal</h1>
        <p>Subscription, downloads, and POS account security</p>
      </div>
    </div>
    <div class="nav-actions">
      <a class="nav-link" href="/signup">Signup</a>
      <button id="logoutBtn" style="display:none">Logout</button>
    </div>
  </header>
  <main>
    <div class="auth-shell" id="portalLoginShell">
      <section class="card hero-panel" id="portalIntro">
        <div class="stack">
          <span class="eyebrow" style="color:#fff">Client Portal</span>
          <h2>Manage subscription access without touching the POS counter.</h2>
          <p>Clients can download the Windows app, manage portal password recovery, generate transfer codes, and reset app user PIN after cloud sync.</p>
        </div>
        <div class="step-list">
          <div>Login with signup phone/email and password</div>
          <div>Download latest Windows setup when GI publishes updates</div>
          <div>Reset staff PINs after the desktop app syncs users</div>
        </div>
      </section>

      <section class="card form-panel" id="loginCard">
        <div class="stack">
          <span class="eyebrow">Secure Login</span>
          <h2>Client Login</h2>
          <p>Use the phone/email and password submitted during signup.</p>
        </div>
        <div class="grid">
          <label>Phone or Email <input id="clientLogin" autocomplete="username"></label>
          <label>Password <input id="clientPassword" type="password" autocomplete="current-password"></label>
        </div>
        <div class="row">
          <button class="primary" id="loginBtn">Login</button>
          <button id="forgotBtn">Forgot Password?</button>
        </div>
        <div class="status" id="loginStatus">Waiting for login.</div>
        <div class="status" id="forgotPanel" style="display:none">
          <strong>Reset Password</strong>
          <div class="grid" style="margin-top:12px">
            <label>Phone or Email <input id="resetLogin" autocomplete="username"></label>
            <label>Recovery Code <input id="resetRecoveryCode" placeholder="XXXX-XXXX-XXXX"></label>
            <label>New Password <input id="resetPassword" type="password" autocomplete="new-password"></label>
          </div>
          <button class="primary" id="resetPasswordBtn" style="margin-top:12px">Reset Password</button>
        </div>
      </section>
    </div>

    <div class="layout" id="portalShell" style="display:none">
      <section class="card panel" id="portalCard" style="display:none">
        <div class="section-head">
          <div>
            <span class="eyebrow">Account</span>
            <h2 id="accountTitle">Account</h2>
            <p id="accountSubtitle">Subscription and devices</p>
          </div>
          <button class="primary" id="refreshBtn">Refresh</button>
        </div>
        <div class="grid">
          <div class="status">
            <strong>Payment</strong><br>
            Online payment is not enabled yet. GI will handle subscription payment manually.
          </div>
          <div class="status" id="portalStatus">Loaded portal.</div>
        </div>
      </section>

      <section class="card panel" id="plansCard" style="display:none">
        <div class="section-head">
          <div>
            <span class="eyebrow">Plans</span>
            <h2>Current and Available Plans</h2>
          <p>Premium, Gold, and Offline are Windows plans. Android provides native mobile billing with offline operation and cloud sync.</p>
          </div>
        </div>
        <div class="plan-grid" id="portalPlanRows"></div>
      </section>

      <section class="card panel" id="transferCard" style="display:none">
        <div class="section-head">
          <div>
            <span class="eyebrow">Device Control</span>
            <h2>Main App Transfer Code</h2>
            <p>Use this when moving the main POS app to another PC. Existing cloud connections for this restaurant will be logged out.</p>
          </div>
        </div>
        <div class="grid">
          <label>Restaurant <select id="transferRestaurant"></select></label>
        </div>
        <button class="primary" id="generateTransferCodeBtn">Generate Transfer Code</button>
        <div class="code-box" id="transferCode">------</div>
        <div class="status" id="transferStatus">No transfer code generated.</div>
      </section>

      <section class="card panel" id="downloadCard" style="display:none">
        <div class="section-head">
          <div>
            <span class="eyebrow">POS Applications</span>
            <h2>Download GI POS</h2>
            <p>Install the application that matches the active Windows or Android plan.</p>
          </div>
        </div>
        <div class="row">
          <a class="button primary" href="/download/windows">Download Setup</a>
          <a class="button" href="/download/android">Download Android APK</a>
          <a class="button" href="/updates/win/latest.yml" target="_blank" rel="noreferrer">Version Info</a>
        </div>
        <div class="status">Use the same approved client account to activate the compatible app. Android plans cannot activate Windows, and Windows plans cannot activate Android.</div>
      </section>

      <section class="card panel" id="securityCard" style="display:none">
        <div class="section-head">
          <div>
            <span class="eyebrow">Security</span>
            <h2>Account Security</h2>
            <p>Generate a recovery code before you forget the portal password. It is shown only once.</p>
          </div>
        </div>
        <div class="grid">
          <label>Current Password <input id="currentPassword" type="password" autocomplete="current-password"></label>
          <label>New Password <input id="newPassword" type="password" autocomplete="new-password"></label>
        </div>
        <div class="row">
          <button class="primary" id="changePasswordBtn">Change Password</button>
          <button id="generateRecoveryBtn">Generate Recovery Code</button>
        </div>
        <div class="code-box" id="portalRecoveryCode">----</div>
        <div class="status" id="securityStatus">No recovery code generated in this browser session.</div>
      </section>

      <section class="card panel" id="staffPinCard" style="display:none">
        <div class="section-head">
          <div>
            <span class="eyebrow">Desktop Users</span>
            <h2>Desktop User PIN Reset</h2>
            <p>Reset a Windows app user PIN from the portal. The desktop app applies it on the next cloud sync.</p>
          </div>
        </div>
        <div class="grid">
          <label>Restaurant <select id="pinResetRestaurant"></select></label>
          <label>App User <select id="pinResetUser"></select></label>
          <label>New PIN <input id="pinResetNewPin" type="password" inputmode="numeric" autocomplete="new-password"></label>
          <label>Confirm PIN <input id="pinResetConfirmPin" type="password" inputmode="numeric" autocomplete="new-password"></label>
        </div>
        <button class="primary" id="resetStaffPinBtn">Send PIN Reset</button>
        <div class="status" id="staffPinStatus">Run cloud sync once from the desktop app to publish app users here.</div>
      </section>

      <section class="card panel" id="restaurantsCard" style="display:none">
        <div class="section-head">
          <div>
            <span class="eyebrow">Business List</span>
            <h2>Restaurants</h2>
          </div>
        </div>
        <div class="restaurant-list" id="clientRestaurantRows"></div>
      </section>
    </div>
  </main>
  <script>
    const portalLoginShell = document.getElementById('portalLoginShell');
    const portalShell = document.getElementById('portalShell');
    const loginCard = document.getElementById('loginCard');
    const portalCard = document.getElementById('portalCard');
    const plansCard = document.getElementById('plansCard');
    const transferCard = document.getElementById('transferCard');
    const downloadCard = document.getElementById('downloadCard');
    const restaurantsCard = document.getElementById('restaurantsCard');
    const loginStatus = document.getElementById('loginStatus');
    const portalStatus = document.getElementById('portalStatus');
    const rowsEl = document.getElementById('clientRestaurantRows');
    const transferRestaurantEl = document.getElementById('transferRestaurant');
    const transferCodeEl = document.getElementById('transferCode');
    const transferStatusEl = document.getElementById('transferStatus');
    const securityCard = document.getElementById('securityCard');
    const securityStatusEl = document.getElementById('securityStatus');
    const recoveryCodeEl = document.getElementById('portalRecoveryCode');
    const staffPinCard = document.getElementById('staffPinCard');
    const staffPinStatusEl = document.getElementById('staffPinStatus');
    const pinResetRestaurantEl = document.getElementById('pinResetRestaurant');
    const pinResetUserEl = document.getElementById('pinResetUser');
    const forgotPanel = document.getElementById('forgotPanel');
    const logoutBtn = document.getElementById('logoutBtn');
    const portalPlanRows = document.getElementById('portalPlanRows');
    const planCatalog = ${PLAN_CATALOG_JSON};
    let clientToken = localStorage.getItem('giClientToken') || '';
    let portalRestaurants = [];

    function esc(value) {
      return String(value || '').replace(/[&<>"']/g, function (ch) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch];
      });
    }
    function setStatus(element, text, kind) {
      element.className = 'status ' + (kind || '');
      element.textContent = text;
    }
    async function clientApi(path, options) {
      const headers = Object.assign(
        { 'content-type': 'application/json', 'x-client-token': clientToken },
        (options && options.headers) || {}
      );
      const response = await fetch(path, Object.assign({}, options || {}, { headers }));
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok || result.ok === false) throw new Error(result.error || 'Request failed');
      return result;
    }
    function showPortal(show) {
      portalLoginShell.style.display = show ? 'none' : '';
      portalShell.style.display = show ? '' : 'none';
      loginCard.style.display = show ? 'none' : '';
      portalCard.style.display = show ? '' : 'none';
      plansCard.style.display = show ? '' : 'none';
      transferCard.style.display = show ? '' : 'none';
      downloadCard.style.display = show ? '' : 'none';
      securityCard.style.display = show ? '' : 'none';
      staffPinCard.style.display = show ? '' : 'none';
      restaurantsCard.style.display = show ? '' : 'none';
      logoutBtn.style.display = show ? '' : 'none';
    }
    function subscriptionText(restaurant) {
      if (!restaurant.subscription_id) return 'No subscription';
      return restaurant.plan_name + ' / ' + restaurant.subscription_status + ' / ' + new Date(restaurant.expires_at).toLocaleDateString();
    }
    function getPlan(planName) {
      const value = String(planName || '').toLowerCase();
      return planCatalog.find(function (plan) { return value.indexOf(plan.id) >= 0 || value.indexOf(String(plan.name).toLowerCase()) >= 0; }) || null;
    }
    function planFeaturesHtml(plan) {
      return '<ul>' + (plan.features || []).map(function (feature) { return '<li>' + esc(feature) + '</li>'; }).join('') + '</ul>';
    }
    function renderPlanCards(restaurants) {
      const activePlanIds = new Set(restaurants.map(function (restaurant) {
        const plan = getPlan(restaurant.plan_name);
        return plan && plan.id;
      }).filter(Boolean));
      portalPlanRows.innerHTML = planCatalog.map(function (plan) {
        const active = activePlanIds.has(plan.id);
        return '<article class="plan-card ' + (active ? 'current-plan-card' : '') + '">' +
          '<h3>' + esc(plan.name) + '<span class="badge ' + (active ? 'good' : '') + '">' + (active ? 'Current' : 'Available') + '</span></h3>' +
          '<p>' + esc(plan.subtitle) + '</p>' +
          '<div class="plan-meta"><span class="badge">' + esc(plan.counterLabel) + '</span><span class="badge">' + esc((plan.platforms || []).map(function (platform) { return platform === 'android' ? 'Android' : 'Windows'; }).join(' + ')) + '</span><span class="badge ' + (plan.localPos ? 'good' : 'warn') + '">' + (plan.localPos ? 'Local POS included' : 'Local POS not included') + '</span></div>' +
          planFeaturesHtml(plan) +
        '</article>';
      }).join('');
    }
    function renderRestaurants(restaurants) {
      if (!restaurants.length) {
        rowsEl.innerHTML = '<div class="empty-state">No restaurant approved for this account yet.</div>';
        return;
      }

      rowsEl.innerHTML = restaurants.map(function (restaurant) {
        const approved = restaurant.status === 'approved';
        const subActive = restaurant.subscription_status === 'active' || restaurant.subscription_status === 'trial';
        const canPair = approved && subActive;
        const badgeClass = approved ? 'good' : restaurant.status === 'suspended' ? 'bad' : '';
        const cardClass = restaurant.status === 'suspended' ? 'suspended' : approved ? '' : 'pending';
        const devices = String(restaurant.active_devices || 0);
        const plan = getPlan(restaurant.plan_name);
        const activeUsers = Number(restaurant.active_users || 1);
        const userLimit = restaurant.max_users == null ? 'Unlimited' : String(restaurant.max_users);
        const deviceList = (restaurant.devices || []).map(function (device) {
          const platform = device.platform === 'android' ? 'Android' : 'Windows';
          return esc(device.name) + ' / ' + platform + (device.active ? '' : ' (disabled)');
        }).join('');
        return '<article class="restaurant-card ' + cardClass + '">' +
          '<div class="restaurant-main">' +
            '<div class="restaurant-title"><strong>' + esc(restaurant.name) + '</strong><small>' + esc(restaurant.id) + '</small><span class="badge ' + badgeClass + '">' + esc(restaurant.status) + '</span></div>' +
            '<div><span class="eyebrow">Plan & Access</span><p>' + esc(subscriptionText(restaurant)) + '</p><div class="plan-meta"><span class="badge good">' + activeUsers + ' / ' + esc(userLimit) + ' users</span><span class="badge ' + (canPair ? 'good' : 'warn') + '">' + (canPair ? 'Activation ready' : 'Approval required') + '</span><span class="badge">' + esc(plan ? plan.counterLabel : 'Plan pending') + '</span></div></div>' +
            '<div><span class="eyebrow">Connected Devices</span><p>' + esc(devices) + ' active</p><div class="device-list">' + (deviceList || 'No devices connected') + '</div></div>' +
          '</div>' +
        '</article>';
      }).join('');

    }
    function renderTransferOptions() {
      const previousRestaurantId = transferRestaurantEl.value;
      const readyRestaurants = portalRestaurants.filter(function (restaurant) {
        const approved = restaurant.status === 'approved';
        const subActive = restaurant.subscription_status === 'active' || restaurant.subscription_status === 'trial';
        return approved && subActive;
      });

      transferRestaurantEl.innerHTML = readyRestaurants.map(function (restaurant) {
        return '<option value="' + esc(restaurant.id) + '">' + esc(restaurant.name) + '</option>';
      }).join('');

      if (readyRestaurants.some(function (restaurant) { return restaurant.id === previousRestaurantId; })) {
        transferRestaurantEl.value = previousRestaurantId;
      }

      if (!readyRestaurants.length) {
        setStatus(transferStatusEl, 'No approved active restaurant found for transfer code.', 'error');
        return;
      }

      setStatus(transferStatusEl, 'Ready to generate a one-time transfer code.', 'ok');
    }
    function getStaffUsers(restaurant) {
      return Array.isArray(restaurant && restaurant.staffUsers) ? restaurant.staffUsers : [];
    }
    function renderPinResetOptions() {
      const previousRestaurantId = pinResetRestaurantEl.value;
      const restaurantsWithUsers = portalRestaurants.filter(function (restaurant) {
        return getStaffUsers(restaurant).length > 0;
      });

      pinResetRestaurantEl.innerHTML = restaurantsWithUsers.map(function (restaurant) {
        return '<option value="' + esc(restaurant.id) + '">' + esc(restaurant.name) + '</option>';
      }).join('');

      if (restaurantsWithUsers.some(function (restaurant) { return restaurant.id === previousRestaurantId; })) {
        pinResetRestaurantEl.value = previousRestaurantId;
      }

      const selectedRestaurant = restaurantsWithUsers.find(function (restaurant) {
        return restaurant.id === pinResetRestaurantEl.value;
      }) || restaurantsWithUsers[0];
      const staffUsers = getStaffUsers(selectedRestaurant);
      pinResetUserEl.innerHTML = staffUsers.map(function (user) {
        return '<option value="' + esc(user.id) + '">' + esc(user.name) + (user.active === false ? ' (Disabled)' : '') + '</option>';
      }).join('');

      if (!restaurantsWithUsers.length) {
        setStatus(staffPinStatusEl, 'No app users found yet. Run cloud sync once from the desktop app, then refresh portal.', '');
        return;
      }

      setStatus(staffPinStatusEl, 'Choose app user and send a new PIN. Desktop app must sync to apply it.', 'ok');
    }
    async function loadPortal() {
      if (!clientToken) {
        showPortal(false);
        return;
      }

      const result = await clientApi('/api/v1/client/me');
      document.getElementById('accountTitle').textContent = result.account.ownerName || 'Client Account';
      document.getElementById('accountSubtitle').textContent = (result.account.phone || result.account.email || '') + ' / ' + result.account.status;
      portalRestaurants = result.restaurants || [];
      renderPlanCards(portalRestaurants);
      renderRestaurants(portalRestaurants);
      renderTransferOptions();
      renderPinResetOptions();
      setStatus(
        portalStatus,
        result.account.recoveryCodeSetAt
          ? 'Portal loaded. Recovery code already generated earlier; generate again if you need a new one.'
          : 'Portal loaded. Generate a recovery code from Account Security.',
        'ok'
      );
      showPortal(true);
    }
    async function login() {
      setStatus(loginStatus, 'Logging in...', '');
      const result = await fetch('/api/v1/client/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          login: document.getElementById('clientLogin').value,
          password: document.getElementById('clientPassword').value
        })
      }).then(async function (response) {
        const body = await response.json().catch(function () { return {}; });
        if (!response.ok || body.ok === false) throw new Error(body.error || 'Login failed');
        return body;
      });
      clientToken = result.token;
      localStorage.setItem('giClientToken', clientToken);
      setStatus(loginStatus, 'Login success.', 'ok');
      await loadPortal();
    }
    async function resetPassword() {
      setStatus(loginStatus, 'Resetting password...', '');
      const response = await fetch('/api/v1/client/password/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          login: document.getElementById('resetLogin').value || document.getElementById('clientLogin').value,
          recoveryCode: document.getElementById('resetRecoveryCode').value,
          newPassword: document.getElementById('resetPassword').value
        })
      });
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok || result.ok === false) throw new Error(result.error || 'Password reset failed');
      setStatus(loginStatus, result.message || 'Password reset successfully.', 'ok');
      forgotPanel.style.display = 'none';
    }
    async function changePassword() {
      setStatus(securityStatusEl, 'Changing password...', '');
      const result = await clientApi('/api/v1/client/password/change', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: document.getElementById('currentPassword').value,
          newPassword: document.getElementById('newPassword').value
        })
      });
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      setStatus(securityStatusEl, result.message || 'Password changed successfully.', 'ok');
    }
    async function generateRecoveryCode() {
      setStatus(securityStatusEl, 'Generating recovery code...', '');
      const result = await clientApi('/api/v1/client/recovery-code', { method: 'POST' });
      recoveryCodeEl.textContent = result.code;
      setStatus(securityStatusEl, result.message || 'Recovery code generated.', 'ok');
    }
    async function generateTransferCode() {
      const restaurantId = transferRestaurantEl.value;
      if (!restaurantId) {
        setStatus(transferStatusEl, 'Choose restaurant first.', 'error');
        return;
      }

      setStatus(transferStatusEl, 'Generating transfer code...', '');
      const result = await clientApi('/api/v1/client/restaurants/' + encodeURIComponent(restaurantId) + '/pairing-codes', {
        method: 'POST',
        body: JSON.stringify({ deviceName: '${MAIN_APP_DEVICE_NAME}' })
      });
      transferCodeEl.textContent = result.transferCode || result.code || '------';
      const expiresAt = result.pairingCode && result.pairingCode.expires_at
        ? new Date(result.pairingCode.expires_at).toLocaleString()
        : '';
      setStatus(
        transferStatusEl,
        'Use this code in the desktop app Transfer Code field' + (expiresAt ? '. Expires: ' + expiresAt : '') + '.',
        'ok'
      );
    }
    async function resetStaffPin() {
      const restaurantId = pinResetRestaurantEl.value;
      const staffUserId = pinResetUserEl.value;
      const newPin = document.getElementById('pinResetNewPin').value;
      const confirmPin = document.getElementById('pinResetConfirmPin').value;

      if (!restaurantId || !staffUserId) {
        setStatus(staffPinStatusEl, 'Choose restaurant and app user.', 'error');
        return;
      }

      if (!/^\\d{4,8}$/.test(newPin)) {
        setStatus(staffPinStatusEl, 'PIN must be 4 to 8 digits.', 'error');
        return;
      }

      if (newPin !== confirmPin) {
        setStatus(staffPinStatusEl, 'PIN confirmation does not match.', 'error');
        return;
      }

      setStatus(staffPinStatusEl, 'Sending PIN reset...', '');
      const result = await clientApi('/api/v1/client/restaurants/' + encodeURIComponent(restaurantId) + '/staff-pin-reset', {
        method: 'POST',
        body: JSON.stringify({ staffUserId: staffUserId, newPin: newPin })
      });
      document.getElementById('pinResetNewPin').value = '';
      document.getElementById('pinResetConfirmPin').value = '';
      setStatus(staffPinStatusEl, result.message || 'PIN reset sent. Run cloud sync in desktop app.', 'ok');
    }
    document.getElementById('loginBtn').addEventListener('click', function () {
      login().catch(function (error) { setStatus(loginStatus, error.message, 'error'); });
    });
    document.getElementById('forgotBtn').addEventListener('click', function () {
      forgotPanel.style.display = forgotPanel.style.display === 'none' ? '' : 'none';
    });
    document.getElementById('resetPasswordBtn').addEventListener('click', function () {
      resetPassword().catch(function (error) { setStatus(loginStatus, error.message, 'error'); });
    });
    document.getElementById('changePasswordBtn').addEventListener('click', function () {
      changePassword().catch(function (error) { setStatus(securityStatusEl, error.message, 'error'); });
    });
    document.getElementById('generateRecoveryBtn').addEventListener('click', function () {
      generateRecoveryCode().catch(function (error) { setStatus(securityStatusEl, error.message, 'error'); });
    });
    document.getElementById('generateTransferCodeBtn').addEventListener('click', function () {
      generateTransferCode().catch(function (error) { setStatus(transferStatusEl, error.message, 'error'); });
    });
    pinResetRestaurantEl.addEventListener('change', renderPinResetOptions);
    document.getElementById('resetStaffPinBtn').addEventListener('click', function () {
      resetStaffPin().catch(function (error) { setStatus(staffPinStatusEl, error.message, 'error'); });
    });
    document.getElementById('refreshBtn').addEventListener('click', function () {
      loadPortal().catch(function (error) { setStatus(portalStatus, error.message, 'error'); });
    });
    logoutBtn.addEventListener('click', function () {
      clientToken = '';
      localStorage.removeItem('giClientToken');
      showPortal(false);
    });
    loadPortal().catch(function () {
      clientToken = '';
      localStorage.removeItem('giClientToken');
      showPortal(false);
    });
  </script>
</body>
</html>`;

const ADMIN_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GI POS Cloud Admin</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <header>
    <div class="brand-lockup">
      <div class="brand-mark">GI</div>
      <div>
        <h1>GI POS Cloud Admin</h1>
        <p>Approve restaurants, manage subscriptions, and reset client access</p>
      </div>
    </div>
    <div class="nav-actions">
      <a class="nav-link" href="/portal">Client Portal</a>
      <a class="nav-link" href="/signup">Signup Page</a>
    </div>
  </header>
  <main class="admin-page">
    <div class="admin-shell">
      <section class="card admin-hero">
        <div class="admin-hero-copy">
          <div class="stack">
            <span class="eyebrow">GI Cloud Control</span>
            <h2>Subscription, release, and client access in one place.</h2>
            <p>Approve restaurants, manage Windows and Android plans, upload desktop releases, and reset client portal access from this panel.</p>
          </div>
          <div class="admin-hero-points">
            <span>Premium: 1 counter</span>
            <span>Gold: local POS server</span>
            <span>Android: native mobile POS</span>
            <span>Manual subscription payment</span>
          </div>
        </div>

        <div class="admin-command">
          <div class="section-head">
            <div>
              <span class="eyebrow">Admin Access</span>
              <h2>Load Control Panel</h2>
              <p>Use the GI cloud admin token. Plan and expiry are edited on each client card.</p>
            </div>
          </div>
          <label>Admin Token <input id="adminToken" type="password" placeholder="GI_CLOUD_ADMIN_TOKEN"></label>
          <div class="row">
            <button class="primary" id="loadBtn">Load Clients</button>
            <button id="saveTokenBtn">Save Token</button>
          </div>
          <div class="status" id="status">Enter admin token and load clients.</div>
        </div>
      </section>

      <div class="admin-board">
        <section class="card panel admin-compact-card release-upload-card">
          <div class="section-head">
            <div>
              <span class="eyebrow">Subscription Desk</span>
              <h2>Client Overview</h2>
              <p>Quick view for approvals and renewal health.</p>
            </div>
          </div>
          <div class="metric-grid" id="adminSummary">
            <div class="metric"><span>Total Clients</span><strong>0</strong></div>
            <div class="metric"><span>Active</span><strong>0</strong></div>
            <div class="metric"><span>Pending</span><strong>0</strong></div>
            <div class="metric"><span>Suspended</span><strong>0</strong></div>
          </div>
          <div class="status good">Normal app connection uses client phone/email and cloud password. Transfer code is only for moving the same counter to another PC.</div>
        </section>

        <section class="card panel admin-compact-card">
          <div class="section-head">
            <div>
              <span class="eyebrow">Release Upload</span>
              <h2>Windows App Update</h2>
              <p>Upload the three files from the desktop build release folder.</p>
            </div>
          </div>
          <div class="admin-release-grid">
            <label>latest.yml <input id="latestYmlFile" type="file" accept=".yml,.yaml"></label>
            <label>Setup EXE <input id="setupExeFile" type="file" accept=".exe"></label>
            <label>EXE Blockmap <input id="setupBlockmapFile" type="file" accept=".blockmap"></label>
          </div>
          <div class="upload-progress-card" id="uploadProgressCard" aria-live="polite">
            <div class="upload-progress-head">
              <span id="uploadProgressTitle">Preparing upload...</span>
              <strong id="uploadProgressPercent">0%</strong>
            </div>
            <div class="upload-progress-track">
              <div class="upload-progress-fill" id="uploadProgressFill"></div>
            </div>
            <div class="upload-progress-meta">
              <span id="uploadProgressBytes">0 B / 0 B</span>
              <span id="uploadProgressDetail">Waiting</span>
            </div>
          </div>
          <div class="row release-actions">
            <button class="primary" id="uploadUpdateBtn">Upload Update</button>
            <div class="release-action-buttons">
              <button id="refreshUpdateBtn">Refresh Info</button>
              <a class="button" href="/download/windows">Current Setup</a>
              <a class="button" href="/updates/win/latest.yml" target="_blank" rel="noreferrer">latest.yml</a>
            </div>
          </div>
          <div class="status" id="updateStatus">Load update info to see current files.</div>
          <div class="file-list" id="updateFiles"></div>
        </section>
      </div>

      <section class="card panel">
        <div class="section-head">
          <div>
            <span class="eyebrow">Plan Cards</span>
            <h2>Subscription Plans</h2>
            <p>Choose Premium, Gold, or Offline for Windows. Choose Android for the native mobile billing application.</p>
          </div>
          <div class="admin-note-row">
            <span>Yearly default</span>
            <span>Custom expiry available</span>
          </div>
        </div>
        <div class="plan-grid" id="adminPlanRows"></div>
      </section>

      <section class="card panel">
        <div class="section-head admin-client-head">
          <div>
            <span class="eyebrow">Clients</span>
            <h2>Restaurants</h2>
            <p>Manage plan, expiry, user capacity, access, and renewal from one client record.</p>
          </div>
          <div class="admin-client-tools">
            <label>Search Client <input id="clientSearch" placeholder="Business, owner, phone, email"></label>
            <label>Status
              <select id="clientStatusFilter">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          </div>
        </div>
        <div class="restaurant-list" id="restaurantRows"></div>
      </section>
    </div>
  </main>
  <script>
    const tokenInput = document.getElementById('adminToken');
    const rowsEl = document.getElementById('restaurantRows');
    const statusEl = document.getElementById('status');
    const updateStatusEl = document.getElementById('updateStatus');
    const updateFilesEl = document.getElementById('updateFiles');
    const adminSummaryEl = document.getElementById('adminSummary');
    const adminPlanRows = document.getElementById('adminPlanRows');
    const clientSearchInput = document.getElementById('clientSearch');
    const clientStatusFilter = document.getElementById('clientStatusFilter');
    const uploadUpdateBtn = document.getElementById('uploadUpdateBtn');
    const uploadProgressCard = document.getElementById('uploadProgressCard');
    const uploadProgressTitle = document.getElementById('uploadProgressTitle');
    const uploadProgressPercent = document.getElementById('uploadProgressPercent');
    const uploadProgressFill = document.getElementById('uploadProgressFill');
    const uploadProgressBytes = document.getElementById('uploadProgressBytes');
    const uploadProgressDetail = document.getElementById('uploadProgressDetail');
    const planCatalog = ${PLAN_CATALOG_JSON};
    let adminRestaurants = [];
    tokenInput.value = localStorage.getItem('giAdminToken') || '';

    function defaultExpiryValue(years) {
      const date = new Date();
      date.setFullYear(date.getFullYear() + Number(years || 1));
      return date.toISOString().slice(0, 10);
    }

    function esc(value) {
      return String(value || '').replace(/[&<>"']/g, function (ch) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch];
      });
    }
    function setStatus(text, kind) {
      statusEl.className = 'status ' + (kind || '');
      statusEl.textContent = text;
    }
    function setUpdateStatus(text, kind) {
      updateStatusEl.className = 'status ' + (kind || '');
      updateStatusEl.textContent = text;
    }
    function formatDate(value) {
      return value ? new Date(value).toLocaleString() : '';
    }
    function formatUploadBytes(value) {
      const bytes = Number(value || 0);
      if (!bytes) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      return (bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1) + ' ' + units[index];
    }
    function setUploadProgress(percent, loaded, total, detail) {
      const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent || 0))));
      uploadProgressCard.classList.add('active');
      uploadProgressPercent.textContent = safePercent + '%';
      uploadProgressFill.style.width = safePercent + '%';
      uploadProgressBytes.textContent = formatUploadBytes(loaded) + ' / ' + formatUploadBytes(total);
      uploadProgressDetail.textContent = detail || 'Uploading';
    }
    function uploadAdminFormData(path, form, totalBytes) {
      return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', path);
        xhr.setRequestHeader('x-admin-token', tokenInput.value);

        xhr.upload.onprogress = function (event) {
          const total = event.lengthComputable ? event.total : totalBytes;
          const loaded = event.loaded || 0;
          const percent = total ? (loaded / total) * 100 : 0;
          setUploadProgress(percent, loaded, total, 'Uploading to cloud');
        };

        xhr.onload = function () {
          let result = {};
          try {
            result = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          } catch {
            reject(new Error('Upload completed but server response was invalid.'));
            return;
          }

          if (xhr.status < 200 || xhr.status >= 300 || result.ok === false) {
            reject(new Error(result.error || 'Upload failed'));
            return;
          }

          setUploadProgress(100, totalBytes, totalBytes, 'Upload complete. Validating files...');
          resolve(result);
        };

        xhr.onerror = function () {
          reject(new Error('Upload failed. Check cloud server connection.'));
        };

        xhr.onabort = function () {
          reject(new Error('Upload cancelled.'));
        };

        xhr.send(form);
      });
    }
    function getPlan(planName) {
      const value = String(planName || '').toLowerCase();
      return planCatalog.find(function (plan) { return value.indexOf(plan.id) >= 0 || value.indexOf(String(plan.name).toLowerCase()) >= 0; }) || planCatalog[0];
    }
    function planOptionsHtml(selectedPlanName) {
      const selectedPlan = getPlan(selectedPlanName);
      return planCatalog.map(function (plan) {
        return '<option value="' + esc(plan.name) + '"' + (plan.id === selectedPlan.id ? ' selected' : '') + '>' + esc(plan.name) + '</option>';
      }).join('');
    }
    function planFeaturesHtml(plan) {
      return '<ul>' + (plan.features || []).map(function (feature) { return '<li>' + esc(feature) + '</li>'; }).join('') + '</ul>';
    }
    function renderAdminPlanCards() {
      adminPlanRows.innerHTML = planCatalog.map(function (plan) {
        return '<article class="plan-card ' + (plan.id === 'gold' ? 'featured' : '') + '">' +
          '<h3>' + esc(plan.name) + '<span class="badge ' + (plan.id === 'gold' ? 'good' : '') + '">' + esc(plan.counterLabel) + '</span></h3>' +
          '<p>' + esc(plan.subtitle) + '</p>' +
          '<div class="plan-meta"><span class="badge">' + esc((plan.platforms || []).map(function (platform) { return platform === 'android' ? 'Android' : 'Windows'; }).join(' + ')) + '</span><span class="badge ' + (plan.localPos ? 'good' : 'warn') + '">' + (plan.localPos ? 'Local POS included' : 'Local POS not included') + '</span><span class="badge">Yearly / custom expiry</span></div>' +
          planFeaturesHtml(plan) +
        '</article>';
      }).join('');
    }
    async function api(path, options) {
      const headers = Object.assign(
        { 'content-type': 'application/json', 'x-admin-token': tokenInput.value },
        (options && options.headers) || {}
      );
      const response = await fetch(path, Object.assign({}, options || {}, { headers }));
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok || result.ok === false) throw new Error(result.error || 'Request failed');
      return result;
    }
    async function adminFetchJson(path, options) {
      const response = await fetch(path, Object.assign({}, options || {}, {
        headers: Object.assign({ 'x-admin-token': tokenInput.value }, (options && options.headers) || {})
      }));
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok || result.ok === false) throw new Error(result.error || 'Request failed');
      return result;
    }
    function subscriptionText(restaurant) {
      if (!restaurant.subscription_id) return 'No subscription';
      return restaurant.plan_name + ' / ' + restaurant.subscription_status + ' / ' + new Date(restaurant.expires_at).toLocaleDateString();
    }
    function subscriptionHealth(restaurant) {
      if (!restaurant.subscription_id) return { label: 'No subscription', className: 'warn' };
      const activeStatus = restaurant.subscription_status === 'active' || restaurant.subscription_status === 'trial';
      const expired = restaurant.expires_at && new Date(restaurant.expires_at).getTime() < Date.now();
      if (activeStatus && !expired) return { label: 'Active till ' + new Date(restaurant.expires_at).toLocaleDateString(), className: 'good' };
      if (expired) return { label: 'Expired ' + new Date(restaurant.expires_at).toLocaleDateString(), className: 'bad' };
      return { label: restaurant.subscription_status || 'Inactive', className: 'warn' };
    }
    function dateInputValue(value) {
      if (!value) return defaultExpiryValue();
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return defaultExpiryValue();
      return date.toISOString().slice(0, 10);
    }
    function renderAdminSummary(restaurants) {
      const total = restaurants.length;
      const suspended = restaurants.filter(function (restaurant) { return restaurant.status === 'suspended'; }).length;
      const pending = restaurants.filter(function (restaurant) { return restaurant.status !== 'approved' && restaurant.status !== 'suspended'; }).length;
      const active = restaurants.filter(function (restaurant) {
        const health = subscriptionHealth(restaurant);
        return restaurant.status === 'approved' && health.className === 'good';
      }).length;
      adminSummaryEl.innerHTML =
        '<div class="metric"><span>Total Clients</span><strong>' + total + '</strong></div>' +
        '<div class="metric"><span>Active</span><strong>' + active + '</strong></div>' +
        '<div class="metric"><span>Pending</span><strong>' + pending + '</strong></div>' +
        '<div class="metric"><span>Suspended</span><strong>' + suspended + '</strong></div>';
    }
    function getFilteredRestaurants(restaurants) {
      const search = String(clientSearchInput.value || '').trim().toLowerCase();
      const filter = clientStatusFilter.value || 'all';

      return restaurants.filter(function (restaurant) {
        const health = subscriptionHealth(restaurant);
        const text = [
          restaurant.name,
          restaurant.owner_name,
          restaurant.phone,
          restaurant.email,
          restaurant.status,
          restaurant.plan_name,
        ].join(' ').toLowerCase();
        const matchesSearch = !search || text.indexOf(search) >= 0;
        let matchesFilter = true;

        if (filter === 'active') {
          matchesFilter = restaurant.status === 'approved' && health.className === 'good';
        } else if (filter === 'pending') {
          matchesFilter = restaurant.status !== 'approved' && restaurant.status !== 'suspended';
        } else if (filter === 'expired') {
          matchesFilter = restaurant.status === 'approved' && health.className === 'bad';
        } else if (filter === 'suspended') {
          matchesFilter = restaurant.status === 'suspended';
        }

        return matchesSearch && matchesFilter;
      });
    }
    function renderUpdateInfo(result) {
      const files = result.files || [];
      const readyText = result.ready ? 'Ready' : 'Missing files';
      const versionText = result.version ? ' / v' + result.version : '';
      const slots = [
        { label: 'Version Manifest', required: 'latest.yml', file: result.latest },
        { label: 'Windows Setup', required: 'Setup .exe', file: result.setup },
        { label: 'Blockmap', required: 'Setup .exe.blockmap', file: result.blockmap }
      ];
      const checklistHtml = '<div class="release-checklist">' + slots.map(function (slot) {
        const ok = Boolean(slot.file);
        return '<div class="release-slot ' + (ok ? 'ok' : 'missing') + '">' +
          '<strong>' + esc(slot.label) + '</strong>' +
          '<span>' + (ok ? esc(slot.file.name || slot.required) : 'Missing ' + esc(slot.required)) + '</span>' +
        '</div>';
      }).join('') + '</div>';
      setUpdateStatus(
        readyText + versionText + ' / ' + (result.updateDir || 'cloud/updates/win'),
        result.ready ? 'ok' : ''
      );
      const filesHtml = files.length
        ? files.map(function (file) {
            return '<div class="file-row">' +
              '<div><strong>' + esc(file.name) + '</strong><br><span>' + esc(formatDate(file.updatedAt)) + '</span></div>' +
              '<span>' + esc(file.sizeLabel || '') + '</span>' +
            '</div>';
          }).join('')
        : '<div class="status">No update files uploaded yet.</div>';
      updateFilesEl.innerHTML = checklistHtml + filesHtml;
    }
    async function loadUpdateInfo() {
      setUpdateStatus('Loading update files...', '');
      const result = await adminFetchJson('/api/v1/admin/updates/windows');
      renderUpdateInfo(result);
    }
    async function uploadUpdate() {
      const latest = document.getElementById('latestYmlFile').files[0];
      const setup = document.getElementById('setupExeFile').files[0];
      const blockmap = document.getElementById('setupBlockmapFile').files[0];

      if (!latest || !setup || !blockmap) {
        setUpdateStatus('Select latest.yml, setup .exe, and setup .exe.blockmap.', 'error');
        return;
      }

      if (!confirm('Replace current Windows app update files?')) {
        return;
      }

      const form = new FormData();
      form.append('latestYml', latest);
      form.append('setupExe', setup);
      form.append('setupBlockmap', blockmap);
      const totalBytes = latest.size + setup.size + blockmap.size;
      uploadUpdateBtn.disabled = true;
      setUpdateStatus('Uploading update files. Keep this page open.', '');
      uploadProgressTitle.textContent = 'Uploading Windows update files';
      setUploadProgress(0, 0, totalBytes, 'Starting upload');

      try {
        const result = await uploadAdminFormData('/api/v1/admin/updates/windows', form, totalBytes);
        renderUpdateInfo(result);
        setUpdateStatus(result.message || 'Update uploaded successfully.', 'ok');
        setUploadProgress(100, totalBytes, totalBytes, 'Ready for app updater');
      } finally {
        uploadUpdateBtn.disabled = false;
      }
    }
    function render(restaurants) {
      adminRestaurants = Array.isArray(restaurants) ? restaurants : adminRestaurants;
      renderAdminSummary(adminRestaurants);
      const visibleRestaurants = getFilteredRestaurants(adminRestaurants);

      if (!adminRestaurants.length) {
        rowsEl.innerHTML = '<div class="empty-state">No signup or restaurant found yet.</div>';
        return;
      }

      if (!visibleRestaurants.length) {
        rowsEl.innerHTML = '<div class="empty-state">No matching clients found.</div>';
        return;
      }

      rowsEl.innerHTML = visibleRestaurants.map(function (restaurant) {
        const approved = restaurant.status === 'approved';
        const badgeClass = approved ? 'good' : restaurant.status === 'suspended' ? 'bad' : '';
        const devices = String(restaurant.active_devices || 0);
        const cardClass = restaurant.status === 'suspended' ? 'suspended' : approved ? '' : 'pending';
        const subscription = subscriptionHealth(restaurant);
        const planValue = restaurant.plan_name || 'Premium';
        const expiryValue = dateInputValue(restaurant.expires_at);
        const selectedPlan = getPlan(planValue);
        const userLimit = restaurant.max_users == null ? '' : String(restaurant.max_users);
        const userUsage = Number(restaurant.active_users || 1);
        const userCapacityText = userLimit ? userUsage + ' / ' + userLimit + ' users' : userUsage + ' / Unlimited users';
        const deviceList = (restaurant.devices || []).slice(0, 4).map(function (device) {
          const platform = device.platform === 'android' ? 'Android' : 'Windows';
          return esc(device.name) + ' / ' + platform + ' - ' + (device.active ? 'active' : 'disabled') + (device.last_seen_at ? ' / ' + esc(formatDate(device.last_seen_at)) : '');
        }).join('<br>');
        return '<article class="restaurant-card admin-client-card ' + cardClass + '">' +
          '<div class="restaurant-main">' +
            '<div class="restaurant-title">' +
              '<strong>' + esc(restaurant.name) + '</strong>' +
              '<small>' + esc(restaurant.id) + '</small>' +
              '<span class="badge ' + badgeClass + '">' + esc(restaurant.status) + '</span>' +
            '</div>' +
            '<div class="stack">' +
              '<div><span class="eyebrow">Contact</span><p>' + esc(restaurant.owner_name || 'Owner') + '</p><small>' + esc(restaurant.phone || restaurant.email || 'No contact') + '</small></div>' +
              '<div><span class="eyebrow">Devices</span><p>' + esc(devices) + ' active</p><div class="device-list">' + (deviceList || 'No device connected yet') + '</div></div>' +
            '</div>' +
            '<div class="subscription-box">' +
              '<div class="toolbar"><div><span class="eyebrow">Plan & Access</span><p>' + esc(subscriptionText(restaurant)) + '</p></div><span class="badge ' + subscription.className + '">' + esc(subscription.label) + '</span></div>' +
              '<div class="plan-meta"><span class="badge good">' + esc(userCapacityText) + '</span><span class="badge">' + esc(selectedPlan.counterLabel) + '</span><span class="badge">' + esc((selectedPlan.platforms || []).map(function (platform) { return platform === 'android' ? 'Android' : 'Windows'; }).join(' + ')) + '</span></div>' +
              '<div class="subscription-edit">' +
                '<label>Plan <select data-plan-input>' + planOptionsHtml(planValue) + '</select></label>' +
                '<label>Period <select data-duration-input><option value="1">1 Year</option><option value="2">2 Years</option><option value="3">3 Years</option><option value="custom" selected>Custom</option></select></label>' +
                '<label>Expiry <input data-expiry-input type="date" value="' + esc(expiryValue) + '"></label>' +
                '<label>User Limit <input data-user-limit-input type="number" min="1" max="10000" value="' + esc(userLimit) + '" placeholder="Unlimited"></label>' +
                '<button class="primary" data-approve="' + esc(restaurant.id) + '">' + (approved ? 'Renew / Update' : 'Approve') + '</button>' +
              '</div>' +
              '<div class="row">' +
                '<button data-reset-password="' + esc(restaurant.id) + '" ' + (!restaurant.account_id ? 'disabled' : '') + '>Reset Portal Password</button>' +
                '<button class="danger" data-suspend="' + esc(restaurant.id) + '">Suspend</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</article>';
      }).join('');

      document.querySelectorAll('[data-approve]').forEach(function (button) {
        button.addEventListener('click', function () {
          const card = button.closest('.restaurant-card');
          const planInput = card ? card.querySelector('[data-plan-input]') : null;
          const expiryInput = card ? card.querySelector('[data-expiry-input]') : null;
          const userLimitInput = card ? card.querySelector('[data-user-limit-input]') : null;
          approve(button.getAttribute('data-approve'), planInput && planInput.value, expiryInput && expiryInput.value, userLimitInput && userLimitInput.value);
        });
      });
      document.querySelectorAll('[data-duration-input]').forEach(function (select) {
        select.addEventListener('change', function () {
          const card = select.closest('.restaurant-card');
          const expiryInput = card ? card.querySelector('[data-expiry-input]') : null;
          if (expiryInput && select.value !== 'custom') {
            expiryInput.value = defaultExpiryValue(select.value);
          }
        });
      });
      document.querySelectorAll('[data-reset-password]').forEach(function (button) {
        button.addEventListener('click', function () { resetPassword(button.getAttribute('data-reset-password')); });
      });
      document.querySelectorAll('[data-suspend]').forEach(function (button) {
        button.addEventListener('click', function () { suspend(button.getAttribute('data-suspend')); });
      });
    }
    async function load() {
      setStatus('Loading clients...', '');
      const result = await api('/api/v1/admin/restaurants');
      render(result.restaurants || []);
      setStatus('Loaded ' + (result.restaurants || []).length + ' restaurant(s).', 'ok');
      await loadUpdateInfo();
    }
    async function approve(id, planName, expiresAt, maxUsers) {
      setStatus('Approving restaurant...', '');
      await api('/api/v1/admin/restaurants/' + encodeURIComponent(id) + '/approve', {
        method: 'POST',
        body: JSON.stringify({
          planName: planName || 'Premium',
          expiresAt: expiresAt || defaultExpiryValue(),
          maxUsers: maxUsers || null
        })
      });
      await load();
    }
    async function resetPassword(id) {
      const newPassword = prompt('New client portal password. Minimum 6 characters.');
      if (!newPassword) return;
      if (newPassword.length < 6) {
        setStatus('Password must be at least 6 characters.', 'error');
        return;
      }
      setStatus('Resetting client portal password...', '');
      const result = await api('/api/v1/admin/restaurants/' + encodeURIComponent(id) + '/password-reset', {
        method: 'POST',
        body: JSON.stringify({ newPassword: newPassword })
      });
      setStatus(result.message || 'Client portal password reset successfully.', 'ok');
    }
    async function suspend(id) {
      if (!confirm('Suspend this restaurant?')) return;
      setStatus('Suspending restaurant...', '');
      await api('/api/v1/admin/restaurants/' + encodeURIComponent(id) + '/suspend', { method: 'POST' });
      await load();
    }
    document.getElementById('loadBtn').addEventListener('click', function () {
      load().catch(function (error) { setStatus(error.message, 'error'); });
    });
    document.getElementById('saveTokenBtn').addEventListener('click', function () {
      localStorage.setItem('giAdminToken', tokenInput.value);
      setStatus('Token saved in this browser.', 'ok');
    });
    document.getElementById('refreshUpdateBtn').addEventListener('click', function () {
      loadUpdateInfo().catch(function (error) { setUpdateStatus(error.message, 'error'); });
    });
    uploadUpdateBtn.addEventListener('click', function () {
      uploadUpdate().catch(function (error) { setUpdateStatus(error.message, 'error'); });
    });
    clientSearchInput.addEventListener('input', function () {
      render(adminRestaurants);
    });
    clientStatusFilter.addEventListener('change', function () {
      render(adminRestaurants);
    });
    renderAdminPlanCards();
  </script>
</body>
</html>`;

async function ensureRuntimeSchema() {
  await pool.query(`
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS recovery_code_hash TEXT NOT NULL DEFAULT '';
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS recovery_code_set_at TIMESTAMPTZ;
    ALTER TABLE subscriptions ALTER COLUMN max_devices SET DEFAULT 999999;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_users INTEGER;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'windows';
    ALTER TABLE pairing_codes ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'windows';
    CREATE INDEX IF NOT EXISTS devices_restaurant_platform_idx ON devices(restaurant_id, platform, active);
  `);
}

ensureRuntimeSchema()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`GI POS cloud API listening on ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Cloud database schema check failed', error);
    process.exit(1);
  });
