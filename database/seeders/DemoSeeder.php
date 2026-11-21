<?php

namespace Database\Seeders;

use App\Enums\Acc;
use App\Services\Journal;
use App\Services\Pricing;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DemoSeeder extends Seeder
{
    private int $seed = 42;

    private function rnd(): float
    {
        $this->seed = ($this->seed * 1103515245 + 12345) % 2147483648;

        return $this->seed / 2147483648;
    }

    private function pick(array $a): mixed
    {
        return $a[(int) floor($this->rnd() * count($a))];
    }

    private function ins(string $table, array $row): int
    {
        if (in_array($table, ['fields', 'customers', 'suppliers', 'products', 'bookings', 'booking_payments', 'sales', 'purchases'], true)) {
            $row += ['created_at' => now(), 'updated_at' => now()];
        }

        return DB::table($table)->insertGetId($row);
    }

    private function code(string $table, string $prefix, int $id): void
    {
        DB::table($table)->where('id', $id)->update(['code' => $prefix.str_pad((string) $id, 5, '0', STR_PAD_LEFT)]);
    }

    public function run(): void
    {
        if (DB::table('fields')->exists()) {
            return;
        }
        DB::transaction(fn () => $this->seedAll());
    }

    private function seedAll(): void
    {
        $today = CarbonImmutable::today();
        $start = $today->subMonthsNoOverflow(3)->startOfMonth();
        $end = $today->addDays(14);
        $fmt = fn (CarbonImmutable $d) => $d->toDateString();

        foreach ([['Lapangan A (Vinyl)', 'Vinyl', 120000, 180000, '#16a34a'], ['Lapangan B (Rumput Sintetis)', 'Sintetis', 130000, 200000, '#2563eb'], ['Lapangan C (Interlock)', 'Interlock', 100000, 150000, '#d97706']] as [$n, $t, $d, $nt, $c]) {
            $this->ins('fields', ['name' => $n, 'type' => $t, 'price_day' => $d, 'price_night' => $nt, 'night_start' => 17, 'color' => $c]);
        }
        $teams = ['Garuda FC', 'Rajawali United', 'Banteng Muda', 'Elang Biru', 'Macan Kemayoran', 'Bintang Timur', 'Satria Muda', 'Putra Bangsa', 'Karyawan PLN', 'Alumni SMAN 3', 'Komunitas Ojol', 'Bank Mandiri FC', 'Tunas Harapan', 'Pemuda Kampung', 'IT Squad', 'Persija Fans', 'Kopi Senja FC', 'Dokter Muda', 'Guru Futsal', 'Arek Suroboyo'];
        $names = ['Andi', 'Budi', 'Citra', 'Dedi', 'Eko', 'Fajar', 'Gilang', 'Hendra', 'Irfan', 'Joko', 'Kevin', 'Lukman', 'Made', 'Nanda', 'Oki', 'Putra', 'Rizky', 'Sandi', 'Taufik', 'Wahyu'];
        $customers = [];
        foreach ($teams as $i => $t) {
            $customers[] = $this->ins('customers', ['name' => $names[$i], 'phone' => '08'.(1200000000 + $i * 7654321), 'team' => $t]);
        }
        $suppliers = [];
        foreach ([['CV Sumber Minuman', '021-555123', 'Jl. Pasar Baru 5'], ['Toko Olahraga Jaya', '021-555456', 'Jl. Sudirman 21'], ['PLN', '123', '-'], ['PDAM', '-', '-'], ['Jasa Perawatan Lapangan Prima', '0813-22223333', 'Bekasi']] as [$n, $p, $a]) {
            $suppliers[] = $this->ins('suppliers', ['name' => $n, 'phone' => $p, 'address' => $a]);
        }
        $products = [];
        foreach ([['Air Mineral 600ml', 'fnb', 'botol', 5000, 1], ['Minuman Isotonik', 'fnb', 'botol', 10000, 1], ['Kopi Sachet', 'fnb', 'gelas', 6000, 1], ['Teh Botol', 'fnb', 'botol', 7000, 1], ['Mie Instan Rebus', 'fnb', 'porsi', 12000, 1], ['Roti Bakar', 'fnb', 'porsi', 15000, 1], ['Sewa Sepatu Futsal', 'rental', 'pasang', 15000, 0], ['Sewa Rompi (set)', 'rental', 'set', 20000, 0], ['Sewa Bola', 'rental', 'buah', 10000, 0]] as [$n, $c, $u, $p, $ts]) {
            $products[] = $this->ins('products', ['name' => $n, 'category' => $c, 'unit' => $u, 'price' => $p, 'cost' => 0, 'stock' => 0, 'track_stock' => $ts]);
        }

        Journal::post($fmt($start), 'manual', null, 'Setoran modal awal pemilik (tunai)', [['account_code' => Acc::BANK, 'debit' => 150000000], ['account_code' => Acc::KAS, 'debit' => 10000000], ['account_code' => Acc::MODAL, 'credit' => 160000000]]);
        Journal::post($fmt($start), 'manual', null, 'Setoran modal awal pemilik (aset bangunan & peralatan)', [['account_code' => Acc::BANGUNAN, 'debit' => 350000000], ['account_code' => Acc::PERALATAN, 'debit' => 40000000], ['account_code' => Acc::MODAL, 'credit' => 390000000]]);
        Journal::post($fmt($start->addDays(35)), 'manual', null, 'Pencairan pinjaman bank untuk renovasi', [['account_code' => Acc::BANK, 'debit' => 100000000], ['account_code' => Acc::HUTANG_BANK, 'credit' => 100000000]]);

        $addPurchase = function (string $date, int $supplier, string $method, array $items, ?string $paidDate = null) {
            $total = array_sum(array_map(fn ($it) => $it['qty'] * $it['price'], $items));
            $id = $this->ins('purchases', ['date' => $date, 'supplier_id' => $supplier, 'method' => $method, 'total' => $total, 'paid_date' => $paidDate, 'paid_method' => $paidDate ? 'bank' : null]);
            $this->code('purchases', 'PB', $id);
            foreach ($items as $it) {
                DB::table('purchase_items')->insert(['purchase_id' => $id, 'product_id' => $it['product_id'] ?? null, 'account_code' => $it['account_code'] ?? null, 'description' => $it['description'], 'qty' => $it['qty'], 'price' => $it['price']]);
                if (! empty($it['product_id'])) {
                    $p = DB::table('products')->find($it['product_id']);
                    $ns = $p->stock + $it['qty'];
                    DB::table('products')->where('id', $p->id)->update(['stock' => $ns, 'cost' => $ns > 0 ? (int) round(($p->stock * $p->cost + $it['qty'] * $it['price']) / $ns) : $it['price']]);
                }
            }
            Journal::syncPurchase($id);
        };
        $addPurchase($fmt($start->addDays(40)), $suppliers[1], 'bank', [['account_code' => Acc::PERALATAN, 'description' => 'Gawang portable & jaring baru', 'qty' => 2, 'price' => 7500000], ['account_code' => Acc::PERALATAN, 'description' => 'Lampu LED stadion', 'qty' => 8, 'price' => 1250000]]);
        $addPurchase($fmt($start->addDays(50)), $suppliers[4], 'bank', [['account_code' => Acc::BANGUNAN, 'description' => 'Renovasi atap & tribun', 'qty' => 1, 'price' => 60000000]]);

        $fnb = array_slice($products, 0, 6);
        $restock = function (string $date, bool $credit) use ($fnb, $addPurchase, $suppliers) {
            $items = array_map(function ($pid) {
                $p = DB::table('products')->find($pid);

                return ['product_id' => $pid, 'description' => $p->name, 'qty' => 30 + (int) floor($this->rnd() * 30), 'price' => (int) round($p->price * (0.45 + $this->rnd() * 0.1) / 100) * 100];
            }, $fnb);
            $addPurchase($date, $suppliers[0], $credit ? 'credit' : 'cash', $items, $credit ? CarbonImmutable::parse($date)->addDays(14)->toDateString() : null);
        };
        $sell = function (string $date) use ($products) {
            $items = [];
            $n = 1 + (int) floor($this->rnd() * 3);
            for ($i = 0; $i < $n; $i++) {
                $p = DB::table('products')->find($this->pick($products));
                $qty = 1 + (int) floor($this->rnd() * ($p->category === 'rental' ? 3 : 8));
                if (($p->track_stock && $p->stock < $qty) || isset($items[$p->id])) {
                    continue;
                }
                $items[$p->id] = [$p, $qty];
            }
            if (! $items) {
                return;
            }
            $total = array_sum(array_map(fn ($x) => $x[0]->price * $x[1], $items));
            $id = $this->ins('sales', ['date' => $date, 'customer_name' => null, 'method' => $this->rnd() < 0.7 ? 'cash' : 'bank', 'total' => $total]);
            $this->code('sales', 'PJ', $id);
            foreach ($items as [$p, $qty]) {
                DB::table('sale_items')->insert(['sale_id' => $id, 'product_id' => $p->id, 'name' => $p->name, 'category' => $p->category, 'qty' => $qty, 'price' => $p->price, 'cost' => $p->cost, 'track_stock' => $p->track_stock]);
                if ($p->track_stock) {
                    DB::table('products')->where('id', $p->id)->decrement('stock', $qty);
                }
            }
            Journal::syncSale($id);
        };

        $fields = DB::table('fields')->get();
        $todayStr = $fmt($today);
        $week = 0;
        $pay = fn ($id, $date, $amount, $method, $note) => $this->ins('booking_payments', ['booking_id' => $id, 'date' => $date, 'amount' => $amount, 'method' => $method, 'note' => $note]);
        for ($d = $start; $d->lte($end); $d = $d->addDay()) {
            $ds = $fmt($d);
            $dow = $d->dayOfWeek;
            $weekend = $dow === 0 || $dow === 6;
            $past = $ds < $todayStr;
            if ($dow === 1 && $ds <= $todayStr) {
                $restock($ds, $week % 2 === 1);
                $week++;
            }
            foreach ($fields as $f) {
                $h = 8;
                while ($h < 24) {
                    $prob = ($h >= 17 ? 0.62 : 0.22) + ($weekend ? 0.2 : 0) - ($ds > $todayStr ? 0.25 : 0);
                    $dur = $this->rnd() < 0.7 ? 1 : 2;
                    if ($h + $dur <= 24 && $this->rnd() < $prob) {
                        $total = Pricing::forHours($f, $h, $h + $dur);
                        $status = $this->rnd() < 0.05 ? 'batal' : ($past ? 'selesai' : 'booked');
                        $id = $this->ins('bookings', ['customer_id' => $this->pick($customers), 'field_id' => $f->id, 'date' => $ds, 'start_hour' => $h, 'end_hour' => $h + $dur, 'subtotal' => $total, 'discount' => 0, 'total' => $total, 'status' => $status]);
                        $this->code('bookings', 'BK', $id);
                        $method = $this->rnd() < 0.55 ? 'cash' : 'bank';
                        $dpDate = max($fmt($d->subDays(1 + (int) floor($this->rnd() * 3))), $fmt($start));
                        $dp = (int) round($total * 0.3 / 1000) * 1000;
                        if ($status === 'selesai') {
                            $r = $this->rnd();
                            if ($r < 0.5) {
                                $pay($id, $ds, $total, $method, 'Lunas');
                            } elseif ($r < 0.95) {
                                $pay($id, $dpDate, $dp, 'bank', 'DP');
                                $pay($id, $ds, $total - $dp, $method, 'Pelunasan');
                            }
                        } elseif ($status === 'booked' && $this->rnd() < 0.6 && $dpDate <= $todayStr) {
                            $pay($id, $dpDate, $dp, 'bank', 'DP');
                        } elseif ($status === 'batal' && $this->rnd() < 0.5 && $dpDate <= $todayStr) {
                            $pay($id, $dpDate, $dp, 'bank', 'DP');
                        }
                        Journal::syncBooking($id);
                        $h += $dur;
                    } else {
                        $h++;
                    }
                }
            }
            if ($ds > $todayStr) {
                continue;
            }
            $k = 2 + (int) floor($this->rnd() * 5);
            for ($i = 0; $i < $k; $i++) {
                $sell($ds);
            }
            $day = $d->day;
            $j = fn ($desc, $lines) => Journal::post($ds, 'manual', null, $desc, $lines);
            if ($day === 25) {
                $j('Pembayaran gaji karyawan', [['account_code' => '6-1100', 'debit' => 18000000], ['account_code' => Acc::BANK, 'credit' => 18000000]]);
            }
            if ($day === 5) {
                $addPurchase($ds, $suppliers[2], 'bank', [['account_code' => '6-1200', 'description' => 'Tagihan listrik', 'qty' => 1, 'price' => 6500000 + (int) round($this->rnd() * 1500) * 1000]]);
                $addPurchase($ds, $suppliers[3], 'cash', [['account_code' => '6-1200', 'description' => 'Tagihan air', 'qty' => 1, 'price' => 750000 + (int) round($this->rnd() * 250) * 1000]]);
            }
            if ($day === 1) {
                $j('Sewa lahan bulanan', [['account_code' => '6-1400', 'debit' => 10000000], ['account_code' => Acc::BANK, 'credit' => 10000000]]);
            }
            if ($day === 15) {
                $paid = $fmt($d->addDays(10));
                $addPurchase($ds, $suppliers[4], 'credit', [['account_code' => '6-1300', 'description' => 'Perawatan & pembersihan lapangan', 'qty' => 1, 'price' => 3000000]], $paid <= $todayStr ? $paid : null);
            }
            if ($day === 10) {
                $j('Iklan media sosial', [['account_code' => '6-1500', 'debit' => 1500000], ['account_code' => Acc::KAS, 'credit' => 1500000]]);
            }
            if ($day === 20) {
                $addPurchase($ds, $suppliers[1], 'cash', [['account_code' => '6-1700', 'description' => 'Bola, rompi & perlengkapan', 'qty' => 1, 'price' => 1200000]]);
            }
            if ($d->isLastOfMonth()) {
                $j('Penyusutan aset tetap bulanan', [['account_code' => '6-1600', 'debit' => 4500000], ['account_code' => Acc::AKUM, 'credit' => 4500000]]);
                if ($d->gt($start->addDays(35))) {
                    $j('Angsuran pinjaman bank (pokok + bunga)', [['account_code' => Acc::HUTANG_BANK, 'debit' => 3500000], ['account_code' => '6-9100', 'debit' => 900000], ['account_code' => Acc::BANK, 'credit' => 4400000]]);
                }
                $j('Setor kas ke bank', [['account_code' => Acc::BANK, 'debit' => 20000000], ['account_code' => Acc::KAS, 'credit' => 20000000]]);
                $j('Prive pemilik', [['account_code' => Acc::PRIVE, 'debit' => 5000000], ['account_code' => Acc::BANK, 'credit' => 5000000]]);
            }
        }

        $y = $today->year;
        $budget = ['4-1100' => 115000000, '4-1200' => 9000000, '4-1300' => 2500000, '4-9100' => 500000, '5-1100' => 4500000, '6-1100' => 18000000, '6-1200' => 7500000, '6-1300' => 3000000, '6-1400' => 10000000, '6-1500' => 2000000, '6-1600' => 4500000, '6-1700' => 1000000, '6-1900' => 500000, '6-9100' => 900000];
        $m0 = $start->year === $y ? $start->month : 1;
        for ($m = $m0; $m <= 12; $m++) {
            foreach ($budget as $acc => $amt) {
                $factor = in_array($m, [6, 7, 12], true) ? 1.1 : 1;
                DB::table('budgets')->upsert(['year' => $y, 'month' => $m, 'account_code' => $acc, 'amount' => (int) round($amt * $factor / 100000) * 100000], ['year', 'month', 'account_code'], ['amount']);
            }
        }
    }
}
