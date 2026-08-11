const http = require('node:http');
const os = require('node:os');
const crypto = require('node:crypto');

const preferredPort = Number(process.env.GI_POS_LAN_PORT || 8080);
const maxPortAttempts = 20;

async function createLanServer({ app, getDatabase, printKot }) {
  const startedAt = new Date().toISOString();
  let server;
  let port = preferredPort;
  let lastError = '';
  const getStatus = () => {
    const addresses = getLanAddresses();
    const urls = addresses.map((address) => `http://${address}:${port}`);

    return {
      enabled: Boolean(server),
      port: server ? port : preferredPort,
      host: '0.0.0.0',
      appName: app.getName(),
      version: app.getVersion(),
      computerName: os.hostname(),
      urls,
      primaryUrl: urls[0] || `http://127.0.0.1:${server ? port : preferredPort}`,
      startedAt: server ? startedAt : '',
      error: server ? '' : lastError || 'LAN server did not start',
      dbPath: getDatabase()?.path || '',
    };
  };

  for (let attempt = 0; attempt < maxPortAttempts; attempt += 1) {
    port = preferredPort + attempt;

    try {
      server = await listenOnPort(createRequestHandler({ app, getDatabase, getStatus, printKot }), port);
      lastError = '';
      break;
    } catch (error) {
      lastError = error?.message || String(error);
      if (error?.code !== 'EADDRINUSE' && error?.code !== 'EACCES') {
        break;
      }
    }
  }

  return {
    getStatus,
    close: () =>
      new Promise((resolve) => {
        if (!server) {
          resolve();
          return;
        }

        server.close(() => resolve());
      }),
  };
}

function registerLanServerHandlers(ipcMain, getServer) {
  ipcMain.handle('lan-server:status', async () => getServer()?.getStatus() || getStoppedStatus());
}

function createRequestHandler({ app, getDatabase, getStatus, printKot }) {
  const sessionSecret = crypto.randomBytes(32);

  return async (request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
      sendJson(response, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/status')) {
      sendHtml(response, buildLandingHtml(getStatus()));
      return;
    }

    if (request.method === 'GET' && (url.pathname === '/login' || url.pathname === '/home' || url.pathname === '/pos')) {
      sendHtml(response, buildMobileAppHtml(getStatus(), url.pathname));
      return;
    }

    if (request.method === 'GET' && (url.pathname === '/qr' || url.pathname.startsWith('/qr/'))) {
      sendHtml(response, buildQrOrderHtml(getStatus(), getQrTableFromPath(url)));
      return;
    }

    if (request.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/api/server/status')) {
      sendJson(response, 200, { ok: true, server: getStatus() });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/pos/snapshot') {
      const snapshot = getDatabase()?.getSnapshot();
      sendJson(response, 200, {
        ok: true,
        appName: app.getName(),
        version: app.getVersion(),
        server: getStatus(),
        snapshot,
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/mobile/bootstrap') {
      sendJson(response, 200, buildMobileBootstrapPayload({ app, getDatabase, getStatus }));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/qr/bootstrap') {
      sendJson(response, 200, buildQrBootstrapPayload({ app, getDatabase, getStatus, tableName: url.searchParams.get('table') }));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/qr/order-status') {
      sendJson(
        response,
        200,
        buildQrOrderStatusPayload({
          getDatabase,
          tableName: url.searchParams.get('table'),
          orderId: url.searchParams.get('id'),
        }),
      );
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/qr/orders') {
      try {
        const body = await readJsonBody(request);
        const result = saveQrOrderToDatabase(getDatabase, body);
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, error?.statusCode || 500, { ok: false, error: error?.message || 'QR order failed' });
      }
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/mobile/login') {
      try {
        const body = await readJsonBody(request);
        const result = await loginMobileUser(getDatabase, body, sessionSecret);
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, error?.statusCode || 500, { ok: false, error: error?.message || 'Login failed' });
      }
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/mobile/orders/save') {
      try {
        const user = verifyMobileSession(getDatabase, request, sessionSecret);
        const body = await readJsonBody(request);
        const result = saveMobileOrder(getDatabase, user, body);
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, error?.statusCode || 500, { ok: false, error: error?.message || 'Order save failed' });
      }
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/mobile/kot/print') {
      try {
        const user = verifyMobileSession(getDatabase, request, sessionSecret);
        const body = await readJsonBody(request);
        const result = await printMobileKot(getDatabase, printKot, user, body);
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, error?.statusCode || 500, { ok: false, error: error?.message || 'KOT print failed' });
      }
      return;
    }

    sendJson(response, 404, { ok: false, error: 'Not found' });
  };
}

function listenOnPort(handler, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);

    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

function startLocalDnsServer({ domains, port, getAddress, upstreamServers, onError }) {
  return new Promise((resolve, reject) => {
    const server = dgram.createSocket('udp4');
    const normalizedDomains = new Set(domains.map((domain) => domain.toLowerCase()));
    let started = false;

    server.on('message', async (message, remote) => {
      try {
        const question = parseDnsQuestion(message);

        if (question && normalizedDomains.has(question.name.toLowerCase())) {
          const address = getAddress();
          const response = buildLocalDnsResponse(message, question, address);
          server.send(response, remote.port, remote.address);
          return;
        }

        const forwardedResponse = await forwardDnsQuery(message, upstreamServers);
        server.send(forwardedResponse, remote.port, remote.address);
      } catch {
        const response = buildDnsFailureResponse(message);
        server.send(response, remote.port, remote.address);
      }
    });

    server.once('listening', () => {
      started = true;
      resolve(server);
    });

    server.once('error', (error) => {
      if (!started) {
        reject(error);
        return;
      }

      onError?.(error);
    });

    server.bind(port, '0.0.0.0');
  });
}

function parseDnsQuestion(message) {
  if (!Buffer.isBuffer(message) || message.length < 17) {
    return null;
  }

  const qdCount = message.readUInt16BE(4);
  if (qdCount < 1) {
    return null;
  }

  let offset = 12;
  const labels = [];

  while (offset < message.length) {
    const labelLength = message[offset];
    offset += 1;

    if (labelLength === 0) {
      break;
    }

    if ((labelLength & 0xc0) !== 0 || offset + labelLength > message.length) {
      return null;
    }

    labels.push(message.slice(offset, offset + labelLength).toString('ascii'));
    offset += labelLength;
  }

  if (!labels.length || offset + 4 > message.length) {
    return null;
  }

  return {
    name: labels.join('.'),
    type: message.readUInt16BE(offset),
    classCode: message.readUInt16BE(offset + 2),
    questionEnd: offset + 4,
  };
}

function buildLocalDnsResponse(query, question, address) {
  const questionBytes = query.slice(12, question.questionEnd);
  const supportsAnswer = question.type === 1 && question.classCode === 1 && isIpv4Address(address);
  const response = Buffer.alloc(12 + questionBytes.length + (supportsAnswer ? 16 : 0));

  query.copy(response, 0, 0, 2);
  response.writeUInt16BE(0x8180, 2);
  response.writeUInt16BE(1, 4);
  response.writeUInt16BE(supportsAnswer ? 1 : 0, 6);
  response.writeUInt16BE(0, 8);
  response.writeUInt16BE(0, 10);
  questionBytes.copy(response, 12);

  if (!supportsAnswer) {
    return response;
  }

  let offset = 12 + questionBytes.length;
  response.writeUInt16BE(0xc00c, offset);
  offset += 2;
  response.writeUInt16BE(1, offset);
  offset += 2;
  response.writeUInt16BE(1, offset);
  offset += 2;
  response.writeUInt32BE(30, offset);
  offset += 4;
  response.writeUInt16BE(4, offset);
  offset += 2;
  address.split('.').forEach((part) => {
    response[offset] = Number(part);
    offset += 1;
  });

  return response;
}

function buildDnsFailureResponse(query) {
  const response = Buffer.from(query);
  if (response.length >= 12) {
    response.writeUInt16BE(0x8182, 2);
    response.writeUInt16BE(0, 6);
    response.writeUInt16BE(0, 8);
    response.writeUInt16BE(0, 10);
  }

  return response;
}

function forwardDnsQuery(message, upstreamServers) {
  const upstream = upstreamServers[0] || '1.1.1.1';

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('DNS upstream timed out'));
    }, 2500);

    socket.once('message', (response) => {
      clearTimeout(timeout);
      socket.close();
      resolve(response);
    });

    socket.once('error', (error) => {
      clearTimeout(timeout);
      socket.close();
      reject(error);
    });

    socket.send(message, 53, upstream, (error) => {
      if (error) {
        clearTimeout(timeout);
        socket.close();
        reject(error);
      }
    });
  });
}

function getUpstreamDnsServers() {
  const localAddresses = new Set(getLanAddresses());
  const servers = dns
    .getServers()
    .map((server) => String(server).replace(/^\[|\]$/g, '').split(':')[0])
    .filter(
      (server) =>
        isIpv4Address(server) &&
        !['0.0.0.0', '127.0.0.1'].includes(server) &&
        !localAddresses.has(server),
    );

  return servers.length ? servers : ['1.1.1.1', '8.8.8.8'];
}

function normalizeDnsDomains(value) {
  const domains = String(value || '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/\.+$/g, ''))
    .filter((domain) => /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(domain) && domain.includes('.'));

  return domains.length ? Array.from(new Set(domains)) : ['pos.local'];
}

function isIpv4Address(value) {
  const parts = String(value || '').split('.');
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function getLocalDnsErrorMessage(error) {
  if (error?.code === 'EACCES') {
    return 'Local DNS needs permission to use port 53. Run app as administrator or set DNS from router.';
  }

  if (error?.code === 'EADDRINUSE') {
    return 'Port 53 is already used by another DNS service on this PC.';
  }

  return error?.message || 'Local DNS could not start';
}

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, values] of Object.entries(interfaces)) {
    for (const item of values || []) {
      if (item.family === 'IPv4' && !item.internal && isReachableLanAddress(name, item.address)) {
        candidates.push({
          address: item.address,
          score: getAddressScore(name, item.address),
        });
      }
    }
  }

  if (!candidates.length) {
    return ['127.0.0.1'];
  }

  return Array.from(
    new Set(
      candidates
    .sort((first, second) => second.score - first.score || first.address.localeCompare(second.address))
        .map((candidate) => candidate.address),
    ),
  );
}

function isReachableLanAddress(name, address) {
  const normalizedName = String(name || '').toLowerCase();
  const isVirtualAdapter = /(virtual|vethernet|vmware|virtualbox|docker|wsl|hyper-v|bluetooth|npcap|loopback|tailscale|zerotier)/.test(normalizedName);
  const isHomeOrOfficeLan = /^(192\.168\.|10\.)/.test(address);

  // 172.x addresses are commonly created by Docker, WSL, and Hyper-V. Do not
  // publish them as customer-facing URLs; only reachable Wi-Fi/Ethernet URLs belong here.
  return isHomeOrOfficeLan && !isVirtualAdapter;
}

function getAddressScore(name, address) {
  const normalizedName = String(name || '').toLowerCase();
  let score = 0;

  if (/^(192\.168\.|10\.)/.test(address) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) {
    score += 50;
  }

  if (/^(192\.168\.)/.test(address)) {
    score += 20;
  }

  if (/(wi-?fi|wireless|ethernet|local area)/.test(normalizedName)) {
    score += 30;
  }

  if (/(virtual|vethernet|vmware|virtualbox|docker|wsl|hyper-v|bluetooth|npcap)/.test(normalizedName)) {
    score -= 80;
  }

  return score;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response, html) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(html);
}

