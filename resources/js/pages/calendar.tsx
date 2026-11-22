import { Head } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Fragment, useMemo, useState } from 'react';
import BookingForm from '@/components/futsal/booking-form';
import {
    Loading,
    NativeSelect,
    Page,
    PageHead,
    Panel,
    Seg,
} from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    addDays,
    DAYS,
    fmtDateLong,
    hh,
    MONTHS_FULL,
    PAY,
    rp,
    STATUS,
    todayStr,
    useApi,
} from '@/lib/futsal/utils';
import { cn } from '@/lib/utils';

const startOfWeek = (s: string) =>
    addDays(s, -((new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7));
const ROW = 2.5; // rem

export default function CalendarPage() {
    const [view, setView] = useState('day');
    const [date, setDate] = useState(todayStr());
    const [fieldId, setFieldId] = useState<number | ''>('');
    const [form, setForm] = useState<any>(null);
    const { data: fields } = useApi<any[]>('/fields');
    const { data: settings } = useApi('/settings');
    const open = +settings?.open_hour || 8;
    const close = +settings?.close_hour || 24;
    const hours = Array.from({ length: close - open }, (_, i) => open + i);

    const range = useMemo(() => {
        if (view === 'day') {
            return { from: date, to: date };
        }

        const s = startOfWeek(view === 'week' ? date : date.slice(0, 8) + '01');

        return { from: s, to: addDays(s, view === 'week' ? 6 : 41) };
    }, [view, date]);
    const { data: bookings, reload } = useApi<any[]>(
        `/bookings?from=${range.from}&to=${range.to}&limit=5000`,
    );
    const activeFields = fields?.filter((f) => f.active) || [];
    const weekField = fieldId || activeFields[0]?.id;
    const today = todayStr();
    const nowHour = new Date().getHours();

    const step = (n: number) => {
        if (view === 'month') {
            const [y, m] = date.split('-').map(Number);
            setDate(
                new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10),
            );
        } else {
            setDate(addDays(date, view === 'day' ? n : 7 * n));
        }
    };
    const title =
        view === 'day'
            ? fmtDateLong(date)
            : view === 'week'
              ? `${fmtDateLong(range.from)} – ${fmtDateLong(range.to)}`
              : `${MONTHS_FULL[+date.slice(5, 7) - 1]} ${date.slice(0, 4)}`;
    const find = (d: string, fid: number, h: number) =>
        bookings?.find(
            (b) =>
                b.date === d &&
                b.field_id === fid &&
                b.status !== 'batal' &&
                b.start_hour <= h &&
                b.end_hour > h,
        );

    const ev = (b: any) => {
        const n = b.end_hour - b.start_hour;

        return (
            <button
                key={b.id}
                onClick={(e) => {
                    e.stopPropagation();
                    setForm({ booking: b });
                }}
                title={`${b.code} · ${b.customer_name}\n${hh(b.start_hour)}-${hh(b.end_hour)} · ${rp(b.total)}\n${STATUS[b.status]} · ${PAY[b.payment_status]}`}
                className={cn(
                    'absolute inset-x-0.5 top-0.5 z-10 flex flex-col overflow-hidden rounded-md px-2 py-1 text-left text-[11px] leading-tight text-white shadow-sm transition hover:brightness-110',
                    b.status === 'selesai' && 'opacity-75',
                )}
                style={{
                    background: b.field_color || 'var(--primary)',
                    height: `calc(${n * ROW}rem + ${n - 1}px - 4px)`,
                }}
            >
                <b className="truncate text-xs">{b.customer_name}</b>
                <span className="truncate opacity-90">
                    {hh(b.start_hour)}–{hh(b.end_hour)} ·{' '}
                    {PAY[b.payment_status]}
                </span>
            </button>
        );
    };
    const slot = (d: string, fid: number, h: number, key: string) => {
        const b = find(d, fid, h);
        const past = d < today || (d === today && h < nowHour);

        return (
            <div
                key={key}
                onClick={() =>
                    !b &&
                    setForm({
                        preset: { date: d, field_id: fid, start_hour: h },
                    })
                }
                className={cn(
                    'relative bg-card',
                    !b && 'cursor-pointer hover:bg-primary/10',
                    past && !b && 'bg-muted/60',
                )}
                style={{ height: ROW + 'rem' }}
            >
                {b && b.start_hour === h && ev(b)}
            </div>
        );
    };
    const grid = (
        cols: number,
        min: string,
        head: ReactNode,
        cell: (h: number) => ReactNode,
    ) => (
        <div className="overflow-x-auto">
            <div
                className="grid gap-px overflow-hidden rounded-lg border bg-border"
                style={{
                    gridTemplateColumns: `3.5rem repeat(${cols}, minmax(${min}, 1fr))`,
                }}
            >
                <div className="sticky left-0 z-20 bg-muted" />
                {head}
                {hours.map((h) => (
                    <Fragment key={h}>
                        <div className="sticky left-0 z-20 bg-card pt-0.5 pr-1 text-right text-[11px] text-muted-foreground">
                            {hh(h)}
                        </div>
                        {cell(h)}
                    </Fragment>
                ))}
            </div>
        </div>
    );
    const headCls = 'bg-muted px-2 py-2 text-center text-xs font-semibold';

    return (
        <Page>
            <Head title="Kalender" />
            <PageHead
                title="Kalender lapangan"
                desc="Klik slot kosong untuk membuat booking, klik booking untuk detail & pembayaran."
            >
                <Seg
                    tabs={[
                        ['day', 'Harian'],
                        ['week', 'Mingguan'],
                        ['month', 'Bulanan'],
                    ]}
                    value={view}
                    onChange={setView}
                />
                <div className="flex items-center gap-1">
                    <Button
                        size="icon"
                        variant="outline"
                        onClick={() => step(-1)}
                        aria-label="Sebelumnya"
                    >
                        <ChevronLeft />
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setDate(todayStr())}
                    >
                        Hari ini
                    </Button>
                    <Button
                        size="icon"
                        variant="outline"
                        onClick={() => step(1)}
                        aria-label="Berikutnya"
                    >
                        <ChevronRight />
                    </Button>
                </div>
                <Input
                    type="date"
                    className="w-40"
                    value={date}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                    aria-label="Tanggal"
                />
                <Button onClick={() => setForm({ preset: { date } })}>
                    <Plus /> Booking
                </Button>
            </PageHead>
            <Panel
                title={title}
                actions={
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        {view === 'week' && (
                            <NativeSelect
                                className="h-8 w-auto"
                                value={weekField || ''}
                                onChange={(e) => setFieldId(+e.target.value)}
                                aria-label="Lapangan"
                            >
                                {activeFields.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        )}
                        {activeFields.map((f) => (
                            <span
                                key={f.id}
                                className="flex items-center gap-1"
                            >
                                <i
                                    className="size-2.5 rounded-full"
                                    style={{ background: f.color }}
                                />
                                {f.name}
                            </span>
                        ))}
                    </div>
                }
            >
                {!bookings || !fields ? (
                    <Loading rows={8} />
                ) : view === 'day' ? (
                    grid(
                        activeFields.length,
                        '9rem',
                        activeFields.map((f) => (
                            <div key={f.id} className={headCls}>
                                <span style={{ color: f.color }}>●</span>{' '}
                                {f.name}
                                <div className="text-[11px] font-normal text-muted-foreground">
                                    {rp(f.price_day)} / {rp(f.price_night)}{' '}
                                    malam
                                </div>
                            </div>
                        )),
                        (h) =>
                            activeFields.map((f) =>
                                slot(date, f.id, h, f.id + '-' + h),
                            ),
                    )
                ) : view === 'week' ? (
                    grid(
                        7,
                        '6.5rem',
                        Array.from({ length: 7 }, (_, i) =>
                            addDays(range.from, i),
                        ).map((d) => (
                            <div
                                key={d}
                                className={cn(
                                    headCls,
                                    d === today && 'text-primary',
                                )}
                            >
                                {DAYS[new Date(d + 'T00:00:00Z').getUTCDay()]}{' '}
                                {+d.slice(8)}
                            </div>
                        )),
                        (h) =>
                            Array.from({ length: 7 }, (_, i) =>
                                addDays(range.from, i),
                            ).map((d) => slot(d, weekField, h, d + '-' + h)),
                    )
                ) : (
                    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
                        {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(
                            (d) => (
                                <div key={d} className={headCls}>
                                    {d}
                                </div>
                            ),
                        )}
                        {Array.from({ length: 42 }, (_, i) =>
                            addDays(range.from, i),
                        ).map((d) => {
                            const bs = bookings.filter(
                                (b) => b.date === d && b.status !== 'batal',
                            );
                            const hrs = bs.reduce((s, b) => s + b.hours, 0);
                            const cap = activeFields.length * hours.length;
                            const occ = cap ? (hrs / cap) * 100 : 0;

                            return (
                                <button
                                    key={d}
                                    onClick={() => {
                                        setDate(d);
                                        setView('day');
                                    }}
                                    className={cn(
                                        'flex min-h-20 flex-col items-start gap-0.5 bg-card p-1.5 text-left text-[11px] transition hover:bg-primary/5 sm:min-h-24 sm:p-2',
                                        d.slice(0, 7) !== date.slice(0, 7) &&
                                            'bg-muted/50 text-muted-foreground',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'text-sm font-semibold',
                                            d === today &&
                                                'flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground',
                                        )}
                                    >
                                        {+d.slice(8)}
                                    </span>
                                    {bs.length > 0 && (
                                        <>
                                            <span>
                                                {bs.length} booking
                                                <span className="hidden sm:inline">
                                                    {' '}
                                                    · {hrs} jam
                                                </span>
                                            </span>
                                            <span className="hidden text-muted-foreground sm:block">
                                                {rp(
                                                    bs.reduce(
                                                        (s, b) => s + b.total,
                                                        0,
                                                    ),
                                                )}
                                            </span>
                                            <span
                                                className="mt-auto h-1 w-full overflow-hidden rounded bg-muted"
                                                title={`Okupansi ${occ.toFixed(0)}%`}
                                            >
                                                <span
                                                    className={cn(
                                                        'block h-full',
                                                        occ > 70
                                                            ? 'bg-red-500'
                                                            : occ > 40
                                                              ? 'bg-amber-500'
                                                              : 'bg-green-500',
                                                    )}
                                                    style={{
                                                        width:
                                                            Math.min(100, occ) +
                                                            '%',
                                                    }}
                                                />
                                            </span>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </Panel>
            {form && (
                <BookingForm
                    booking={form.booking}
                    preset={form.preset}
                    onClose={() => setForm(null)}
                    onSaved={reload}
                />
            )}
        </Page>
    );
}
