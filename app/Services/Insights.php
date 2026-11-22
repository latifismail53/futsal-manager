<?php

namespace App\Services;

use App\Enums\Acc;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard, statistik pelanggan, dan laporan pemesanan interaktif.
 */
class Insights
{
    public static function dashboard(): array
    {
        $t = today()->toDateString();
        $ms = today()->startOfMonth()->toDateString();
        [$open, $close] = Settings::hours();
        $cash = DB::table('accounts as a')->leftJoin('journal_lines as l', 'l.account_code', '=', 'a.code')->where('a.is_cash', true)
            ->groupBy('a.code', 'a.name')->selectRaw('a.code, a.name, CAST(COALESCE(SUM(l.debit) - SUM(l.credit),0) AS SIGNED) bal')->get();
        $todayBookings = Bookings::query()->where('b.date', $t)->where('b.status', '!=', 'batal')->orderBy('b.start_hour')->orderBy('b.field_id')->get()->map(Bookings::decorate(...));
        $unpaid = Bookings::query()->where('b.status', '!=', 'batal')->whereRaw('b.total > COALESCE(p.paid,0)')->selectRaw('COUNT(*) n, SUM(b.total - COALESCE(p.paid,0)) v')->reorder()->first();
        $bal = fn ($code, $sign) => (int) DB::table('journal_lines')->where('account_code', $code)->sum(DB::raw($sign ? 'debit - credit' : 'credit - debit'));
        $daily = DB::table('journal_lines as l')->join('journals as j', 'j.id', '=', 'l.journal_id')->join('accounts as a', 'a.code', '=', 'l.account_code')
            ->whereBetween('j.date', [today()->subDays(29)->toDateString(), $t])->groupBy('j.date')->orderBy('j.date')
            ->selectRaw("j.date, CAST(SUM(CASE WHEN a.type='revenue' THEN l.credit-l.debit ELSE 0 END) AS SIGNED) revenue, CAST(SUM(CASE WHEN a.type='expense' THEN l.debit-l.credit ELSE 0 END) AS SIGNED) expense")->get();
        $fieldsN = DB::table('fields')->where('active', true)->count();
        $span = $close - $open;
        $monthHours = (int) DB::table('bookings')->where('status', '!=', 'batal')->whereBetween('date', [$ms, $t])->sum(DB::raw('end_hour - start_hour'));

        return [
            'today' => $t, 'income' => FinancialReports::incomeStatement($ms, $t), 'cash' => $cash, 'cashTotal' => (int) $cash->sum('bal'),
            'todayBookings' => $todayBookings, 'upcoming' => DB::table('bookings')->where('date', '>', $t)->where('status', 'booked')->count(),
            'unpaidCount' => (int) ($unpaid->n ?? 0), 'unpaidTotal' => (int) ($unpaid->v ?? 0), 'piutang' => $bal(Acc::PIUTANG, true), 'hutang' => $bal(Acc::HUTANG, false),
            'daily' => $daily, 'lowStock' => DB::table('products')->where('track_stock', true)->where('active', true)->whereColumn('stock', '<', 'min_stock')->orderBy('stock')->get(),
            'occupancyToday' => $fieldsN ? $todayBookings->sum('hours') / ($fieldsN * $span) * 100 : 0,
            'occupancyMonth' => $fieldsN ? $monthHours / ($fieldsN * $span * today()->day) * 100 : 0,
        ];
    }

