# futsal-manager

Aplikasi manajemen rental futsal: Laravel 13 + Inertia + React + shadcn/ui + MySQL.

## Fitur

- Dashboard, Cek Jam Kosong, kalender harian/mingguan/bulanan
- Pemesanan (DP, pelunasan, booking rutin mingguan, deteksi bentrok, nota, WhatsApp)
- Penjualan (POS), pembelian (tunai/bank/kredit, pelunasan hutang), stok & opname
- Pelanggan, master data (lapangan, produk, pelanggan, supplier), pengaturan usaha
- Akuntansi: jurnal otomatis & manual, buku besar, neraca saldo, COA
- Laporan keuangan: laba rugi, neraca, arus kas, rasio
- Anggaran vs realisasi, laporan pemesanan interaktif
- Peran: owner, admin, kasir, akuntan

## Kebutuhan

PHP 8.3+, Composer, Node 22+ dan pnpm, MySQL 8, Redis (phpredis).

## Instalasi

```bash
composer install
pnpm install
cp .env.example .env
php artisan key:generate
# atur DB_* (MySQL) dan REDIS_* di .env
php artisan migrate --seed
pnpm run build
php artisan serve
```

Akun demo (password `password`): `owner@futsal.test`, `admin@futsal.test`, `kasir@futsal.test`, `akuntan@futsal.test`. Ganti sebelum dipakai di produksi.

## Pengujian

```bash
php artisan test          # memakai database MySQL futsal_test (lihat phpunit.xml)
./vendor/bin/phpstan analyse
pnpm run types:check
pnpm run check
```
