const BetterSqlite3 = require('better-sqlite3');
const path = require('path');

const db = new BetterSqlite3(path.join(process.cwd(), 'database.db'));


db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -32000');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 1073741824');
db.pragma('page_size = 4096');


const serialize = (data) => JSON.stringify(data);
const deserialize = (data, fallback = []) => {
    try {
        if (!data) return fallback;
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
        return fallback;
    }
};

// Prepared statement cache for performance
const stmtCache = new Map();
const getStatement = (sql) => {
    if (!stmtCache.has(sql)) {
        stmtCache.set(sql, db.prepare(sql));
    }
    return stmtCache.get(sql);
};


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
    {
        name: 'liked',
        schema: `
            userId TEXT PRIMARY KEY,
            songs TEXT DEFAULT '[]'
        `
    },
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
        schema: `
            userId TEXT PRIMARY KEY,
            reason TEXT DEFAULT 'No reason provided',
            developer TEXT
        `
    },
    {
        name: 'prefixes',
        schema: `
            guildId TEXT PRIMARY KEY,
            prefix TEXT
        `
    },
    {
        name: 'rankPermissions',
        schema: `
            rank TEXT PRIMARY KEY,
            allowedCommands TEXT DEFAULT '[]',
            deniedCommands TEXT DEFAULT '[]'
        `
    },
    {
        name: 'ignorechannels',
        schema: `
            guildId TEXT,
            channelId TEXT,
            PRIMARY KEY (guildId, channelId)
        `
    },
    {
        name: 'userpreferences',
        schema: `
            userId TEXT PRIMARY KEY,
            musicSource TEXT DEFAULT 'ytmsearch'
        `
    },
    {
        name: 'setup',
        schema: `
            guildId TEXT PRIMARY KEY,
            channelId TEXT,
            messageId TEXT,
            voiceChannelId TEXT
        `
    },
    {
        name: 'twofourseven',
        schema: `
            guildId TEXT PRIMARY KEY,
            textId TEXT,
            voiceId TEXT
        `
    },
    {
        name: 'autorole',
        schema: `
            guildId TEXT PRIMARY KEY,
            roles TEXT DEFAULT '[]'
        `
    },
    {
        name: 'voicerole',
        schema: `
            guildId TEXT PRIMARY KEY,
            roleId TEXT,
            voiceChannelId TEXT
        `
    },
    {
        name: 'vcstatus',
        schema: `
            guildId TEXT PRIMARY KEY,
            status TEXT
        `
    },
    {
        name: 'reboot',
        schema: `
            id TEXT PRIMARY KEY,
            channelId TEXT,
            messageId TEXT,
            guildId TEXT
        `
    },
    {
        name: 'music_stats',
        schema: `
            userId TEXT PRIMARY KEY,
            songsPlayed INTEGER DEFAULT 0,
            lastSong TEXT DEFAULT ''
        `
    }
];

tables.forEach(table => {
    db.prepare(`CREATE TABLE IF NOT EXISTS ${table.name} (${table.schema})`).run();

    if (table.name === 'profiles') {
        const columns = db.prepare('PRAGMA table_info(profiles)').all();
        const columnNames = columns.map(c => c.name);
        const required = ['rank', 'deniedCommands', 'allowedCommands'];
        required.forEach(col => {
            if (!columnNames.includes(col)) {
                const type = col === 'rank' ? 'TEXT DEFAULT "User"' : 'TEXT DEFAULT "[]"';
                db.prepare(`ALTER TABLE profiles ADD COLUMN ${col} ${type}`).run();
            }
        });
    }

    if (table.name === 'reboot') {
        const columns = db.prepare('PRAGMA table_info(reboot)').all();
        const columnNames = columns.map(c => c.name);
        if (!columnNames.includes('guildId')) {
            db.prepare('ALTER TABLE reboot ADD COLUMN guildId TEXT').run();
        }
    }
});