function buildLandingHtml(status) {
  const urls = status.urls.length ? status.urls : [status.primaryUrl];
  const urlItems = urls.map((url) => `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`).join('');
  const primaryUrl = status.primaryUrl || urls[0] || '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(status.appName)} Local Server</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; color: #111827; background: #eef3f5; }
      main { max-width: 720px; margin: 0 auto; padding: 32px 18px; }
      section { background: #fff; border: 1px solid #d7e0e7; border-radius: 10px; padding: 22px; box-shadow: 0 14px 32px rgba(15, 23, 42, .1); }
      h1 { margin: 0 0 4px; font-size: 28px; }
      p { margin: 0 0 18px; color: #667085; font-weight: 700; }
      dl { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 10px; margin: 18px 0; }
      dt { color: #667085; font-weight: 800; }
      dd { margin: 0; font-weight: 800; overflow-wrap: anywhere; }
      ul { margin: 12px 0 0; padding-left: 20px; }
      li { margin: 8px 0; font-weight: 800; }
      a { color: #087f8c; }
      .actions { display: flex; gap: 10px; flex-wrap: wrap; margin: 18px 0; }
      .button { min-height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; color: #fff; background: #087f8c; border-radius: 8px; font-weight: 900; text-decoration: none; }
      .button.secondary { color: #111827; background: #f4f7f8; border: 1px solid #d7e0e7; }
      code { display: inline-block; margin-top: 10px; padding: 8px 10px; background: #f4f7f8; border: 1px solid #d7e0e7; border-radius: 7px; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${escapeHtml(status.appName)} Local Server</h1>
        <p>Main PC server is running. Client POS screens are available on this local network.</p>
        <dl>
          <dt>Status</dt><dd>${status.enabled ? 'Running' : 'Stopped'}</dd>
          <dt>Computer</dt><dd>${escapeHtml(status.computerName)}</dd>
          <dt>Version</dt><dd>${escapeHtml(status.version)}</dd>
          <dt>Port</dt><dd>${escapeHtml(status.port)}</dd>
          <dt>Database</dt><dd>${status.dbPath ? 'SQLite ready' : 'Not ready'}</dd>
        </dl>
        <strong>Use from other devices on the same Wi-Fi/LAN:</strong>
        <ul>${urlItems}</ul>
        <div class="actions">
          <a class="button" href="/login">Open Mobile Login</a>
          <a class="button secondary" href="/pos">Open Mobile POS</a>
        </div>
        <code>API: /api/server/status</code>
        <code>Mobile: ${escapeHtml(primaryUrl)}/login</code>
      </section>
    </main>
  </body>
</html>`;
}

function buildMobileAppHtml(status, pathname) {
  const initialScreen = pathname === '/pos' ? 'pos' : pathname === '/home' ? 'home' : 'login';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <title>${escapeHtml(status.appName)} Mobile POS</title>
    <style>
      :root { color-scheme: light; --ink:#08111f; --muted:#64748b; --line:#d7e0e7; --soft:#f3f7fa; --teal:#0f8793; --red:#cb1137; --green:#138a43; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; font-family: Arial, sans-serif; color: var(--ink); background: #eef3f5; }
      header { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: #fff; border-bottom: 1px solid var(--line); box-shadow: 0 5px 16px rgba(15,23,42,.06); }
      .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .logo { width: 38px; height: 38px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--red), var(--teal)); border-radius: 9px; font-weight: 950; }
      h1, h2, p { margin: 0; }
      h1 { font-size: 16px; line-height: 1.1; }
      small, p { color: var(--muted); font-weight: 800; }
      main { max-width: 980px; margin: 0 auto; padding: 10px 12px 20px; }
      .card { background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 14px 30px rgba(15,23,42,.08); }
      .panel { padding: 14px; display: grid; gap: 12px; }
      .login-card { max-width: 440px; margin: 36px auto; }
      label { display: grid; gap: 6px; color: #475569; font-size: 12px; font-weight: 900; }
      input, select { width: 100%; height: 46px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 9px; font: inherit; font-weight: 850; }
      button { min-height: 46px; padding: 0 14px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; color: var(--ink); font: inherit; font-weight: 950; }
      button.primary { color: #fff; background: var(--teal); border-color: var(--teal); }
      button.danger { color: #fff; background: var(--red); border-color: var(--red); }
      .tabs { display: flex; gap: 8px; margin-bottom: 10px; }
      .tabs button { min-height: 40px; }
      .tabs #posTab { flex: 1; }
      .tabs button.active { color: #fff; background: var(--red); border-color: var(--red); }
      .grid { display: grid; gap: 12px; }
      .home-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .metric { padding: 14px; display: grid; gap: 8px; background: #fff; border: 1px solid var(--line); border-radius: 12px; }
      .metric strong { font-size: 24px; }
      .pos-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .55fr); gap: 12px; }
      .order-toolbar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .table-panel { display: grid; gap: 8px; padding: 10px; background: var(--soft); border: 1px solid var(--line); border-radius: 10px; }
      .table-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 7px; }
      .table-grid button { min-height: 40px; padding: 0 8px; }
      .table-grid button.selected { color: #fff; background: var(--teal); border-color: var(--teal); }
      .table-grid button.occupied { background: #fff8e1; border-color: #f6c453; }
      .table-grid button.occupied.selected { color: #fff; background: var(--red); border-color: var(--red); }
      .category-strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
      .category-strip button { min-width: max-content; min-height: 40px; }
      .category-strip button.active { color: #fff; background: var(--red); border-color: var(--red); }
      .menu-search { position: sticky; top: 60px; z-index: 3; height: 44px; background: #fff; box-shadow: 0 8px 16px rgba(15,23,42,.06); }
      .item-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
      .item-card { min-height: 88px; display: grid; align-content: space-between; text-align: left; }
      .item-card.unavailable { opacity: .62; cursor: not-allowed; background: #f8fafc; }
      .item-card strong { display: block; }
      .item-card span { color: var(--red); font-weight: 950; }
      .item-card .soldout { width: fit-content; padding: 2px 6px; color: #fff; background: #991b1b; border-radius: 999px; font-size: 10px; }
      .cart-list { display: grid; gap: 8px; max-height: 420px; overflow: auto; }
      .cart-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 9px; background: var(--soft); border: 1px solid var(--line); border-radius: 9px; }
      .cart-line strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cart-line small { display: block; }
      .status { padding: 10px; color: #334155; background: var(--soft); border: 1px solid var(--line); border-radius: 9px; font-weight: 850; }
      .status.error { color: #a30f2f; background: #fff1f2; border-color: #fecdd3; }
      .cart-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .cart-actions button, .cart-actions select { min-width: 0; }
      .hidden { display: none !important; }
      .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .spacer { flex: 1; }
      @media (max-width: 760px) {
        body { padding-bottom: 176px; }
        main { padding: 8px 8px 18px; }
        header { padding: 8px; }
        .brand small { display: none; }
        .logo { width: 34px; height: 34px; }
        .tabs { position: sticky; top: 0; z-index: 4; padding: 4px 0 8px; background: #eef3f5; }
        .tabs button { min-height: 38px; }
        .pos-layout { display: block; }
        .pos-layout > .card:first-child { padding: 10px; }
        .order-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .order-toolbar label:last-child { grid-column: 1 / -1; }
        .table-panel { padding: 8px; }
        .table-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
        .table-grid button { min-height: 46px; padding: 0 4px; }
        .category-strip { margin-top: 10px; }
        .category-strip button { min-height: 38px; }
        .menu-search { top: 50px; margin: 8px 0; }
        .item-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
        .item-card { min-height: 82px; padding: 10px; }
        .cart-panel { position: fixed; z-index: 10; right: 8px; bottom: 8px; left: 8px; padding: 10px; border-color: #b7dce0; box-shadow: 0 16px 34px rgba(15,23,42,.2); }
        .cart-panel h2 { font-size: 18px; }
        .cart-panel .cart-list, .cart-panel label, .cart-panel #clearBtn, .cart-panel #newOrderBtn, .cart-panel #posStatus { display: none; }
        .cart-panel.expanded .cart-list, .cart-panel.expanded label, .cart-panel.expanded #clearBtn, .cart-panel.expanded #newOrderBtn, .cart-panel.expanded #posStatus { display: grid; }
        .cart-panel.expanded .cart-list { max-height: 180px; }
        .cart-panel .cart-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .cart-panel .status { padding: 8px 10px; }
        .cart-panel .status strong { font-size: 20px; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">
        <div class="logo">GI</div>
        <div>
          <h1 id="businessTitle">${escapeHtml(status.appName)}</h1>
          <small>Main PC: ${escapeHtml(status.computerName)} / ${escapeHtml(status.version)}</small>
        </div>
      </div>
      <button id="logoutBtn" class="hidden">Logout</button>
    </header>

    <main>
      <section id="loginScreen" class="card panel login-card hidden">
        <div>
          <h2>Mobile Login</h2>
          <p>Use the same POS user and PIN from the Main PC.</p>
        </div>
        <label>User <select id="userSelect"></select></label>
        <label>PIN <input id="pinInput" type="password" inputmode="numeric" autocomplete="current-password" /></label>
        <button class="primary" id="loginBtn">Login</button>
        <div id="loginStatus" class="status">Connects to Main PC SQLite. No mobile database is created.</div>
      </section>

      <section id="appScreen" class="hidden">
        <div class="tabs">
          <button id="posTab">POS Sale</button>
          <button id="refreshTab">Refresh</button>
        </div>

        <section id="homeScreen" class="grid home-grid hidden">
          <div class="metric"><span>Menu Items</span><strong id="menuCount">0</strong></div>
          <div class="metric"><span>Open Bills</span><strong id="openCount">0</strong></div>
          <div class="metric"><span>Users</span><strong id="userCount">0</strong></div>
          <div class="metric"><span>Server</span><strong>Online</strong><small>${escapeHtml(status.primaryUrl)}</small></div>
          <div class="card panel" style="grid-column:1/-1">
            <h2 id="homeBusiness">Restaurant</h2>
            <p id="homeDetails">Mobile POS starter is connected to Main PC.</p>
          </div>
        </section>

        <section id="posScreen" class="pos-layout hidden">
          <div class="card panel">
            <div class="row">
              <h2>Mobile POS</h2>
              <span class="spacer"></span>
              <small id="activeUserLabel"></small>
            </div>
            <div class="order-toolbar">
              <label>Order Type <select id="orderTypeSelect"></select></label>
              <label>Seating <select id="seatingModeSelect"><option value="individual">Individual</option><option value="group">Group</option></select></label>
              <label>Group Name <input id="groupNameInput" placeholder="Family 1" /></label>
            </div>
            <div class="table-panel">
              <div class="row">
                <strong id="tablePanelTitle">Tables</strong>
                <span class="spacer"></span>
                <small id="selectedTableLabel">No table selected</small>
              </div>
              <div class="category-strip" id="tableGroupStrip"></div>
              <div class="table-grid" id="tableGrid"></div>
            </div>
            <input class="menu-search" id="itemSearch" type="search" placeholder="Search menu items" autocomplete="off" />
            <div class="category-strip" id="categoryStrip"></div>
            <div class="item-grid" id="itemGrid"></div>
          </div>

          <aside class="card panel cart-panel">
            <div class="row">
              <h2>Cart</h2>
              <span class="spacer"></span>
              <small id="billLabel">New Bill</small>
              <button id="cartToggleBtn" type="button">View</button>
            </div>
            <div class="cart-list" id="cartList"></div>
            <div class="status"><span>Total</span><br><strong id="cartTotal">Rs. 0.00</strong></div>
            <label>KOT Printer <select id="printerProfileSelect"></select></label>
            <div class="cart-actions">
              <button class="primary" id="holdBtn">Hold</button>
              <button id="newOrderBtn">New Order</button>
              <button class="primary" id="printKotBtn">Print KOT</button>
              <button class="danger" id="clearBtn">Clear</button>
            </div>
            <div id="posStatus" class="status">Ready</div>
          </aside>
        </section>
      </section>
    </main>

    <script>
      const initialScreen = ${JSON.stringify(initialScreen)};
      const state = {
        data: null,
        user: JSON.parse(localStorage.getItem('giMobileUser') || 'null'),
        sessionToken: localStorage.getItem('giMobileSession') || '',
        activeScreen: initialScreen === 'home' ? 'home' : 'pos',
        activeCategory: 'all',
        itemSearch: '',
        activeTableGroupId: '',
        orderId: '',
        billNo: '',
        orderType: 'Dining',
        seatingMode: 'individual',
        selectedTables: [],
        diningGroupName: '',
        printerProfileId: '',
        cart: [],
      };
      const byId = (id) => document.getElementById(id);
      const money = (value) => 'Rs. ' + Number(value || 0).toFixed(2);
      function escapeText(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch]);
      }
      async function fetchJson(path, options) {
        const response = await fetch(path, options);
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.ok === false) throw new Error(body.error || 'Request failed');
        return body;
      }
      async function authFetchJson(path, options = {}) {
        if (!state.sessionToken) throw new Error('Login required');
        return fetchJson(path, {
          ...options,
          headers: {
            ...(options.headers || {}),
            authorization: 'Bearer ' + state.sessionToken,
          },
        });
      }
      async function loadData() {
        state.data = await fetchJson('/api/mobile/bootstrap');
        renderShell();
      }
      function renderShell() {
        const data = state.data || {};
        const business = data.businessProfile || {};
        byId('businessTitle').textContent = business.businessName || data.appName || 'GI POS Restaurant';
        byId('homeBusiness').textContent = business.businessName || 'Restaurant';
        byId('homeDetails').textContent = [business.ownerName, business.phone, business.email].filter(Boolean).join(' / ') || 'Main PC local server connected.';
        byId('menuCount').textContent = String((data.menuItems || []).length);
        byId('openCount').textContent = String(data.openOrders || 0);
        byId('userCount').textContent = String((data.staffUsers || []).length);
        byId('userSelect').innerHTML = (data.staffUsers || []).map((user) => '<option value="' + escapeText(user.id) + '">' + escapeText(user.name) + '</option>').join('');
        if (!(data.staffUsers || []).length) {
          byId('userSelect').innerHTML = '<option value="">No active users found</option>';
        }
        if (!state.activeTableGroupId) {
          state.activeTableGroupId = (data.diningTableGroups || [])[0]?.id || '';
        }
        if (!state.printerProfileId) {
          const billPrinter = (data.printerProfiles || []).find((profile) => profile.isBillPrinter);
          state.printerProfileId = billPrinter?.id || (data.printerProfiles || [])[0]?.id || '';
        }
        byId('orderTypeSelect').innerHTML = ['Dining', 'Delivery', 'Take Away', 'Online'].map((type) =>
          '<option value="' + type + '">' + type + '</option>'
        ).join('');
        byId('orderTypeSelect').value = state.orderType;
        byId('seatingModeSelect').value = state.seatingMode;
        byId('groupNameInput').value = state.diningGroupName;
        renderTables();
        renderPrinters();
        renderCategories();
        renderItems();
        renderCart();
        renderScreen();
      }
      function renderScreen() {
        const loggedIn = Boolean(state.user);
        byId('loginScreen').classList.toggle('hidden', loggedIn);
        byId('appScreen').classList.toggle('hidden', !loggedIn);
        byId('logoutBtn').classList.toggle('hidden', !loggedIn);
        byId('homeScreen').classList.toggle('hidden', !loggedIn || state.activeScreen !== 'home');
        byId('posScreen').classList.toggle('hidden', !loggedIn || state.activeScreen !== 'pos');
        byId('posTab').classList.toggle('active', state.activeScreen === 'pos');
        byId('activeUserLabel').textContent = state.user ? state.user.name : '';
        if (!loggedIn && initialScreen !== 'login') {
          history.replaceState(null, '', '/login');
        }
      }
      function renderTables() {
        const groups = state.data?.diningTableGroups || [];
        const activeGroup = groups.find((group) => group.id === state.activeTableGroupId) || groups[0] || { tables: [], label: 'Tables' };
        state.activeTableGroupId = activeGroup.id || state.activeTableGroupId;
        byId('tablePanelTitle').textContent = activeGroup.label || 'Tables';
        byId('selectedTableLabel').textContent = getTableDisplayLabel() || 'No table selected';
        byId('groupNameInput').closest('label').classList.toggle('hidden', state.seatingMode !== 'group');
        byId('tableGroupStrip').innerHTML = groups.map((group) =>
          '<button class="' + (state.activeTableGroupId === group.id ? 'active' : '') + '" data-table-group="' + escapeText(group.id) + '">' + escapeText(group.label) + '</button>'
        ).join('');
        byId('tableGrid').innerHTML = (activeGroup.tables || []).map((tableName) => {
          const selected = state.selectedTables.includes(tableName);
          const occupied = Boolean(findOpenOrderForTables([tableName]));
          return '<button class="' + [selected ? 'selected' : '', occupied ? 'occupied' : ''].filter(Boolean).join(' ') + '" data-table="' + escapeText(tableName) + '">' + escapeText(tableName) + '</button>';
        }).join('') || '<div class="status">No tables configured.</div>';
        document.querySelectorAll('[data-table-group]').forEach((button) => {
          button.addEventListener('click', () => {
            state.activeTableGroupId = button.getAttribute('data-table-group') || '';
            renderTables();
          });
        });
        document.querySelectorAll('[data-table]').forEach((button) => {
          button.addEventListener('click', () => selectTable(button.getAttribute('data-table') || ''));
        });
      }
      function renderPrinters() {
        const profiles = state.data?.printerProfiles || [];
        byId('printerProfileSelect').innerHTML = profiles.map((profile) =>
          '<option value="' + escapeText(profile.id) + '">' + escapeText(profile.name) + (profile.isBillPrinter ? ' / Bill' : '') + '</option>'
        ).join('');
        if (!profiles.length) {
          byId('printerProfileSelect').innerHTML = '<option value="">Bill Printer</option>';
        }
        byId('printerProfileSelect').value = state.printerProfileId;
      }
      function selectTable(tableName) {
        if (!tableName) return;
        if (state.seatingMode === 'group') {
          state.selectedTables = state.selectedTables.includes(tableName)
            ? state.selectedTables.filter((value) => value !== tableName)
            : [...state.selectedTables, tableName];
          const order = findOpenOrderForTables(state.selectedTables);
          if (order && state.selectedTables.length >= 2) {
            loadOrder(order);
          }
        } else {
          state.selectedTables = [tableName];
          const order = findOpenOrderForTables([tableName]);
          if (order) {
            loadOrder(order);
          } else {
            state.orderId = '';
            state.billNo = '';
          }
        }
        renderTables();
        renderCart();
      }
      function findOpenOrderForTables(tables) {
        const selected = [...tables].map((table) => String(table).toLowerCase()).sort();
        if (!selected.length) return null;
        return (state.data?.openOrderList || []).find((order) => {
          const orderTables = (order.tables || []).map((table) => String(table).toLowerCase()).sort();
          if (!orderTables.length) return false;
          if (selected.length === 1) return orderTables.includes(selected[0]);
          return selected.length === orderTables.length && selected.every((table, index) => table === orderTables[index]);
        }) || null;
      }
      function loadOrder(order) {
        state.orderId = order.id;
        state.billNo = order.billNo || '';
        state.orderType = order.orderType || 'Dining';
        state.seatingMode = order.seatingMode || 'individual';
        state.selectedTables = [...(order.tables || [])];
        state.diningGroupName = order.diningGroupName || '';
        state.cart = (order.cart || []).map((line) => ({ ...line }));
        byId('orderTypeSelect').value = state.orderType;
        byId('seatingModeSelect').value = state.seatingMode;
        byId('groupNameInput').value = state.diningGroupName;
        setStatus('Loaded Bill #' + state.billNo);
      }
      function getTableDisplayLabel() {
        if (state.orderType !== 'Dining') return state.orderType;
        if (state.seatingMode === 'group') {
          return state.selectedTables.length ? ((state.diningGroupName || 'Group') + ' / ' + state.selectedTables.join(', ')) : '';
        }
        return state.selectedTables[0] || '';
      }
      function renderCategories() {
        const categories = [{ id: 'all', label: 'All' }, ...(state.data?.categories || [])];
        byId('categoryStrip').innerHTML = categories.map((category) =>
          '<button class="' + (state.activeCategory === category.id ? 'active' : '') + '" data-category="' + escapeText(category.id) + '">' + escapeText(category.label) + '</button>'
        ).join('');
        document.querySelectorAll('[data-category]').forEach((button) => {
          button.addEventListener('click', () => {
            state.activeCategory = button.getAttribute('data-category') || 'all';
            renderCategories();
            renderItems();
          });
        });
      }
      function renderItems() {
        const query = state.itemSearch.trim().toLowerCase();
        const items = (state.data?.menuItems || []).filter((item) =>
          (state.activeCategory === 'all' || item.category === state.activeCategory) &&
          (!query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query)),
        );
        byId('itemGrid').innerHTML = items.map((item) =>
          '<button class="item-card' + (item.available === false ? ' unavailable' : '') + '" data-item="' + escapeText(item.id) + '"' + (item.available === false ? ' disabled' : '') + '><strong>' + escapeText(item.name) + '</strong>' + (item.available === false ? '<span class="soldout">Sold Out</span>' : '') + '<span>' + (Number(item.price || 0) > 0 ? money(item.price) : 'Open price') + '</span></button>'
        ).join('') || '<div class="status">No menu items found. Sync or setup menu on Main PC.</div>';
        document.querySelectorAll('[data-item]').forEach((button) => {
          button.addEventListener('click', () => addItem(button.getAttribute('data-item')));
        });
      }
      function addItem(itemId) {
        const item = (state.data?.menuItems || []).find((candidate) => candidate.id === itemId);
        if (!item) return;
        if (item.available === false) {
          setStatus(item.name + ' is unavailable', true);
          return;
        }
        let price = Number(item.price || 0);
        if (price <= 0) {
          price = Number(prompt('Enter item amount', '0') || 0);
          if (price <= 0) return;
        }
        const taxRate = Number(item.taxRate ?? state.data?.businessProfile?.defaultGstRate ?? 0);
        const line = state.cart.find((entry) => entry.itemId === item.id && entry.price === price && entry.taxRate === taxRate);
        if (line) {
          line.qty += 1;
        } else {
          state.cart.push({ id: 'line-' + Date.now() + '-' + Math.random().toString(16).slice(2), itemId: item.id, name: item.name, price, qty: 1, taxRate });
        }
        renderCart();
      }
      function renderCart() {
        byId('cartList').innerHTML = state.cart.map((line, index) =>
          '<div class="cart-line"><div><strong>' + escapeText(line.name) + '</strong><small>' + line.qty + ' x ' + money(line.price) + '</small></div><div class="row"><button data-add="' + index + '">+</button><button data-remove="' + index + '">-</button></div></div>'
        ).join('') || '<div class="status">Tap items to add to cart.</div>';
        document.querySelectorAll('[data-add]').forEach((button) => {
          button.addEventListener('click', () => {
            const line = state.cart[Number(button.getAttribute('data-add'))];
            if (!line) return;
            line.qty += 1;
            renderCart();
          });
        });
        document.querySelectorAll('[data-remove]').forEach((button) => {
          button.addEventListener('click', () => {
            const index = Number(button.getAttribute('data-remove'));
            const line = state.cart[index];
            if (!line) return;
            line.qty -= 1;
            if (line.qty <= 0) state.cart.splice(index, 1);
            renderCart();
          });
        });
        const subtotal = state.cart.reduce((sum, line) => sum + line.price * line.qty, 0);
        const tax = state.cart.reduce((sum, line) => sum + (line.price * line.qty * Number(line.taxRate || 0)) / 100, 0);
        const total = state.data?.businessProfile?.gstType === 'inclusive' ? subtotal : subtotal + tax;
        byId('cartTotal').textContent = money(total);
        byId('billLabel').textContent = state.billNo ? 'Bill #' + state.billNo : 'New Bill';
      }
      function setStatus(message, isError = false) {
        byId('posStatus').className = isError ? 'status error' : 'status';
        byId('posStatus').textContent = message;
      }
      function buildOrderPayload(status) {
        return {
          orderId: state.orderId,
          billNo: state.billNo,
          status,
          orderType: state.orderType,
          seatingMode: state.seatingMode,
          table: state.selectedTables[0] || '',
          tables: state.selectedTables,
          diningGroupName: state.diningGroupName,
          cart: state.cart,
        };
      }
      async function saveOrder(status, resetAfterSave) {
        if (!state.cart.length) {
          setStatus('Add items before saving', true);
          return null;
        }
        setStatus(status === 'hold' ? 'Holding order...' : 'Saving order...');
        try {
          const result = await authFetchJson('/api/mobile/orders/save', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(buildOrderPayload(status)),
          });
          state.orderId = result.order.id;
          state.billNo = result.order.billNo;
          if (resetAfterSave) {
            resetOrder();
          }
          await loadData();
          setStatus(status === 'hold' ? 'Order moved to Hold' : 'Order saved');
          return result.order;
        } catch (error) {
          setStatus(error.message || 'Save failed', true);
          return null;
        }
      }
      async function printKot() {
        if (!state.cart.length) {
          setStatus('Add items before printing KOT', true);
          return;
        }
        setStatus('Printing KOT...');
        try {
          const result = await authFetchJson('/api/mobile/kot/print', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...buildOrderPayload('unclosed'), printerProfileId: state.printerProfileId }),
          });
          state.orderId = result.order.id;
          state.billNo = result.order.billNo;
          await loadData();
          setStatus('KOT sent to ' + (result.printerProfile?.name || 'printer'));
        } catch (error) {
          setStatus(error.message || 'KOT print failed', true);
        }
      }
      async function newOrder() {
        if (state.cart.length) {
          const saved = await saveOrder('unclosed', true);
          if (!saved) return;
        } else {
          resetOrder();
          setStatus('New order ready');
        }
      }
      function resetOrder() {
        state.orderId = '';
        state.billNo = '';
        state.cart = [];
        state.selectedTables = [];
        state.seatingMode = 'individual';
        state.diningGroupName = '';
        state.orderType = 'Dining';
        byId('orderTypeSelect').value = state.orderType;
        byId('seatingModeSelect').value = state.seatingMode;
        byId('groupNameInput').value = '';
        renderTables();
        renderCart();
      }
      async function login() {
        byId('loginStatus').className = 'status';
        byId('loginStatus').textContent = 'Checking PIN...';
        try {
          const result = await fetchJson('/api/mobile/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ userId: byId('userSelect').value, pin: byId('pinInput').value }),
          });
          state.user = result.user;
          state.sessionToken = result.sessionToken || '';
          localStorage.setItem('giMobileUser', JSON.stringify(state.user));
          localStorage.setItem('giMobileSession', state.sessionToken);
          byId('pinInput').value = '';
          state.activeScreen = initialScreen === 'home' ? 'home' : 'pos';
          history.replaceState(null, '', state.activeScreen === 'home' ? '/home' : '/pos');
          renderScreen();
        } catch (error) {
          byId('loginStatus').className = 'status error';
          byId('loginStatus').textContent = error.message || 'Login failed';
        }
      }
      byId('loginBtn').addEventListener('click', login);
      byId('pinInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') login(); });
      byId('posTab').addEventListener('click', () => { state.activeScreen = 'pos'; history.replaceState(null, '', '/pos'); renderScreen(); });
      byId('refreshTab').addEventListener('click', () => loadData().catch((error) => alert(error.message)));
      byId('itemSearch').addEventListener('input', (event) => {
        state.itemSearch = event.target.value || '';
        renderItems();
      });
      byId('cartToggleBtn').addEventListener('click', () => {
        const panel = byId('cartToggleBtn').closest('.cart-panel');
        panel.classList.toggle('expanded');
        byId('cartToggleBtn').textContent = panel.classList.contains('expanded') ? 'Close' : 'View';
      });
      byId('orderTypeSelect').addEventListener('change', (event) => {
        state.orderType = event.target.value;
        renderTables();
      });
      byId('seatingModeSelect').addEventListener('change', (event) => {
        state.seatingMode = event.target.value === 'group' ? 'group' : 'individual';
        state.selectedTables = [];
        state.orderId = '';
        state.billNo = '';
        renderTables();
        renderCart();
      });
      byId('groupNameInput').addEventListener('input', (event) => {
        state.diningGroupName = event.target.value;
        renderTables();
      });
      byId('printerProfileSelect').addEventListener('change', (event) => {
        state.printerProfileId = event.target.value;
      });
      byId('holdBtn').addEventListener('click', () => saveOrder('hold', true));
      byId('newOrderBtn').addEventListener('click', () => newOrder());
      byId('printKotBtn').addEventListener('click', () => printKot());
      byId('clearBtn').addEventListener('click', () => {
        if (!state.cart.length || confirm('Clear current cart?')) {
          resetOrder();
          setStatus('Cart cleared');
        }
      });
      byId('logoutBtn').addEventListener('click', () => {
        state.user = null;
        state.sessionToken = '';
        localStorage.removeItem('giMobileUser');
        localStorage.removeItem('giMobileSession');
        history.replaceState(null, '', '/login');
        renderScreen();
      });
      loadData().catch((error) => {
        byId('loginStatus').className = 'status error';
        byId('loginStatus').textContent = error.message || 'Cannot load Main PC data';
      });
    </script>
  </body>
</html>`;
}

function buildQrOrderHtml(status, tableName) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <title>${escapeHtml(status.appName)} Table Order</title>
    <style>
      :root { color-scheme: light; --ink:#07111f; --muted:#64748b; --line:#d7e0e7; --soft:#f3f7fa; --teal:#0f8793; --red:#cb1137; --green:#138a43; --shadow:0 14px 34px rgba(15,23,42,.1); }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; font-family: Arial, sans-serif; color: var(--ink); background: linear-gradient(180deg, #f8fbfc 0, #eef3f5 220px, #eaf0f3 100%); }
      header { position: sticky; top: 0; z-index: 4; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; background: rgba(255,255,255,.94); border-bottom: 1px solid var(--line); box-shadow: 0 8px 24px rgba(15,23,42,.06); backdrop-filter: blur(10px); }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 18px; line-height: 1.1; }
      h2 { font-size: 24px; }
      small, p { color: var(--muted); font-weight: 800; }
      main { max-width: 1040px; margin: 0 auto; padding: 12px 12px 18px; }
      .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .brand > div:last-child { min-width: 0; }
      .brand h1, .brand small { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .logo { width: 40px; height: 40px; flex: 0 0 auto; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--red), var(--teal)); border-radius: 11px; font-weight: 950; box-shadow: inset 0 -10px 16px rgba(0,0,0,.18); }
      .table-pill { min-width: 78px; max-width: 118px; padding: 8px 10px; color: #fff; background: var(--red); border-radius: 10px; text-align: center; font-weight: 950; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; box-shadow: 0 8px 18px rgba(203,17,55,.18); }
      .status { margin: 0 0 10px; padding: 10px 12px; color: #075985; background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 10px; font-weight: 900; }
      .status.error { color: #b91c1c; background: #fff1f2; border-color: #fecdd3; }
      .status.success { color: #166534; background: #dcfce7; border-color: #86efac; }
      .table-state { margin: -2px 0 10px; display: grid; gap: 4px; padding: 10px 12px; color: #334155; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; font-weight: 900; }
      .table-state strong { color: #9a3412; }
      .table-state.success { color: #166534; background: #dcfce7; border-color: #86efac; }
      .table-state.error { color: #b91c1c; background: #fff1f2; border-color: #fecdd3; }
      .table-state span { color: inherit; font-size: 12px; font-weight: 800; }
      .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 12px; align-items: start; }
      .card { background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
      .menu-card, .cart-card { padding: 12px; display: grid; gap: 12px; }
      .menu-card > div:first-child { display: grid; gap: 3px; padding: 2px 2px 0; }
      .menu-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
      .menu-tools input { min-height: 38px; }
      .menu-tools span { color: var(--muted); font-size: 12px; font-weight: 900; white-space: nowrap; }
      .category-tabs { display: flex; gap: 8px; overflow-x: auto; padding: 0 0 4px; scrollbar-width: thin; }
      button { font: inherit; border: 0; cursor: pointer; }
      .category-tabs button { min-height: 38px; padding: 0 13px; color: #334155; background: #f8fafc; border: 1px solid var(--line); border-radius: 999px; font-weight: 900; white-space: nowrap; }
      .category-tabs button.active { color: #fff; background: var(--red); border-color: var(--red); }
      .items { display: grid; grid-template-columns: repeat(auto-fill, minmax(142px, 1fr)); gap: 10px; }
      .item { min-width: 0; min-height: 156px; display: grid; grid-template-rows: auto auto minmax(32px, auto); gap: 8px; padding: 9px; color: var(--ink); background: #fff; border: 1px solid var(--line); border-radius: 12px; text-align: left; box-shadow: 0 1px 0 rgba(15,23,42,.03); }
      .item:hover { border-color: var(--teal); box-shadow: 0 8px 18px rgba(15,135,147,.12); }
      .photo { height: 82px; display: grid; place-items: center; color: #94a3b8; background: #eef3f5; border: 1px solid #dbe4ea; border-radius: 10px; overflow: hidden; }
      .photo img { width: 100%; height: 100%; object-fit: cover; }
      .price { color: var(--red); font-weight: 950; }
      .item strong, .cart-line strong { overflow-wrap: anywhere; line-height: 1.18; }
      .cart-card { gap: 10px; }
      .cart-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .cart-clear { min-height: 34px; padding: 0 10px; color: #b91c1c; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; font-weight: 950; }
      .cart-lines { display: grid; gap: 8px; }
      .cart-empty { min-height: 120px; display: grid; place-items: center; color: var(--muted); background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; font-weight: 900; text-align: center; }
      .cart-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; padding: 8px; background: #f8fafc; border: 1px solid var(--line); border-radius: 9px; }
      .qty { display: flex; align-items: center; gap: 5px; }
      .qty button { width: 34px; height: 34px; color: #111827; background: #fff; border: 1px solid var(--line); border-radius: 9px; font-weight: 950; }
      label { display: grid; gap: 6px; color: #475569; font-size: 12px; font-weight: 900; }
      input, textarea { width: 100%; min-width: 0; min-height: 42px; color: #111827; background: #f8fafc; border: 1px solid var(--line); border-radius: 10px; padding: 0 10px; font: inherit; font-weight: 800; outline: 0; }
      input:focus, textarea:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(15,135,147,.12); }
      textarea { min-height: 70px; padding: 9px 10px; resize: vertical; }
      .total-row { display: flex; align-items: baseline; justify-content: space-between; padding-top: 8px; border-top: 1px dashed var(--line); }
      .total-row strong { font-size: 24px; }
      .submit { min-height: 48px; color: #fff; background: var(--teal); border-radius: 12px; font-weight: 950; box-shadow: 0 10px 20px rgba(15,135,147,.18); }
      .submit:disabled { cursor: not-allowed; opacity: .55; }
      .hidden { display: none !important; }
      @media (max-width: 820px) {
        body { background: #eef3f5; }
        header { gap: 8px; }
        h1 { font-size: 16px; }
        h2 { font-size: 20px; }
        main { padding: 10px 8px 0; }
        .layout { grid-template-columns: 1fr; }
        .card { border-radius: 14px; }
        .menu-card { padding: 10px; }
        .menu-tools { grid-template-columns: 1fr; gap: 6px; }
        .menu-tools span { padding-left: 2px; }
        .cart-card { position: sticky; bottom: 0; z-index: 3; max-height: 72vh; overflow-y: auto; border-radius: 16px 16px 0 0; border-bottom: 0; box-shadow: 0 -12px 34px rgba(15,23,42,.16); }
        .items { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .item { min-height: 142px; padding: 8px; }
        .photo { height: 72px; }
      }
      @media (max-width: 430px) {
        header { padding: 9px 10px; }
        .logo { width: 36px; height: 36px; border-radius: 10px; }
        .table-pill { min-width: 64px; max-width: 94px; padding: 7px 8px; font-size: 13px; }
        .status, .table-state { font-size: 13px; }
        .category-tabs button { min-height: 36px; padding: 0 11px; font-size: 13px; }
        .items { gap: 8px; }
        .item { min-height: 132px; gap: 6px; font-size: 13px; }
        .photo { height: 64px; }
        .price { font-size: 12px; }
        .cart-line { grid-template-columns: minmax(0, 1fr); }
        .qty { justify-content: space-between; }
        .qty button { width: 42px; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">
        <div class="logo">GI</div>
        <div>
          <h1 id="businessName">${escapeHtml(status.appName)}</h1>
          <small>Scan menu order</small>
        </div>
      </div>
      <div class="table-pill" id="tableName">${escapeHtml(tableName || 'Table')}</div>
    </header>
    <main>
      <div class="status" id="statusBox">Loading table menu...</div>
      <div class="table-state hidden" id="tableStateBox"></div>
      <div class="layout">
        <section class="card menu-card">
          <div>
            <h2>Menu</h2>
            <p>Select items and send order to counter.</p>
          </div>
          <div class="menu-tools">
            <input id="menuSearchInput" placeholder="Search item" />
            <span id="menuCount">0 item(s)</span>
          </div>
          <div class="category-tabs" id="categoryTabs"></div>
          <div class="items" id="itemGrid"></div>
        </section>
        <aside class="card cart-card">
          <div class="cart-head">
            <div>
              <h2>Your Order</h2>
              <p id="cartCount">0 item(s)</p>
            </div>
            <button class="cart-clear" id="clearCartBtn" type="button">Clear</button>
          </div>
          <div class="cart-lines" id="cartLines"></div>
          <label>
            Name
            <input id="customerNameInput" placeholder="Optional" />
          </label>
          <label>
            Phone
            <input id="customerPhoneInput" inputmode="tel" placeholder="Optional" />
          </label>
          <label>
            Note
            <textarea id="noteInput" placeholder="Less spicy, no onion..."></textarea>
          </label>
          <div class="total-row">
            <span>Total</span>
            <strong>Rs. <span id="cartTotal">0.00</span></strong>
          </div>
          <button class="submit" id="submitBtn" type="button">Send Order</button>
        </aside>
      </div>
    </main>
    <script>
      const initialTable = ${JSON.stringify(String(tableName || ''))};
      const state = {
        table: initialTable,
        business: {},
        categories: [],
        items: [],
        activeCategory: 'all',
        menuSearch: '',
        cart: [],
        pendingOrder: null,
        openBill: null,
        submitting: false,
      };
      const byId = (id) => document.getElementById(id);
      const money = (value) => Number(value || 0).toFixed(2);
      function storageKey(name) {
        return 'giQr:' + name + ':' + String(state.table || '').toLowerCase();
      }
      function readStoredDraft() {
        if (!state.table) return null;
        try {
          return JSON.parse(localStorage.getItem(storageKey('draft')) || 'null');
        } catch {
          return null;
        }
      }
      function saveDraft() {
        if (!state.table) return;
        const draft = {
          cart: state.cart,
          customerName: byId('customerNameInput').value,
          customerPhone: byId('customerPhoneInput').value,
          note: byId('noteInput').value,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(storageKey('draft'), JSON.stringify(draft));
      }
      function readLastOrder() {
        if (!state.table) return null;
        try {
          return JSON.parse(localStorage.getItem(storageKey('lastOrder')) || 'null');
        } catch {
          return null;
        }
      }
      function saveLastOrder(order, merged) {
        if (!state.table) return;
        localStorage.setItem(storageKey('lastOrder'), JSON.stringify({
          id: order.id,
          shortId: order.shortId,
          status: order.status || 'pending',
          merged: Boolean(merged),
          sentAt: order.createdAt || new Date().toISOString(),
          updatedAt: order.updatedAt || new Date().toISOString(),
        }));
      }
      function setStatus(message, kind) {
        const box = byId('statusBox');
        box.textContent = message;
        box.className = 'status' + (kind ? ' ' + kind : '');
      }
      function renderTableState() {
        const box = byId('tableStateBox');
        const pending = state.pendingOrder;
        const openBill = state.openBill;

        if (pending) {
          box.className = 'table-state';
          box.innerHTML =
            '<strong>Pending at counter: Ref ' + escapeHtmlText(pending.shortId || pending.id || '') + '</strong>' +
            '<span>New items from this table will be added to the same pending request until staff accepts it.</span>';
          return;
        }

        if (openBill) {
          box.className = 'table-state success';
          box.innerHTML =
            '<strong>Table bill is active: Bill #' + escapeHtmlText(openBill.billNo || '') + '</strong>' +
            '<span>You can send more items; counter staff will add them to this table.</span>';
          return;
        }

        box.className = 'table-state hidden';
        box.textContent = '';
      }
      async function fetchJson(url, options) {
        const response = await fetch(url, options);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || 'Request failed');
        }
        return payload;
      }
      function cartTotal() {
        const subtotal = state.cart.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.qty || 0), 0);
        const tax = state.cart.reduce((sum, line) => sum + (Number(line.price || 0) * Number(line.qty || 0) * Number(line.taxRate || 0)) / 100, 0);
        return state.business?.gstType === 'inclusive' ? subtotal : subtotal + tax;
      }
      function renderCategories() {
        const used = new Set(state.items.map((item) => item.category));
        const categories = [{ id: 'all', label: 'All' }].concat(state.categories.filter((category) => used.has(category.id)));
        if (!categories.some((category) => category.id === state.activeCategory)) {
          state.activeCategory = 'all';
        }
        byId('categoryTabs').innerHTML = categories.map((category) =>
          '<button type="button" class="' + (category.id === state.activeCategory ? 'active' : '') + '" data-category="' + escapeAttr(category.id) + '">' + escapeHtmlText(category.label) + '</button>'
        ).join('');
        byId('categoryTabs').querySelectorAll('button').forEach((button) => {
          button.addEventListener('click', () => {
            state.activeCategory = button.dataset.category || 'all';
            renderCategories();
            renderItems();
          });
        });
      }
      function renderItems() {
        const query = state.menuSearch.trim().toLowerCase();
        const items = state.items.filter((item) => {
          const inCategory = state.activeCategory === 'all' || item.category === state.activeCategory;
          const inSearch =
            !query ||
            item.name.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query);

          return inCategory && inSearch;
        });
        byId('menuCount').textContent = items.length + ' / ' + state.items.length + ' item(s)';
        byId('itemGrid').innerHTML = items.length
          ? items.map((item) =>
              '<button class="item" type="button" data-id="' + escapeAttr(item.id) + '">' +
              '<div class="photo">' + (item.imageDataUrl ? '<img alt="" src="' + escapeAttr(item.imageDataUrl) + '" />' : '+') + '</div>' +
              '<span class="price">Rs. ' + money(item.price) + '</span>' +
              '<strong>' + escapeHtmlText(item.name) + '</strong>' +
              '</button>'
            ).join('')
          : '<div class="cart-empty">No available items in this category</div>';
        byId('itemGrid').querySelectorAll('.item').forEach((button) => {
          button.addEventListener('click', () => {
            const item = state.items.find((entry) => entry.id === button.dataset.id);
            if (item) addItem(item);
          });
        });
      }
      function addItem(item) {
        const existing = state.cart.find((line) => line.itemId === item.id && line.price === item.price);
        if (existing) {
          existing.qty += 1;
        } else {
          state.cart.push({ id: 'qr-line-' + Date.now() + '-' + item.id, itemId: item.id, name: item.name, price: item.price, qty: 1, taxRate: Number(item.taxRate ?? state.business?.defaultGstRate ?? 0), discountMode: 'percent', discountPercent: 0, discountAmount: 0, description: '' });
        }
        renderCart();
        setStatus(item.name + ' added', '');
      }
      function changeQty(itemId, amount) {
        state.cart = state.cart
          .map((line) => line.itemId === itemId ? { ...line, qty: Math.max(0, line.qty + amount) } : line)
          .filter((line) => line.qty > 0);
        renderCart();
      }
      function clearCart() {
        if (!state.cart.length) {
          return;
        }

        if (!confirm('Clear selected items?')) {
          return;
        }

        state.cart = [];
        byId('noteInput').value = '';
        renderCart();
        setStatus('Cart cleared', '');
      }
      function renderCart() {
        byId('cartCount').textContent = state.cart.reduce((sum, line) => sum + line.qty, 0) + ' item(s)';
        byId('cartTotal').textContent = money(cartTotal());
        byId('submitBtn').disabled = state.submitting || !state.cart.length;
        byId('cartLines').innerHTML = state.cart.length
          ? state.cart.map((line) =>
              '<div class="cart-line">' +
              '<div><strong>' + escapeHtmlText(line.name) + '</strong><p>Rs. ' + money(line.price * line.qty) + '</p></div>' +
              '<div class="qty"><button type="button" data-qty="-1" data-id="' + escapeAttr(line.itemId) + '">-</button><strong>' + line.qty + '</strong><button type="button" data-qty="1" data-id="' + escapeAttr(line.itemId) + '">+</button></div>' +
              '</div>'
            ).join('')
          : '<div class="cart-empty">Your cart is empty</div>';
        byId('cartLines').querySelectorAll('[data-qty]').forEach((button) => {
          button.addEventListener('click', () => changeQty(button.dataset.id, Number(button.dataset.qty)));
        });
        saveDraft();
      }
      async function submitOrder() {
        if (!state.cart.length || state.submitting) return;
        state.submitting = true;
        renderCart();
        setStatus('Sending order to counter...', '');
        try {
          const result = await fetchJson('/api/qr/orders', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              table: state.table,
              customerName: byId('customerNameInput').value,
              customerPhone: byId('customerPhoneInput').value,
              note: byId('noteInput').value,
              cart: state.cart,
            }),
          });
          state.cart = [];
          byId('noteInput').value = '';
          renderCart();
          saveLastOrder(result.order, result.merged);
          state.pendingOrder = result.order;
          renderTableState();
          setStatus((result.merged ? 'Items added to pending table order. Ref: ' : 'Order sent to counter. Ref: ') + result.order.shortId, 'success');
          void refreshOrderState();
        } catch (error) {
          setStatus(error.message || 'Could not send order', 'error');
        } finally {
          state.submitting = false;
          renderCart();
        }
      }
      function escapeHtmlText(value) {
        return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
      }
      function escapeAttr(value) {
        return escapeHtmlText(value);
      }
      function getOrderStatusMessage(order) {
        if (!order?.id) {
          return '';
        }

        if (order.status === 'accepted') {
          return 'Order accepted at counter. Ref: ' + (order.shortId || order.id) + '.';
        }

        if (order.status === 'rejected') {
          return 'Order rejected at counter. Please call staff. Ref: ' + (order.shortId || order.id) + '.';
        }

        return 'Order waiting at counter. Ref: ' + (order.shortId || order.id) + '.';
      }
      async function refreshOrderState() {
        if (!state.table) {
          return;
        }

        const lastOrder = readLastOrder();
        const params = new URLSearchParams({ table: state.table });
        if (lastOrder?.id) {
          params.set('id', lastOrder.id);
        }

        const result = await fetchJson('/api/qr/order-status?' + params.toString());
        state.pendingOrder = result.pendingOrder || null;
        state.openBill = result.openBill || null;

        if (result.order) {
          saveLastOrder(result.order, result.order.merged);
          setStatus(getOrderStatusMessage(result.order), result.order.status === 'rejected' ? 'error' : 'success');
        }

        renderTableState();
      }
      async function loadData() {
        const queryTable = new URLSearchParams(window.location.search).get('table') || '';
        state.table = initialTable || queryTable;
        const result = await fetchJson('/api/qr/bootstrap?table=' + encodeURIComponent(state.table));
        state.business = result.businessProfile || {};
        state.table = result.table;
        state.categories = result.categories || [];
        state.items = result.menuItems || [];
        state.pendingOrder = result.pendingOrder || null;
        state.openBill = result.openBill || null;
        const draft = readStoredDraft();
        if (draft && Array.isArray(draft.cart)) {
          const itemIds = new Set(state.items.map((item) => item.id));
          state.cart = draft.cart.filter((line) => itemIds.has(line.itemId) && Number(line.qty || 0) > 0);
          byId('customerNameInput').value = draft.customerName || '';
          byId('customerPhoneInput').value = draft.customerPhone || '';
          byId('noteInput').value = draft.note || '';
        }
        byId('businessName').textContent = state.business.businessName || result.appName || 'GI POS Restaurant';
        byId('tableName').textContent = state.table;
        renderTableState();
        renderCategories();
        renderItems();
        renderCart();
        const lastOrder = readLastOrder();
        setStatus(
          lastOrder?.shortId
            ? 'Last order sent. Ref: ' + lastOrder.shortId + '. Add more items if needed.'
            : state.items.length ? 'Menu ready. Send order when finished.' : 'No available menu items now.',
          lastOrder?.shortId ? 'success' : ''
        );
        void refreshOrderState().catch(() => undefined);
      }
      byId('submitBtn').addEventListener('click', submitOrder);
      byId('clearCartBtn').addEventListener('click', clearCart);
      byId('menuSearchInput').addEventListener('input', (event) => {
        state.menuSearch = event.target.value;
        renderItems();
      });
      byId('customerNameInput').addEventListener('input', saveDraft);
      byId('customerPhoneInput').addEventListener('input', saveDraft);
      byId('noteInput').addEventListener('input', saveDraft);
      window.setInterval(() => void refreshOrderState().catch(() => undefined), 8000);
      loadData().catch((error) => {
        byId('itemGrid').innerHTML = '<div class="cart-empty">Menu not available</div>';
        setStatus(error.message || 'Cannot load table menu', 'error');
      });
    </script>
  </body>
</html>`;
}

function buildMobileBootstrapPayload({ app, getDatabase, getStatus }) {
  const values = getSnapshotValues(getDatabase);
  const businessProfile = normalizeBusinessProfile(readStoredJson(values, 'pos-business-profile', {}), app);
  const categories = normalizeCategories(readStoredJson(values, 'pos-categories', []));
  const diningTableGroups = normalizeDiningTableGroups(readStoredJson(values, 'pos-dining-table-groups', []));
  const menuItems = normalizeMenuItems(readStoredJson(values, 'pos-menu-items', []));
  const staffUsers = normalizeStaffUsers(readStoredJson(values, 'pos-staff-users', []));
  const orders = normalizeSavedOrders(readStoredJson(values, 'pos-orders', []));
  const printerProfiles = normalizePrinterProfiles(readStoredJson(values, 'printer-profiles', []));
  const billPrinterProfileId = String(readStoredJson(values, 'bill-printer-profile-id', 'bill-printer') || 'bill-printer');
  const openOrders = orders
    .filter((order) => order.status !== 'paid')
    .map((order) => ({
      id: order.id,
      billNo: order.billNo,
      status: order.status,
      orderType: order.orderType,
      table: order.table,
      seatingMode: order.seatingMode,
      tables: order.tables,
      diningGroupName: order.diningGroupName,
      cart: order.cart,
      totals: order.totals,
      updatedAt: order.updatedAt,
    }));

  return {
    ok: true,
    appName: app.getName(),
    version: app.getVersion(),
    server: getStatus(),
    businessProfile,
    categories,
    diningTableGroups,
    menuItems,
    staffUsers: staffUsers.map((user) => ({
      id: user.id,
      name: user.name,
      active: user.active,
      permissions: user.permissions,
    })),
    printerProfiles: printerProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      paperWidth: profile.settings.paperWidth,
      isBillPrinter: profile.id === billPrinterProfileId,
    })),
    openOrderList: openOrders,
    openOrders: openOrders.length,
    paidBills: orders.filter((order) => order.status === 'paid').length,
  };
}

function buildQrBootstrapPayload({ app, getDatabase, getStatus, tableName }) {
  const values = getSnapshotValues(getDatabase);
  const businessProfile = normalizeBusinessProfile(readStoredJson(values, 'pos-business-profile', {}), app);
  const categories = normalizeCategories(readStoredJson(values, 'pos-categories', []));
  const diningTableGroups = normalizeDiningTableGroups(readStoredJson(values, 'pos-dining-table-groups', []));
  const requestedTable = parseDiningTableNames(tableName)[0] || '';
  const table = findDiningTable(requestedTable, diningTableGroups);

  if (!table) {
    return {
      ok: false,
      error: requestedTable ? `Table ${requestedTable} is not available` : 'Table is required',
      appName: app.getName(),
      version: app.getVersion(),
      server: getStatus(),
    };
  }

  const menuItems = normalizeMenuItems(readStoredJson(values, 'pos-menu-items', []))
    .filter((item) => item.available !== false && item.price > 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      taxRate: item.taxRate,
      imageDataUrl: item.imageDataUrl,
    }));
  const usedCategoryIds = new Set(menuItems.map((item) => item.category));
  const qrOrders = normalizeQrOrders(readStoredJson(values, 'pos-qr-orders', []));
  const savedOrders = normalizeSavedOrders(readStoredJson(values, 'pos-orders', []));
  const pendingOrder = findPendingQrOrderForTable(qrOrders, table);
  const openBill = findOpenDiningOrderForTable(savedOrders, table);

  return {
    ok: true,
    appName: app.getName(),
    version: app.getVersion(),
    server: getStatus(),
    businessProfile,
    table,
    categories: categories.filter((category) => usedCategoryIds.has(category.id)),
    menuItems,
    pendingOrder: serializeQrOrderForCustomer(pendingOrder),
    openBill: serializeOpenBillForCustomer(openBill),
  };
}

function buildQrOrderStatusPayload({ getDatabase, tableName, orderId }) {
  const values = getSnapshotValues(getDatabase);
  const qrOrders = normalizeQrOrders(readStoredJson(values, 'pos-qr-orders', []));
  const savedOrders = normalizeSavedOrders(readStoredJson(values, 'pos-orders', []));
  const diningTableGroups = normalizeDiningTableGroups(readStoredJson(values, 'pos-dining-table-groups', []));
  const requestedTable = parseDiningTableNames(tableName)[0] || '';
  const table = findDiningTable(requestedTable, diningTableGroups) || requestedTable;
  const order = String(orderId || '').trim()
    ? qrOrders.find((savedOrder) => savedOrder.id === String(orderId).trim()) || null
    : null;

  return {
    ok: true,
    table,
    order: serializeQrOrderForCustomer(order),
    pendingOrder: table ? serializeQrOrderForCustomer(findPendingQrOrderForTable(qrOrders, table)) : null,
    openBill: table ? serializeOpenBillForCustomer(findOpenDiningOrderForTable(savedOrders, table)) : null,
  };
}

function serializeQrOrderForCustomer(order) {
  if (!order) {
    return null;
  }

  return {
    id: order.id,
    shortId: order.shortId || order.id.slice(-6).toUpperCase(),
    status: order.status,
    table: order.table,
    total: order.totals.total,
    itemCount: order.cart.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function serializeOpenBillForCustomer(order) {
  if (!order) {
    return null;
  }

  return {
    id: order.id,
    billNo: order.billNo,
    status: order.status,
    total: order.totals.total,
    itemCount: order.cart.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    updatedAt: order.updatedAt,
  };
}

function findPendingQrOrderForTable(orders, table) {
  const requested = String(table || '').trim().toLowerCase();
  if (!requested) {
    return null;
  }

  return (
    orders
      .filter((order) => order.status === 'pending' && String(order.table || '').toLowerCase() === requested)
      .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())[0] || null
  );
}

function getSavedOrderTables(order) {
  const savedTables = parseDiningTableNames(order?.tables || []);
  if (savedTables.length) {
    return savedTables;
  }

  return getDiningTablesFromLabel(order?.table || '');
}

function findOpenDiningOrderForTable(orders, table) {
  const requested = String(table || '').trim().toLowerCase();
  if (!requested) {
    return null;
  }

  return (
    orders.find(
      (order) =>
        order.status !== 'paid' &&
        order.orderType === 'Dining' &&
        getSavedOrderTables(order).some((tableName) => tableName.toLowerCase() === requested),
    ) || null
  );
}

function getSnapshotValues(getDatabase) {
  return getDatabase?.()?.getSnapshot?.()?.values || {};
}

function readStoredJson(values, key, fallback) {
  const rawValue = values?.[key];

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return fallback;
  }

  try {
    return JSON.parse(String(rawValue));
  } catch {
    return fallback;
  }
}

function getQrTableFromPath(url) {
  const searchTable = String(url.searchParams.get('table') || '').trim();
  if (searchTable) {
    return parseDiningTableNames(searchTable)[0] || searchTable;
  }

  if (!url.pathname.startsWith('/qr/')) {
    return '';
  }

  const rawTable = url.pathname.slice('/qr/'.length);
  try {
    return parseDiningTableNames(decodeURIComponent(rawTable))[0] || decodeURIComponent(rawTable).trim();
  } catch {
    return parseDiningTableNames(rawTable)[0] || rawTable.trim();
  }
}

function normalizeBusinessProfile(profile, app) {
  const source = profile && typeof profile === 'object' ? profile : {};

  return {
    businessName: String(source.businessName || '').trim() || app.getName(),
    ownerName: String(source.ownerName || '').trim(),
    branch: String(source.branch || '').trim(),
    phone: String(source.phone || '').trim(),
    email: String(source.email || '').trim(),
    address: String(source.address || '').trim(),
    gstin: String(source.gstin || '').trim(),
    defaultGstRate: Math.max(0, Number(source.defaultGstRate || 0)),
    gstType: source.gstType === 'inclusive' ? 'inclusive' : 'exclusive',
  };
}

function normalizeCategories(categories) {
  if (!Array.isArray(categories)) {
    return [];
  }

  return categories
    .filter((category) => category && typeof category === 'object')
    .map((category, index) => ({
      id: String(category.id || '').trim(),
      label: String(category.label || category.name || '').trim(),
      priority: Number.isFinite(Number(category.priority)) ? Number(category.priority) : index * 10,
    }))
    .filter((category) => category.id && category.label && category.id !== 'all')
    .sort((first, second) => first.priority - second.priority || first.label.localeCompare(second.label));
}

function normalizeMenuItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: String(item.id || '').trim(),
      name: String(item.name || '').trim(),
      category: String(item.category || '').trim(),
      price: Math.max(0, Number(item.price || 0)),
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)).filter(Boolean) : [],
      imageDataUrl: String(item.imageDataUrl || ''),
      available: item.available === false ? false : true,
      unavailableReason: String(item.unavailableReason || '').trim(),
      taxRate:
        Object.prototype.hasOwnProperty.call(item, 'taxRate') && String(item.taxRate ?? '').trim() !== ''
          ? Math.max(0, Number(item.taxRate || 0))
          : undefined,
    }))
    .filter((item) => item.id && item.name);
}

function normalizeDiningTableGroups(groups) {
  const defaultGroups = [
    { id: 'main-hall', label: 'Main Hall', tables: Array.from({ length: 8 }, (_, index) => `T${index + 1}`) },
    { id: 'family', label: 'Family', tables: Array.from({ length: 8 }, (_, index) => `T${index + 9}`) },
    { id: 'ac-room', label: 'AC Room', tables: Array.from({ length: 4 }, (_, index) => `T${index + 17}`) },
    { id: 'outdoor', label: 'Outdoor', tables: Array.from({ length: 4 }, (_, index) => `T${index + 21}`) },
  ];
  const sourceGroups = Array.isArray(groups) && groups.length ? groups : defaultGroups;

  return sourceGroups
    .filter((group) => group && typeof group === 'object')
    .map((group, index) => ({
      id: String(group.id || `area-${index + 1}`).trim(),
      label: String(group.label || `Area ${index + 1}`).trim(),
      tables: parseDiningTableNames(group.tables || []),
    }))
    .filter((group) => group.id && group.label && group.tables.length);
}

function findDiningTable(tableName, diningTableGroups) {
  const requested = String(tableName || '').trim().toLowerCase();
  if (!requested) {
    return '';
  }

  return diningTableGroups.flatMap((group) => group.tables).find((table) => table.toLowerCase() === requested) || '';
}

function normalizeStaffUsers(users) {
  if (!Array.isArray(users)) {
    return [];
  }

  return users
    .filter((user) => user && typeof user === 'object')
    .map((user) => ({
      id: String(user.id || '').trim(),
      name: String(user.name || '').trim() || 'Staff',
      pinSalt: String(user.pinSalt || '').trim(),
      pinHash: String(user.pinHash || '').trim(),
      permissions: Array.isArray(user.permissions) ? user.permissions.map((permission) => String(permission)) : ['pos_access'],
      active: user.active !== false,
    }))
    .filter((user) => user.id && user.pinSalt && user.pinHash);
}

function normalizeSavedOrders(orders) {
  if (!Array.isArray(orders)) {
    return [];
  }

  return orders
    .filter((order) => order && typeof order === 'object')
    .map((order) => ({
      ...order,
      id: String(order.id || '').trim(),
      billNo: String(order.billNo || '').trim(),
      status: normalizeOrderStatus(order.status),
      orderType: normalizeOrderType(order.orderType),
      table: String(order.table || '').trim(),
      seatingMode: order.seatingMode === 'group' ? 'group' : 'individual',
      tables: parseDiningTableNames(order.tables || getDiningTablesFromLabel(order.table)),
      diningGroupName: String(order.diningGroupName || '').trim(),
      cart: normalizeCartLines(order.cart || []),
      totals: normalizeTotals(order.totals),
      updatedAt: String(order.updatedAt || order.createdAt || new Date().toISOString()),
    }))
    .filter((order) => order.id);
}

function normalizeQrOrders(orders) {
  if (!Array.isArray(orders)) {
    return [];
  }

  return orders
    .filter((order) => order && typeof order === 'object')
    .map((order) => {
      const status = ['pending', 'accepted', 'rejected'].includes(String(order.status)) ? String(order.status) : 'pending';
      const table = parseDiningTableNames(order.table || order.tables)[0] || String(order.table || '').trim();
      const cart = normalizeCartLines(order.cart || []);

      return {
        id: String(order.id || createOrderId('qr-order')).trim(),
        shortId: String(order.shortId || '').trim(),
        status,
        source: 'table-qr',
        table,
        tables: table ? [table] : parseDiningTableNames(order.tables || []),
        customerName: String(order.customerName || '').trim(),
        customerPhone: String(order.customerPhone || '').trim(),
        note: String(order.note || '').trim(),
        cart,
        totals: normalizeTotals(order.totals || buildTotals(cart)),
        createdAt: String(order.createdAt || new Date().toISOString()),
        updatedAt: String(order.updatedAt || order.createdAt || new Date().toISOString()),
      };
    })
    .filter((order) => order.id && order.table && order.cart.length);
}

function normalizePrinterProfiles(profiles) {
  const defaultProfile = {
    id: 'bill-printer',
    name: 'Bill Printer',
    settings: {
      mode: 'system',
      deviceName: '',
      ipAddress: '',
      port: '9100',
      paperWidth: '80',
    },
  };
  const sourceProfiles = Array.isArray(profiles) && profiles.length ? profiles : [defaultProfile];

  return sourceProfiles
    .filter((profile) => profile && typeof profile === 'object')
    .map((profile, index) => ({
      id: String(profile.id || (index === 0 ? 'bill-printer' : `printer-${index + 1}`)).trim(),
      name: String(profile.name || (index === 0 ? 'Bill Printer' : `Printer ${index + 1}`)).trim(),
      settings: normalizePrinterSettings(profile.settings),
    }))
    .filter((profile) => profile.id && profile.name);
}

function normalizePrinterSettings(settings = {}) {
  return {
    mode: settings.mode === 'network' ? 'network' : 'system',
    deviceName: String(settings.deviceName || ''),
    ipAddress: String(settings.ipAddress || ''),
    port: String(settings.port || '9100'),
    paperWidth: settings.paperWidth === '58' ? '58' : '80',
  };
}

function normalizeOrderStatus(status) {
  const value = String(status || '').trim();
  return value === 'hold' || value === 'paid' ? value : 'unclosed';
}

function normalizeOrderType(orderType) {
  const value = String(orderType || '').trim();
  return ['Dining', 'Delivery', 'Take Away', 'Online'].includes(value) ? value : 'Dining';
}

function parseDiningTableNames(value) {
  const rawValues = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[\n,;]+/)
        .map((item) => item.trim());
  const seen = new Set();
  const tables = [];

  for (const rawValue of rawValues) {
    const tableName = String(rawValue || '').trim().replace(/\s+/g, ' ');
    const key = tableName.toLowerCase();
    if (tableName && !seen.has(key)) {
      seen.add(key);
      tables.push(tableName);
    }
  }

  return tables;
}

function getDiningTablesFromLabel(value) {
  const label = String(value || '');
  const labelParts = label.split('/');
  const tablePart = label.includes('/') ? labelParts[labelParts.length - 1] || '' : label;
  return parseDiningTableNames(tablePart.replace(/\+/g, ','));
}

function normalizeCartLines(lines) {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines
    .filter((line) => line && typeof line === 'object')
    .map((line) => {
      const qty = Math.max(0, Number(line.qty || 0));
      const price = roundMoney(Math.max(0, Number(line.price || 0)));
      const gross = roundMoney(qty * price);
      const discountMode = line.discountMode === 'amount' ? 'amount' : 'percent';

      return {
        id: String(line.id || createOrderId('line')).trim(),
        itemId: String(line.itemId || '').trim(),
        name: String(line.name || '').trim(),
        price,
        qty,
        taxRate: Math.max(0, Number(line.taxRate || 0)),
        discountMode,
        discountPercent: discountMode === 'percent' ? clamp(Number(line.discountPercent || 0), 0, 100) : 0,
        discountAmount: discountMode === 'amount' ? clamp(Number(line.discountAmount || 0), 0, gross) : 0,
        description: String(line.description || '').trim(),
      };
    })
    .filter((line) => line.itemId && line.name && line.qty > 0);
}

function normalizeMobileCartLines(lines, menuItems, defaultTaxRate = 0) {
  const menuById = new Map(menuItems.map((item) => [item.id, item]));
  return normalizeCartLines(lines)
    .map((line) => {
      const menuItem = menuById.get(line.itemId);
      if (!menuItem || menuItem.available === false) {
        return null;
      }

      return {
        ...line,
        name: menuItem.name,
        price: menuItem.price > 0 ? menuItem.price : line.price,
        taxRate: Math.max(0, Number(menuItem.taxRate ?? defaultTaxRate)),
      };
    })
    .filter(Boolean);
}

function normalizeTotals(totals = {}) {
  return {
    subtotal: roundMoney(Number(totals.subtotal || 0)),
    discount: roundMoney(Number(totals.discount || 0)),
    tax: roundMoney(Number(totals.tax || 0)),
    serviceCharge: roundMoney(Number(totals.serviceCharge || 0)),
    total: roundMoney(Number(totals.total || 0)),
    paid: roundMoney(Number(totals.paid || 0)),
    balance: roundMoney(Number(totals.balance || 0)),
    change: roundMoney(Number(totals.change || 0)),
  };
}

function buildTotals(cart, businessProfile = {}) {
  const subtotal = roundMoney(cart.reduce((sum, line) => sum + line.price * line.qty, 0));
  const tax = roundMoney(
    cart.reduce((sum, line) => {
      const gross = Number(line.price || 0) * Number(line.qty || 0);
      const rate = Math.max(0, Number(line.taxRate || 0));
      return sum + (businessProfile.gstType === 'inclusive' ? (gross * rate) / (100 + rate) : (gross * rate) / 100);
    }, 0),
  );
  const total = businessProfile.gstType === 'inclusive' ? subtotal : roundMoney(subtotal + tax);
  return {
    subtotal,
    discount: 0,
    tax,
    serviceCharge: 0,
    total,
    paid: 0,
    balance: total,
    change: 0,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function createOrderId(prefix = 'mobile-order') {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function getNextBillNumber(orders) {
  const highest = orders.reduce((max, order) => Math.max(max, Number(order.billNo || 0) || 0), 0);
  return String(highest + 1);
}

function getSeatingDisplayLabel(seatingMode, tableLabel, selectedTables, diningGroupName) {
  const tables = parseDiningTableNames(seatingMode === 'group' ? selectedTables : tableLabel);

  if (seatingMode === 'group') {
    if (tables.length < 2) {
      return '';
    }

    return `${String(diningGroupName || '').trim() || 'Group'} / ${tables.join(', ')}`;
  }

  return tables[0] || '';
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(createHttpError(413, 'Request body too large'));
        request.destroy();
      }
    });

    request.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(createHttpError(400, 'Invalid JSON body'));
      }
    });

    request.on('error', reject);
  });
}

async function loginMobileUser(getDatabase, body, sessionSecret) {
  const userId = String(body?.userId || '').trim();
  const pin = String(body?.pin || '');

  if (!userId || !pin) {
    throw createHttpError(400, 'Select user and enter PIN');
  }

  const users = normalizeStaffUsers(readStoredJson(getSnapshotValues(getDatabase), 'pos-staff-users', []));
  const user = users.find((candidate) => candidate.id === userId);

  if (!user || !user.active) {
    throw createHttpError(403, 'User is not active');
  }

  if (!user.permissions.includes('pos_access')) {
    throw createHttpError(403, 'POS permission is required');
  }

  if (!verifyPin(pin, user.pinSalt, user.pinHash)) {
    throw createHttpError(403, 'Wrong PIN');
  }

  return {
    ok: true,
    sessionToken: signMobileSession(user.id, sessionSecret),
    user: {
      id: user.id,
      name: user.name,
      active: user.active,
      permissions: user.permissions,
    },
  };
}

function saveMobileOrder(getDatabase, user, body) {
  const result = saveMobileOrderToDatabase(getDatabase, user, body, normalizeOrderStatus(body?.status));
  return { ok: true, order: result.order, openOrders: result.openOrders };
}

async function printMobileKot(getDatabase, printKot, user, body) {
  if (typeof printKot !== 'function') {
    throw createHttpError(500, 'KOT printing is not available on this server');
  }

  const printerProfileId = String(body?.printerProfileId || '').trim();
  const values = getSnapshotValues(getDatabase);
  const printerProfiles = normalizePrinterProfiles(readStoredJson(values, 'printer-profiles', []));
  const profile = printerProfiles.find((printerProfile) => printerProfile.id === printerProfileId) || printerProfiles[0];

  if (!profile) {
    throw createHttpError(400, 'Printer profile not found');
  }

  const result = saveMobileOrderToDatabase(getDatabase, user, { ...body, status: 'unclosed' }, 'unclosed');
  await printKot({
    settings: profile.settings,
    kot: {
      billNo: result.order.billNo,
      station: profile.name,
      orderType: result.order.orderType,
      table: result.order.table,
      customer: result.order.customer,
      cashier: user.name,
      items: result.order.cart.map((line) => ({
        name: line.name,
        qty: line.qty,
        description: line.description || '',
      })),
      createdAt: new Date().toISOString(),
    },
  });

  return {
    ok: true,
    order: result.order,
    printerProfile: {
      id: profile.id,
      name: profile.name,
    },
  };
}

function saveMobileOrderToDatabase(getDatabase, user, body, status) {
  const database = getDatabase?.();

  if (!database?.setValue) {
    throw createHttpError(500, 'Local SQLite database is not writable');
  }

  const values = getSnapshotValues(getDatabase);
  const orders = normalizeSavedOrders(readStoredJson(values, 'pos-orders', []));
  const menuItems = normalizeMenuItems(readStoredJson(values, 'pos-menu-items', []));
  const businessProfile = normalizeBusinessProfile(readStoredJson(values, 'pos-business-profile', {}), { getName: () => 'GI POS Restaurant' });
  const orderId = String(body?.orderId || '').trim() || createOrderId();
  const existingOrder = orders.find((order) => order.id === orderId);
  const orderType = normalizeOrderType(body?.orderType);
  const seatingMode = body?.seatingMode === 'group' ? 'group' : 'individual';
  const selectedTables = parseDiningTableNames(body?.tables || body?.table);
  const tableLabel = getSeatingDisplayLabel(seatingMode, body?.table, selectedTables, body?.diningGroupName);
  const cart = normalizeMobileCartLines(body?.cart || [], menuItems, businessProfile.defaultGstRate);

  if (!cart.length) {
    throw createHttpError(400, 'Add items before saving order');
  }

  if (orderType === 'Dining' && !tableLabel) {
    throw createHttpError(400, seatingMode === 'group' ? 'Select two or more tables' : 'Select table');
  }

  const now = new Date().toISOString();
  const totals = buildTotals(cart, businessProfile);
  const order = {
    id: orderId,
    billNo: existingOrder?.billNo || String(body?.billNo || '').trim() || getNextBillNumber(orders),
    status,
    orderType,
    table: tableLabel,
    seatingMode,
    tables: selectedTables,
    diningGroupName: seatingMode === 'group' ? String(body?.diningGroupName || '').trim() : '',
    customerId: undefined,
    customer: '',
    cart,
    discountMode: 'percent',
    discountPercent: 0,
    discountAmount: 0,
    servicePercent: 0,
    paymentMethod: 'Cash',
    paymentBreakdown: {
      cash: 0,
      upi: 0,
      card: 0,
    },
    amountReceived: 0,
    totals,
    creditApplied: existingOrder?.creditApplied || false,
    createdAt: existingOrder?.createdAt || now,
    updatedAt: now,
    source: 'lan-pos',
    sourceUserId: user.id,
    sourceUserName: user.name,
  };
  const nextOrders = [order, ...orders.filter((savedOrder) => savedOrder.id !== orderId)];
  database.setValue('pos-orders', JSON.stringify(nextOrders));

  return {
    order,
    openOrders: nextOrders.filter((savedOrder) => savedOrder.status !== 'paid').length,
  };
}

function saveQrOrderToDatabase(getDatabase, body) {
  const database = getDatabase?.();

  if (!database?.setValue) {
    throw createHttpError(500, 'Local SQLite database is not writable');
  }

  const values = getSnapshotValues(getDatabase);
  const diningTableGroups = normalizeDiningTableGroups(readStoredJson(values, 'pos-dining-table-groups', []));
  const requestedTable = parseDiningTableNames(body?.table)[0] || '';
  const table = findDiningTable(requestedTable, diningTableGroups);

  if (!table) {
    throw createHttpError(400, requestedTable ? `Table ${requestedTable} is not available` : 'Table is required');
  }

  const menuItems = normalizeMenuItems(readStoredJson(values, 'pos-menu-items', [])).filter((item) => item.price > 0);
  const businessProfile = normalizeBusinessProfile(readStoredJson(values, 'pos-business-profile', {}), { getName: () => 'GI POS Restaurant' });
  const cart = normalizeMobileCartLines(body?.cart || [], menuItems, businessProfile.defaultGstRate);

  if (!cart.length) {
    throw createHttpError(400, 'Add items before sending order');
  }

  const orders = normalizeQrOrders(readStoredJson(values, 'pos-qr-orders', []));
  const now = new Date().toISOString();
  const customerName = String(body?.customerName || '').trim().slice(0, 80);
  const customerPhone = String(body?.customerPhone || '').trim().slice(0, 30);
  const note = String(body?.note || '').trim().slice(0, 240);
  const existingPendingOrder = orders.find(
    (order) => order.status === 'pending' && String(order.table || '').toLowerCase() === table.toLowerCase(),
  );
  const id = existingPendingOrder?.id || createOrderId('qr-order');
  const shortId = existingPendingOrder?.shortId || id.slice(-6).toUpperCase();
  const mergedCart = existingPendingOrder ? mergeQrCartLines(existingPendingOrder.cart, cart) : cart;
  const order = {
    id,
    shortId,
    status: 'pending',
    source: 'table-qr',
    table,
    tables: [table],
    customerName: existingPendingOrder?.customerName || customerName,
    customerPhone: existingPendingOrder?.customerPhone || customerPhone,
    note: mergeQrOrderNotes(existingPendingOrder?.note, note),
    cart: mergedCart,
    totals: buildTotals(mergedCart, businessProfile),
    createdAt: existingPendingOrder?.createdAt || now,
    updatedAt: now,
  };
  const nextOrders = [order, ...orders.filter((savedOrder) => savedOrder.id !== order.id)].slice(0, 200);
  database.setValue('pos-qr-orders', JSON.stringify(nextOrders));

  return {
    ok: true,
    merged: Boolean(existingPendingOrder),
    order: {
      id: order.id,
      shortId: order.shortId,
      status: order.status,
      table: order.table,
      total: order.totals.total,
      itemCount: order.cart.reduce((sum, line) => sum + Number(line.qty || 0), 0),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
    pending: nextOrders.filter((savedOrder) => savedOrder.status === 'pending').length,
  };
}

function mergeQrCartLines(baseCart = [], incomingCart = []) {
  const merged = normalizeCartLines(baseCart).map((line) => ({ ...line }));

  normalizeCartLines(incomingCart).forEach((incomingLine) => {
    const existingLine = merged.find(
      (line) =>
        line.itemId === incomingLine.itemId &&
        line.price === incomingLine.price &&
        line.taxRate === incomingLine.taxRate &&
        String(line.description || '') === String(incomingLine.description || ''),
    );

    if (existingLine) {
      existingLine.qty = roundMoney(existingLine.qty + incomingLine.qty);
      return;
    }

    merged.push(incomingLine);
  });

  return merged;
}

function mergeQrOrderNotes(existingNote, nextNote) {
  const notes = [existingNote, nextNote].map((note) => String(note || '').trim()).filter(Boolean);
  const uniqueNotes = [];
  const seen = new Set();

  for (const note of notes) {
    const key = note.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueNotes.push(note);
    }
  }

  return uniqueNotes.join(' / ').slice(0, 240);
}

function signMobileSession(userId, sessionSecret) {
  const payload = Buffer.from(JSON.stringify({ userId, iat: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyMobileSession(getDatabase, request, sessionSecret) {
  const authHeader = String(request.headers.authorization || '');
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const [payloadText, signature] = token.split('.');

  if (!payloadText || !signature) {
    throw createHttpError(401, 'Login required');
  }

  const expectedSignature = crypto.createHmac('sha256', sessionSecret).update(payloadText).digest('base64url');
  if (!safeEqualText(signature, expectedSignature)) {
    throw createHttpError(401, 'Invalid login session');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadText, 'base64url').toString('utf8'));
  } catch {
    throw createHttpError(401, 'Invalid login session');
  }

  const maxAgeMs = 24 * 60 * 60 * 1000;
  if (!payload?.userId || Date.now() - Number(payload.iat || 0) > maxAgeMs) {
    throw createHttpError(401, 'Login session expired');
  }

  const users = normalizeStaffUsers(readStoredJson(getSnapshotValues(getDatabase), 'pos-staff-users', []));
  const user = users.find((candidate) => candidate.id === String(payload.userId));
  if (!user || !user.active || !user.permissions.includes('pos_access')) {
    throw createHttpError(403, 'POS permission is required');
  }

  return user;
}

function verifyPin(pin, salt, expectedHash) {
  const hash = crypto.createHash('sha256').update(`${salt}:${pin}`).digest('hex');

  if (!/^[a-f0-9]{64}$/i.test(expectedHash) || hash.length !== expectedHash.length) {
    return false;
  }

  return safeEqualBuffer(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function safeEqualText(first, second) {
  return safeEqualBuffer(Buffer.from(String(first)), Buffer.from(String(second)));
}

function safeEqualBuffer(first, second) {
  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getStoppedStatus() {
  return {
    enabled: false,
    port: preferredPort,
    host: '0.0.0.0',
    appName: 'GI POS Restaurant',
    version: '',
    computerName: os.hostname(),
    urls: [],
    primaryUrl: `http://127.0.0.1:${preferredPort}`,
    startedAt: '',
    error: 'LAN server not available',
    dbPath: '',
  };
}

module.exports = {
  createLanServer,
  registerLanServerHandlers,
};
