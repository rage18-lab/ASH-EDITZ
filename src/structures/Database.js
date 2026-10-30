'use strict';
// ─── Database.js – sql.js (pure WASM) replacement for better-sqlite3 ──────────
//
// Why sql.js?  better-sqlite3 is a native C++ addon that needs node-gyp to
// compile.  The bot-hosting environment blocks npm install scripts so the
// pre-built binary is never downloaded and node-gyp is not in PATH.
// sql.js is a pure JS/WASM port of SQLite that ships pre-compiled, requires
// zero build tools, and reads/writes the same .db file format.
//
// Usage:
//   const { initDatabase } = require('./Database');
//   await initDatabase();          // call ONCE before any DB access
//   const db = require('./Database'); // then require returns the managers object
//
// NOTE: Each cluster/shard child loads the database file into its own memory.
// For a bot with a single cluster (the default) this is not a problem.
// ─────────────────────────────────────────────────────────────────────────────

const initSqlJs = require('sql.js');
const fs   = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'database.db');

/** @type {import('sql.js').Database | null} */
let db        = null;
let isDirty   = false;
let _saveTimer = null;

// ── Persistence ───────────────────────────────────────────────────────────────

function markDirty() { isDirty = true; }

function saveDatabase() {
    if (!db || !isDirty) return;
    try {
        const data = db.export();
        fs.writeFileSync(dbPath, Buffer.from(data));
        isDirty = false;
    } catch (e) {
        console.error('[Database] Save error:', e.message);
    }
}

// ── Synchronous query helpers ─────────────────────────────────────────────────
// These wrap sql.js's statement API to match the better-sqlite3 calling style
// that the rest of the codebase expects.

/** Returns one row as a plain object, or undefined. */
function sqlGet(sql, params = []) {
    const stmt = db.prepare(sql);
    try {
        if (params.length) stmt.bind(params);
        return stmt.step() ? stmt.getAsObject() : undefined;
    } finally {
        stmt.free();
    }
}

/** Returns all matching rows as an array of plain objects. */
function sqlAll(sql, params = []) {
    const stmt = db.prepare(sql);
    const rows = [];
    try {
        if (params.length) stmt.bind(params);
        while (stmt.step()) rows.push(stmt.getAsObject());
        return rows;
    } finally {
        stmt.free();
    }
}

/** Executes a write statement (INSERT / UPDATE / DELETE / DDL). */
function sqlRun(sql, params = []) {
    db.run(sql, params);
    markDirty();
}

// ── Serialisation helpers ─────────────────────────────────────────────────────

