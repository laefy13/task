const session = require("express-session");
const sql = require("mssql");

const config = {
  user: "laefy13@task-management-sys-server",
  password: "S4g3firegaming!",
  server: "task-management-sys-server.database.windows.net",
  database: "dbtasks",
  port: 1433,
  options: {
    encrypt: true,
  },
};

sql.connect(config).catch((err) => {
  console.error("Error connecting to SQL Server:", err);
});

class SQLSessionStore extends session.Store {
  constructor(options) {
    super(options);
  }

  async set(sid, sessionData, callback) {
    try {
      const session = JSON.stringify(sessionData);
      const expires = sessionData.cookie.expires
        ? new Date(sessionData.cookie.expires)
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 1 day if no expiration
      await sql.query`
                MERGE Sessions AS target
                USING (SELECT ${sid} AS sid, ${session} AS session, ${expires} AS expires) AS source
                ON target.sid = source.sid
                WHEN MATCHED THEN
                    UPDATE SET session = source.session, expires = source.expires
                WHEN NOT MATCHED THEN
                    INSERT (sid, session, expires) VALUES (source.sid, source.session, source.expires);`;
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  async get(sid, callback) {
    try {
      const result =
        await sql.query`SELECT session, expires FROM Sessions WHERE sid = ${sid}`;
      if (result.recordset.length > 0) {
        const { session, expires } = result.recordset[0];
        if (new Date(expires) > new Date()) {
          callback(null, JSON.parse(session));
        } else {
          await this.destroy(sid, () => {});
          callback(null, null);
        }
      } else {
        callback(null, null);
      }
    } catch (err) {
      callback(err);
    }
  }

  async destroy(sid, callback) {
    try {
      await sql.query`DELETE FROM Sessions WHERE sid = ${sid}`;
      callback(null);
    } catch (err) {
      callback(err);
    }
  }
}

module.exports = SQLSessionStore;
