const { Client } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function checkPostgresConnection() {
  console.log('PostgreSQL Connection Checker');
  console.log('----------------------------');
  
  // Get connection details from user
  const host = await prompt('Host (default: localhost): ') || 'localhost';
  const port = await prompt('Port (default: 5432): ') || '5432';
  const user = await prompt('Username (default: postgres): ') || 'postgres';
  const password = await prompt('Password: ');
  const database = await prompt('Database name (default: postgres): ') || 'postgres';
  
  console.log('\nAttempting to connect to PostgreSQL with:');
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`User: ${user}`);
  console.log(`Database: ${database}`);
  console.log('Password: *****');
  
  // Create client with provided details
  const client = new Client({
    host,
    port: parseInt(port),
    user,
    password,
    database,
    // Set a shorter connection timeout
    connectionTimeoutMillis: 5000,
  });
  
  try {
    console.log('\nConnecting...');
    await client.connect();
    console.log('✅ Connection successful!');
    
    // Get PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log(`\nPostgreSQL Version: ${versionResult.rows[0].version}`);
    
    // List all databases
    console.log('\nAvailable databases:');
    const dbResult = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false');
    dbResult.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.datname}`);
    });
    
    // List all tables in the current database
    console.log(`\nTables in "${database}" database:`);
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tableResult.rows.length === 0) {
      console.log('No tables found in the public schema.');
    } else {
      tableResult.rows.forEach((row, i) => {
        console.log(`${i+1}. ${row.table_name}`);
      });
    }
    
    await client.end();
    console.log('\nConnection closed.');
    
    return true;
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error(`Error: ${error.message}`);
    
    // Provide troubleshooting tips based on the error
    console.log('\nTroubleshooting tips:');
    
    if (error.message.includes('password authentication failed')) {
      console.log('- Check if the username and password are correct');
      console.log('- Verify that the user has permission to access the database');
    } 
    else if (error.message.includes('does not exist')) {
      console.log('- The specified database does not exist');
      console.log('- Try connecting to the default "postgres" database first');
    }
    else if (error.message.includes('ECONNREFUSED')) {
      console.log('- PostgreSQL server is not running or not listening on the specified host/port');
      console.log('- Check if PostgreSQL service is running');
      console.log('- Verify the host and port are correct');
      console.log('- Make sure PostgreSQL is configured to accept connections (pg_hba.conf)');
    }
    else if (error.message.includes('timeout')) {
      console.log('- Connection timed out - server might be behind a firewall');
      console.log('- Check if the host is reachable (try ping)');
      console.log('- Verify the PostgreSQL server is accepting connections from your IP');
    }
    
    console.log('\nGeneral tips:');
    console.log('1. Check if PostgreSQL is installed and running');
    console.log('2. Verify PostgreSQL is configured to accept connections');
    console.log('3. Check firewall settings if connecting to a remote server');
    console.log('4. Try connecting with psql command line tool to verify credentials');
    
    return false;
  } finally {
    rl.close();
  }
}

checkPostgresConnection()
  .then(success => {
    if (success) {
      console.log('\n✅ PostgreSQL connection test completed successfully.');
    } else {
      console.log('\n❌ PostgreSQL connection test failed. See above for details.');
    }
  })
  .catch(err => {
    console.error('Unexpected error:', err);
  });
