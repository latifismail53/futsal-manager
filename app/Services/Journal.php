<?php

namespace App\Services;

use App\Enums\Acc;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Posting jurnal otomatis dari transaksi operasional.
 */
class Journal
{
    /**
     * @param  list<array{account_code:string,debit?:int|float,credit?:int|float}>  $lines
     */
    public static function post(string $date, string $refType, ?int $refId, string $description, array $lines): ?int
    {
        $clean = collect($lines)
            ->map(fn ($l) => ['account_code' => $l['account_code'], 'debit' => (int) round($l['debit'] ?? 0), 'credit' => (int) round($l['credit'] ?? 0)])
            ->filter(fn ($l) => $l['debit'] || $l['credit'])->values();
        if ($clean->isEmpty()) {
            return null;
        }
        $d = $clean->sum('debit');
        $c = $clean->sum('credit');
        if ($d !== $c) {
            throw new RuntimeException("Jurnal tidak seimbang (D {$d} / K {$c})");
        }
        $now = now();
        $id = DB::table('journals')->insertGetId(['date' => $date, 'ref_type' => $refType, 'ref_id' => $refId, 'description' => mb_substr($description, 0, 250), 'created_at' => $now, 'updated_at' => $now]);
        DB::table('journal_lines')->insert($clean->map(fn ($l) => $l + ['journal_id' => $id])->all());
        self::flush();

        return $id;
    }

    public static function remove(string $refType, int $refId): void
    {
        DB::table('journals')->where('ref_type', $refType)->where('ref_id', $refId)->delete();
        self::flush();
    }

    public static function flush(): void
    {
        Cache::increment('reports:version');
    }

    public static function syncBooking(int $id): void
    {
        self::remove('booking', $id);
        $b = DB::table('bookings as b')->leftJoin('fields as f', 'f.id', '=', 'b.field_id')->leftJoin('customers as c', 'c.id', '=', 'b.customer_id')
            ->where('b.id', $id)->select('b.*', 'f.name as field_name', 'c.name as customer_name')->first();
        if (! $b) {
            return;
        }
        $pays = DB::table('booking_payments')->where('booking_id', $id)->orderBy('date')->get();
        $label = "{$b->code} {$b->customer_name} - {$b->field_name} {$b->date} {$b->start_hour}:00-{$b->end_hour}:00";
        foreach ($pays as $p) {
            self::post($p->date, 'booking', $id, "Pembayaran booking {$label}", [
                ['account_code' => Acc::cash($p->method), 'debit' => $p->amount], ['account_code' => Acc::UANG_MUKA, 'credit' => $p->amount],
            ]);
        }
        $paid = (int) $pays->sum('amount');
        $total = (int) $b->total;
        if ($b->status === 'selesai') {
            $fromDp = min($paid, $total);
            $lines = [['account_code' => Acc::PEND_SEWA, 'credit' => $total], ['account_code' => Acc::UANG_MUKA, 'debit' => $fromDp], ['account_code' => Acc::PIUTANG, 'debit' => $total - $fromDp]];
            if ($paid > $total) {
                $lines[] = ['account_code' => Acc::UANG_MUKA, 'debit' => $paid - $total];
                $lines[] = ['account_code' => Acc::PEND_LAIN, 'credit' => $paid - $total];
            }
            self::post($b->date, 'booking', $id, "Pengakuan pendapatan sewa {$label}", $lines);
        } elseif ($b->status === 'batal' && $paid > 0) {
            self::post($b->date, 'booking', $id, "DP hangus booking batal {$label}", [
                ['account_code' => Acc::UANG_MUKA, 'debit' => $paid], ['account_code' => Acc::PEND_LAIN, 'credit' => $paid],
            ]);
        }
    }

    public static function syncSale(int $id): void
    {
        self::remove('sale', $id);
        $s = DB::table('sales')->find($id);
        if (! $s) {
            return;
        }
        $rev = [];
        $cogs = 0;
        foreach (DB::table('sale_items')->where('sale_id', $id)->get() as $it) {
            $acc = $it->category === 'rental' ? Acc::PEND_ALAT : Acc::PEND_FNB;
            $rev[$acc] = ($rev[$acc] ?? 0) + $it->qty * $it->price;
            if ($it->track_stock) {
                $cogs += $it->qty * $it->cost;
            }
        }
        $label = $s->code.($s->customer_name ? ' - '.$s->customer_name : '');
        $lines = [['account_code' => Acc::cash($s->method), 'debit' => $s->total]];
        foreach ($rev as $a => $v) {
            $lines[] = ['account_code' => $a, 'credit' => $v];
        }
        self::post($s->date, 'sale', $id, "Penjualan {$label}", $lines);
        if ($cogs) {
            self::post($s->date, 'sale', $id, "HPP penjualan {$label}", [['account_code' => Acc::HPP, 'debit' => $cogs], ['account_code' => Acc::PERSEDIAAN, 'credit' => $cogs]]);
        }
    }

    public static function syncPurchase(int $id): void
    {
        self::remove('purchase', $id);
        self::remove('purchase_payment', $id);
        $p = DB::table('purchases as p')->leftJoin('suppliers as s', 's.id', '=', 'p.supplier_id')->where('p.id', $id)->select('p.*', 's.name as supplier_name')->first();
        if (! $p) {
            return;
        }
        $debits = [];
        foreach (DB::table('purchase_items')->where('purchase_id', $id)->get() as $it) {
            $acc = $it->product_id ? Acc::PERSEDIAAN : $it->account_code;
            $debits[$acc] = ($debits[$acc] ?? 0) + $it->qty * $it->price;
        }
        $label = $p->code.($p->supplier_name ? ' - '.$p->supplier_name : '');
        $lines = collect($debits)->map(fn ($v, $a) => ['account_code' => $a, 'debit' => $v])->values()->all();
        $lines[] = ['account_code' => $p->method === 'credit' ? Acc::HUTANG : Acc::cash($p->method), 'credit' => $p->total];
        self::post($p->date, 'purchase', $id, "Pembelian {$label}", $lines);
        if ($p->method === 'credit' && $p->paid_date) {
            self::post($p->paid_date, 'purchase_payment', $id, "Pelunasan hutang {$label}", [
                ['account_code' => Acc::HUTANG, 'debit' => $p->total], ['account_code' => Acc::cash($p->paid_method), 'credit' => $p->total],
            ]);
        }
    }

    public static function syncAdjustment(int $id): void
    {
        self::remove('adjust', $id);
        $a = DB::table('stock_adjustments as a')->join('products as p', 'p.id', '=', 'a.product_id')->where('a.id', $id)->select('a.*', 'p.name')->first();
        if (! $a || ! $a->diff || ! $a->cost) {
            return;
        }
        $v = abs($a->diff) * $a->cost;
        $sign = $a->diff > 0 ? '+' : '';
        self::post($a->date, 'adjust', $id, "Penyesuaian stok {$a->name} ({$sign}{$a->diff})", $a->diff < 0
            ? [['account_code' => Acc::BEBAN_LAIN, 'debit' => $v], ['account_code' => Acc::PERSEDIAAN, 'credit' => $v]]
            : [['account_code' => Acc::PERSEDIAAN, 'debit' => $v], ['account_code' => Acc::PEND_LAIN, 'credit' => $v]]);
    }
}
