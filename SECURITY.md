# Kebijakan Keamanan

## Melaporkan celah keamanan

Jangan laporkan celah keamanan lewat issue publik. Gunakan fitur [Report a vulnerability](https://github.com/latifismail53/futsal-manager/security/advisories/new) (GitHub private vulnerability reporting).

Sertakan jenis celah, langkah reproduksi, dan dampaknya. Laporan akan ditanggapi secepatnya, dan perbaikan dirilis sebelum detail celah dipublikasikan.

## Versi yang didukung

Hanya branch `main` terbaru yang menerima perbaikan keamanan.

## Saran untuk instalasi produksi

- Set `APP_ENV=production`, `APP_DEBUG=false`, dan `FUTSAL_ALLOW_RESET=false` **sebelum** `php artisan optimize`.
- Set `SESSION_SECURE_COOKIE=true` dan `APP_URL` dengan `https://`.
- Jangan pakai akun demo (`*@futsal.test`). Di produksi akun demo tidak dibuat; buat akun dengan `php artisan futsal:user`.
- Aktifkan 2FA untuk akun pemilik dan akuntan.
- Jangan commit file `.env`.
- Gunakan HTTPS dan password database/Redis yang kuat.

## Batasan keamanan yang diketahui

- Belum ada Content Security Policy (CSP).
- Belum ada log aktivitas pengguna (audit trail).
- Belum ada penguncian periode akuntansi, sehingga transaksi lama masih bisa diubah oleh peran yang berwenang.
