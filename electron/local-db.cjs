const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const initSqlJs = require('sql.js');

const DB_FILE_NAME = 'gi-pos-local.sqlite';
const SYNCABLE_KV_KEYS = new Set([
  'pos-business-profile',
  'pos-categories',
  'pos-customers',
  'pos-expenses',
  'pos-menu-items',
  'pos-orders',
  'pos-staff-users',
  'pos-staff-user-directory',
]);

async function createLocalDatabase(app) {
  const dataDir = path.join(app.getPath('userData'), 'data');
  const dbPath = path.join(dataDir, DB_FILE_NAME);
  fs.mkdirSync(dataDir, { recursive: true });

  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });
  const db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();

  db.run(`
    PRAGMA user_version = 1;

    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_id TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );
  `);

  persistDatabase(db, dbPath);

  return {
    path: dbPath,
    getSnapshot() {
      const values = {};
      const result = db.exec('SELECT key, value FROM app_kv ORDER BY key');

      if (result[0]) {
        for (const row of result[0].values) {
          values[String(row[0])] = String(row[1] ?? '');
        }
      }

      return {
        engine: 'sqlite',
        path: dbPath,
        values,
      };
    },
    setValue(key, value) {
      const now = new Date().toISOString();
      const payload = JSON.stringify({ key, value, updatedAt: now });
      db.run(
        `
          INSERT INTO app_kv (key, value, updated_at, sync_status)
          VALUES (?, ?, ?, 'pending')
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at,
            sync_status = 'pending'
        `,
        [key, value, now],
      );
      if (shouldSyncKey(key)) {
        insertOutboxEvent(db, 'app_kv', key, 'upsert', payload, now);
      }
      persistDatabase(db, dbPath);

      return { ok: true, key, updatedAt: now };
    },
    setMany(entries) {
      const now = new Date().toISOString();
      db.run('BEGIN TRANSACTION');

      try {
        const statement = db.prepare(`
          INSERT INTO app_kv (key, value, updated_at, sync_status)
          VALUES (?, ?, ?, 'pending')
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at,
            sync_status = 'pending'
        `);

        for (const entry of entries) {
          statement.run([entry.key, entry.value, now]);
          if (shouldSyncKey(entry.key)) {
            insertOutboxEvent(
              db,
              'app_kv',
              entry.key,
              'upsert',
              JSON.stringify({ key: entry.key, value: entry.value, updatedAt: now }),
              now,
            );
          }
        }

        statement.free();
        db.run('COMMIT');
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }

      persistDatabase(db, dbPath);

      return { ok: true, count: entries.length, updatedAt: now };
    },
    applyRemoteValues(entries) {
      const cleanEntries = Array.isArray(entries)
        ? entries.filter((entry) => entry && typeof entry.key === 'string')
        : [];
      if (!cleanEntries.length) {
        return { ok: true, count: 0, updatedAt: new Date().toISOString() };
      }

      const now = new Date().toISOString();
      db.run('BEGIN TRANSACTION');

      try {
        const statement = db.prepare(`
          INSERT INTO app_kv (key, value, updated_at, sync_status)
          VALUES (?, ?, ?, 'synced')
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at,
            sync_status = 'synced'
        `);

        for (const entry of cleanEntries) {
          statement.run([entry.key, String(entry.value ?? ''), entry.updatedAt || now]);
        }

        statement.free();
        db.run('COMMIT');
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }

      persistDatabase(db, dbPath);

      return { ok: true, count: cleanEntries.length, updatedAt: now };
    },
    getPendingSync(limit = 100) {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 500));
      const statement = db.prepare(`
        SELECT id, entity_type, entity_id, operation, payload, created_at
        FROM sync_outbox
        WHERE synced_at IS NULL
        ORDER BY created_at ASC
        LIMIT ?
      `);
      statement.bind([safeLimit]);
      const changes = [];

      while (statement.step()) {
        const row = statement.getAsObject();
        changes.push({
          id: String(row.id),
          entityType: String(row.entity_type),
          entityId: String(row.entity_id),
          operation: String(row.operation),
          payload: parseJson(row.payload, {}),
          createdAt: String(row.created_at),
        });
      }

      statement.free();

      return { ok: true, changes };
    },
    markSynced(ids) {
      const syncIds = Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];
      if (!syncIds.length) {
        return { ok: true, count: 0, updatedAt: new Date().toISOString() };
      }

      const now = new Date().toISOString();
      const placeholders = syncIds.map(() => '?').join(', ');
      db.run(`UPDATE sync_outbox SET synced_at = ? WHERE id IN (${placeholders})`, [now, ...syncIds]);
      persistDatabase(db, dbPath);

      return { ok: true, count: syncIds.length, updatedAt: now };
    },
    clearPendingSync() {
      const now = new Date().toISOString();
      db.run('UPDATE sync_outbox SET synced_at = ? WHERE synced_at IS NULL', [now]);
      persistDatabase(db, dbPath);

      return { ok: true, updatedAt: now };
    },
    resetAll() {
      const now = new Date().toISOString();
      db.run('BEGIN TRANSACTION');

      try {
        db.run('DELETE FROM sync_outbox');
        db.run('DELETE FROM app_kv');
        db.run('COMMIT');
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }

      persistDatabase(db, dbPath);

      return { ok: true, updatedAt: now };
    },
    close() {
      persistDatabase(db, dbPath);
      db.close();
    },
  };
}

function persistDatabase(db, dbPath) {
  const data = Buffer.from(db.export());
  fs.writeFileSync(dbPath, data);
}

function insertOutboxEvent(db, entityType, entityId, operation, payload, createdAt) {
  db.run(
    `
      INSERT INTO sync_outbox (id, entity_type, entity_id, operation, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [crypto.randomUUID(), entityType, entityId, operation, payload, createdAt],
  );
}

function shouldSyncKey(key) {
  return SYNCABLE_KV_KEYS.has(key);
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(String(value ?? ''));
  } catch {
    return fallback;
  }
}

function registerLocalDatabaseHandlers(ipcMain, getDatabase) {
  ipcMain.handle('db:load', async () => getDatabase().getSnapshot());
  ipcMain.handle('db:set', async (_event, key, value) => getDatabase().setValue(String(key), String(value ?? '')));
  ipcMain.handle('db:set-many', async (_event, entries) => {
    const cleanEntries = Array.isArray(entries)
      ? entries
          .filter((entry) => entry && typeof entry.key === 'string')
          .map((entry) => ({ key: entry.key, value: String(entry.value ?? '') }))
      : [];

    return getDatabase().setMany(cleanEntries);
  });
  ipcMain.handle('db:sync-pending', async (_event, limit) => getDatabase().getPendingSync(limit));
  ipcMain.handle('db:sync-mark-synced', async (_event, ids) => getDatabase().markSynced(ids));
  ipcMain.handle('db:sync-clear-pending', async () => getDatabase().clearPendingSync());
  ipcMain.handle('db:apply-remote-values', async (_event, entries) => getDatabase().applyRemoteValues(entries));
  ipcMain.handle('db:reset-all', async () => getDatabase().resetAll());
}

module.exports = {
  createLocalDatabase,
  registerLocalDatabaseHandlers,
};