    public static function customerStats(): array
    {
        $t = today()->toDateString();
        $paid = DB::table('booking_payments as p')->join('bookings as b', 'b.id', '=', 'p.booking_id')->where('b.status', '!=', 'batal')->groupBy('b.customer_id')->selectRaw('b.customer_id, SUM(p.amount) paid');
        $agg = DB::table('bookings')->groupBy('customer_id')->selectRaw("customer_id,
            SUM(status!='batal') bookings, SUM(CASE WHEN status!='batal' THEN end_hour-start_hour ELSE 0 END) hours,
            SUM(CASE WHEN status!='batal' THEN total ELSE 0 END) total, MAX(CASE WHEN status!='batal' THEN date END) last_date,
            MIN(CASE WHEN status!='batal' THEN date END) first_date, SUM(status='batal') cancelled, SUM(status='booked' AND date>=?) upcoming", [$t]);

        return DB::table('customers as c')->leftJoinSub($agg, 'a', 'a.customer_id', '=', 'c.id')->leftJoinSub($paid, 'p', 'p.customer_id', '=', 'c.id')
            ->select('c.*')->selectRaw('CAST(COALESCE(a.bookings,0) AS SIGNED) bookings, CAST(COALESCE(a.hours,0) AS SIGNED) hours, CAST(COALESCE(a.total,0) AS SIGNED) total, a.last_date, a.first_date, CAST(COALESCE(p.paid,0) AS SIGNED) paid, CAST(COALESCE(a.cancelled,0) AS SIGNED) cancelled, CAST(COALESCE(a.upcoming,0) AS SIGNED) upcoming')
            ->orderByDesc('total')->get()->map(function ($c) {
                $c->outstanding = max(0, $c->total - $c->paid);

                return $c;
            })->all();
    }

    public static function customerHistory(int $id): array
    {
        $c = DB::table('customers')->find($id) ?? throw new DomainException('Pelanggan tidak ditemukan');
        $bookings = Bookings::query()->where('b.customer_id', $id)->orderByDesc('b.date')->orderByDesc('b.start_hour')->get()->map(Bookings::decorate(...));
        $active = $bookings->where('status', '!=', 'batal');
        $fav = fn ($fn) => $active->countBy($fn)->sortDesc()->keys()->first();

        return ['customer' => $c, 'bookings' => $bookings->values(), 'summary' => [
            'bookings' => $active->count(), 'cancelled' => $bookings->count() - $active->count(), 'hours' => $active->sum('hours'), 'total' => $active->sum('total'),
            'paid' => $active->sum('paid'), 'outstanding' => $active->sum('remaining'), 'fav_field' => $fav(fn ($b) => $b->field_name), 'fav_hour' => $fav(fn ($b) => $b->start_hour),
            'fav_day' => $fav(fn ($b) => CarbonImmutable::parse($b->date)->dayOfWeek),
            'upcoming' => $active->filter(fn ($b) => $b->status === 'booked' && $b->date >= today()->toDateString())->count(),
        ]];
    }

    public static function bookingReport(array $q): array
    {
        [$open, $close] = Settings::hours();
        $rows = Bookings::filter(Bookings::query(), $q)->orderBy('b.date')->orderBy('b.start_hour')->get()->map(Bookings::decorate(...));
        if (! empty($q['payment_status'])) {
            $rows = $rows->where('payment_status', $q['payment_status'])->values();
        }
        $nFields = DB::table('fields')->where('active', true)->when($q['field_id'] ?? null, fn ($w, $v) => $w->where('id', $v))->count();
        $from = CarbonImmutable::parse($q['from']);
        $to = CarbonImmutable::parse($q['to']);
        $days = (int) $from->diffInDays($to) + 1;
        $capacity = $nFields * $days * ($close - $open);
        $active = $rows->where('status', '!=', 'batal');
        $byDate = $byField = $byCust = $byStatus = [];
        $byWeekday = array_map(fn ($i) => ['weekday' => $i, 'count' => 0, 'hours' => 0, 'revenue' => 0], range(0, 6));
        $heat = array_fill(0, 7, array_fill(0, 24, 0));
        $byHour = array_map(fn ($i) => ['hour' => $i, 'hours' => 0, 'revenue' => 0], range(0, 23));
        foreach ($rows as $r) {
            $byStatus[$r->status] ??= ['status' => $r->status, 'count' => 0, 'revenue' => 0];
            $byStatus[$r->status]['count']++;
            $byStatus[$r->status]['revenue'] += $r->total;
        }
        foreach ($active as $r) {
            $byDate[$r->date] ??= ['date' => $r->date, 'count' => 0, 'hours' => 0, 'revenue' => 0];
            $byField[$r->field_id] ??= ['field_id' => $r->field_id, 'name' => $r->field_name, 'color' => $r->field_color, 'count' => 0, 'hours' => 0, 'revenue' => 0];
            $byCust[$r->customer_id] ??= ['customer_id' => $r->customer_id, 'name' => $r->customer_name, 'team' => $r->team, 'count' => 0, 'hours' => 0, 'revenue' => 0, 'outstanding' => 0];
            $wd = CarbonImmutable::parse($r->date)->dayOfWeek;
            foreach ([&$byDate[$r->date], &$byField[$r->field_id], &$byCust[$r->customer_id], &$byWeekday[$wd]] as &$g) {
                $g['count']++;
                $g['hours'] += $r->hours;
                $g['revenue'] += $r->total;
            }
            unset($g);
            $byCust[$r->customer_id]['outstanding'] += $r->remaining;
            for ($x = $r->start_hour; $x < $r->end_hour; $x++) {
                $heat[$wd][$x]++;
                $byHour[$x]['hours']++;
                $byHour[$x]['revenue'] += $r->total / $r->hours;
            }
        }
        $allDates = [];
        for ($d = $from; $d->lte($to); $d = $d->addDay()) {
            $ds = $d->toDateString();
            $allDates[] = $byDate[$ds] ?? ['date' => $ds, 'count' => 0, 'hours' => 0, 'revenue' => 0];
        }
        $perFieldCap = $days * ($close - $open);
        $hours = $active->sum('hours');
        $total = $active->sum('total');

        return [
            'filters' => $q, 'open' => $open, 'close' => $close,
            'summary' => ['bookings' => $active->count(), 'cancelled' => $rows->count() - $active->count(), 'hours' => $hours, 'revenue' => $total,
                'paid' => $active->sum('paid'), 'outstanding' => $active->sum('remaining'), 'discount' => $active->sum('discount'),
                'avg' => $active->count() ? (int) round($total / $active->count()) : 0, 'occupancy' => $capacity ? $hours / $capacity * 100 : 0,
                'customers' => count($byCust), 'cancelRate' => $rows->count() ? ($rows->count() - $active->count()) / $rows->count() * 100 : 0],
            'byDate' => $allDates,
            'byField' => array_values(array_map(fn ($f) => [...$f, 'occupancy' => $perFieldCap ? $f['hours'] / $perFieldCap * 100 : 0], $byField)),
            'byCustomer' => collect($byCust)->sortByDesc('revenue')->values(), 'byStatus' => array_values($byStatus), 'byWeekday' => $byWeekday,
            'byHour' => array_slice($byHour, $open, $close - $open), 'heat' => $heat, 'rows' => $rows->values(),
        ];
    }

    public static function incomeMonthly(int $year): array
    {
        return array_map(function ($m) use ($year) {
            $f = CarbonImmutable::create($year, $m, 1);
            if ($f->isFuture()) {
                return ['month' => $m, 'revenue' => null, 'expense' => null, 'net' => null];
            }
            $is = FinancialReports::incomeStatement($f->toDateString(), $f->endOfMonth()->toDateString());

            return ['month' => $m, 'revenue' => $is['totalRevenue'] + $is['totalOtherRevenue'], 'expense' => $is['totalCogs'] + $is['totalExpense'] + $is['totalOtherExpense'], 'net' => $is['netIncome']];
        }, range(1, 12));
    }
}
