const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const initSqlJs = require('sql.js');

const DB_FILE_NAME = 'gi-pos-local.sqlite';
const DATA_DIR_NAME = 'GIPOS Restaurant';
const BACKUP_DIR_NAME = 'Backups';
const MAX_AUTO_BACKUPS = 8;
const MAX_MANUAL_BACKUPS = 10;
const AUTO_BACKUP_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;
const SYNCABLE_KV_KEYS = new Set([
  'pos-business-profile',
  'pos-categories',
  'pos-customers',
  'pos-expenses',
  'pos-menu-items',
  'pos-opening-cash-balances',
  'pos-orders',
  'pos-staff-users',
  'pos-staff-user-directory',
]);

async function createLocalDatabase(app) {
  const dataDir = getPersistentDataDir(app);
  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);
  const dbPath = path.join(dataDir, DB_FILE_NAME);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
  migrateLegacyDatabase(app, dbPath, backupDir);

  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
  });
  let db = openDatabaseWithBackupFallback(SQL, dbPath, backupDir);

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
  createDatabaseBackup(dbPath, backupDir, 'startup');

  return {
    path: dbPath,
    dataDir,
    backupDir,
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
        dataDir,
        backupDir,
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
      createDatabaseBackup(dbPath, backupDir, 'before-reset');
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
    createBackup() {
      const backup = createDatabaseBackup(dbPath, backupDir, 'manual');
      return { ok: true, path: backup.path, fileName: backup.fileName, updatedAt: new Date().toISOString() };
    },
    listBackups() {
      pruneBackups(backupDir);
      return { ok: true, backups: listDatabaseBackups(backupDir) };
    },
    restoreBackup(fileName) {
      const backupPath = resolveBackupPath(backupDir, fileName);
      if (!backupPath) {
        throw new Error('Backup file not found');
      }

      createDatabaseBackup(dbPath, backupDir, 'before-restore');
      const nextDb = new SQL.Database(fs.readFileSync(backupPath));
      nextDb.run('SELECT name FROM sqlite_master LIMIT 1');
      db.close();
      db = nextDb;
      persistDatabase(db, dbPath);

      return { ok: true, path: dbPath, restoredFrom: backupPath, updatedAt: new Date().toISOString() };
    },
    close() {
      createDatabaseBackup(dbPath, backupDir, 'close');
      persistDatabase(db, dbPath);
      db.close();
    },
  };
}

