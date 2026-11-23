<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->string('role', 20)->default('kasir')->change());
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->string('role', 20)->default('admin')->change());
    }
};
