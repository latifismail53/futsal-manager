# Arsitektur

## Gambaran umum

```
Browser (React 19 + shadcn/ui)
   │  Inertia (halaman)          fetch /api/* (JSON, session + XSRF)
   ▼                              ▼
Laravel 13 ── routes/web.php ── middleware auth + role:<peran>
   │
   ├── app/Http/Controllers/Api   controller tipis
   ├── app/Http/Requests          validasi (Form Request)
   ├── app/Services               logika bisnis
   │     ├── Bookings             booking, tarif, bentrok, jam kosong, booking rutin
   │     ├── Inventory            penjualan, pembelian, HPP rata-rata, stok opname
   │     ├── Journal              posting & sinkronisasi jurnal otomatis
   │     ├── FinancialReports     neraca saldo, laba rugi, neraca, arus kas, anggaran
   │     ├── Insights             dashboard, statistik pelanggan, laporan pemesanan
   │     ├── Pricing, Settings
   │
   ├── MySQL                      data transaksi & jurnal
   └── Redis                      cache laporan, session, queue
```

## Struktur folder penting

| Folder                            | Isi                                                           |
| --------------------------------- | ------------------------------------------------------------- |
| `app/Services`                    | Logika bisnis dan akuntansi                                   |
| `app/Enums/Acc.php`               | Kode akun (COA) yang dipakai jurnal otomatis                  |
| `database/migrations`             | Skema tabel                                                   |
| `database/seeders/DemoSeeder.php` | Data contoh ±4 bulan                                          |
| `resources/js/pages`              | Halaman Inertia (satu file per menu)                          |
| `resources/js/components/futsal`  | Komponen bersama: `kit.tsx`, `charts.tsx`, `booking-form.tsx` |
| `resources/js/lib/futsal`         | Klien API, format rupiah/tanggal, nota, WhatsApp, CSV         |
| `tests/Feature`                   | Tes alur bisnis dan hak akses                                 |

## Peran dan hak akses

Middleware `role:` membatasi halaman dan endpoint API. `owner` selalu lolos.

| Peran   | Akses                                                                                     |
| ------- | ----------------------------------------------------------------------------------------- |
| owner   | Semua                                                                                     |
| admin   | Operasional, stok, pembelian, master data, pengaturan, laporan pemesanan, hapus transaksi |
| kasir   | Dashboard, jam kosong, kalender, pemesanan, penjualan, pelanggan                          |
| akuntan | Dashboard, pembelian, akuntansi, laporan keuangan, anggaran, laporan pemesanan            |

## Aturan akuntansi

Semua nominal disimpan sebagai integer rupiah. Setiap transaksi memanggil `Journal::post()` di dalam `DB::transaction()`, dan jurnal yang tidak seimbang ditolak.

| Kejadian                  | Debit                                     | Kredit                                         |
| ------------------------- | ----------------------------------------- | ---------------------------------------------- |
| DP / pembayaran booking   | Kas atau Bank                             | Uang Muka Pelanggan                            |
| Booking selesai           | Uang Muka Pelanggan, Piutang Usaha (sisa) | Pendapatan Sewa Lapangan                       |
| Booking batal (DP hangus) | Uang Muka Pelanggan                       | Pendapatan Lain-lain                           |
| Penjualan                 | Kas/Bank; HPP                             | Pendapatan F&B / Sewa Perlengkapan; Persediaan |
| Pembelian barang          | Persediaan (HPP rata-rata tertimbang)     | Kas, Bank, atau Hutang Usaha                   |
| Pembelian beban/aset      | Akun beban atau aset                      | Kas, Bank, atau Hutang Usaha                   |
| Pelunasan hutang          | Hutang Usaha                              | Kas atau Bank                                  |
| Opname: stok kurang       | Beban Lain-lain                           | Persediaan                                     |
| Opname: stok lebih        | Persediaan                                | Pendapatan Lain-lain                           |

Laporan keuangan dihitung dari jurnal yang sudah diposting. Ekuitas di neraca mencakup laba ditahan dan laba tahun berjalan, sehingga neraca selalu seimbang.

### Bagan akun

| Kode   | Akun                 | Kode            | Akun                         |
| ------ | -------------------- | --------------- | ---------------------------- |
| 1-1100 | Kas                  | 3-1100          | Modal Pemilik                |
| 1-1200 | Bank                 | 3-1200          | Prive                        |
| 1-1300 | Piutang Usaha        | 3-2100          | Laba Ditahan                 |
| 1-1400 | Persediaan Barang    | 4-1100          | Pendapatan Sewa Lapangan     |
| 1-2100 | Peralatan            | 4-1200          | Pendapatan Penjualan F&B     |
| 1-2200 | Bangunan & Lapangan  | 4-1300          | Pendapatan Sewa Perlengkapan |
| 1-2900 | Akumulasi Penyusutan | 4-9100          | Pendapatan Lain-lain         |
| 2-1100 | Hutang Usaha         | 5-1100          | Harga Pokok Penjualan        |
| 2-1200 | Uang Muka Pelanggan  | 6-1100 – 6-1900 | Beban operasional            |
| 2-2100 | Hutang Bank          | 6-9100          | Beban Bunga                  |

## Pencegahan booking bentrok

Booking baru atau yang diubah ditolak bila ada booking lain (selain status `batal`) di lapangan dan tanggal yang sama dengan `start_hour < end_hour_baru` dan `end_hour > start_hour_baru`. Pengecekan dilakukan di backend dalam transaksi, jadi tetap aman walau frontend dilewati. Booking rutin mingguan mengecek setiap tanggal dan bisa melewati tanggal yang bentrok.

## Performa

- Index untuk pencarian jadwal (`field_id, date, status`), jurnal (`ref_type, ref_id`), dan saldo akun (`account_code, journal_id`).
- Agregasi laporan langsung di SQL, hasilnya di-cache di Redis dan otomatis kedaluwarsa saat ada jurnal baru (`reports:version`).
- Code splitting per halaman; Chart.js hanya dimuat di halaman bergrafik. Link sidebar memakai Inertia prefetch.
- Respons API di frontend di-memo dan dibersihkan setelah ada perubahan data.
