'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { ObjectId } = require('mongodb');
const db = require('./db');

const PORT = Number(process.env.PORT || 3000);
const OWNER = process.env.APP_OWNER || 'Praktikan';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const CATEGORIES = ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Lainnya'];
const MAX_BODY_BYTES = 10 * 1024;
const MAX_AMOUNT = 1_000_000_000_000;

// ---------- Utilitas ----------
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooBig = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooBig = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooBig) return reject(httpError(413, 'Data yang dikirim terlalu besar.'));
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        return resolve(text ? JSON.parse(text) : {});
      } catch {
        return reject(httpError(400, 'Format JSON tidak valid.'));
      }
    });
    req.on('error', reject);
  });
}

function validate(input) {
  const body = input && typeof input === 'object' ? input : {};
  const keterangan = typeof body.keterangan === 'string' ? body.keterangan.trim() : '';
  const kategori = body.kategori;
  const jumlah = Number(body.jumlah);

  if (!keterangan || keterangan.length > 100) {
    throw httpError(400, 'Keterangan wajib diisi (maksimal 100 karakter).');
  }
  if (!CATEGORIES.includes(kategori)) {
    throw httpError(400, 'Kategori tidak valid.');
  }
  if (!Number.isInteger(jumlah) || jumlah <= 0 || jumlah > MAX_AMOUNT) {
    throw httpError(400, 'Jumlah harus berupa bilangan bulat positif.');
  }
  return { keterangan, kategori, jumlah };
}

function toJson(doc) {
  return {
    id: String(doc._id),
    keterangan: doc.keterangan,
    kategori: doc.kategori,
    jumlah: doc.jumlah,
    createdAt: doc.createdAt,
  };
}

function collection() {
  try {
    return db.expenses();
  } catch {
    throw httpError(503, 'Database belum siap, coba lagi sebentar.');
  }
}

// ---------- Handler ----------
async function handleHealth(res) {
  try {
    await db.ping();
    sendJson(res, 200, { status: 'ok' });
  } catch {
    sendJson(res, 503, { status: 'database tidak tersedia' });
  }
}

async function handleApi(req, res, url) {
  const match = url.pathname.match(/^\/api\/expenses(?:\/([^/]+))?$/);
  if (!match) throw httpError(404, 'Endpoint tidak ditemukan.');
  const id = match[1];
  const col = collection();

  // /api/expenses
  if (!id) {
    if (req.method === 'GET') {
      const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
      return sendJson(res, 200, docs.map(toJson));
    }
    if (req.method === 'POST') {
      const data = validate(await readJson(req));
      const doc = { ...data, createdAt: new Date() };
      const result = await col.insertOne(doc);
      return sendJson(res, 201, toJson({ ...doc, _id: result.insertedId }));
    }
    throw httpError(405, 'Metode tidak diizinkan.');
  }

  // /api/expenses/:id
  if (!/^[0-9a-fA-F]{24}$/.test(id)) throw httpError(400, 'ID tidak valid.');
  const _id = new ObjectId(id);

  if (req.method === 'PUT') {
    const data = validate(await readJson(req));
    const result = await col.updateOne({ _id }, { $set: data });
    if (result.matchedCount === 0) throw httpError(404, 'Data tidak ditemukan.');
    return sendJson(res, 200, { id, ...data });
  }
  if (req.method === 'DELETE') {
    const result = await col.deleteOne({ _id });
    if (result.deletedCount === 0) throw httpError(404, 'Data tidak ditemukan.');
    res.writeHead(204);
    return res.end();
  }
  throw httpError(405, 'Metode tidak diizinkan.');
}

// ---------- Berkas statis (daftar tetap, tanpa akses path bebas) ----------
const STATIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'application/javascript; charset=utf-8' },
  '/style.css': { file: 'style.css', type: 'text/css; charset=utf-8' },
};

function loadStatic() {
  const loaded = {};
  for (const [route, meta] of Object.entries(STATIC_FILES)) {
    let body = fs.readFileSync(path.join(PUBLIC_DIR, meta.file), 'utf8');
    if (route === '/') body = body.replaceAll('__OWNER__', escapeHtml(OWNER));
    loaded[route] = { body, type: meta.type };
  }
  return loaded;
}

function createServer(staticFiles) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');

      if (url.pathname === '/health') return await handleHealth(res);
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);

      if (req.method === 'GET' || req.method === 'HEAD') {
        const asset = staticFiles[url.pathname];
        if (asset) {
          res.writeHead(200, {
            'Content-Type': asset.type,
            'Cache-Control': 'no-cache',
            'Content-Length': Buffer.byteLength(asset.body),
          });
          return res.end(req.method === 'HEAD' ? undefined : asset.body);
        }
      }
      throw httpError(404, 'Halaman tidak ditemukan.');
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      if (res.headersSent) return res.end();
      return sendJson(res, status, {
        error: status === 500 ? 'Terjadi kesalahan pada server.' : err.message,
      });
    }
  });
}

// ---------- Start ----------
async function main() {
  for (const key of ['MONGO_DB', 'MONGO_USER', 'MONGO_PASSWORD']) {
    if (!process.env[key]) {
      console.error(`Variabel lingkungan ${key} belum diisi.`);
      process.exit(1);
    }
  }

  const server = createServer(loadStatic());
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server berjalan di port ${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} diterima, menghentikan server...`);
    server.close();
    server.closeAllConnections();
    await db.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await db.connect();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { createServer, loadStatic };
