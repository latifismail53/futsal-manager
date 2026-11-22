<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\BaseSeeder;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FutsalPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_pages_and_read_endpoints_work_with_demo_data(): void
    {
        $this->seed([BaseSeeder::class, DemoSeeder::class]);
        $this->actingAs(User::factory()->create(['role' => 'owner']));
        $today = now()->toDateString();
        $from = now()->startOfYear()->toDateString();

        foreach (['dashboard', 'jam-kosong', 'kalender', 'pemesanan', 'penjualan', 'pembelian', 'stok', 'pelanggan', 'master', 'akuntansi', 'laporan-keuangan', 'anggaran', 'laporan-pemesanan', 'pengaturan'] as $page) {
            $this->get('/'.$page)->assertOk();
        }

        $q = "from={$from}&to={$today}";
        [$field, $booking, $customer, $sale, $purchase, $product] = array_map(fn ($t) => DB::table($t)->min('id'), ['fields', 'bookings', 'customers', 'sales', 'purchases', 'products']);
        $endpoints = [
            '/api/dashboard', '/api/settings', '/api/accounts', '/api/fields', '/api/customers', '/api/suppliers', '/api/products',
            "/api/availability?date={$today}", "/api/availability/days?from={$today}&days=14", "/api/bookings?{$q}", "/api/bookings/quote?field_id={$field}&start=8&end=10",
            "/api/bookings/{$booking}", '/api/customer-stats', "/api/customers/{$customer}/history", "/api/sales?{$q}", "/api/sales/{$sale}", "/api/purchases?{$q}", "/api/purchases/{$purchase}",
            "/api/stock-adjustments?{$q}", "/api/products/{$product}/movements", "/api/journals?{$q}", '/api/budgets?year='.now()->year,
            "/api/reports/trial-balance?to={$today}", "/api/reports/income-statement?{$q}", "/api/reports/balance-sheet?date={$today}",
            "/api/reports/cash-flow?{$q}", "/api/reports/ledger?account=1-1100&{$q}", '/api/reports/budget?year='.now()->year.'&mFrom=1&mTo=12',
            '/api/reports/income-monthly?year='.now()->year, "/api/reports/bookings?{$q}",
        ];

        foreach ($endpoints as $url) {
            $res = $this->getJson($url);
            $this->assertSame(200, $res->status(), $url.' → '.$res->getContent());
        }

        $this->assertTrue($this->getJson("/api/reports/balance-sheet?date={$today}")->json('balanced'));
    }
}
