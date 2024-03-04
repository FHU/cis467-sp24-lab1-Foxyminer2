const config = {
    db: {
        host: "127.0.0.1", 
        user: "root",
        password: "Mineboy57", 
        database: "botscryout",
        connectTimeout: 60000,
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
        idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
    }
}

module.exports = config