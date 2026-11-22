<?php

namespace App\Services;

use App\Support\Row;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

class Bookings
{
    public static function query(): Builder
    {
        $paid = DB::table('booking_payments')->selectRaw('booking_id, SUM(amount) paid')->groupBy('booking_id');

        return DB::table('bookings as b')
            ->leftJoin('customers as c', 'c.id', '=', 'b.customer_id')
            ->leftJoin('fields as f', 'f.id', '=', 'b.field_id')
            ->leftJoinSub($paid, 'p', 'p.booking_id', '=', 'b.id')
            ->select('b.*', 'c.name as customer_name', 'c.phone as customer_phone', 'c.team', 'f.name as field_name', 'f.color as field_color', DB::raw('COALESCE(p.paid,0) as paid'));
    }

    public static function decorate(stdClass $b): stdClass
    {
        $b->paid = (int) $b->paid;
        $b->payment_status = $b->paid <= 0 ? 'belum' : ($b->paid >= $b->total ? 'lunas' : 'dp');
        $b->remaining = max(0, $b->total - $b->paid);
        $b->hours = $b->end_hour - $b->start_hour;

        return $b;
    }

    /** @param  array<string, mixed>  $f */
    public static function filter(Builder $q, array $f): Builder
    {
        return $q->when($f['from'] ?? null, fn ($q, $v) => $q->where('b.date', '>=', $v))
            ->when($f['to'] ?? null, fn ($q, $v) => $q->where('b.date', '<=', $v))
            ->when($f['field_id'] ?? null, fn ($q, $v) => $q->where('b.field_id', $v))
            ->when($f['customer_id'] ?? null, fn ($q, $v) => $q->where('b.customer_id', $v))
            ->when($f['status'] ?? null, fn ($q, $v) => $q->where('b.status', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('c.name', 'like', "%{$v}%")->orWhere('b.code', 'like', "%{$v}%")->orWhere('c.team', 'like', "%{$v}%")));
    }

    /**
     * @param  array<string, mixed>  $f
     * @return Collection<int, stdClass>
     */
    public static function list(array $f, int $limit = 1000): Collection
    {
        $rows = self::filter(self::query(), $f)->orderByDesc('b.date')->orderByDesc('b.start_hour')->limit(min($limit, 5000))->get()->map(self::decorate(...));

        return empty($f['payment_status']) ? $rows : $rows->where('payment_status', $f['payment_status'])->values();
    }

    public static function find(int $id): stdClass
    {
        $b = self::query()->where('b.id', $id)->first() ?? throw new DomainException('Booking tidak ditemukan');
        $b = self::decorate($b);
        $b->payments = DB::table('booking_payments')->where('booking_id', $id)->orderBy('date')->orderBy('id')->get();

        return $b;
    }

    /**
     * Validasi bentrok jadwal & hitung harga. Mengunci baris lapangan agar booking paralel tidak dobel.
     *
     * @param  array<string, mixed>  $d
     * @return array{subtotal:int,discount:int,total:int}
     */
    public static function price(array $d, ?int $exceptId = null, bool $lock = false): array
    {
        $field = DB::table('fields')->where('id', $d['field_id'])->when($lock, fn ($q) => $q->lockForUpdate())->first() ?? throw new DomainException('Lapangan tidak ditemukan');
        [$open, $close] = Settings::hours();
        if ($d['start_hour'] < $open || $d['end_hour'] > $close) {
            throw new DomainException("Jam operasional {$open}:00–{$close}:00");
        }
        if ($d['end_hour'] <= $d['start_hour']) {
            throw new DomainException('Jam selesai harus setelah jam mulai');
        }
        $clash = DB::table('bookings as b')->leftJoin('customers as c', 'c.id', '=', 'b.customer_id')
            ->where('b.field_id', $d['field_id'])->where('b.date', $d['date'])->where('b.status', '!=', 'batal')
            ->where('b.id', '!=', $exceptId ?? 0)->where('b.start_hour', '<', $d['end_hour'])->where('b.end_hour', '>', $d['start_hour'])
            ->select('b.code', 'c.name')->first();
        if ($clash) {
            throw new DomainException("Jadwal bentrok dengan {$clash->code} ({$clash->name})");
        }
        $subtotal = Pricing::forHours($field, (int) $d['start_hour'], (int) $d['end_hour']);
        $discount = max(0, (int) ($d['discount'] ?? 0));

        return ['subtotal' => $subtotal, 'discount' => $discount, 'total' => max(0, $subtotal - $discount)];
    }

