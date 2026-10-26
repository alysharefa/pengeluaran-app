# Pencatat Pengeluaran

Aplikasi CRUD pencatat pengeluaran harian: **Node.js (tanpa framework) + MongoDB**,
dijalankan dengan Docker Compose.

## Menjalankan

```bash
cp .env.example .env      # lalu edit nilai di dalam .env
docker compose up -d --build
docker compose ps
```

Buka `http://localhost` (lokal) atau `http://<IP_PUBLIC_VM>` (Azure VM).
Tunggu hingga kedua container berstatus `healthy` (MongoDB butuh sekitar 20-40 detik).

## Struktur

| Path | Fungsi |
|---|---|
| `Dockerfile` | Multi-stage build image aplikasi |
| `compose.yaml` | Service app + db, network internal, volume, healthcheck |
| `src/server.js` | Server HTTP dan REST API (Create, Read, Update, Delete) |
| `src/db.js` | Koneksi MongoDB dengan percobaan ulang otomatis |
| `public/` | Halaman web (HTML, CSS, JavaScript) |
| `.env.example` | Contoh variabel rahasia (salin menjadi `.env`) |

## API

| Metode | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/expenses` | Daftar pengeluaran |
| POST | `/api/expenses` | Tambah pengeluaran |
| PUT | `/api/expenses/:id` | Ubah pengeluaran |
| DELETE | `/api/expenses/:id` | Hapus pengeluaran |
| GET | `/health` | Cek aplikasi dan koneksi database |

## Perintah berguna

```bash
docker compose logs -f app       # lihat log aplikasi
docker compose down              # hentikan (data tetap aman)
docker compose down -v           # hentikan + HAPUS data database
```
