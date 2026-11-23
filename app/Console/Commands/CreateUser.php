<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

#[Signature('futsal:user {email} {--name= : Nama pengguna} {--role= : owner, admin, kasir, atau akuntan (akun baru: owner; akun lama: peran tetap)}')]
#[Description('Buat atau perbarui akun pengguna beserta perannya (password diminta secara interaktif)')]
class CreateUser extends Command
{
    public const ROLES = ['owner', 'admin', 'kasir', 'akuntan'];

    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $user = User::query()->firstOrNew(['email' => strtolower($email)]);
        $role = (string) ($this->option('role') ?? ($user->exists ? $user->role : 'owner'));
        if (! in_array($role, self::ROLES, true)) {
            $this->error('Peran harus salah satu dari: '.implode(', ', self::ROLES));

            return self::FAILURE;
        }
        $password = (string) $this->secret('Password');

        $validator = Validator::make(
            ['email' => $email, 'role' => $role, 'password' => $password, 'password_confirmation' => (string) $this->secret('Ulangi password')],
            ['email' => ['required', 'email'], 'role' => ['required', 'in:'.implode(',', self::ROLES)], 'password' => ['required', 'confirmed', Password::defaults()]],
        );
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user->forceFill([
            'name' => $this->option('name') ?: ($user->name ?? strstr($email, '@', true)),
            'password' => $password,
            'role' => $role,
            'email_verified_at' => $user->email_verified_at ?? now(),
            'remember_token' => Str::random(60),
        ])->save();

        $this->info("Akun {$user->email} ({$role}) tersimpan.");

        return self::SUCCESS;
    }
}
