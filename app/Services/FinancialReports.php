<?php

namespace App\Services;

use App\Enums\Acc;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use stdClass;

/**
 * Laporan keuangan yang dihitung dari jurnal. Hasil di-cache per versi jurnal.
 */
class FinancialReports
{
    /**
     * @template T
     *
     * @param  Closure(): T  $fn
     * @return T
     */
    private static function cached(string $key, Closure $fn): mixed
    {
        $v = Cache::get('reports:version', 0);

        return Cache::remember("rep:{$v}:{$key}", now()->addHour(), $fn);
    }

    private static function debitNormal(string $type): bool
    {
        return in_array($type, ['asset', 'expense'], true);
    }

    /** @return Collection<int, stdClass> */
    public static function balances(?string $from, ?string $to): Collection
    {
        /** @var array<int, stdClass> $rows */
        $rows = self::cached("bal:{$from}:{$to}", function () use ($from, $to) {
            $sums = DB::table('journal_lines as l')->join('journals as j', 'j.id', '=', 'l.journal_id')
                ->when($from, fn ($q) => $q->where('j.date', '>=', $from))
                ->when($to, fn ($q) => $q->where('j.date', '<=', $to))
                ->groupBy('l.account_code')
                ->selectRaw('l.account_code, SUM(l.debit) debit, SUM(l.credit) credit')->get()->keyBy('account_code');

            return DB::table('accounts')->orderBy('code')->get()->map(function ($a) use ($sums) {
                $d = (int) ($sums[$a->code]->debit ?? 0);
                $c = (int) ($sums[$a->code]->credit ?? 0);

                return (object) [...(array) $a, 'debit' => $d, 'credit' => $c, 'balance' => self::debitNormal($a->type) ? $d - $c : $c - $d];
            })->all();
        });

        return collect($rows);
    }

    /** @return array<string, mixed> */
    public static function trialBalance(string $from, string $to): array
    {
        $rows = self::balances($from, $to)->map(function ($r) {
            $net = $r->debit - $r->credit;

            return [...(array) $r, 'end_debit' => max($net, 0), 'end_credit' => max(-$net, 0)];
        })->values();

        return ['rows' => $rows, 'total_debit' => $rows->sum('end_debit'), 'total_credit' => $rows->sum('end_credit')];
    }

    /** @return array<string, mixed> */
    public static function incomeStatement(?string $from, string $to): array
    {
        $rows = self::balances($from, $to);
        $pick = fn ($st) => $rows->where('subtype', $st)->map(fn ($r) => ['code' => $r->code, 'name' => $r->name, 'amount' => $r->balance])->values();
        [$revenue, $cogs, $expenses, $oRev, $oExp] = [$pick('revenue'), $pick('cogs'), $pick('expense'), $pick('other_revenue'), $pick('other_expense')];
        $tr = $revenue->sum('amount');
        $tc = $cogs->sum('amount');
        $te = $expenses->sum('amount');
        $gross = $tr - $tc;
        $op = $gross - $te;

        return [
            'from' => $from, 'to' => $to, 'revenue' => $revenue, 'cogs' => $cogs, 'expenses' => $expenses, 'otherRevenue' => $oRev, 'otherExpense' => $oExp,
            'totalRevenue' => $tr, 'totalCogs' => $tc, 'grossProfit' => $gross, 'totalExpense' => $te, 'operatingProfit' => $op,
            'totalOtherRevenue' => $oRev->sum('amount'), 'totalOtherExpense' => $oExp->sum('amount'),
            'netIncome' => $op + $oRev->sum('amount') - $oExp->sum('amount'),
        ];
    }

