const express = require('express');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

// Add this at the top of your file to see all incoming requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} received`);
    next();
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Create a router for API endpoints
const apiRouter = express.Router();

// Define API routes on the router
apiRouter.post('/test-connection', async (req, res) => {
    console.log('POST /api/test-connection received');
    const { dbType, host, port, username, password, database, authSource } = req.body;
    
    console.log('Request body:', req.body);
    
    if (!dbType || !host || !port) {
        return res.status(400).json({ 
            success: false, 
            message: 'Database type, host, and port are required' 
        });
    }

    try {
        let connectionResult;
        let databases = [];
        
        switch (dbType) {
            case 'postgresql':
                console.log('Testing PostgreSQL connection...');
                connectionResult = await testPostgreSQL(host, port, username, password, database);
                // Get list of databases
                databases = await getPostgreSQLDatabases({
                    host, port, user: username, password
                });
                break;
                
            case 'mysql':
                console.log('Testing MySQL connection...');
                connectionResult = await testMySQL(host, port, username, password, database);
                // Get list of databases
                databases = await getMySQLDatabases({
                    host, port, user: username, password
                });
                break;
                
            case 'mongodb':
                console.log('Testing MongoDB connection...');
                connectionResult = await testMongoDB(host, port, username, password, database, authSource);
                // Get list of databases
                databases = await getMongoDBDatabases({
                    host, port, user: username, password, authSource
                });
                break;
                
            default:
                console.log('Unsupported database type:', dbType);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Unsupported database type' 
                });
        }
        
        console.log(`${dbType} connection successful:`, connectionResult);
        res.json({ 
            success: true, 
            message: `${dbType} connection successful`,
            details: connectionResult,
            databases: databases
        });
    } catch (error) {
        console.error(`${dbType} connection error:`, error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

apiRouter.post('/echo', (req, res) => {
    console.log('POST /echo received');
    console.log('Request body:', req.body);
    res.json({ 
        success: true, 
        message: 'Echo endpoint working',
        receivedData: req.body 
    });
});

// Add a new endpoint to get databases
apiRouter.post('/databases', async (req, res) => {
    console.log('POST /api/databases received');
    const { dbType, host, port, username, password, authSource } = req.body;
    
    console.log('Request body:', req.body);
    
    if (!dbType || !host || !port) {
        return res.status(400).json({ 
            success: false, 
            message: 'Database type, host, and port are required' 
        });
    }

    try {
        let databases = [];
        
        switch (dbType) {
            case 'postgresql':
                console.log('Getting PostgreSQL databases...');
                databases = await getPostgreSQLDatabases({
                    host, port, user: username, password
                });
                break;
                
            case 'mysql':
                console.log('Getting MySQL databases...');
                databases = await getMySQLDatabases({
                    host, port, user: username, password
                });
                break;
                
            case 'mongodb':
                console.log('Getting MongoDB databases...');
                databases = await getMongoDBDatabases({
                    host, port, user: username, password, authSource
                });
                break;
                
            default:
                console.log('Unsupported database type:', dbType);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Unsupported database type' 
                });
        }
        
        console.log(`Retrieved ${databases.length} ${dbType} databases`);
        res.json({ 
            success: true, 
            message: `Retrieved ${databases.length} databases`,
            databases: databases
        });
    } catch (error) {
        console.error(`Error retrieving ${dbType} databases:`, error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Add a new endpoint to get tables for a database
apiRouter.post('/tables', async (req, res) => {
    console.log('POST /api/tables received');
    const { dbType, host, port, username, password, database, authSource } = req.body;
    
    console.log('Request body:', req.body);
    
    if (!dbType || !host || !port || !database) {
        return res.status(400).json({ 
            success: false, 
            message: 'Database type, host, port, and database name are required' 
        });
    }

    try {
        let tables = [];
        
        switch (dbType) {
            case 'postgresql':
                console.log('Getting PostgreSQL tables...');
                tables = await getPostgreSQLTables({
                    host, port, user: username, password, database
                });
                break;
                
            case 'mysql':
                console.log('Getting MySQL tables...');
                tables = await getMySQLTables({
                    host, port, user: username, password, database
                });
                break;
                
            case 'mongodb':
                console.log('Getting MongoDB collections...');
                tables = await getMongoDBCollections({
                    host, port, user: username, password, database, authSource
                });
                break;
                
            default:
                console.log('Unsupported database type:', dbType);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Unsupported database type' 
                });
        }
        
        console.log(`Retrieved ${tables.length} ${dbType} tables/collections from ${database}`);
        res.json({ 
            success: true, 
            message: `Retrieved ${tables.length} tables/collections`,
            tables: tables
        });
    } catch (error) {
        console.error(`Error retrieving ${dbType} tables:`, error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Add a new endpoint to get table data
apiRouter.post('/table-data', async (req, res) => {
    console.log('POST /api/table-data received');
    const { dbType, host, port, username, password, database, table, authSource, page = 1, pageSize = 100 } = req.body;
    
    console.log('Request body:', {
        dbType, host, port, database, table, page, pageSize,
        // Don't log sensitive data
        username: username ? '****' : undefined,
        password: password ? '****' : undefined
    });
    
    if (!dbType || !host || !port || !database || !table) {
        return res.status(400).json({ 
            success: false, 
            message: 'Database type, host, port, database name, and table name are required' 
        });
    }

    try {
        let data = [];
        let totalRows = 0;
        
        switch (dbType) {
            case 'postgresql':
                console.log('Getting PostgreSQL table data...');
                try {
                    const pgResult = await getPostgreSQLTableData({
                        host, port, user: username, password, database, table, page, pageSize
                    });
                    data = pgResult.data;
                    totalRows = pgResult.totalRows;
                } catch (pgError) {
                    console.error('PostgreSQL error:', pgError);
                    return res.status(500).json({
                        success: false,
                        message: `PostgreSQL error: ${pgError.message}`
                    });
                }
                break;
                
            case 'mysql':
                console.log('Getting MySQL table data...');
                const mysqlResult = await getMySQLTableData({
                    host, port, user: username, password, database, table, page, pageSize
                });
                data = mysqlResult.data;
                totalRows = mysqlResult.totalRows;
                break;
                
            case 'mongodb':
                console.log('Getting MongoDB collection data...');
                const mongoResult = await getMongoDBCollectionData({
                    host, port, user: username, password, database, collection: table, authSource, page, pageSize
                });
                data = mongoResult.data;
                totalRows = mongoResult.totalRows;
                break;
                
            default:
                console.log('Unsupported database type:', dbType);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Unsupported database type' 
                });
        }
        
        console.log(`Retrieved ${data.length} rows from ${database}.${table}`);
        res.json({ 
            success: true, 
            message: `Retrieved ${data.length} rows`,
            data: data,
            totalRows: totalRows,
            page: page,
            pageSize: pageSize,
            totalPages: Math.ceil(totalRows / pageSize)
        });
    } catch (error) {
        console.error(`Error retrieving ${dbType} table data:`, error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Unknown server error'
        });
    }
});

// Use the API router
app.use('/api', apiRouter);

// Create connection endpoint
apiRouter.post('/create-connection', async (req, res) => {
    const { dbType, host, port, username, password, database, authSource } = req.body;

    if (!dbType || !host || !port) {
        return res.status(400).json({ 
            success: false, 
            message: 'Database type, host, and port are required' 
        });
    }

    try {
        let result;
        switch (dbType) {
            case 'postgresql':
                result = await testPostgreSQL(host, port, username, password, database);
                break;
            case 'mysql':
                result = await testMySQL(host, port, username, password, database);
                break;
            case 'mongodb':
                result = await testMongoDB(host, port, username, password, database, authSource);
                break;
            default:
                return res.status(400).json({ 
                    success: false, 
                    message: 'Unsupported database type' 
                });
        }
        
        // Here you would normally save the connection details to your database
        console.log('Connection created:', { dbType, host, port, username, database });
        
        res.json({ 
            success: true, 
            message: `${dbType} connection created successfully`,
            details: { dbType, host, port, username, database } 
        });
    } catch (error) {
        console.error(`Error creating ${dbType} connection:`, error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Test PostgreSQL connection
async function testPostgreSQL(host, port, username, password, database) {
    const config = {
        host,
        port: parseInt(port),
        user: username,
        password,
        connectionTimeoutMillis: 5000,
    };
    if (database) {
        config.database = database;
    }
    const pool = new Pool(config);

    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return { version: client.serverVersion };
    } finally {
        await pool.end();
    }
}

// Test MySQL connection
async function testMySQL(host, port, username, password, database) {
    const config = {
        host,
        port: parseInt(port),
        user: username,
        password
    };
    if (database) {
        config.database = database;
    }
    const connection = await mysql.createConnection(config);

    try {
        const [rows] = await connection.execute('SELECT 1');
        return { status: 'Connected' };
    } finally {
        await connection.end();
    }
}

// Test MongoDB connection
async function testMongoDB(host, port, username, password, database, authSource = 'admin') {
    let url;
    if (database) {
        url = `mongodb://${username}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=${authSource}`;
    } else {
        url = `mongodb://${username}:${encodeURIComponent(password)}@${host}:${port}/?authSource=${authSource}`;
    }
    const client = new MongoClient(url, { connectTimeoutMS: 5000 });

    try {
        await client.connect();
        const adminDb = client.db().admin();
        const serverStatus = await adminDb.serverStatus();
        return { version: serverStatus.version };
    } finally {
        await client.close();
    }
}

// PostgreSQL database functions
async function getPostgreSQLDatabases(source) {
    const { host, port, user, password } = source;
    
    // Connect to the default 'postgres' database to list all databases
    const pool = new Pool({
        host,
        port: parseInt(port),
        user,
        password,
        database: 'postgres',
        connectionTimeoutMillis: 5000,
    });
    
    try {
        const result = await pool.query(`
            SELECT datname AS name
            FROM pg_database
            WHERE datistemplate = false
            ORDER BY datname
        `);
        
        return result.rows;
    } finally {
        await pool.end();
    }
}

// MySQL database functions
async function getMySQLDatabases(source) {
    const { host, port, user, password } = source;
    
    const connection = await mysql.createConnection({
        host,
        port: parseInt(port),
        user,
        password
    });
    
    try {
        const [rows] = await connection.execute('SHOW DATABASES');
        return rows.map(row => ({ name: row.Database }));
    } finally {
        await connection.end();
    }
}

// MongoDB database functions
async function getMongoDBDatabases(source) {
    const { host, port, user, password, authSource = 'admin' } = source;
    
    const url = `mongodb://${user}:${encodeURIComponent(password)}@${host}:${port}/?authSource=${authSource}`;
    const client = new MongoClient(url, { connectTimeoutMS: 5000 });
    
    try {
        await client.connect();
        const adminDb = client.db().admin();
        const result = await adminDb.listDatabases();
        
        return result.databases.map(db => ({
            name: db.name,
            sizeOnDisk: db.sizeOnDisk,
            empty: db.empty
        }));
    } finally {
        await client.close();
    }
}

// PostgreSQL table functions
async function getPostgreSQLTables(source) {
    const { host, port, user, password, database } = source;
    
    const pool = new Pool({
        host,
        port: parseInt(port),
        user,
        password,
        database,
        connectionTimeoutMillis: 5000,
    });
    
    try {
        const result = await pool.query(`
            SELECT table_name AS name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        return result.rows;
    } finally {
        await pool.end();
    }
}

// MySQL table functions
async function getMySQLTables(source) {
    const { host, port, user, password, database } = source;
    
    const connection = await mysql.createConnection({
        host,
        port: parseInt(port),
        user,
        password,
        database
    });
    
    try {
        const [rows] = await connection.execute('SHOW TABLES');
        const tableKey = `Tables_in_${database}`;
        return rows.map(row => ({ name: row[tableKey] }));
    } finally {
        await connection.end();
    }
}

// MongoDB collection functions
async function getMongoDBCollections(source) {
    const { host, port, user, password, database, authSource = 'admin' } = source;
    
    const url = `mongodb://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=${authSource}`;
    const client = new MongoClient(url, { connectTimeoutMS: 5000 });
    
    try {
        await client.connect();
        const db = client.db(database);
        const collections = await db.listCollections().toArray();
        
        return collections.map(collection => ({
            name: collection.name,
            type: collection.type
        }));
    } finally {
        await client.close();
    }
}

// PostgreSQL table data functions
async function getPostgreSQLTableData(source) {
    const { host, port, user, password, database, table, page, pageSize } = source;
    
    const pool = new Pool({
        host,
        port: parseInt(port),
        user,
        password,
        database,
        connectionTimeoutMillis: 5000,
    });
    
    try {
        // Get total rows
        const countResult = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
        const totalRows = parseInt(countResult.rows[0].count);
        
        // Get paginated data
        const offset = (page - 1) * pageSize;
        const dataResult = await pool.query(`
            SELECT * FROM "${table}"
            LIMIT ${pageSize} OFFSET ${offset}
        `);
        
        return {
            data: dataResult.rows,
            totalRows: totalRows
        };
    } catch (error) {
        console.error(`PostgreSQL error for table ${table}:`, error);
        throw new Error(`Database error: ${error.message}`);
    } finally {
        await pool.end();
    }
}

// MySQL table data functions
async function getMySQLTableData(source) {
    const { host, port, user, password, database, table, page, pageSize } = source;
    
    const connection = await mysql.createConnection({
        host,
        port: parseInt(port),
        user,
        password,
        database
    });
    
    try {
        // Get total rows
        const [countRows] = await connection.execute(`SELECT COUNT(*) as count FROM \`${table}\``);
        const totalRows = parseInt(countRows[0].count);
        
        // Get paginated data
        const offset = (page - 1) * pageSize;
        const [dataRows] = await connection.execute(`
            SELECT * FROM \`${table}\`
            LIMIT ${offset}, ${pageSize}
        `);
        
        return {
            data: dataRows,
            totalRows: totalRows
        };
    } finally {
        await connection.end();
    }
}

// MongoDB collection data functions
async function getMongoDBCollectionData(source) {
    const { host, port, user, password, database, collection, authSource = 'admin', page, pageSize } = source;
    
    const url = `mongodb://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?authSource=${authSource}`;
    const client = new MongoClient(url, { connectTimeoutMS: 5000 });
    
    try {
        await client.connect();
        const db = client.db(database);
        const coll = db.collection(collection);
        
        // Get total documents
        const totalRows = await coll.countDocuments();
        
        // Get paginated data
        const skip = (page - 1) * pageSize;
        const data = await coll.find({})
            .skip(skip)
            .limit(pageSize)
            .toArray();
        
        // Convert MongoDB _id to string for JSON serialization
        const serializedData = data.map(doc => {
            const newDoc = { ...doc };
            if (newDoc._id) {
                newDoc._id = newDoc._id.toString();
            }
            return newDoc;
        });
        
        return {
            data: serializedData,
            totalRows: totalRows
        };
    } finally {
        await client.close();
    }
}

// Add a new endpoint to delete a database
apiRouter.post('/delete-database', async (req, res) => {
    console.log('POST /api/delete-database received');
    const { dbType, host, port, username, password, database, authSource } = req.body;
    
    console.log('Request body:', req.body);
    
    if (!dbType || !host || !port || !database) {
        return res.status(400).json({ 
            success: false, 
            message: 'Database type, host, port, and database name are required' 
        });
    }

    try {
        let result;
        
        switch (dbType) {
            case 'postgresql':
                console.log('Deleting PostgreSQL database...');
                result = await deletePostgreSQLDatabase({
                    host, port, user: username, password, database
                });
                break;
                
            case 'mysql':
                console.log('Deleting MySQL database...');
                result = await deleteMySQLDatabase({
                    host, port, user: username, password, database
                });
                break;
                
            case 'mongodb':
                console.log('Deleting MongoDB database...');
                result = await deleteMongoDBDatabase({
                    host, port, user: username, password, database, authSource
                });
                break;
                
            default:
                console.log('Unsupported database type:', dbType);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Unsupported database type' 
                });
        }
        
        console.log(`Database ${database} deleted successfully`);
        res.json({ 
            success: true, 
            message: `Database ${database} deleted successfully`
        });
    } catch (error) {
        console.error(`Error deleting ${dbType} database:`, error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Function to delete a PostgreSQL database
async function deletePostgreSQLDatabase({ host, port, user, password, database }) {
    // Connect to the default 'postgres' database to delete another database
    const pool = new Pool({
        host,
        port: parseInt(port),
        user,
        password,
        database: 'postgres', // Connect to default database
        connectionTimeoutMillis: 5000,
    });
    
    try {
        // First check if there are active connections to the database
        const client = await pool.connect();
        
        // Terminate all connections to the database
        await client.query(`
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = $1
            AND pid <> pg_backend_pid()
        `, [database]);
        
        // Drop the database
        await client.query(`DROP DATABASE IF EXISTS "${database}"`);
        client.release();
        
        return { success: true };
    } finally {
        await pool.end();
    }
}

// Function to delete a MySQL database
async function deleteMySQLDatabase({ host, port, user, password, database }) {
    const connection = await mysql.createConnection({
        host,
        port: parseInt(port),
        user,
        password
    });
    
    try {
        await connection.execute(`DROP DATABASE IF EXISTS \`${database}\``);
        return { success: true };
    } finally {
        await connection.end();
    }
}

// Function to delete a MongoDB database
async function deleteMongoDBDatabase({ host, port, user, password, database, authSource = 'admin' }) {
    const url = `mongodb://${user}:${encodeURIComponent(password)}@${host}:${port}/?authSource=${authSource}`;
    const client = new MongoClient(url, { connectTimeoutMS: 5000 });
    
    try {
        await client.connect();
        const db = client.db(database);
        await db.dropDatabase();
        return { success: true };
    } finally {
        await client.close();
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// Add this simple test endpoint
app.post('/echo', (req, res) => {
    console.log('POST /echo received');
    console.log('Request body:', req.body);
    res.json({ 
        success: true, 
        message: 'Echo endpoint working',
        receivedData: req.body 
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Supported databases: PostgreSQL, MySQL, MongoDB`);
});