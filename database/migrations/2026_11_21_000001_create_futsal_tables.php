<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('role', 20)->default('admin')->after('email');
        });

        Schema::create('settings', function (Blueprint $t) {
            $t->string('key', 60)->primary();
            $t->text('value')->nullable();
        });

        Schema::create('accounts', function (Blueprint $t) {
            $t->string('code', 10)->primary();
            $t->string('name');
            $t->string('type', 20);
            $t->string('subtype', 30);
            $t->boolean('is_cash')->default(false);
        });

        Schema::create('fields', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('type')->nullable();
            $t->unsignedInteger('price_day');
            $t->unsignedInteger('price_night');
            $t->unsignedTinyInteger('night_start')->default(17);
            $t->string('color', 20)->default('#16a34a');
            $t->boolean('active')->default(true);
            $t->timestamps();
        });

        Schema::create('customers', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('phone', 30)->nullable();
            $t->string('team')->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();
            $t->index('name');
        });

        Schema::create('suppliers', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('phone', 30)->nullable();
            $t->string('address')->nullable();
            $t->timestamps();
        });

        Schema::create('products', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('category', 20)->default('fnb');
            $t->string('unit', 20)->default('pcs');
            $t->unsignedInteger('price')->default(0);
            $t->unsignedInteger('cost')->default(0);
            $t->integer('stock')->default(0);
            $t->integer('min_stock')->default(10);
            $t->boolean('track_stock')->default(true);
            $t->boolean('active')->default(true);
            $t->timestamps();
        });

        Schema::create('bookings', function (Blueprint $t) {
            $t->id();
            $t->string('code', 20)->nullable()->unique();
            $t->foreignId('customer_id')->constrained()->restrictOnDelete();
            $t->foreignId('field_id')->constrained()->restrictOnDelete();
            $t->date('date');
            $t->unsignedTinyInteger('start_hour');
            $t->unsignedTinyInteger('end_hour');
            $t->unsignedBigInteger('subtotal')->default(0);
            $t->unsignedBigInteger('discount')->default(0);
            $t->unsignedBigInteger('total')->default(0);
            $t->string('status', 10)->default('booked');
            $t->string('series', 20)->nullable()->index();
            $t->text('notes')->nullable();
            $t->timestamps();
            $t->index(['field_id', 'date', 'status']);
            $t->index(['date', 'status']);
        });

        Schema::create('booking_payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $t->date('date');
            $t->unsignedBigInteger('amount');
            $t->string('method', 10)->default('cash');
            $t->string('note')->nullable();
            $t->timestamps();
        });

        Schema::create('sales', function (Blueprint $t) {
            $t->id();
            $t->string('code', 20)->nullable()->unique();
            $t->date('date')->index();
            $t->string('customer_name')->nullable();
            $t->string('method', 10)->default('cash');
            $t->unsignedBigInteger('total')->default(0);
            $t->text('notes')->nullable();
            $t->timestamps();
        });

        Schema::create('sale_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $t->string('name');
            $t->string('category', 20);
            $t->unsignedInteger('qty');
            $t->unsignedInteger('price');
            $t->unsignedInteger('cost');
            $t->boolean('track_stock');
        });

        Schema::create('purchases', function (Blueprint $t) {
            $t->id();
            $t->string('code', 20)->nullable()->unique();
            $t->date('date')->index();
            $t->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $t->string('method', 10)->default('cash');
            $t->unsignedBigInteger('total')->default(0);
            $t->date('paid_date')->nullable();
            $t->string('paid_method', 10)->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();
        });

        Schema::create('purchase_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('purchase_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $t->string('account_code', 10)->nullable();
            $t->string('description');
            $t->unsignedInteger('qty');
            $t->unsignedBigInteger('price');
        });

        Schema::create('stock_adjustments', function (Blueprint $t) {
            $t->id();
            $t->date('date')->index();
            $t->foreignId('product_id')->constrained()->cascadeOnDelete();
            $t->integer('system_qty');
            $t->integer('actual_qty');
            $t->integer('diff');
            $t->unsignedInteger('cost')->default(0);
            $t->string('note')->nullable();
            $t->timestamps();
        });

        Schema::create('journals', function (Blueprint $t) {
            $t->id();
            $t->date('date')->index();
            $t->string('ref_type', 30)->default('manual');
            $t->unsignedBigInteger('ref_id')->nullable();
            $t->string('description')->nullable();
            $t->timestamps();
            $t->index(['ref_type', 'ref_id']);
        });

        Schema::create('journal_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('journal_id')->constrained()->cascadeOnDelete();
            $t->string('account_code', 10);
            $t->unsignedBigInteger('debit')->default(0);
            $t->unsignedBigInteger('credit')->default(0);
            $t->foreign('account_code')->references('code')->on('accounts');
            $t->index(['account_code', 'journal_id']);
        });

        Schema::create('budgets', function (Blueprint $t) {
            $t->unsignedSmallInteger('year');
            $t->unsignedTinyInteger('month');
            $t->string('account_code', 10);
            $t->bigInteger('amount')->default(0);
            $t->primary(['year', 'month', 'account_code']);
            $t->foreign('account_code')->references('code')->on('accounts');
        });
    }

    public function down(): void
    {
        foreach (['budgets', 'journal_lines', 'journals', 'stock_adjustments', 'purchase_items', 'purchases', 'sale_items', 'sales', 'booking_payments', 'bookings', 'products', 'suppliers', 'customers', 'fields', 'accounts', 'settings'] as $t) {
            Schema::dropIfExists($t);
        }
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('role'));
    }
};
