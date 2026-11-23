# Kebijakan Keamanan

## Melaporkan celah keamanan

Jangan laporkan celah keamanan lewat issue publik. Gunakan fitur [Report a vulnerability](https://github.com/latifismail53/futsal-manager/security/advisories/new) (GitHub private vulnerability reporting).

Sertakan jenis celah, langkah reproduksi, dan dampaknya. Laporan akan ditanggapi secepatnya, dan perbaikan dirilis sebelum detail celah dipublikasikan.

## Versi yang didukung

Hanya branch `main` terbaru yang menerima perbaikan keamanan.

## Saran untuk instalasi produksi

- Set `APP_ENV=production`, `APP_DEBUG=false`, dan `FUTSAL_ALLOW_RESET=false`.
- Hapus atau ganti akun demo (`*@futsal.test`).
- Jangan commit file `.env`.
- Gunakan HTTPS dan password database/Redis yang kuat.
