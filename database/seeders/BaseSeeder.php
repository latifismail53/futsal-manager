<?php

namespace Database\Seeders;

use App\Enums\Acc;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class BaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Acc::DEFAULTS as [$code, $name, $type, $subtype, $cash]) {
            DB::table('accounts')->insertOrIgnore(compact('code', 'name', 'type', 'subtype') + ['is_cash' => $cash]);
        }
        $defaults = ['business_name' => 'Arena Futsal Nusantara', 'open_hour' => '8', 'close_hour' => '24', 'address' => 'Jl. Merdeka No. 10',
            'phone' => '081234567890', 'bank_info' => 'BCA 1234567890 a.n. Arena Futsal Nusantara', 'receipt_footer' => 'Terima kasih, selamat bermain!'];
        foreach ($defaults as $key => $value) {
            DB::table('settings')->insertOrIgnore(compact('key', 'value'));
        }
    }
}