function persistDatabase(db, dbPath) {
  const data = Buffer.from(db.export());
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const tempPath = `${dbPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, data);
  fs.renameSync(tempPath, dbPath);
}

function getPersistentDataDir(app) {
  if (process.env.GI_POS_DATA_DIR) {
    return path.resolve(process.env.GI_POS_DATA_DIR);
  }

  if (process.platform === 'win32') {
    return path.join('C:\\', DATA_DIR_NAME);
  }

  return path.join(app.getPath('documents'), DATA_DIR_NAME);
}

function migrateLegacyDatabase(app, dbPath, backupDir) {
  if (fs.existsSync(dbPath)) {
    return;
  }

  const legacyPath = path.join(app.getPath('userData'), 'data', DB_FILE_NAME);
  if (!fs.existsSync(legacyPath)) {
    const latestBackup = listDatabaseBackups(backupDir)[0];
    if (latestBackup) {
      fs.copyFileSync(latestBackup.path, dbPath);
    }
    return;
  }

  fs.copyFileSync(legacyPath, dbPath);
  createDatabaseBackup(dbPath, backupDir, 'legacy-migrated');
}

function openDatabaseWithBackupFallback(SQL, dbPath, backupDir) {
  if (fs.existsSync(dbPath)) {
    try {
      return new SQL.Database(fs.readFileSync(dbPath));
    } catch {
      createCorruptCopy(dbPath, backupDir);
    }
  }

  const latestBackup = listDatabaseBackups(backupDir)[0];
  if (latestBackup) {
    fs.copyFileSync(latestBackup.path, dbPath);
    return new SQL.Database(fs.readFileSync(dbPath));
  }

  return new SQL.Database();
}

function createDatabaseBackup(dbPath, backupDir, reason) {
  if (!fs.existsSync(dbPath)) {
    return { path: '', fileName: '' };
  }

  fs.mkdirSync(backupDir, { recursive: true });
  const safeReason = String(reason || 'backup').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const recentBackup = getRecentAutomaticBackup(backupDir, safeReason);

  if (recentBackup) {
    pruneBackups(backupDir);
    return { path: recentBackup.path, fileName: recentBackup.fileName, skipped: true };
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const fileName = `gi-pos-${safeReason}-${stamp}.sqlite`;
  const backupPath = path.join(backupDir, fileName);
  fs.copyFileSync(dbPath, backupPath);
  pruneBackups(backupDir);
  return { path: backupPath, fileName };
}

function getRecentAutomaticBackup(backupDir, reason) {
  if (reason !== 'startup' && reason !== 'close') {
    return null;
  }

  const latestAutoBackup = listDatabaseBackups(backupDir).find(
    (backup) => !isManualBackup(backup.fileName) && !isCorruptBackup(backup.fileName),
  );

  if (!latestAutoBackup) {
    return null;
  }

  const ageMs = Date.now() - new Date(latestAutoBackup.updatedAt).getTime();
  return ageMs >= 0 && ageMs < AUTO_BACKUP_MIN_INTERVAL_MS ? latestAutoBackup : null;
}

function createCorruptCopy(dbPath, backupDir) {
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
    fs.copyFileSync(dbPath, path.join(backupDir, `gi-pos-corrupt-${stamp}.sqlite`));
  } catch {
    // Keep startup moving; the backup fallback handles recovery.
  }
}

function listDatabaseBackups(backupDir) {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs
    .readdirSync(backupDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.sqlite'))
    .map((fileName) => {
      const filePath = path.join(backupDir, fileName);
      const stat = fs.statSync(filePath);
      return {
        fileName,
        path: filePath,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      };
    })
    .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime());
}

function pruneBackups(backupDir) {
  pruneBackupList(
    listDatabaseBackups(backupDir).filter((backup) => !isManualBackup(backup.fileName) && !isCorruptBackup(backup.fileName)),
    MAX_AUTO_BACKUPS,
  );
  pruneBackupList(
    listDatabaseBackups(backupDir).filter((backup) => isManualBackup(backup.fileName)),
    MAX_MANUAL_BACKUPS,
  );
}

function pruneBackupList(backups, maxCount) {
  backups.slice(maxCount).forEach((backup) => {
    try {
      fs.unlinkSync(backup.path);
    } catch {
      // Old backup cleanup is best effort only.
    }
  });
}

function isManualBackup(fileName) {
  return String(fileName || '').toLowerCase().includes('-manual-');
}

function isCorruptBackup(fileName) {
  return String(fileName || '').toLowerCase().includes('-corrupt-');
}

function resolveBackupPath(backupDir, fileName) {
  const safeName = path.basename(String(fileName || ''));
  const backupRoot = path.resolve(backupDir);
  const backupPath = path.resolve(backupRoot, safeName);
  const isInsideBackupDir = backupPath === backupRoot || backupPath.startsWith(`${backupRoot}${path.sep}`);
  return isInsideBackupDir && fs.existsSync(backupPath) ? backupPath : '';
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
  ipcMain.handle('db:backup-create', async () => getDatabase().createBackup());
  ipcMain.handle('db:backup-list', async () => getDatabase().listBackups());
  ipcMain.handle('db:backup-restore', async (_event, fileName) => getDatabase().restoreBackup(String(fileName || '')));
}

module.exports = {
  createLocalDatabase,
  registerLocalDatabaseHandlers,
};