const serialize   = (data) => JSON.stringify(data);
const deserialize = (data, fallback = []) => {
    try {
        if (!data) return fallback;
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch { return fallback; }
};

// ── Manager objects (populated by initDatabase) ───────────────────────────────
const managers = {};

// ── Generic manager factory ───────────────────────────────────────────────────

function createManager(tableName, primaryKey = 'id') {
    return {
        get: (pkValue) =>
            sqlGet(`SELECT * FROM ${tableName} WHERE ${primaryKey} = ?`, [pkValue]),

        set: (pkValue, data) => {
            const updates = [];
            const params  = [];
            for (const key in data) {
                if (key === primaryKey) continue;
                updates.push(`${key} = ?`);
                let val = data[key];
                if (typeof val === 'object' && val !== null) val = serialize(val);
                params.push(val);
            }
            const exists = sqlGet(`SELECT 1 FROM ${tableName} WHERE ${primaryKey} = ?`, [pkValue]);
            if (exists) {
                params.push(pkValue);
                sqlRun(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${primaryKey} = ?`, params);
            } else {
                const keys = [primaryKey, ...Object.keys(data).filter(k => k !== primaryKey)];
                const vals = keys.map(k => {
                    let v = k === primaryKey ? pkValue : data[k];
                    if (typeof v === 'object' && v !== null) v = serialize(v);
                    return v;
                });
                sqlRun(
                    `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
                    vals
                );
            }
        },

        delete: (pkValue) =>
            sqlRun(`DELETE FROM ${tableName} WHERE ${primaryKey} = ?`, [pkValue]),

        getAll: () => sqlAll(`SELECT * FROM ${tableName}`)
    };
}

// ── Build all managers (called once after DB is ready) ────────────────────────

function _buildManagers() {

    // ── profiles ──────────────────────────────────────────────────────────────
    managers.profiles = {
        get: (userId) => {
            const row = sqlGet('SELECT * FROM profiles WHERE userId = ?', [userId]);
            if (!row) return null;
            return {
                ...row,
                badges:          deserialize(row.badges),
                friends:         deserialize(row.friends),
                deniedCommands:  deserialize(row.deniedCommands),
                allowedCommands: deserialize(row.allowedCommands)
            };
        },
        set: (userId, data) => {
            const updates = [];
            const params  = [];
            for (const key in data) {
                if (key === 'userId') continue;
                updates.push(`${key} = ?`);
                let val = data[key];
                if (['badges','friends','deniedCommands','allowedCommands'].includes(key)) val = serialize(val);
                params.push(val);
            }
            const exists = sqlGet('SELECT 1 FROM profiles WHERE userId = ?', [userId]);
            if (exists) {
                params.push(userId);
                sqlRun(`UPDATE profiles SET ${updates.join(', ')} WHERE userId = ?`, params);
            } else {
                const keys = ['userId', ...Object.keys(data).filter(k => k !== 'userId')];
                const vals = keys.map(k => {
                    let v = k === 'userId' ? userId : data[k];
                    if (['badges','friends','deniedCommands','allowedCommands'].includes(k)) v = serialize(v || []);
                    return v;
                });
                sqlRun(
                    `INSERT INTO profiles (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
                    vals
                );
            }
        }
    };

    // ── liked ─────────────────────────────────────────────────────────────────
    managers.liked = {
        get: (userId) => {
            const row = sqlGet('SELECT * FROM liked WHERE userId = ?', [userId]);
            return row ? deserialize(row.songs) : [];
        },
        set: (userId, songs) =>
            sqlRun('INSERT OR REPLACE INTO liked (userId, songs) VALUES (?, ?)', [userId, serialize(songs)])
    };

    // ── noprefix ──────────────────────────────────────────────────────────────
    managers.noprefix = {
        get: (userId, guildId = 'GLOBAL') => {
            const row = sqlGet('SELECT * FROM noprefix WHERE userId = ? AND guildId = ?', [userId, guildId]);
            if (!row) return null;
            return { ...row, noprefix: !!row.noprefix };
        },
        set: (userId, guildId, status, expiresAt = null) =>
            sqlRun(
                'INSERT OR REPLACE INTO noprefix (userId, guildId, noprefix, expiresAt) VALUES (?, ?, ?, ?)',
                [userId, guildId, status ? 1 : 0, expiresAt]
            ),
        find: (filter = {}) => {
            let sql = 'SELECT * FROM noprefix';
            const params = [];
            const conditions = [];
            for (const key in filter) {
                conditions.push(`${key} = ?`);
                params.push(typeof filter[key] === 'boolean' ? (filter[key] ? 1 : 0) : filter[key]);
            }
            if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
            return sqlAll(sql, params).map(row => ({ ...row, noprefix: !!row.noprefix }));
        },
        findOne: (filter = {}) => {
            let sql = 'SELECT * FROM noprefix';
            const params = [];
            const conditions = [];
            for (const key in filter) {
                conditions.push(`${key} = ?`);
                params.push(typeof filter[key] === 'boolean' ? (filter[key] ? 1 : 0) : filter[key]);
            }
            if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
            const row = sqlGet(sql, params);
            if (!row) return null;
            return { ...row, noprefix: !!row.noprefix };
        },
        create: (data) => {
            const keys = Object.keys(data);
            const vals = keys.map(k =>
                typeof data[k] === 'boolean' ? (data[k] ? 1 : 0)
                    : data[k] instanceof Date ? data[k].toISOString()
                    : data[k]
            );
            sqlRun(
                `INSERT INTO noprefix (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
                vals
            );
        },
        updateOne: (filter, data) => {
            const updates   = [];
            const params    = [];
            for (const key in data) {
                updates.push(`${key} = ?`);
                params.push(
                    typeof data[key] === 'boolean' ? (data[key] ? 1 : 0)
                        : data[key] instanceof Date ? data[key].toISOString()
                        : data[key]
                );
            }
            const conditions = [];
            for (const key in filter) {
                conditions.push(`${key} = ?`);
                params.push(typeof filter[key] === 'boolean' ? (filter[key] ? 1 : 0) : filter[key]);
            }
            let sql = `UPDATE noprefix SET ${updates.join(', ')}`;
            if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
            sqlRun(sql, params);
        },
        deleteOne: (filter) => {
            let sql = 'DELETE FROM noprefix';
            const params = [];
            const conditions = [];
            for (const key in filter) {
                conditions.push(`${key} = ?`);
                params.push(typeof filter[key] === 'boolean' ? (filter[key] ? 1 : 0) : filter[key]);
            }
            if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
            sqlRun(sql, params);
        },
        deleteMany: (filter) => {
            let sql = 'DELETE FROM noprefix';
            const params = [];
            const conditions = [];
            for (const key in filter) {
                conditions.push(`${key} = ?`);
                params.push(typeof filter[key] === 'boolean' ? (filter[key] ? 1 : 0) : filter[key]);
            }
            if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
            sqlRun(sql, params);
            return { deletedCount: db.getRowsModified() };
        },
        findExpired: (now) =>
            sqlAll('SELECT * FROM noprefix WHERE expiresAt IS NOT NULL AND expiresAt < ?', [now]),
        delete: (id) => sqlRun('DELETE FROM noprefix WHERE id = ?', [id]),
        getGlobal: (userId) => {
            const row = sqlGet(
                'SELECT * FROM noprefix WHERE userId = ? AND guildId = ? AND noprefix = 1',
                [userId, 'GLOBAL']
            );
            if (!row) return null;
            if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
                sqlRun('DELETE FROM noprefix WHERE id = ?', [row.id]);
                return null;
            }
            return { ...row, noprefix: !!row.noprefix };
        }
    };

    // ── blacklist / prefixes ──────────────────────────────────────────────────
    managers.blacklist = createManager('blacklist', 'userId');
    managers.prefixes  = createManager('prefixes',  'guildId');

    // ── ignorechannels ────────────────────────────────────────────────────────
    managers.ignorechannels = {
        get:           (guildId, channelId) =>
            sqlGet('SELECT 1 FROM ignorechannels WHERE guildId = ? AND channelId = ?', [guildId, channelId]),
        getForGuild:   (guildId) =>
            sqlAll('SELECT * FROM ignorechannels WHERE guildId = ?', [guildId]),
        add:           (guildId, channelId) =>
            sqlRun('INSERT OR IGNORE INTO ignorechannels (guildId, channelId) VALUES (?, ?)', [guildId, channelId]),
        remove:        (guildId, channelId) =>
            sqlRun('DELETE FROM ignorechannels WHERE guildId = ? AND channelId = ?', [guildId, channelId]),
        deleteForGuild:(guildId) =>
            sqlRun('DELETE FROM ignorechannels WHERE guildId = ?', [guildId])
    };

    // ── simple generic managers ───────────────────────────────────────────────
    managers.userpreferences = createManager('userpreferences', 'userId');
    managers.setup           = createManager('setup',           'guildId');
    managers.twofourseven    = createManager('twofourseven',    'guildId');

    // ── autorole ──────────────────────────────────────────────────────────────
    managers.autorole = {
        get: (guildId) => {
            const row = sqlGet('SELECT * FROM autorole WHERE guildId = ?', [guildId]);
            if (!row) return null;
            return { ...row, roles: deserialize(row.roles) };
        },
        set:    (guildId, roles) =>
            sqlRun('INSERT OR REPLACE INTO autorole (guildId, roles) VALUES (?, ?)', [guildId, serialize(roles)]),
        delete: (guildId) =>
            sqlRun('DELETE FROM autorole WHERE guildId = ?', [guildId])
    };

    // ── voicerole / vcstatus / reboot ─────────────────────────────────────────
    managers.voicerole = createManager('voicerole', 'guildId');
    managers.vcstatus  = createManager('vcstatus',  'guildId');
    managers.reboot    = createManager('reboot',    'id');

    // ── musicStats ────────────────────────────────────────────────────────────
    managers.musicStats = {
        get: (userId) =>
            sqlGet('SELECT * FROM music_stats WHERE userId = ?', [userId])
            || { userId, songsPlayed: 0, lastSong: '' },
        increment: (userId, songTitle = '') => {
            const exists = sqlGet('SELECT 1 FROM music_stats WHERE userId = ?', [userId]);
            if (exists) {
                sqlRun('UPDATE music_stats SET songsPlayed = songsPlayed + 1, lastSong = ? WHERE userId = ?',
                    [songTitle, userId]);
            } else {
                sqlRun('INSERT INTO music_stats (userId, songsPlayed, lastSong) VALUES (?, 1, ?)',
                    [userId, songTitle]);
            }
        },
        getTopUsers: (limit = 10) =>
            sqlAll('SELECT * FROM music_stats ORDER BY songsPlayed DESC LIMIT ?', [limit])
    };

    // ── rankPermissions ───────────────────────────────────────────────────────
    managers.rankPermissions = {
        get: (rank) => {
            const row = sqlGet('SELECT * FROM rankPermissions WHERE rank = ?', [rank]);
            if (!row) return { rank, allowedCommands: [], deniedCommands: [] };
            return {
                ...row,
                allowedCommands: deserialize(row.allowedCommands),
                deniedCommands:  deserialize(row.deniedCommands)
            };
        },
        set: (rank, data) => {
            const updates = [];
            const params  = [];
            for (const key in data) {
                if (key === 'rank') continue;
                updates.push(`${key} = ?`);
                let val = data[key];
                if (['allowedCommands','deniedCommands'].includes(key)) val = serialize(val);
                params.push(val);
            }
            const exists = sqlGet('SELECT 1 FROM rankPermissions WHERE rank = ?', [rank]);
            if (exists) {
                params.push(rank);
                sqlRun(`UPDATE rankPermissions SET ${updates.join(', ')} WHERE rank = ?`, params);
            } else {
                const keys = ['rank', ...Object.keys(data).filter(k => k !== 'rank')];
                const vals = keys.map(k => {
                    let v = k === 'rank' ? rank : data[k];
                    if (['allowedCommands','deniedCommands'].includes(k)) v = serialize(v || []);
                    return v;
                });
                sqlRun(
                    `INSERT INTO rankPermissions (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
                    vals
                );
            }
        },
        deleteMany: (customSql = 'DELETE FROM rankPermissions', params = []) =>
            sqlRun(customSql, params)
    };
}

// ── Async init ────────────────────────────────────────────────────────────────

async function initDatabase() {
    if (db) return managers; // idempotent

    const SQL = await initSqlJs();

    // Load existing database file or create a new one
    const fileBuffer = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : null;
    db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

    // ── PRAGMAs ───────────────────────────────────────────────────────────────
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
    db.run('PRAGMA cache_size = -32000');
    db.run('PRAGMA temp_store = MEMORY');

    // ── Table creation ────────────────────────────────────────────────────────
    const tables = [
        {
            name: 'profiles',
            schema: `
                userId TEXT PRIMARY KEY,
                bio TEXT DEFAULT 'No bio set',
                badges TEXT DEFAULT '[]',
                friends TEXT DEFAULT '[]',
                marry TEXT DEFAULT 'None',
                rank TEXT DEFAULT 'User',
                deniedCommands TEXT DEFAULT '[]',
                allowedCommands TEXT DEFAULT '[]'
            `
        },
        { name: 'liked',           schema: `userId TEXT PRIMARY KEY, songs TEXT DEFAULT '[]'` },
        {
            name: 'noprefix',
            schema: `
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT,
                guildId TEXT,
                noprefix INTEGER DEFAULT 0,
                expiresAt TEXT
            `
        },
        {
            name: 'blacklist',
            schema: `userId TEXT PRIMARY KEY, reason TEXT DEFAULT 'No reason provided', developer TEXT`
        },
        { name: 'prefixes',        schema: `guildId TEXT PRIMARY KEY, prefix TEXT` },
        {
            name: 'rankPermissions',
            schema: `rank TEXT PRIMARY KEY, allowedCommands TEXT DEFAULT '[]', deniedCommands TEXT DEFAULT '[]'`
        },
        {
            name: 'ignorechannels',
            schema: `guildId TEXT, channelId TEXT, PRIMARY KEY (guildId, channelId)`
        },
        { name: 'userpreferences', schema: `userId TEXT PRIMARY KEY, musicSource TEXT DEFAULT 'ytmsearch'` },
        {
            name: 'setup',
            schema: `guildId TEXT PRIMARY KEY, channelId TEXT, messageId TEXT, voiceChannelId TEXT`
        },
        { name: 'twofourseven',    schema: `guildId TEXT PRIMARY KEY, textId TEXT, voiceId TEXT` },
        { name: 'autorole',        schema: `guildId TEXT PRIMARY KEY, roles TEXT DEFAULT '[]'` },
        { name: 'voicerole',       schema: `guildId TEXT PRIMARY KEY, roleId TEXT, voiceChannelId TEXT` },
        { name: 'vcstatus',        schema: `guildId TEXT PRIMARY KEY, status TEXT` },
        { name: 'reboot',          schema: `id TEXT PRIMARY KEY, channelId TEXT, messageId TEXT, guildId TEXT` },
        {
            name: 'music_stats',
            schema: `userId TEXT PRIMARY KEY, songsPlayed INTEGER DEFAULT 0, lastSong TEXT DEFAULT ''`
        }
    ];

    tables.forEach(table => {
        db.run(`CREATE TABLE IF NOT EXISTS ${table.name} (${table.schema})`);

        // Online migrations ────────────────────────────────────────────────────
        if (table.name === 'profiles') {
            const cols      = sqlAll('PRAGMA table_info(profiles)');
            const colNames  = cols.map(c => c.name);
            ['rank', 'deniedCommands', 'allowedCommands'].forEach(col => {
                if (!colNames.includes(col)) {
                    const type = col === 'rank' ? 'TEXT DEFAULT "User"' : 'TEXT DEFAULT "[]"';
                    db.run(`ALTER TABLE profiles ADD COLUMN ${col} ${type}`);
                }
            });
        }

        if (table.name === 'reboot') {
            const cols     = sqlAll('PRAGMA table_info(reboot)');
            const colNames = cols.map(c => c.name);
            if (!colNames.includes('guildId')) {
                db.run('ALTER TABLE reboot ADD COLUMN guildId TEXT');
            }
        }
    });

    // ── Indexes ───────────────────────────────────────────────────────────────
    [
        'CREATE INDEX IF NOT EXISTS idx_profiles_userId          ON profiles(userId)',
        'CREATE INDEX IF NOT EXISTS idx_liked_userId             ON liked(userId)',
        'CREATE INDEX IF NOT EXISTS idx_noprefix_userId_guildId  ON noprefix(userId, guildId)',
        'CREATE INDEX IF NOT EXISTS idx_blacklist_userId         ON blacklist(userId)',
        'CREATE INDEX IF NOT EXISTS idx_prefixes_guildId         ON prefixes(guildId)',
        'CREATE INDEX IF NOT EXISTS idx_ignorechannels_guildId   ON ignorechannels(guildId)',
        'CREATE INDEX IF NOT EXISTS idx_userpreferences_userId   ON userpreferences(userId)',
        'CREATE INDEX IF NOT EXISTS idx_setup_guildId            ON setup(guildId)',
        'CREATE INDEX IF NOT EXISTS idx_twofourseven_guildId     ON twofourseven(guildId)',
        'CREATE INDEX IF NOT EXISTS idx_autorole_guildId         ON autorole(guildId)',
        'CREATE INDEX IF NOT EXISTS idx_voicerole_guildId        ON voicerole(guildId)',
        'CREATE INDEX IF NOT EXISTS idx_vcstatus_guildId         ON vcstatus(guildId)'
    ].forEach(idx => db.run(idx));

    // Flush any DDL changes immediately
    saveDatabase();

    // ── Auto-save every 5 seconds (non-blocking) ──────────────────────────────
    _saveTimer = setInterval(saveDatabase, 5_000);
    if (_saveTimer.unref) _saveTimer.unref();

    // ── Graceful shutdown saves ───────────────────────────────────────────────
    let _shuttingDown = false;
    const shutdown = () => {
        if (_shuttingDown) return;
        _shuttingDown = true;
        if (_saveTimer) { clearInterval(_saveTimer); _saveTimer = null; }
        saveDatabase();
    };
    process.once('exit',    shutdown);
    process.once('SIGINT',  () => { shutdown(); process.exit(0); });
    process.once('SIGTERM', () => { shutdown(); process.exit(0); });

    // ── Populate all manager objects ──────────────────────────────────────────
    _buildManagers();

    console.log('[Database] sql.js SQLite ready →', dbPath);
    return managers;
}

// ── Exports ───────────────────────────────────────────────────────────────────
// `managers` is populated in-place by initDatabase(), so any code that does
// `const db = require('./Database')` after initDatabase() resolves will see
// all the manager properties on the same object reference.

module.exports              = managers;
module.exports.initDatabase = initDatabase;
