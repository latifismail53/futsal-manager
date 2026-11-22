<?php

namespace App\Services;

class Arr2
{
    public static function only(object|array $o, array $keys): array
    {
        return array_intersect_key((array) $o, array_flip($keys));
    }
}
