'use strict';

const { MongoClient } = require('mongodb');

const MONGO_HOST = process.env.MONGO_HOST || 'db';
const MONGO_PORT = process.env.MONGO_PORT || '27017';
const MONGO_DB = process.env.MONGO_DB;
const MONGO_USER = process.env.MONGO_USER;
const MONGO_PASSWORD = process.env.MONGO_PASSWORD;

let client = null;
let database = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mencoba terhubung berulang kali karena MongoDB bisa saja masih
// menyelesaikan inisialisasi walaupun container-nya sudah berstatus healthy.
async function connect(retries = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const candidate = new MongoClient(`mongodb://${MONGO_HOST}:${MONGO_PORT}`, {
      auth: { username: MONGO_USER, password: MONGO_PASSWORD },
      authSource: 'admin',
      serverSelectionTimeoutMS: 3000,
    });
    try {
      await candidate.connect();
      await candidate.db('admin').command({ ping: 1 });
      client = candidate;
      database = client.db(MONGO_DB);
      await database.collection('expenses').createIndex({ createdAt: -1 });
      console.log('Terhubung ke MongoDB.');
      return;
    } catch (err) {
      console.log(`Menunggu MongoDB (${attempt}/${retries}): ${err.message}`);
      await candidate.close().catch(() => {});
      await sleep(delayMs);
    }
  }
  throw new Error('Tidak dapat terhubung ke MongoDB.');
}

function expenses() {
  if (!database) throw new Error('Database belum siap.');
  return database.collection('expenses');
}

async function ping() {
  if (!client) throw new Error('Database belum siap.');
  await client.db('admin').command({ ping: 1 });
}

async function close() {
  if (client) await client.close();
}

module.exports = { connect, expenses, ping, close };