    /** @param  array<string, mixed>  $d */
    public static function customerId(array $d): int
    {
        if (! empty($d['customer_id'])) {
            return (int) $d['customer_id'];
        }
        if (! empty($d['customer_name'])) {
            return DB::table('customers')->insertGetId(['name' => $d['customer_name'], 'phone' => $d['customer_phone'] ?? null, 'team' => $d['team'] ?? null, 'created_at' => now(), 'updated_at' => now()]);
        }
        throw new DomainException('Pelanggan wajib diisi');
    }

    private static function code(int $id): string
    {
        $code = 'BK'.str_pad((string) $id, 5, '0', STR_PAD_LEFT);
        DB::table('bookings')->where('id', $id)->update(['code' => $code]);

        return $code;
    }

    /** @param  array<string, mixed>  $d */
    public static function create(array $d): stdClass
    {
        $id = DB::transaction(function () use ($d) {
            $price = self::price($d, null, true);
            $id = DB::table('bookings')->insertGetId([
                'customer_id' => self::customerId($d), 'field_id' => $d['field_id'], 'date' => $d['date'], 'start_hour' => $d['start_hour'], 'end_hour' => $d['end_hour'],
                ...$price, 'status' => $d['status'] ?? 'booked', 'notes' => $d['notes'] ?? null, 'created_at' => now(), 'updated_at' => now(),
            ]);
            self::code($id);
            if (($d['payment_amount'] ?? 0) > 0) {
                self::insertPayment($id, ['amount' => $d['payment_amount'], 'date' => $d['payment_date'] ?? null, 'method' => $d['payment_method'] ?? 'cash', 'note' => $d['payment_note'] ?? 'DP']);
            }
            Journal::syncBooking($id);

            return $id;
        });

        return self::find($id);
    }

    /** @param  array<string, mixed>  $d */
    public static function update(int $id, array $d): stdClass
    {
        DB::transaction(function () use ($id, $d) {
            $price = self::price($d, $id, true);
            DB::table('bookings')->where('id', $id)->update([
                'customer_id' => self::customerId($d), 'field_id' => $d['field_id'], 'date' => $d['date'], 'start_hour' => $d['start_hour'], 'end_hour' => $d['end_hour'],
                ...$price, 'status' => $d['status'] ?? 'booked', 'notes' => $d['notes'] ?? null, 'updated_at' => now(),
            ]);
            Journal::syncBooking($id);
        });

        return self::find($id);
    }

    public static function setStatus(int $id, string $status): void
    {
        DB::transaction(function () use ($id, $status) {
            if ($status !== 'batal') {
                self::price((array) Row::find('bookings', $id, 'Booking'), $id, true);
            }
            DB::table('bookings')->where('id', $id)->update(['status' => $status, 'updated_at' => now()]);
            Journal::syncBooking($id);
        });
    }

    /** @param  array<string, mixed>  $p */
    public static function insertPayment(int $bookingId, array $p): void
    {
        DB::table('booking_payments')->insert(['booking_id' => $bookingId, 'date' => $p['date'] ?? today()->toDateString(), 'amount' => (int) $p['amount'], 'method' => $p['method'] ?? 'cash', 'note' => $p['note'] ?? null, 'created_at' => now(), 'updated_at' => now()]);
    }

