<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\BaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(BaseSeeder::class);
    }

    private function as(string $role): static
    {
        return $this->actingAs(User::factory()->create(['role' => $role]));
    }

    public function test_responses_include_security_headers(): void
    {
        $this->get('/login')->assertOk()
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }

    public function test_only_admin_can_delete_booking_payments(): void
    {
        $this->as('kasir')->deleteJson('/api/booking-payments/1')->assertForbidden();
        $this->as('admin')->deleteJson('/api/booking-payments/999')->assertStatus(422);
    }

    public function test_reset_demo_is_owner_only_and_respects_config(): void
    {
        $this->as('admin')->postJson('/api/reset-demo')->assertForbidden();

        config(['futsal.allow_reset' => false]);
        $this->as('owner')->postJson('/api/reset-demo')->assertForbidden();
        $this->getJson('/api/settings')->assertOk()->assertJsonPath('allow_reset', false);
    }

    public function test_invalid_date_parameters_are_rejected(): void
    {
        $this->as('owner');
        $this->getJson('/api/availability?date=bukan-tanggal')->assertStatus(422);
        $this->getJson('/api/reports/income-statement?from=2026-01-01&to=xyz')->assertStatus(422);
        $this->getJson('/api/sales?from=1;DROP')->assertStatus(422);
    }

    public function test_product_stock_and_cost_cannot_bypass_journals(): void
    {
        $this->as('admin');
        $id = DB::table('products')->insertGetId(['name' => 'Air', 'category' => 'fnb', 'unit' => 'btl', 'price' => 5000, 'cost' => 3000, 'stock' => 5, 'track_stock' => 1, 'active' => 1]);

        $this->putJson("/api/products/{$id}", ['stock' => 999, 'price' => 6000])->assertOk()->assertJsonPath('stock', 5)->assertJsonPath('price', 6000);
        $this->putJson("/api/products/{$id}", ['cost' => 1])->assertStatus(422);
        $this->postJson('/api/products', ['name' => 'Baru', 'category' => 'fnb', 'price' => 1000, 'stock' => 50])->assertCreated()->assertJsonPath('stock', 0);
    }

    public function test_sale_price_comes_from_product_master(): void
    {
        $this->as('kasir');
        $id = DB::table('products')->insertGetId(['name' => 'Air', 'category' => 'fnb', 'unit' => 'btl', 'price' => 5000, 'cost' => 0, 'stock' => 10, 'track_stock' => 1, 'active' => 1]);

        $this->postJson('/api/sales', ['method' => 'cash', 'items' => [['product_id' => $id, 'qty' => 2, 'price' => 1]]])
            ->assertCreated()->assertJsonPath('total', 10000);
    }

    public function test_field_color_must_be_hex(): void
    {
        $this->as('admin')->postJson('/api/fields', ['name' => 'X', 'price_day' => 1, 'price_night' => 1, 'night_start' => 17, 'color' => 'red;background:url(x)'])
            ->assertStatus(422)->assertJsonValidationErrors('color');
    }

    public function test_password_change_invalidates_existing_sessions(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $this->post('/login', ['email' => $user->email, 'password' => 'password'])->assertRedirect();
        $this->get('/dashboard')->assertOk();

        $user->forceFill(['password' => 'S4ndi-Baru!2026'])->save();
        $this->app['auth']->forgetGuards();
        $this->get('/dashboard')->assertRedirect('/login');
    }

    public function test_new_users_default_to_least_privileged_role(): void
    {
        DB::table('users')->insert(['name' => 'X', 'email' => 'x@example.com', 'password' => 'x']);
        $this->assertSame('kasir', DB::table('users')->where('email', 'x@example.com')->value('role'));
    }

    public function test_futsal_user_command_creates_account_with_role(): void
    {
        $this->artisan('futsal:user', ['email' => 'Pemilik@Usaha.com', '--role' => 'akuntan', '--name' => 'Pemilik'])
            ->expectsQuestion('Password', 'S4ndi-Kuat!2026')
            ->expectsQuestion('Ulangi password', 'S4ndi-Kuat!2026')
            ->assertSuccessful();

        $user = User::query()->where('email', 'pemilik@usaha.com')->firstOrFail();
        $this->assertSame('akuntan', $user->role);
        $this->assertTrue(Hash::check('S4ndi-Kuat!2026', $user->password));

        $this->artisan('futsal:user', ['email' => 'pemilik@usaha.com'])
            ->expectsQuestion('Password', 'S4ndi-Baru!2026')
            ->expectsQuestion('Ulangi password', 'S4ndi-Baru!2026')
            ->assertSuccessful();
        $this->assertSame('akuntan', $user->fresh()?->role);

        $this->artisan('futsal:user', ['email' => 'a@b.com', '--role' => 'superadmin'])
            ->expectsQuestion('Password', 'x')->expectsQuestion('Ulangi password', 'x')
            ->assertFailed();
    }
}
