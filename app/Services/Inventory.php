<?php

namespace App\Services;

use App\Support\Row;
use DomainException;
use Illuminate\Support\Facades\DB;

class Inventory
{
    private static function code(string $table, string $prefix, int $id): void
    {
        DB::table($table)->where('id', $id)->update(['code' => $prefix.str_pad((string) $id, 5, '0', STR_PAD_LEFT)]);
    }

    /** @param  array<string, mixed>  $d */
    public static function createSale(array $d): \stdClass
    {
        return DB::transaction(function () use ($d) {
            $products = DB::table('products')->whereIn('id', array_column($d['items'], 'product_id'))->lockForUpdate()->get()->keyBy('id');
            $rows = array_map(function ($it) use ($products) {
                $p = $products[$it['product_id']] ?? throw new DomainException('Produk tidak ditemukan');
                if ($p->track_stock && $p->stock < $it['qty']) {
                    throw new DomainException("Stok {$p->name} tidak cukup (sisa {$p->stock})");
                }

                return ['p' => $p, 'qty' => (int) $it['qty'], 'price' => (int) ($it['price'] ?? $p->price)];
            }, $d['items']);
            $total = array_sum(array_map(fn ($r) => $r['qty'] * $r['price'], $rows));
            $id = DB::table('sales')->insertGetId(['date' => $d['date'] ?? today()->toDateString(), 'customer_name' => $d['customer_name'] ?? null, 'method' => $d['method'] ?? 'cash',
                'total' => $total, 'notes' => $d['notes'] ?? null, 'created_at' => now(), 'updated_at' => now()]);
            self::code('sales', 'PJ', $id);
            foreach ($rows as $r) {
                DB::table('sale_items')->insert(['sale_id' => $id, 'product_id' => $r['p']->id, 'name' => $r['p']->name, 'category' => $r['p']->category, 'qty' => $r['qty'], 'price' => $r['price'], 'cost' => $r['p']->cost, 'track_stock' => $r['p']->track_stock]);
                if ($r['p']->track_stock) {
                    DB::table('products')->where('id', $r['p']->id)->decrement('stock', $r['qty']);
                }
            }
            Journal::syncSale($id);

            return Row::find('sales', $id);
        });
    }

    public static function deleteSale(int $id): void
    {
        DB::transaction(function () use ($id) {
            foreach (DB::table('sale_items')->where('sale_id', $id)->where('track_stock', true)->get() as $it) {
                DB::table('products')->where('id', $it->product_id)->increment('stock', $it->qty);
            }
            Journal::remove('sale', $id);
            DB::table('sales')->where('id', $id)->delete();
        });
    }

    /** @param  array<string, mixed>  $d */
    public static function createPurchase(array $d): \stdClass
    {
        return DB::transaction(function () use ($d) {
            $total = array_sum(array_map(fn ($it) => $it['qty'] * $it['price'], $d['items']));
            $id = DB::table('purchases')->insertGetId(['date' => $d['date'] ?? today()->toDateString(), 'supplier_id' => $d['supplier_id'] ?? null, 'method' => $d['method'] ?? 'cash',
                'total' => $total, 'notes' => $d['notes'] ?? null, 'created_at' => now(), 'updated_at' => now()]);
            self::code('purchases', 'PB', $id);
            foreach ($d['items'] as $it) {
                $pid = $it['product_id'] ?? null;
                if (! $pid && empty($it['account_code'])) {
                    throw new DomainException('Setiap item harus memilih produk atau akun beban/aset');
                }
                DB::table('purchase_items')->insert(['purchase_id' => $id, 'product_id' => $pid, 'account_code' => $pid ? null : $it['account_code'], 'description' => $it['description'] ?? '', 'qty' => $it['qty'], 'price' => $it['price']]);
                if ($pid) {
                    $p = Row::find('products', $pid, 'Produk', true);
                    $base = max($p->stock, 0);
                    $ns = $p->stock + $it['qty'];
                    $nc = $ns > 0 ? (int) round(($base * $p->cost + $it['qty'] * $it['price']) / ($base + $it['qty'])) : (int) $it['price'];
                    DB::table('products')->where('id', $pid)->update(['stock' => $ns, 'cost' => $nc]);
                }
            }
            Journal::syncPurchase($id);

            return Row::find('purchases', $id);
        });
    }