const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_profiles_userId ON profiles(userId)',
    'CREATE INDEX IF NOT EXISTS idx_liked_userId ON liked(userId)',
    'CREATE INDEX IF NOT EXISTS idx_noprefix_userId_guildId ON noprefix(userId, guildId)',
    'CREATE INDEX IF NOT EXISTS idx_blacklist_userId ON blacklist(userId)',
    'CREATE INDEX IF NOT EXISTS idx_prefixes_guildId ON prefixes(guildId)',
    'CREATE INDEX IF NOT EXISTS idx_ignorechannels_guildId ON ignorechannels(guildId)',
    'CREATE INDEX IF NOT EXISTS idx_userpreferences_userId ON userpreferences(userId)',
    'CREATE INDEX IF NOT EXISTS idx_setup_guildId ON setup(guildId)',
    'CREATE INDEX IF NOT EXISTS idx_twofourseven_guildId ON twofourseven(guildId)',
    'CREATE INDEX IF NOT EXISTS idx_autorole_guildId ON autorole(guildId)',
    'CREATE INDEX IF NOT EXISTS idx_voicerole_guildId ON voicerole(guildId)',
    'CREATE INDEX IF NOT EXISTS idx_vcstatus_guildId ON vcstatus(guildId)'
];

indexes.forEach(index => {
    db.prepare(index).run();
});


const managers = {};

const createManager = (tableName, primaryKey = 'id') => {
    return {
        get: (pkValue) => {
            return db.prepare(`SELECT * FROM ${tableName} WHERE ${primaryKey} = ?`).get(pkValue);
        },
        set: (pkValue, data) => {
            const updates = [];
            const params = [];
            for (const key in data) {
                if (key === primaryKey) continue;
                updates.push(`${key} = ?`);
                let val = data[key];
                if (typeof val === 'object' && val !== null) val = serialize(val);
                params.push(val);
            }

            const exists = db.prepare(`SELECT 1 FROM ${tableName} WHERE ${primaryKey} = ?`).get(pkValue);
            if (exists) {
                params.push(pkValue);
                db.prepare(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${primaryKey} = ?`).run(...params);
            } else {
                const keys = [primaryKey, ...Object.keys(data).filter(k => k !== primaryKey)];
                const vals = keys.map(k => {
                    let v = k === primaryKey ? pkValue : data[k];
                    if (typeof v === 'object' && v !== null) v = serialize(v);
                    return v;
                });
                db.prepare(`INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...vals);
            }
        },
        delete: (pkValue) => {
            db.prepare(`DELETE FROM ${tableName} WHERE ${primaryKey} = ?`).run(pkValue);
        },
        getAll: () => {
            return db.prepare(`SELECT * FROM ${tableName}`).all();
        }
    };
};

managers.profiles = {
    get: (userId) => {
        const row = db.prepare('SELECT * FROM profiles WHERE userId = ?').get(userId);
        if (!row) return null;
        return {
            ...row,
            badges: deserialize(row.badges),
            friends: deserialize(row.friends),
            deniedCommands: deserialize(row.deniedCommands),
            allowedCommands: deserialize(row.allowedCommands)
        };
    },
    set: (userId, data) => {
        const updates = [];
        const params = [];
        for (const key in data) {
            if (key === 'userId') continue;
            updates.push(`${key} = ?`);
            let val = data[key];
            if (['badges', 'friends', 'deniedCommands', 'allowedCommands'].includes(key)) val = serialize(val);
            params.push(val);
        }

        const exists = db.prepare('SELECT 1 FROM profiles WHERE userId = ?').get(userId);
        if (exists) {
            params.push(userId);
            db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE userId = ?`).run(...params);
        } else {
            const keys = ['userId', ...Object.keys(data).filter(k => k !== 'userId')];
            const vals = keys.map(k => {
                let v = k === 'userId' ? userId : data[k];
                if (['badges', 'friends', 'deniedCommands', 'allowedCommands'].includes(k)) v = serialize(v || []);
                return v;
            });
            db.prepare(`INSERT INTO profiles (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...vals);
        }
    }
};

managers.liked = {
    get: (userId) => {
        const row = db.prepare('SELECT * FROM liked WHERE userId = ?').get(userId);
        return row ? deserialize(row.songs) : [];
    },
    set: (userId, songs) => {
        db.prepare('INSERT OR REPLACE INTO liked (userId, songs) VALUES (?, ?)').run(userId, serialize(songs));
    }
};

