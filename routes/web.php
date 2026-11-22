<?php

use App\Http\Controllers\Api\AccountingController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\GeneralController;
use App\Http\Controllers\Api\MasterController;
use App\Http\Controllers\Api\TradeController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

const OPS = 'role:admin,kasir';
const FIN = 'role:akuntan';

Route::middleware(['auth'])->group(function () {
    // Halaman (Inertia)
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::middleware(OPS)->group(function () {
        Route::inertia('jam-kosong', 'availability')->name('availability');
        Route::inertia('kalender', 'calendar')->name('calendar');
        Route::inertia('pemesanan', 'bookings/index')->name('bookings');
        Route::inertia('penjualan', 'sales')->name('sales');
        Route::inertia('pelanggan', 'customers')->name('customers');
    });
    Route::middleware('role:admin')->group(function () {
        Route::inertia('stok', 'stock')->name('stock');
        Route::inertia('master', 'master')->name('master');
        Route::inertia('pengaturan', 'business-settings')->name('business.settings');
    });
    Route::inertia('pembelian', 'purchases')->middleware('role:admin,akuntan')->name('purchases');
    Route::inertia('laporan-pemesanan', 'booking-report')->middleware('role:admin,akuntan')->name('booking.report');
    Route::middleware(FIN)->group(function () {
        Route::inertia('akuntansi', 'accounting')->name('accounting');
        Route::inertia('laporan-keuangan', 'financials')->name('financials');
        Route::inertia('anggaran', 'budget')->name('budget');
    });

    // Endpoint data JSON (sesi + CSRF, untuk komponen interaktif)
    Route::prefix('api')->group(function () {
        Route::get('dashboard', [GeneralController::class, 'dashboard']);
        Route::get('settings', [GeneralController::class, 'settings']);
        Route::get('accounts', [AccountingController::class, 'accounts']);
        Route::get('{type}', [MasterController::class, 'index'])->whereIn('type', ['fields', 'customers', 'suppliers', 'products']);

        Route::middleware(OPS)->group(function () {
            Route::get('availability', [BookingController::class, 'availability']);
            Route::get('availability/days', [BookingController::class, 'availabilityDays']);
            Route::get('bookings', [BookingController::class, 'index']);
            Route::get('bookings/quote', [BookingController::class, 'quote']);
            Route::get('bookings/{id}', [BookingController::class, 'show'])->whereNumber('id');
            Route::post('bookings', [BookingController::class, 'store']);
            Route::post('bookings/recurring', [BookingController::class, 'recurring']);
            Route::post('bookings/complete-past', [BookingController::class, 'completePast']);
            Route::post('bookings/series/{series}/cancel', [BookingController::class, 'cancelSeries']);
            Route::put('bookings/{id}', [BookingController::class, 'update']);
            Route::post('bookings/{id}/status', [BookingController::class, 'status']);
            Route::post('bookings/{id}/payments', [BookingController::class, 'addPayment']);
            Route::delete('booking-payments/{pid}', [BookingController::class, 'deletePayment']);
            Route::get('customer-stats', [GeneralController::class, 'customerStats']);
            Route::get('customers/{id}/history', [GeneralController::class, 'customerHistory']);
            Route::post('customers', [MasterController::class, 'store'])->defaults('type', 'customers');
            Route::get('sales', [TradeController::class, 'sales']);
            Route::get('sales/{id}', [TradeController::class, 'sale']);
            Route::post('sales', [TradeController::class, 'storeSale']);
        });

        Route::middleware('role:admin')->group(function () {
            Route::delete('bookings/{id}', [BookingController::class, 'destroy']);
            Route::delete('sales/{id}', [TradeController::class, 'destroySale']);
            Route::post('{type}', [MasterController::class, 'store'])->whereIn('type', ['fields', 'suppliers', 'products']);
            Route::put('{type}/{id}', [MasterController::class, 'update'])->whereIn('type', ['fields', 'customers', 'suppliers', 'products']);
            Route::delete('{type}/{id}', [MasterController::class, 'destroy'])->whereIn('type', ['fields', 'customers', 'suppliers', 'products']);
            Route::get('stock-adjustments', [TradeController::class, 'adjustments']);
            Route::post('stock-adjustments', [TradeController::class, 'storeAdjustment']);
            Route::delete('stock-adjustments/{id}', [TradeController::class, 'destroyAdjustment']);
            Route::get('products/{id}/movements', [TradeController::class, 'movements']);
            Route::put('settings', [GeneralController::class, 'saveSettings']);
            Route::post('reset-demo', [GeneralController::class, 'resetDemo']);
        });

        Route::middleware('role:admin,akuntan')->group(function () {
            Route::get('purchases', [TradeController::class, 'purchases']);
            Route::get('purchases/{id}', [TradeController::class, 'purchase']);
            Route::post('purchases', [TradeController::class, 'storePurchase']);
            Route::post('purchases/{id}/pay', [TradeController::class, 'payPurchase']);
            Route::delete('purchases/{id}', [TradeController::class, 'destroyPurchase']);
            Route::get('reports/bookings', [AccountingController::class, 'report'])->defaults('type', 'bookings');
        });

        Route::middleware(FIN)->group(function () {
            Route::post('accounts', [AccountingController::class, 'storeAccount']);
            Route::put('accounts/{code}', [AccountingController::class, 'updateAccount']);
            Route::delete('accounts/{code}', [AccountingController::class, 'destroyAccount']);
            Route::get('journals', [AccountingController::class, 'journals']);
            Route::post('journals', [AccountingController::class, 'storeJournal']);
            Route::delete('journals/{id}', [AccountingController::class, 'destroyJournal']);
            Route::get('budgets', [AccountingController::class, 'budgets']);
            Route::put('budgets', [AccountingController::class, 'saveBudgets']);
            Route::get('reports/{type}', [AccountingController::class, 'report']);
        });
    });
});

require __DIR__.'/settings.php';
