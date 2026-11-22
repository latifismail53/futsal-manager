<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Settings;
use Database\Seeders\BaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FutsalFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private int $fieldId;

    private int $productId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(BaseSeeder::class);
        Settings::put(['open_hour' => 8, 'close_hour' => 24]);
        $this->owner = User::factory()->create(['role' => 'owner']);
        $this->fieldId = DB::table('fields')->insertGetId(['name' => 'Lapangan A', 'type' => 'Vinyl', 'price_day' => 100000, 'price_night' => 150000, 'night_start' => 17, 'color' => '#16a34a', 'active' => 1]);
        $this->productId = DB::table('products')->insertGetId(['name' => 'Air Mineral', 'category' => 'fnb', 'unit' => 'btl', 'price' => 5000, 'cost' => 0, 'stock' => 0, 'track_stock' => 1, 'active' => 1]);
        $this->actingAs($this->owner);
    }

    private function assertBooksBalanced(): void
    {
        $tb = $this->getJson('/api/reports/trial-balance?to=2099-12-31')->assertOk()->json();
        $this->assertSame($tb['total_debit'], $tb['total_credit']);
        $this->assertTrue($this->getJson('/api/reports/balance-sheet?date=2099-12-31')->assertOk()->json('balanced'));
    }

    private function balance(string $code): int
    {
        $r = DB::table('journal_lines')->where('account_code', $code)->selectRaw('COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as b')->first();

        return (int) $r->b;
    }

    public function test_booking_lifecycle_rejects_conflicts_and_posts_journals(): void
    {
        $date = now()->addDays(3)->toDateString();
        $b = $this->postJson('/api/bookings', [
            'field_id' => $this->fieldId, 'date' => $date, 'start_hour' => 16, 'end_hour' => 18,
            'customer_name' => 'Budi', 'customer_phone' => '0812', 'payment_amount' => 100000, 'payment_method' => 'cash',
        ])->assertCreated()->json();

        $this->assertSame(250000, $b['total']); // 1 jam siang + 1 jam malam
        $this->assertSame(100000, $this->balance('1-1100'));
        $this->assertSame(-100000, $this->balance('2-1200'));

        $this->postJson('/api/bookings', ['field_id' => $this->fieldId, 'date' => $date, 'start_hour' => 17, 'end_hour' => 19, 'customer_name' => 'Andi'])
            ->assertStatus(422);

        $slots = collect($this->getJson("/api/availability?date={$date}")->assertOk()->json('fields.0.slots'));
        $this->assertFalse($slots->firstWhere('hour', 16)['free']);
        $this->assertTrue($slots->firstWhere('hour', 18)['free']);

        $this->postJson("/api/bookings/{$b['id']}/payments", ['amount' => 150000, 'method' => 'bank', 'date' => $date])->assertOk();
        $this->assertSame('lunas', $this->getJson("/api/bookings/{$b['id']}")->json('payment_status'));

        $this->postJson("/api/bookings/{$b['id']}/status", ['status' => 'selesai'])->assertOk();
        $this->assertSame(-250000, $this->balance('4-1100'));
        $this->assertSame(0, $this->balance('2-1200'));
        $this->assertBooksBalanced();
    }

    public function test_recurring_booking_skips_conflicting_weeks(): void
    {
        $date = now()->addDays(2)->toDateString();
        $this->postJson('/api/bookings', ['field_id' => $this->fieldId, 'date' => now()->addDays(9)->toDateString(), 'start_hour' => 20, 'end_hour' => 21, 'customer_name' => 'X'])->assertCreated();

        $body = ['field_id' => $this->fieldId, 'date' => $date, 'start_hour' => 20, 'end_hour' => 22, 'customer_name' => 'Tim Rutin', 'weeks' => 4];
        $preview = $this->postJson('/api/bookings/recurring', $body + ['preview' => true])->assertOk()->json('dates');
        $this->assertCount(4, $preview);
        $this->assertSame([true, false, true, true], array_column($preview, 'ok'));

        $r = $this->postJson('/api/bookings/recurring', $body + ['skip_conflicts' => true])->assertOk()->json();
        $this->assertCount(3, $r['created']);
        $this->assertCount(1, $r['skipped']);
    }

    public function test_purchase_sale_and_stock_opname_keep_inventory_and_books_consistent(): void
    {
        $today = now()->toDateString();
        $this->postJson('/api/purchases', ['date' => $today, 'method' => 'cash', 'items' => [['product_id' => $this->productId, 'qty' => 10, 'price' => 2000]]])->assertCreated();
        $credit = $this->postJson('/api/purchases', ['date' => $today, 'method' => 'credit', 'items' => [['product_id' => $this->productId, 'qty' => 10, 'price' => 3000]]])->assertCreated()->json();

        $p = DB::table('products')->find($this->productId);
        $this->assertSame(20, (int) $p->stock);
        $this->assertSame(2500, (int) $p->cost); // rata-rata tertimbang
        $this->assertSame(-30000, $this->balance('2-1100'));

        $this->postJson("/api/purchases/{$credit['id']}/pay", ['date' => $today, 'method' => 'bank'])->assertOk();
        $this->assertSame(0, $this->balance('2-1100'));

        $sale = $this->postJson('/api/sales', ['date' => $today, 'method' => 'cash', 'items' => [['product_id' => $this->productId, 'qty' => 4, 'price' => 5000]]])->assertCreated()->json();
        $this->assertSame(16, (int) DB::table('products')->find($this->productId)->stock);
        $this->assertSame(10000, $this->balance('5-1100'));
        $this->assertSame(-20000, $this->balance('4-1200'));

        $this->deleteJson("/api/sales/{$sale['id']}")->assertOk();
        $this->assertSame(20, (int) DB::table('products')->find($this->productId)->stock);
        $this->assertSame(0, $this->balance('5-1100'));

        $this->postJson('/api/stock-adjustments', ['date' => $today, 'items' => [['product_id' => $this->productId, 'actual_qty' => 18]]])->assertOk();
        $this->assertSame(18, (int) DB::table('products')->find($this->productId)->stock);
        $this->assertSame(5000, $this->balance('6-1900'));
        $this->assertBooksBalanced();
    }

    public function test_unbalanced_manual_journal_is_rejected(): void
    {
        $this->postJson('/api/journals', ['date' => now()->toDateString(), 'description' => 'Salah', 'lines' => [
            ['account_code' => '6-1100', 'debit' => 1000, 'credit' => 0],
            ['account_code' => '1-1100', 'debit' => 0, 'credit' => 900],
        ]])->assertStatus(422);
        $this->assertSame(0, DB::table('journals')->count());
    }

    public function test_roles_limit_menu_and_api_access(): void
    {
        $kasir = User::factory()->create(['role' => 'kasir']);
        $akuntan = User::factory()->create(['role' => 'akuntan']);

        $this->actingAs($kasir)->getJson('/api/journals')->assertForbidden();
        $this->actingAs($kasir)->get('/akuntansi')->assertForbidden();
        $this->actingAs($kasir)->getJson('/api/bookings')->assertOk();
        $this->actingAs($akuntan)->getJson('/api/bookings')->assertForbidden();
        $this->actingAs($akuntan)->getJson('/api/reports/income-statement?from=2026-01-01&to=2026-12-31')->assertOk();
        $this->actingAs($akuntan)->deleteJson('/api/fields/'.$this->fieldId)->assertForbidden();
    }
}
