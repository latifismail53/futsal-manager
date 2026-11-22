<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Insights;
use App\Services\Journal;
use App\Services\Settings;
use Database\Seeders\DemoSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class GeneralController extends Controller
{
    public function dashboard(): JsonResponse
    {
        return response()->json(Insights::dashboard());
    }

    public function settings(): JsonResponse
    {
        return response()->json(Settings::all());
    }

    public function saveSettings(Request $request): JsonResponse
    {
        Settings::put($request->validate([
            'business_name' => 'sometimes|required|string|max:255', 'address' => 'nullable|string|max:255', 'phone' => 'nullable|string|max:30',
            'open_hour' => 'sometimes|integer|between:0,23', 'close_hour' => 'sometimes|integer|between:1,24', 'bank_info' => 'nullable|string|max:255', 'receipt_footer' => 'nullable|string|max:255',
        ]));

        return response()->json(['ok' => true]);
    }

    public function customerStats(): JsonResponse
    {
        return response()->json(Insights::customerStats());
    }

    public function customerHistory(int $id): JsonResponse
    {
        return response()->json(Insights::customerHistory($id));
    }

    public function resetDemo(): JsonResponse
    {
        abort_unless(config('futsal.allow_reset'), 403, 'Reset dinonaktifkan');
        Schema::disableForeignKeyConstraints();
        foreach (['stock_adjustments', 'journal_lines', 'journals', 'booking_payments', 'bookings', 'sale_items', 'sales', 'purchase_items', 'purchases', 'budgets', 'products', 'customers', 'suppliers', 'fields'] as $t) {
            DB::table($t)->truncate();
        }
        Schema::enableForeignKeyConstraints();
        (new DemoSeeder)->run();
        Journal::flush();

        return response()->json(['ok' => true]);
    }
}
