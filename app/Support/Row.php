<?php

namespace App\Support;

use DomainException;
use Illuminate\Support\Facades\DB;
use stdClass;

/**
 * Akses baris tunggal dengan tipe yang jelas (stdClass) untuk query builder.
 */
class Row
{
    public static function maybe(string $table, int|string $id, bool $lock = false): ?stdClass
    {
        return DB::table($table)->where('id', $id)->when($lock, fn ($q) => $q->lockForUpdate())->first();
    }

    public static function find(string $table, int|string $id, string $what = 'Data', bool $lock = false): stdClass
    {
        return self::maybe($table, $id, $lock) ?? throw new DomainException("{$what} tidak ditemukan");
    }
}
