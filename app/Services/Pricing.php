<?php

namespace App\Services;

class Pricing
{
    public static function forHours(\stdClass $field, int $start, int $end): int
    {
        $sum = 0;
        for ($h = $start; $h < $end; $h++) {
            $sum += $h >= $field->night_start ? $field->price_night : $field->price_day;
        }

        return $sum;
    }
}
