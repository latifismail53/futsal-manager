<?php

namespace App\Enums;

final class Acc
{
    public const KAS = '1-1100';
    public const BANK = '1-1200';
    public const PIUTANG = '1-1300';
    public const PERSEDIAAN = '1-1400';
    public const PERALATAN = '1-2100';
    public const BANGUNAN = '1-2200';
    public const AKUM = '1-2900';
    public const HUTANG = '2-1100';
    public const UANG_MUKA = '2-1200';
    public const HUTANG_BANK = '2-2100';
    public const MODAL = '3-1100';
    public const PRIVE = '3-1200';
    public const LABA_DITAHAN = '3-2100';
    public const PEND_SEWA = '4-1100';
    public const PEND_FNB = '4-1200';
    public const PEND_ALAT = '4-1300';
    public const PEND_LAIN = '4-9100';
    public const HPP = '5-1100';
    public const BEBAN_LAIN = '6-1900';

    /** @var list<array{0:string,1:string,2:string,3:string,4:bool}> */
    public const DEFAULTS = [
        ['1-1100', 'Kas', 'asset', 'current_asset', true],
        ['1-1200', 'Bank', 'asset', 'current_asset', true],
        ['1-1300', 'Piutang Usaha', 'asset', 'current_asset', false],
        ['1-1400', 'Persediaan Barang', 'asset', 'current_asset', false],
        ['1-2100', 'Peralatan', 'asset', 'fixed_asset', false],
        ['1-2200', 'Bangunan & Lapangan', 'asset', 'fixed_asset', false],
        ['1-2900', 'Akumulasi Penyusutan', 'asset', 'contra_asset', false],
        ['2-1100', 'Hutang Usaha', 'liability', 'current_liability', false],
        ['2-1200', 'Uang Muka Pelanggan', 'liability', 'current_liability', false],
        ['2-2100', 'Hutang Bank', 'liability', 'long_liability', false],
        ['3-1100', 'Modal Pemilik', 'equity', 'equity', false],
        ['3-1200', 'Prive', 'equity', 'equity', false],
        ['3-2100', 'Laba Ditahan', 'equity', 'equity', false],
        ['4-1100', 'Pendapatan Sewa Lapangan', 'revenue', 'revenue', false],
        ['4-1200', 'Pendapatan Penjualan F&B', 'revenue', 'revenue', false],
        ['4-1300', 'Pendapatan Sewa Perlengkapan', 'revenue', 'revenue', false],
        ['4-9100', 'Pendapatan Lain-lain', 'revenue', 'other_revenue', false],
        ['5-1100', 'Harga Pokok Penjualan', 'expense', 'cogs', false],
        ['6-1100', 'Beban Gaji', 'expense', 'expense', false],
        ['6-1200', 'Beban Listrik & Air', 'expense', 'expense', false],
        ['6-1300', 'Beban Perawatan Lapangan', 'expense', 'expense', false],
        ['6-1400', 'Beban Sewa Tempat', 'expense', 'expense', false],
        ['6-1500', 'Beban Pemasaran', 'expense', 'expense', false],
        ['6-1600', 'Beban Penyusutan', 'expense', 'expense', false],
        ['6-1700', 'Beban Perlengkapan', 'expense', 'expense', false],
        ['6-1900', 'Beban Lain-lain', 'expense', 'expense', false],
        ['6-9100', 'Beban Bunga', 'expense', 'other_expense', false],
    ];

    public static function cash(?string $method): string
    {
        return $method === 'bank' ? self::BANK : self::KAS;
    }
}
