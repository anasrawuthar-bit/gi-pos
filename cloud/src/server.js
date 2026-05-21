const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createPool } = require('./db');

const PORT = Number(process.env.PORT || 8080);
const ADMIN_TOKEN = process.env.GI_CLOUD_ADMIN_TOKEN || '';
const CLIENT_TOKEN_SECRET = process.env.GI_CLIENT_TOKEN_SECRET || ADMIN_TOKEN || 'gi-pos-local-client-secret';
const UPDATE_DIR = process.env.GI_UPDATE_DIR || path.join(__dirname, '..', 'updates', 'win');
const DEFAULT_PAIRING_MINUTES = 30;
const DEFAULT_SUBSCRIPTION_DAYS = 30;
const UNLIMITED_DEVICE_LIMIT = 999999;
const CLIENT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const STAFF_DIRECTORY_KEY = 'pos-staff-user-directory';
const STAFF_PIN_RESET_KEY = 'pos-staff-pin-reset-commands';
const MAIN_APP_DEVICE_NAME = 'Main App';
const MAX_UPDATE_UPLOAD_BYTES = Number(process.env.GI_MAX_UPDATE_UPLOAD_BYTES || 350 * 1024 * 1024);
const pool = createPool();

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

  sendJson(response, 200, {
    ok: true,
    token: createClientToken(account.id),
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
    restaurants: await getAccountRestaurants(context.account.id),
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
  const transferCode = String(body.transferCode || '').replace(/\D/g, '');

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

    let transferPairing = null;
    let loggedOutDevices = [];

    if (transferCode) {
      const transferResult = await client.query(
        `
          SELECT id, device_name
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

    const apiKey = createApiKey();
    const deviceResult = await client.query(
      `
        INSERT INTO devices (restaurant_id, name, api_key_hash)
        VALUES ($1, $2, $3)
        RETURNING id, restaurant_id, name, active, last_seen_at, created_at
      `,
      [restaurantId, deviceName, hashSecret(apiKey)],
    );
    const device = deviceResult.rows[0];

    if (transferPairing) {
      await client.query('UPDATE pairing_codes SET used_at = now(), used_by_device = $1 WHERE id = $2', [
        device.id,
        transferPairing.id,
      ]);
    }

    await client.query('COMMIT');

    sendJson(response, 201, {
      ok: true,
      restaurant,
      device,
      subscription,
      apiKey,
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
  const maxDevices = UNLIMITED_DEVICE_LIMIT;
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
      [restaurant.id, String(body.planName || 'Legacy'), expiresAt, maxDevices],
    );
    const deviceResult = await client.query(
      `
        INSERT INTO devices (restaurant_id, name, api_key_hash)
        VALUES ($1, $2, $3)
        RETURNING id, name, active, created_at
      `,
      [restaurant.id, deviceName, apiKeyHash],
    );
    await client.query('COMMIT');

    sendJson(response, 201, {
      ok: true,
      restaurant,
      device: deviceResult.rows[0],
      subscription: subscriptionResult.rows[0],
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
      COALESCE(ds.active_devices, 0)::int AS active_devices,
      COALESCE(ds.total_devices, 0)::int AS total_devices
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
    ORDER BY r.created_at DESC
    LIMIT 200
  `);
  const devicesResult = await pool.query(`
    SELECT id, restaurant_id, name, active, last_seen_at, created_at
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
      ...restaurant,
      devices: devicesByRestaurant.get(restaurant.id) || [],
    })),
  });
}

async function handleAdminApprove(request, response, restaurantId) {
  const body = await readJson(request);
  const planName = String(body.planName || 'Monthly').trim();
  const maxDevices = UNLIMITED_DEVICE_LIMIT;
  const expiresAt = parseExpiryDate(body.expiresAt, DEFAULT_SUBSCRIPTION_DAYS);

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
        INSERT INTO subscriptions (restaurant_id, plan_name, status, starts_at, expires_at, max_devices)
        VALUES ($1, $2, 'active', now(), $3, $4)
        RETURNING id, plan_name, status, starts_at, expires_at, max_devices
      `,
      [restaurantId, planName || 'Monthly', expiresAt, maxDevices],
    );
    await client.query('COMMIT');

    sendJson(response, 200, { ok: true, subscription: subscriptionResult.rows[0] });
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

    const code = createPairingCode();
    const codeResult = await client.query(
      `
        INSERT INTO pairing_codes (restaurant_id, code_hash, device_name, expires_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id, device_name, expires_at, created_at
      `,
      [restaurantId, hashSecret(code), deviceName || MAIN_APP_DEVICE_NAME, expiresAt.toISOString()],
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
  const result = await pool.query(
    `
      UPDATE devices
      SET active = $1, updated_at = now()
      WHERE id = $2
      RETURNING id, restaurant_id, name, active, last_seen_at, created_at
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

    const subscription = await getActiveSubscription(client, pairing.restaurant_id);
    if (!subscription) {
      await client.query('ROLLBACK');
      sendJson(response, 402, { ok: false, error: 'Subscription is not active' });
      return;
    }

    const deviceResult = await client.query(
      `
        INSERT INTO devices (restaurant_id, name, api_key_hash)
        VALUES ($1, $2, $3)
        RETURNING id, name, active, created_at
      `,
      [pairing.restaurant_id, deviceName || pairing.device_name || MAIN_APP_DEVICE_NAME, hashSecret(apiKey)],
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
      subscription,
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

  await handler({ account });
}

async function getAccountRestaurants(accountId) {
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
      SELECT d.id, d.restaurant_id, d.name, d.active, d.last_seen_at, d.created_at
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

  return restaurantsResult.rows.map((restaurant) => {
    const { staff_users: staffUsers, ...rest } = restaurant;

    return {
      ...rest,
      devices: devicesByRestaurant.get(restaurant.id) || [],
      staffUsers: normalizeStaffDirectory(staffUsers),
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
      SELECT id, plan_name, status, starts_at, expires_at, max_devices
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

  return result.rows[0] || null;
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

function createClientToken(accountId) {
  const payload = {
    accountId,
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
  :root { color-scheme: light; font-family: Inter, Segoe UI, Arial, sans-serif; color: #08111f; background: #eef2f6; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: #eef2f6; }
  header { height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 28px; background: #fff; border-bottom: 1px solid #d7dee8; }
  main { padding: 28px; }
  h1, h2, h3, p { margin: 0; }
  h1 { font-size: 24px; }
  p { color: #5b6677; font-weight: 700; }
  a { color: #0f8793; font-weight: 900; text-decoration: none; }
  a.button { height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #08111f; font-weight: 900; }
  a.button.primary { background: #0f8793; color: #fff; border-color: #0f8793; }
  .card { background: #fff; border: 1px solid #d7dee8; border-radius: 8px; box-shadow: 0 14px 34px rgba(15, 23, 42, .08); }
  .layout { max-width: 1160px; margin: 0 auto; display: grid; gap: 18px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .panel { padding: 22px; display: grid; gap: 14px; }
  label { display: grid; gap: 6px; color: #4a5568; font-size: 12px; font-weight: 900; }
  input, select { width: 100%; height: 42px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-weight: 800; outline: none; }
  input:focus, select:focus { border-color: #0f8793; box-shadow: 0 0 0 3px rgba(15, 135, 147, .16); }
  button { height: 42px; padding: 0 14px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #08111f; font-weight: 900; cursor: pointer; }
  button.primary { background: #0f8793; color: #fff; border-color: #0f8793; }
  button.danger { background: #cb1137; color: #fff; border-color: #cb1137; }
  button:disabled { opacity: .55; cursor: not-allowed; }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .status { padding: 12px 14px; border-radius: 7px; background: #f4f7fb; border: 1px solid #dbe3ee; color: #334155; font-weight: 800; }
  .status.ok { background: #ecfdf3; border-color: #b9efcd; color: #126b36; }
  .status.error { background: #fff1f2; border-color: #fecdd3; color: #a30f2f; }
  .file-list { display: grid; gap: 8px; }
  .file-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 10px; border: 1px solid #dbe3ee; border-radius: 7px; background: #f8fafc; }
  .file-row strong, .file-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-row span, small { color: #64748b; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 11px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
  th { color: #475569; font-size: 11px; text-transform: uppercase; }
  .badge { display: inline-flex; padding: 5px 8px; border-radius: 999px; background: #edf2f7; color: #334155; font-size: 11px; font-weight: 900; }
  .badge.good { background: #dcfce7; color: #166534; }
  .badge.bad { background: #ffe4e6; color: #9f1239; }
  .code-box { font-size: 34px; letter-spacing: .14em; font-weight: 950; color: #0f8793; }
  @media (max-width: 860px) { header, main { padding-left: 16px; padding-right: 16px; } .grid { grid-template-columns: 1fr; } }
`;

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
    <div>
      <h1>GI POS Cloud</h1>
      <p>Restaurant POS signup request</p>
    </div>
    <div class="row">
      <a href="/portal">Client Portal</a>
      <a href="/admin">Admin Panel</a>
    </div>
  </header>
  <main>
    <div class="layout">
      <section class="card panel">
        <h2>Client Signup</h2>
        <p>Submit the restaurant request. GI admin will approve subscription, then the desktop app can connect with cloud login.</p>
        <div class="grid">
          <label>Business Name <input id="businessName" autocomplete="organization"></label>
          <label>Owner Name <input id="ownerName" autocomplete="name"></label>
          <label>Phone <input id="phone" autocomplete="tel"></label>
          <label>Email <input id="email" autocomplete="email"></label>
          <label>Password <input id="password" type="password" autocomplete="new-password"></label>
        </div>
        <button class="primary" id="signupBtn">Submit Signup</button>
        <div class="status" id="status">Waiting for signup details.</div>
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
    <div>
      <h1>GI POS Client Portal</h1>
      <p>Subscription, devices, and POS connection</p>
    </div>
    <div class="row">
      <a href="/signup">Signup</a>
      <button id="logoutBtn" style="display:none">Logout</button>
    </div>
  </header>
  <main>
    <div class="layout">
      <section class="card panel" id="loginCard">
        <h2>Client Login</h2>
        <p>Use the phone/email and password submitted during signup.</p>
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

      <section class="card panel" id="portalCard" style="display:none">
        <div class="row" style="justify-content:space-between">
          <div>
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

      <section class="card panel" id="transferCard" style="display:none">
        <h2>Main App Transfer Code</h2>
        <p>Use this when moving the main POS app to another PC. Existing cloud connections for this restaurant will be logged out.</p>
        <div class="grid">
          <label>Restaurant <select id="transferRestaurant"></select></label>
        </div>
        <button class="primary" id="generateTransferCodeBtn">Generate Transfer Code</button>
        <div class="code-box" id="transferCode">------</div>
        <div class="status" id="transferStatus">No transfer code generated.</div>
      </section>

      <section class="card panel" id="downloadCard" style="display:none">
        <h2>Download Windows App</h2>
        <p>Download and install the latest GI POS Restaurant desktop app for Windows.</p>
        <div class="row">
          <a class="button primary" href="/download/windows">Download Setup</a>
          <a class="button" href="/updates/win/latest.yml" target="_blank" rel="noreferrer">Version Info</a>
        </div>
        <div class="status">Install the setup file, then connect from the desktop app with this cloud account login.</div>
      </section>

      <section class="card panel" id="securityCard" style="display:none">
        <h2>Account Security</h2>
        <p>Generate a recovery code before you forget the portal password. It is shown only once.</p>
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
        <h2>Desktop User PIN Reset</h2>
        <p>Reset a Windows app user PIN from the portal. The desktop app applies it on the next cloud sync.</p>
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
        <h2>Restaurants</h2>
        <div style="overflow:auto">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Subscription</th>
                <th>Devices</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="clientRestaurantRows"></tbody>
          </table>
        </div>
      </section>
    </div>
  </main>
  <script>
    const loginCard = document.getElementById('loginCard');
    const portalCard = document.getElementById('portalCard');
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
      loginCard.style.display = show ? 'none' : '';
      portalCard.style.display = show ? '' : 'none';
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
    function renderRestaurants(restaurants) {
      rowsEl.innerHTML = restaurants.map(function (restaurant) {
        const approved = restaurant.status === 'approved';
        const subActive = restaurant.subscription_status === 'active' || restaurant.subscription_status === 'trial';
        const canPair = approved && subActive;
        const badgeClass = approved ? 'good' : restaurant.status === 'suspended' ? 'bad' : '';
        const devices = String(restaurant.active_devices || 0);
        const deviceList = (restaurant.devices || []).map(function (device) {
          return esc(device.name) + (device.active ? '' : ' (disabled)');
        }).join('<br>');
        return '<tr>' +
          '<td><strong>' + esc(restaurant.name) + '</strong><br><small>' + esc(restaurant.id) + '</small></td>' +
          '<td><span class="badge ' + badgeClass + '">' + esc(restaurant.status) + '</span></td>' +
          '<td>' + esc(subscriptionText(restaurant)) + '</td>' +
          '<td>' + esc(devices) + '<br><small>' + (deviceList || 'No devices') + '</small></td>' +
          '<td><span class="badge ' + (canPair ? 'good' : '') + '">' + (canPair ? 'Cloud login ready' : 'Approval required') + '</span></td>' +
        '</tr>';
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
    <div>
      <h1>GI POS Cloud Admin</h1>
      <p>Approve restaurants, manage subscriptions, and reset client access</p>
    </div>
    <div class="row">
      <a href="/portal">Client Portal</a>
      <a href="/signup">Signup Page</a>
    </div>
  </header>
  <main>
    <div class="layout">
      <section class="card panel">
        <h2>Admin Access</h2>
        <div class="grid">
          <label>Admin Token <input id="adminToken" type="password" placeholder="GI_CLOUD_ADMIN_TOKEN"></label>
          <label>Plan Name <input id="planName" value="Monthly"></label>
          <label>Subscription Expiry <input id="expiresAt" type="date"></label>
        </div>
        <div class="row">
          <button class="primary" id="loadBtn">Load Clients</button>
          <button id="saveTokenBtn">Save Token</button>
        </div>
        <div class="status" id="status">Enter admin token and load clients.</div>
      </section>
      <section class="card panel">
        <h2>Device Connection</h2>
        <p>Desktop apps connect with the client phone/email and cloud password. Device count is unlimited.</p>
        <div class="status good">Normal connection uses cloud login. Transfer code is only for moving the same counter to another PC.</div>
      </section>
      <section class="card panel">
        <h2>Windows App Update</h2>
        <p>Upload the three files from the desktop build release folder. The server replaces the active update only after all files pass validation.</p>
        <div class="grid">
          <label>latest.yml <input id="latestYmlFile" type="file" accept=".yml,.yaml"></label>
          <label>Setup EXE <input id="setupExeFile" type="file" accept=".exe"></label>
          <label>EXE Blockmap <input id="setupBlockmapFile" type="file" accept=".blockmap"></label>
        </div>
        <div class="row">
          <button class="primary" id="uploadUpdateBtn">Upload Update</button>
          <button id="refreshUpdateBtn">Refresh Update Info</button>
          <a class="button" href="/download/windows">Download Current Setup</a>
          <a class="button" href="/updates/win/latest.yml" target="_blank" rel="noreferrer">Open latest.yml</a>
        </div>
        <div class="status" id="updateStatus">Load update info to see current files.</div>
        <div class="file-list" id="updateFiles"></div>
      </section>
      <section class="card panel">
        <h2>Restaurants</h2>
        <div style="overflow:auto">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Subscription</th>
                <th>Devices</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="restaurantRows"></tbody>
          </table>
        </div>
      </section>
    </div>
  </main>
  <script>
    const tokenInput = document.getElementById('adminToken');
    const rowsEl = document.getElementById('restaurantRows');
    const statusEl = document.getElementById('status');
    const updateStatusEl = document.getElementById('updateStatus');
    const updateFilesEl = document.getElementById('updateFiles');
    tokenInput.value = localStorage.getItem('giAdminToken') || '';

    const tomorrow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    document.getElementById('expiresAt').value = tomorrow.toISOString().slice(0, 10);

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
    function renderUpdateInfo(result) {
      const files = result.files || [];
      const readyText = result.ready ? 'Ready' : 'Missing files';
      const versionText = result.version ? ' / v' + result.version : '';
      setUpdateStatus(
        readyText + versionText + ' / ' + (result.updateDir || 'cloud/updates/win'),
        result.ready ? 'ok' : ''
      );
      updateFilesEl.innerHTML = files.length
        ? files.map(function (file) {
            return '<div class="file-row">' +
              '<div><strong>' + esc(file.name) + '</strong><br><span>' + esc(formatDate(file.updatedAt)) + '</span></div>' +
              '<span>' + esc(file.sizeLabel || '') + '</span>' +
            '</div>';
          }).join('')
        : '<div class="status">No update files uploaded yet.</div>';
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
      setUpdateStatus('Uploading update files. Please wait...', '');
      const result = await adminFetchJson('/api/v1/admin/updates/windows', {
        method: 'POST',
        body: form
      });
      renderUpdateInfo(result);
      setUpdateStatus(result.message || 'Update uploaded successfully.', 'ok');
    }
    function render(restaurants) {
      rowsEl.innerHTML = restaurants.map(function (restaurant) {
        const approved = restaurant.status === 'approved';
        const badgeClass = approved ? 'good' : restaurant.status === 'suspended' ? 'bad' : '';
        const devices = String(restaurant.active_devices || 0);
        return '<tr>' +
          '<td><strong>' + esc(restaurant.name) + '</strong><br><small>' + esc(restaurant.id) + '</small></td>' +
          '<td>' + esc(restaurant.owner_name) + '<br>' + esc(restaurant.phone || restaurant.email) + '</td>' +
          '<td><span class="badge ' + badgeClass + '">' + esc(restaurant.status) + '</span></td>' +
          '<td>' + esc(subscriptionText(restaurant)) + '</td>' +
          '<td>' + esc(devices) + '</td>' +
          '<td><div class="row">' +
            '<button data-approve="' + esc(restaurant.id) + '">Approve</button>' +
            '<button data-reset-password="' + esc(restaurant.id) + '" ' + (!restaurant.account_id ? 'disabled' : '') + '>Reset Password</button>' +
            '<button class="danger" data-suspend="' + esc(restaurant.id) + '">Suspend</button>' +
          '</div></td>' +
        '</tr>';
      }).join('');

      document.querySelectorAll('[data-approve]').forEach(function (button) {
        button.addEventListener('click', function () { approve(button.getAttribute('data-approve')); });
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
    async function approve(id) {
      setStatus('Approving restaurant...', '');
      await api('/api/v1/admin/restaurants/' + encodeURIComponent(id) + '/approve', {
        method: 'POST',
        body: JSON.stringify({
          planName: document.getElementById('planName').value,
          expiresAt: document.getElementById('expiresAt').value
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
    document.getElementById('uploadUpdateBtn').addEventListener('click', function () {
      uploadUpdate().catch(function (error) { setUpdateStatus(error.message, 'error'); });
    });
  </script>
</body>
</html>`;

async function ensureRuntimeSchema() {
  await pool.query(`
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS recovery_code_hash TEXT NOT NULL DEFAULT '';
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS recovery_code_set_at TIMESTAMPTZ;
    ALTER TABLE subscriptions ALTER COLUMN max_devices SET DEFAULT 999999;
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
