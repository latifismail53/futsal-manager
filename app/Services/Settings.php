<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class Settings
{
    /** @return array<string, string|null> */
    public static function all(): array
    {
        return Cache::rememberForever('settings', fn () => DB::table('settings')->pluck('value', 'key')->all());
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return self::all()[$key] ?? $default;
    }

    /** @return array{0:int,1:int} */
    public static function hours(): array
    {
        return [(int) self::get('open_hour', 8) ?: 8, (int) self::get('close_hour', 24) ?: 24];
    }

    /** @param  array<string, scalar|null>  $values */
    public static function put(array $values): void
    {
        foreach ($values as $key => $value) {
            DB::table('settings')->updateOrInsert(['key' => $key], ['value' => (string) $value]);
        }
        Cache::forget('settings');
    }
}
