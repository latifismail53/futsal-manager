<?php

namespace App\Services;

class Arr2
{
    /**
     * @param  object|array<string, mixed>  $o
     * @param  list<string>  $keys
     * @return array<string, mixed>
     */
    public static function only(object|array $o, array $keys): array
    {
        return array_intersect_key((array) $o, array_flip($keys));
    }
}