    /** @return array<string, mixed> */
    public static function balanceSheet(string $date): array
    {
        $rows = self::balances(null, $date);
        $d = CarbonImmutable::parse($date);
        $map = fn ($st) => $rows->where('subtype', $st)->map(fn ($r) => ['code' => $r->code, 'name' => $r->name, 'amount' => $r->balance])->values();
        $retainedPrior = self::incomeStatement(null, $d->startOfYear()->subDay()->toDateString())['netIncome'];
        $current = self::incomeStatement($d->startOfYear()->toDateString(), $date)['netIncome'];
        $equity = $map('equity')->map(fn ($r) => $r['code'] === Acc::LABA_DITAHAN ? [...$r, 'amount' => $r['amount'] + $retainedPrior] : $r)
            ->push(['code' => '', 'name' => "Laba Tahun Berjalan ({$d->year})", 'amount' => $current]);
        $ca = $map('current_asset');
        $fa = $map('fixed_asset')->concat($map('contra_asset'));
        $cl = $map('current_liability');
        $ll = $map('long_liability');
        $ta = $ca->sum('amount') + $fa->sum('amount');
        $tl = $cl->sum('amount') + $ll->sum('amount');
        $te = $equity->sum('amount');

        return [
            'date' => $date, 'currentAssets' => $ca, 'fixedAssets' => $fa, 'currentLiabilities' => $cl, 'longLiabilities' => $ll, 'equity' => $equity,
            'totalCurrentAssets' => $ca->sum('amount'), 'totalFixedAssets' => $fa->sum('amount'),
            'totalCurrentLiabilities' => $cl->sum('amount'), 'totalLongLiabilities' => $ll->sum('amount'),
            'totalAssets' => $ta, 'totalLiabilities' => $tl, 'totalEquity' => $te, 'balanced' => $ta === $tl + $te,
        ];
    }

    private const CF_CAT = [
        'fixed_asset' => 'investing', 'contra_asset' => 'investing', 'long_liability' => 'financing', 'equity' => 'financing',
    ];

    private const CF_LABEL = [
        '1-1300' => 'Penerimaan piutang pelanggan', '1-1400' => 'Pembelian persediaan barang',
        '2-1100' => 'Pembayaran hutang usaha', '2-1200' => 'Penerimaan pembayaran booking lapangan',
        '2-2100' => 'Pinjaman / angsuran pokok bank', '3-1100' => 'Setoran modal pemilik', '3-1200' => 'Pengambilan prive pemilik',
    ];

    private static function cfLabel(stdClass $a): string
    {
        return self::CF_LABEL[$a->code] ?? match (true) {
            $a->type === 'revenue' => 'Penerimaan '.mb_strtolower(preg_replace('/^Pendapatan /', '', $a->name)),
            $a->type === 'expense' => 'Pembayaran '.mb_strtolower(preg_replace('/^Beban /', '', $a->name)),
            $a->subtype === 'fixed_asset' => 'Pembelian aset: '.$a->name,
            default => $a->name,
        };
    }

    /** @return array<string, mixed> */
    public static function cashFlow(string $from, string $to): array
    {
        return self::cached("cf:{$from}:{$to}", function () use ($from, $to) {
            $accs = DB::table('accounts')->get()->keyBy('code');
            $cash = $accs->where('is_cash', true)->keys()->all();
            $opening = (int) DB::table('journal_lines as l')->join('journals as j', 'j.id', '=', 'l.journal_id')
                ->where('j.date', '<', $from)->whereIn('l.account_code', $cash)->selectRaw('COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as b')->value('b');
            $lines = DB::table('journal_lines as l')->join('journals as j', 'j.id', '=', 'l.journal_id')
                ->whereBetween('j.date', [$from, $to])->orderBy('j.id')->select('l.*', 'j.date')->get()->groupBy('journal_id');
            $groups = ['operating' => [], 'investing' => [], 'financing' => []];
            $monthly = [];
            foreach ($lines as $ls) {
                $cashNet = $ls->filter(fn ($l) => in_array($l->account_code, $cash, true))->sum(fn ($l) => $l->debit - $l->credit);
                if (! $cashNet) {
                    continue;
                }
                foreach ($ls->reject(fn ($l) => in_array($l->account_code, $cash, true)) as $l) {
                    $amt = $l->credit - $l->debit;
                    if (! $amt) {
                        continue;
                    }
                    $a = $accs[$l->account_code];
                    $cat = self::CF_CAT[$a->subtype] ?? 'operating';
                    $groups[$cat][$a->code] ??= ['code' => $a->code, 'name' => self::cfLabel($a), 'amount' => 0];
                    $groups[$cat][$a->code]['amount'] += $amt;
                    $m = substr($l->date, 0, 7);
                    $monthly[$m] ??= ['month' => $m, 'operating' => 0, 'investing' => 0, 'financing' => 0];
                    $monthly[$m][$cat] += $amt;
                }
            }
            [$o, $i, $f] = [self::cfRows($groups['operating']), self::cfRows($groups['investing']), self::cfRows($groups['financing'])];
            $net = $o->sum('amount') + $i->sum('amount') + $f->sum('amount');
            ksort($monthly);

            return [
                'from' => $from, 'to' => $to, 'opening' => $opening, 'operating' => $o, 'investing' => $i, 'financing' => $f,
                'totalOperating' => $o->sum('amount'), 'totalInvesting' => $i->sum('amount'), 'totalFinancing' => $f->sum('amount'),
                'net' => $net, 'closing' => $opening + $net, 'monthly' => array_values($monthly),
            ];
        });
    }

