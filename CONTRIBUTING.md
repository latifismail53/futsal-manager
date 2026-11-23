# Panduan Kontribusi

Terima kasih ingin ikut mengembangkan Futsal Manager. Issue dan pull request boleh ditulis dalam Bahasa Indonesia atau Inggris.

## Alur kerja

1. Fork repo, lalu buat branch dari `main`: `git checkout -b fitur/nama-singkat`.
2. Siapkan aplikasi sesuai bagian [Instalasi](README.md#instalasi) dan buat database tes `futsal_test`.
3. Buat perubahan sekecil dan sefokus mungkin. Tambahkan tes untuk perilaku baru.
4. Jalankan semua pengecekan sebelum push:

    ```bash
    vendor/bin/pint            # format PHP
    vendor/bin/phpstan analyse
    php artisan test
    pnpm run check:fix
    pnpm run types:check
    pnpm run build
    ```

5. Buka pull request ke `main` dan isi template-nya.

## Konvensi kode

- **Controller tipis.** Logika bisnis ada di `app/Services`, validasi di `app/Http/Requests`.
- **Uang dalam integer rupiah.** Jangan pakai float untuk nominal.
- **Transaksi database.** Operasi yang mengubah stok, pembayaran, atau jurnal dibungkus `DB::transaction()`.
- **Jurnal harus seimbang.** Pakai `App\Services\Journal::post()`; jurnal tidak seimbang akan ditolak.
- **Kolom nominal unsigned.** Di SQL, tulis `SUM(debit) - SUM(credit)`, bukan `SUM(debit - credit)`.
- **Frontend.** Pakai komponen shadcn/ui di `resources/js/components/ui` dan komponen bersama di `resources/js/components/futsal`. Pastikan tampilan tetap rapi di lebar 390px, 820px, dan 1440px.
- **Bahasa.** Label antarmuka memakai Bahasa Indonesia.

## Melaporkan bug atau meminta fitur

Gunakan [template issue](https://github.com/latifismail53/futsal-manager/issues/new/choose). Sertakan langkah reproduksi, perilaku yang diharapkan, dan tangkapan layar bila ada.