    /** @return array<string, mixed> */
    public static function availability(string $date, ?int $fieldId = null, int $exclude = 0): array
    {
        [$open, $close] = Settings::hours();
        $fields = DB::table('fields')->when($fieldId, fn ($q) => $q->where('id', $fieldId), fn ($q) => $q->where('active', true))->orderBy('id')->get();
        $bookings = self::query()->where('b.date', $date)->where('b.status', '!=', 'batal')->where('b.id', '!=', $exclude)->get()->map(self::decorate(...));

        return ['date' => $date, 'open' => $open, 'close' => $close, 'fields' => $fields->map(function ($f) use ($open, $close, $bookings) {
            $slots = [];
            for ($h = $open; $h < $close; $h++) {
                $b = $bookings->first(fn ($x) => $x->field_id === $f->id && $x->start_hour <= $h && $x->end_hour > $h);
                $slots[] = ['hour' => $h, 'free' => ! $b, 'price' => $h >= $f->night_start ? $f->price_night : $f->price_day,
                    'booking' => $b ? Arr2::only($b, ['id', 'code', 'customer_name', 'team', 'start_hour', 'end_hour', 'payment_status']) : null];
            }
            $ranges = [];
            $st = null;
            foreach ($slots as $i => $x) {
                if ($x['free'] && $st === null) {
                    $st = $x['hour'];
                }
                if ($st !== null && (! $x['free'] || $i === count($slots) - 1)) {
                    $end = $x['free'] ? $x['hour'] + 1 : $x['hour'];
                    $ranges[] = ['start' => $st, 'end' => $end, 'hours' => $end - $st];
                    $st = null;
                }
            }
            $free = count(array_filter($slots, fn ($x) => $x['free']));

            return [...Arr2::only($f, ['id', 'name', 'type', 'color', 'price_day', 'price_night', 'night_start']), 'slots' => $slots, 'ranges' => $ranges, 'free_hours' => $free, 'booked_hours' => count($slots) - $free];
        })];
    }

    /** @return array<int, array{date:string,total:int,booked:int,free:int}> */
    public static function availabilityDays(string $from, int $days, ?int $fieldId = null): array
    {
        [$open, $close] = Settings::hours();
        $days = min(max($days, 1), 62);
        $to = CarbonImmutable::parse($from)->addDays($days - 1)->toDateString();
        $activeIds = DB::table('fields')->where('active', true)->pluck('id');
        $used = DB::table('bookings')->where('status', '!=', 'batal')->whereBetween('date', [$from, $to])
            ->when($fieldId, fn ($q) => $q->where('field_id', $fieldId), fn ($q) => $q->whereIn('field_id', $activeIds))
            ->groupBy('date')->selectRaw('date, SUM(GREATEST(0, CAST(LEAST(end_hour, ?) AS SIGNED) - CAST(GREATEST(start_hour, ?) AS SIGNED))) h', [$close, $open])->pluck('h', 'date');
        $total = ($fieldId ? 1 : $activeIds->count()) * ($close - $open);

        return collect(range(0, $days - 1))->map(function ($i) use ($from, $used, $total) {
            $d = CarbonImmutable::parse($from)->addDays($i)->toDateString();
            $booked = (int) ($used[$d] ?? 0);

            return ['date' => $d, 'total' => $total, 'booked' => $booked, 'free' => max(0, $total - $booked)];
        })->all();
    }

    /**
     * @param  array<string, mixed>  $d
     * @return array<string, mixed>
     */
    public static function recurring(array $d): array
    {
        $weeks = min(max((int) ($d['weeks'] ?? 1), 1), 52);
        $step = (int) ($d['interval_days'] ?? 7) ?: 7;
        $check = collect(range(0, $weeks - 1))->map(function ($i) use ($d, $step) {
            $date = CarbonImmutable::parse($d['date'])->addDays($i * $step)->toDateString();
            try {
                return ['date' => $date, 'ok' => true, 'total' => self::price([...$d, 'date' => $date])['total']];
            } catch (DomainException $e) {
                return ['date' => $date, 'ok' => false, 'error' => $e->getMessage()];
            }
        });
        if (! empty($d['preview'])) {
            return ['dates' => $check->all()];
        }
        $bad = $check->where('ok', false);
        if (empty($d['skip_conflicts']) && $bad->isNotEmpty()) {
            throw new DomainException('Ada jadwal bentrok: '.$bad->pluck('date')->join(', '));
        }

        return DB::transaction(function () use ($d, $check, $bad) {
            $cid = self::customerId($d);
            $series = 'RT'.strtoupper(Str::random(8));
            $created = [];
            foreach ($check->where('ok', true) as $c) {
                $price = self::price([...$d, 'date' => $c['date']], null, true);
                $id = DB::table('bookings')->insertGetId(['customer_id' => $cid, 'field_id' => $d['field_id'], 'date' => $c['date'], 'start_hour' => $d['start_hour'], 'end_hour' => $d['end_hour'],
                    ...$price, 'status' => 'booked', 'notes' => $d['notes'] ?? 'Booking rutin', 'series' => $series, 'created_at' => now(), 'updated_at' => now()]);
                $created[] = self::code($id);
                Journal::syncBooking($id);
            }

            return ['series' => $series, 'created' => $created, 'skipped' => $bad->values()->all()];
        });
    }
}