    /**
     * @param  array<string, array<string, mixed>>  $g
     * @return Collection<int, array<string, mixed>>
     */
    private static function cfRows(array $g): Collection
    {
        return collect($g)->filter(fn (array $r) => (int) $r['amount'] !== 0)->sortKeys()->values();
    }

    /** @return array<string, mixed> */
    public static function ledger(string $account, string $from, string $to): array
    {
        $acc = DB::table('accounts')->where('code', $account)->firstOrFail();
        $dn = self::debitNormal($acc->type);
        $ob = DB::table('journal_lines as l')->join('journals as j', 'j.id', '=', 'l.journal_id')->where('l.account_code', $account)->where('j.date', '<', $from)
            ->selectRaw('COALESCE(SUM(l.debit),0) d, COALESCE(SUM(l.credit),0) c')->first();
        $bal = $dn ? $ob->d - $ob->c : $ob->c - $ob->d;
        $opening = $bal;
        $rows = DB::table('journal_lines as l')->join('journals as j', 'j.id', '=', 'l.journal_id')->where('l.account_code', $account)
            ->whereBetween('j.date', [$from, $to])->orderBy('j.date')->orderBy('j.id')
            ->select('j.id as journal_id', 'j.date', 'j.description', 'j.ref_type', 'l.debit', 'l.credit')->get()
            ->map(function ($r) use (&$bal, $dn) {
                $bal += $dn ? $r->debit - $r->credit : $r->credit - $r->debit;

                return [...(array) $r, 'balance' => $bal];
            });

        return ['account' => $acc, 'opening' => (int) $opening, 'rows' => $rows, 'closing' => (int) $bal];
    }

    /** @return array<string, mixed> */
    public static function budget(int $year, int $mFrom, int $mTo): array
    {
        $from = CarbonImmutable::create($year, $mFrom, 1)->toDateString();
        $to = CarbonImmutable::create($year, $mTo, 1)->endOfMonth()->toDateString();
        $bud = DB::table('budgets')->where('year', $year)->whereBetween('month', [$mFrom, $mTo])->groupBy('account_code')
            ->selectRaw('account_code, SUM(amount) s')->pluck('s', 'account_code');
        $act = self::balances($from, $to)->pluck('balance', 'code');
        $rows = DB::table('accounts')->whereIn('type', ['revenue', 'expense'])->orderBy('code')->get()->map(function ($a) use ($bud, $act) {
            $b = (int) ($bud[$a->code] ?? 0);
            $x = (int) ($act[$a->code] ?? 0);
            $v = $x - $b;

            return ['code' => $a->code, 'name' => $a->name, 'type' => $a->type, 'budget' => $b, 'actual' => $x, 'variance' => $v,
                'pct' => $b ? $x / $b * 100 : null, 'favorable' => $a->type === 'revenue' ? $v >= 0 : $v <= 0];
        });
        $monthly = [];
        for ($m = $mFrom; $m <= $mTo; $m++) {
            $f = CarbonImmutable::create($year, $m, 1);
            $is = self::incomeStatement($f->toDateString(), $f->endOfMonth()->toDateString());
            $b = DB::table('budgets as b')->join('accounts as a', 'a.code', '=', 'b.account_code')->where('b.year', $year)->where('b.month', $m)
                ->groupBy('a.type')->selectRaw('a.type, SUM(b.amount) s')->pluck('s', 'type');
            $bRev = (int) ($b['revenue'] ?? 0);
            $bExp = (int) ($b['expense'] ?? 0);
            $monthly[] = ['month' => $m, 'budgetRevenue' => $bRev, 'actualRevenue' => $is['totalRevenue'] + $is['totalOtherRevenue'],
                'budgetExpense' => $bExp, 'actualExpense' => $is['totalCogs'] + $is['totalExpense'] + $is['totalOtherExpense'],
                'budgetProfit' => $bRev - $bExp, 'actualProfit' => $is['netIncome']];
        }

        return compact('year', 'mFrom', 'mTo', 'from', 'to', 'rows', 'monthly');
    }
}