    public static function payPurchase(int $id, ?string $date, ?string $method): void
    {
        DB::transaction(function () use ($id, $date, $method) {
            DB::table('purchases')->where('id', $id)->where('method', 'credit')->update(['paid_date' => $date ?? today()->toDateString(), 'paid_method' => $method ?? 'bank']);
            Journal::syncPurchase($id);
        });
    }

    public static function deletePurchase(int $id): void
    {
        DB::transaction(function () use ($id) {
            foreach (DB::table('purchase_items')->where('purchase_id', $id)->whereNotNull('product_id')->get() as $it) {
                DB::table('products')->where('id', $it->product_id)->decrement('stock', $it->qty);
            }
            Journal::remove('purchase', $id);
            Journal::remove('purchase_payment', $id);
            DB::table('purchases')->where('id', $id)->delete();
        });
    }

    /** @param  list<array<string, mixed>>  $items */
    public static function adjust(string $date, array $items, ?string $note): int
    {
        return DB::transaction(function () use ($date, $items, $note) {
            $n = 0;
            foreach ($items as $it) {
                $p = Row::find('products', $it['product_id'], 'Produk', true);
                $actual = (int) $it['actual_qty'];
                $diff = $actual - $p->stock;
                if (! $diff) {
                    continue;
                }
                $id = DB::table('stock_adjustments')->insertGetId(['date' => $date, 'product_id' => $p->id, 'system_qty' => $p->stock, 'actual_qty' => $actual, 'diff' => $diff,
                    'cost' => $p->cost, 'note' => $it['note'] ?? $note ?? 'Stok opname', 'created_at' => now(), 'updated_at' => now()]);
                DB::table('products')->where('id', $p->id)->update(['stock' => $actual]);
                Journal::syncAdjustment($id);
                $n++;
            }

            return $n;
        });
    }

    public static function deleteAdjustment(int $id): void
    {
        DB::transaction(function () use ($id) {
            $a = Row::find('stock_adjustments', $id);
            DB::table('products')->where('id', $a->product_id)->decrement('stock', $a->diff);
            Journal::remove('adjust', $id);
            DB::table('stock_adjustments')->where('id', $id)->delete();
        });
    }

    /** @return array<string, mixed> */
    public static function movements(int $productId): array
    {
        $p = Row::find('products', $productId, 'Produk');
        $buy = DB::table('purchase_items as pi')->join('purchases as pu', 'pu.id', '=', 'pi.purchase_id')->where('pi.product_id', $p->id)
            ->selectRaw("pu.date, pu.code as ref, 'Pembelian' as type, CAST(pi.qty AS SIGNED) as qty, pi.price");
        $sell = DB::table('sale_items as si')->join('sales as s', 's.id', '=', 'si.sale_id')->where('si.product_id', $p->id)->where('si.track_stock', true)
            ->selectRaw("s.date, s.code as ref, 'Penjualan' as type, -CAST(si.qty AS SIGNED) as qty, si.price");
        $adj = DB::table('stock_adjustments')->where('product_id', $p->id)->selectRaw("date, CONCAT('ADJ', id) as ref, 'Penyesuaian' as type, diff as qty, cost as price");
        $rows = $buy->unionAll($sell)->unionAll($adj)->get()->sortBy('date')->values();
        $bal = $p->stock - (int) $rows->sum('qty');
        $opening = $bal;
        $rows = $rows->map(function ($r) use (&$bal) {
            $bal += (int) $r->qty;
            $r->qty = (int) $r->qty;
            $r->balance = $bal;

            return $r;
        });

        return ['product' => $p, 'opening' => $opening, 'rows' => $rows->reverse()->values()];
    }
}
