/**
 * MongoDB connection via Mongoose.
 */
const dns = require('dns');
const mongoose = require('mongoose');

// Used when this PC's DNS server cannot answer SRV lookups (override with DNS_SERVERS in .env)
const PUBLIC_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

/**
 * "mongodb+srv://" addresses (MongoDB Atlas) need a DNS SRV lookup.
 * On some Windows PCs Node's resolver points at a local DNS proxy
 * (e.g. 127.0.0.1 from a VPN or antivirus) that refuses SRV queries,
 * which fails with "querySrv ECONNREFUSED". In that case switch Node's
 * resolver to public DNS servers before connecting.
 */
const ensureSrvDns = async (uri) => {
  const match = /^mongodb\+srv:\/\/(?:[^/]*@)?([^/?]+)/.exec(uri || '');
  if (!match) return;
  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${match[1]}`);
  } catch (err) {
    const servers = (process.env.DNS_SERVERS || PUBLIC_DNS_SERVERS.join(','))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    console.warn(`[db] DNS SRV lookup failed on this PC's DNS (${err.code}). Using public DNS: ${servers.join(', ')}`);
    dns.setServers(servers);
  }
};

/**
 * Connect to MongoDB using MONGO_URI.
 * Exits the process when the first connection fails, because the API
 * cannot do anything useful without its database.
 */
const connectDB = async () => {
  try {
    await ensureSrvDns(process.env.MONGO_URI);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[db] MongoDB connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
  } catch (err) {
    console.error(`[db] MongoDB connection failed: ${err.message}`);
    console.error('[db] Make sure MongoDB is running and MONGO_URI in .env is correct.');
    process.exit(1);
  }

  // Runtime connection events (Mongoose reconnects automatically)
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[db] MongoDB reconnected'));
  mongoose.connection.on('error', (err) => console.error(`[db] MongoDB error: ${err.message}`));
};

module.exports = connectDB;