managers.noprefix = {
    get: (userId, guildId = 'GLOBAL') => {
        const row = db.prepare('SELECT * FROM noprefix WHERE userId = ? AND guildId = ?').get(userId, guildId);
        if (!row) return null;
        return { ...row, noprefix: !!row.noprefix };
    },
    set: (userId, guildId, status, expiresAt = null) => {
        db.prepare('INSERT OR REPLACE INTO noprefix (userId, guildId, noprefix, expiresAt) VALUES (?, ?, ?, ?)').run(userId, guildId, status ? 1 : 0, expiresAt);
    },
    find: (filter = {}) => {
        let sql = 'SELECT * FROM noprefix';
        const params = [];
        const conditions = [];
        for (const key in filter) {
            conditions.push(`${key} = ?`);
            params.push(typeof filter[key] === 'boolean' ? (filter[key] ? 1 : 0) : filter[key]);
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        return db.prepare(sql).all(...params).map(row => ({ ...row, noprefix: !!row.noprefix }));
    },
    findOne: (filter = {}) => {
        let sql = 'SELECT * FROM noprefix';
        const params = [];
        const conditions = [];
        for (const key in filter) {
            conditions.push(`${key} = ?`);
            params.push(typeof filter[key] === 'boolean' ? (filter[key] ? 1 : 0) : filter[key]);
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        const row = db.prepare(sql).get(...params);
        if (!row) return null;
        return { ...row, noprefix: !!row.noprefix };
    },
    create: (data) => {
        const keys = Object.keys(data);
        const vals = keys.map(k => typeof data[k] === 'boolean' ? (data[k] ? 1 : 0) : (data[k] instanceof Date ? data[k].toISOString() : data[k]));
        db.prepare(`INSERT INTO noprefix (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...vals);
    },
    updateOne: (filter, data) => {
        let sql = 'UPDATE noprefix SET ';
        const updates = [];
        const params = [];
        for (const key in data) {
            updates.push(`${key} = ?`);
            params.push(typeof data[key] === 'boolean' ? (data[key] ? 1 : 0) : (data[key] instanceof Date ? data[key].toISOString() : data[key]));
        }
        sql += updates.join(', ');
        const conditions = [];
        for (const key in filter) {
            conditions.push(`${key} = ?`);
            params.push(typeof filter[key] === 'boolean' ? (filter[key] ? 1 : 0) : filter[key]);
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        db.prepare(sql).run(...params);
    },
    deleteOne: (filter) => {
        let sql = 'DELETE FROM noprefix';
        const params = [];
        const conditions = [];
        for (const key in filter) {
            conditions.push(`${key} = ?`);
            params.push(typeof filter[key] === 'boolean' ? (filter[key] ? 1 : 0) : filter[key]);
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        db.prepare(sql).run(...params);
    },
    deleteMany: (filter) => {
        let sql = 'DELETE FROM noprefix';
        const params = [];
        const conditions = [];
        for (const key in filter) {
            conditions.push(`${key} = ?`);
            params.push(typeof filter[key] === 'boolean' ? (filter[key] ? 1 : 0) : filter[key]);
        }
        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        const res = db.prepare(sql).run(...params);
        return { deletedCount: res.changes };
    },
    findExpired: (now) => {
        return db.prepare('SELECT * FROM noprefix WHERE expiresAt IS NOT NULL AND expiresAt < ?').all(now);
    },
    delete: (id) => {
        db.prepare('DELETE FROM noprefix WHERE id = ?').run(id);
    },
    getGlobal: (userId) => {
        const row = db.prepare('SELECT * FROM noprefix WHERE userId = ? AND guildId = ? AND noprefix = 1').get(userId, 'GLOBAL');
        if (!row) return null;
        if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
            db.prepare('DELETE FROM noprefix WHERE id = ?').run(row.id);
            return null;
        }
        return { ...row, noprefix: !!row.noprefix };
    }
};

managers.blacklist = createManager('blacklist', 'userId');
managers.prefixes = createManager('prefixes', 'guildId');
managers.ignorechannels = {
    get: (guildId, channelId) => {
        return db.prepare('SELECT 1 FROM ignorechannels WHERE guildId = ? AND channelId = ?').get(guildId, channelId);
    },
    getForGuild: (guildId) => {
        return db.prepare('SELECT * FROM ignorechannels WHERE guildId = ?').all(guildId);
    },
    add: (guildId, channelId) => {
        db.prepare('INSERT OR IGNORE INTO ignorechannels (guildId, channelId) VALUES (?, ?)').run(guildId, channelId);
    },
    remove: (guildId, channelId) => {
        db.prepare('DELETE FROM ignorechannels WHERE guildId = ? AND channelId = ?').run(guildId, channelId);
    },
    deleteForGuild: (guildId) => {
        db.prepare('DELETE FROM ignorechannels WHERE guildId = ?').run(guildId);
    }
};
managers.userpreferences = createManager('userpreferences', 'userId');
managers.setup = createManager('setup', 'guildId');
managers.twofourseven = createManager('twofourseven', 'guildId');
managers.autorole = {
    get: (guildId) => {
        const row = db.prepare('SELECT * FROM autorole WHERE guildId = ?').get(guildId);
        if (!row) return null;
        return { ...row, roles: deserialize(row.roles) };
    },
    set: (guildId, roles) => {
        db.prepare('INSERT OR REPLACE INTO autorole (guildId, roles) VALUES (?, ?)').run(guildId, serialize(roles));
    },
    delete: (guildId) => {
        db.prepare('DELETE FROM autorole WHERE guildId = ?').run(guildId);
    }
};
managers.voicerole = createManager('voicerole', 'guildId');
managers.vcstatus = createManager('vcstatus', 'guildId');
managers.reboot = createManager('reboot', 'id');

managers.musicStats = {
    get: (userId) => {
        return db.prepare('SELECT * FROM music_stats WHERE userId = ?').get(userId) || { userId, songsPlayed: 0, lastSong: '' };
    },
    increment: (userId, songTitle = '') => {
        const exists = db.prepare('SELECT 1 FROM music_stats WHERE userId = ?').get(userId);
        if (exists) {
            db.prepare('UPDATE music_stats SET songsPlayed = songsPlayed + 1, lastSong = ? WHERE userId = ?').run(songTitle, userId);
        } else {
            db.prepare('INSERT INTO music_stats (userId, songsPlayed, lastSong) VALUES (?, 1, ?)').run(userId, songTitle);
        }
    },
    getTopUsers: (limit = 10) => {
        return db.prepare('SELECT * FROM music_stats ORDER BY songsPlayed DESC LIMIT ?').all(limit);
    }
};

managers.rankPermissions = {
    get: (rank) => {
        const row = db.prepare('SELECT * FROM rankPermissions WHERE rank = ?').get(rank);
        if (!row) return { rank, allowedCommands: [], deniedCommands: [] };
        return {
            ...row,
            allowedCommands: deserialize(row.allowedCommands),
            deniedCommands: deserialize(row.deniedCommands)
        };
    },
    set: (rank, data) => {
        const updates = [];
        const params = [];
        for (const key in data) {
            if (key === 'rank') continue;
            updates.push(`${key} = ?`);
            let val = data[key];
            if (['allowedCommands', 'deniedCommands'].includes(key)) val = serialize(val);
            params.push(val);
        }

        const exists = db.prepare('SELECT 1 FROM rankPermissions WHERE rank = ?').get(rank);
        if (exists) {
            params.push(rank);
            db.prepare(`UPDATE rankPermissions SET ${updates.join(', ')} WHERE rank = ?`).run(...params);
        } else {
            const keys = ['rank', ...Object.keys(data).filter(k => k !== 'rank')];
            const vals = keys.map(k => {
                let v = k === 'rank' ? rank : data[k];
                if (['allowedCommands', 'deniedCommands'].includes(k)) v = serialize(v || []);
                return v;
            });
            db.prepare(`INSERT INTO rankPermissions (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`).run(...vals);
        }
    },
    deleteMany: (sql = 'DELETE FROM rankPermissions', params = []) => {
        db.prepare(sql).run(...params);
    }
};


const Database = { db, ...managers };

module.exports = Database;

