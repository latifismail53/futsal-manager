<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([BaseSeeder::class, DemoSeeder::class]);

        foreach ([['Pemilik', 'owner@futsal.test', 'owner'], ['Admin', 'admin@futsal.test', 'admin'], ['Kasir', 'kasir@futsal.test', 'kasir'], ['Akuntan', 'akuntan@futsal.test', 'akuntan']] as [$name, $email, $role]) {
            User::query()->firstOrCreate(['email' => $email], ['name' => $name, 'password' => 'password', 'role' => $role, 'email_verified_at' => now()]);
        }
    }
}
