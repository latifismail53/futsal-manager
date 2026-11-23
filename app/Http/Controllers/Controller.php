<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    /** Tolak parameter tanggal yang tidak berformat Y-m-d (mencegah error 500 dari input acak). */
    protected function validateDates(Request $request, string ...$keys): void
    {
        $request->validate(array_fill_keys($keys, ['nullable', 'date_format:Y-m-d']));
    }
}
