import { Head } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Copy, Share2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import BookingForm from '@/components/futsal/booking-form';
import { Badge, DataTable, Empty, Loading, NativeSelect, Page, PageHead, Panel, payTone, Seg } from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { addDays, DAYS, fmtDateLong, hh, MONTHS, PAY, rp, todayStr, useApi, waLink } from '@/lib/futsal/utils';

const nowHour = () => new Date().getHours();

export default function Availability() {
    const [date, setDate] = useState(todayStr());
    const [dur, setDur] = useState(1);
    const [fieldId, setFieldId] = useState('');
    const [stripFrom, setStripFrom] = useState(todayStr());
    const [form, setForm] = useState<any>(null);
    const { data: settings } = useApi('/settings');
    const { data: fields } = useApi<any[]>('/fields');
    const { data: av, reload } = useApi(`/availability?date=${date}${fieldId ? '&field_id=' + fieldId : ''}`);
    const { data: days, reload: reloadDays } = useApi<any[]>(`/availability/days?from=${stripFrom}&days=14${fieldId ? '&field_id=' + fieldId : ''}`);
    const isPast = (h: number) => date < todayStr() || (date === todayStr() && h <= nowHour());

    const options = useMemo(() => {
        if (!av || av.date !== date) {
            return [];
        }

        const out: any[] = [];

        for (const f of av.fields) {
            for (let i = 0; i + dur <= f.slots.length; i++) {
                const win = f.slots.slice(i, i + dur);

                if (win.every((s: any) => s.free && !isPast(s.hour))) {
                    out.push({ field: f, start: win[0].hour, end: win[0].hour + dur, price: win.reduce((s: number, x: any) => s + x.price, 0) });
                }
            }
        }

        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [av, dur, date]);

    const freeRanges = (f: any) => {
        const r: [number, number][] = [];
        let st: number | null = null;
        f.slots.forEach((s: any, i: number) => {
            const ok = s.free && !isPast(s.hour);

            if (ok && st == null) {
                st = s.hour;
            }

            if (st != null && (!ok || i === f.slots.length - 1)) {
                r.push([st, ok ? s.hour + 1 : s.hour]);
                st = null;
            }
        });

        return r;
    };
    const shareText = () => {
        if (!av) {
            return '';
        }

        const lines = [`*Jadwal kosong ${settings?.business_name || ''}*`, fmtDateLong(date), ''];

        for (const f of av.fields) {
            const r = freeRanges(f);
            lines.push(`${f.name}: ${r.length ? r.map(([a, b]) => `${hh(a)}-${hh(b)}`).join(', ') : 'penuh'}`);
        }

        lines.push('', 'Hubungi kami untuk booking.');

        return lines.join('\n');
    };
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(shareText());
            toast.success('Info jam kosong disalin');
        } catch {
            toast.error('Gagal menyalin');
        }
    };
    const book = (field_id: number, start_hour: number, end_hour: number) => setForm({ preset: { field_id, date, start_hour, end_hour } });
    const totalFree = av ? av.fields.reduce((s: number, f: any) => s + f.slots.filter((x: any) => x.free && !isPast(x.hour)).length, 0) : 0;
    const pickDate = (v: string) => {
        setDate(v);

        if (v < stripFrom || v > addDays(stripFrom, 13)) {
            setStripFrom(v);
        }
    };

    return (
        <Page>
            <Head title="Cek Jam Kosong" />
            <PageHead title="Cek jam kosong" desc="Pilih tanggal untuk melihat jam lapangan yang masih tersedia, lalu klik untuk langsung booking.">
                <Button variant="outline" onClick={copy} disabled={!av}>
                    <Copy /> Salin info
                </Button>
                <Button variant="outline" asChild>
                    <a href={waLink('', shareText())} target="_blank" rel="noreferrer">
                        <Share2 /> Bagikan ke WhatsApp
                    </a>
                </Button>
            </PageHead>

            <Panel>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" onClick={() => pickDate(addDays(date, -1))} aria-label="Hari sebelumnya"><ChevronLeft /></Button>
                        <Input type="date" className="w-40" value={date} onChange={(e) => pickDate(e.target.value)} aria-label="Tanggal" />
                        <Button size="icon" variant="outline" onClick={() => pickDate(addDays(date, 1))} aria-label="Hari berikutnya"><ChevronRight /></Button>
                    </div>
                    <Button variant="outline" onClick={() => { setDate(todayStr()); setStripFrom(todayStr()); }}>Hari ini</Button>
                    <NativeSelect className="w-auto" value={fieldId} onChange={(e) => setFieldId(e.target.value)} aria-label="Lapangan">
                        <option value="">Semua lapangan</option>
                        {fields?.filter((f) => f.active).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </NativeSelect>
                    <div className="flex items-center gap-2 sm:ml-auto">
                        <span className="text-xs text-muted-foreground">Durasi main</span>
                        <Seg tabs={[1, 2, 3, 4].map((d) => [String(d), `${d} jam`])} value={String(dur)} onChange={(v) => setDur(+v)} />
                    </div>
                </div>
                <div className="mt-3 flex items-stretch gap-1.5">
                    <Button size="icon" variant="ghost" className="h-auto shrink-0" onClick={() => setStripFrom(addDays(stripFrom, -14))} aria-label="14 hari sebelumnya"><ChevronLeft /></Button>
                    <div className="flex flex-1 snap-x gap-1.5 overflow-x-auto pb-1">
                        {days?.map((d) => {
                            const dt = new Date(d.date + 'T00:00:00Z');
                            const p = d.total ? d.free / d.total : 0;

                            return (
                                <button
                                    key={d.date}
                                    onClick={() => setDate(d.date)}
                                    title={`${d.free} dari ${d.total} jam kosong`}
                                    className={cn('flex min-w-[4.25rem] flex-1 snap-start flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-xs transition hover:border-primary/60', d.date === date && 'border-primary bg-primary/10')}
                                >
                                    <span className="text-muted-foreground">{DAYS[dt.getUTCDay()]}</span>
                                    <b className="text-base leading-none">{dt.getUTCDate()}</b>
                                    <span className="text-muted-foreground">{MONTHS[dt.getUTCMonth()]}</span>
                                    <span className="my-0.5 h-1 w-full overflow-hidden rounded bg-muted">
                                        <span className={cn('block h-full', p < 0.25 ? 'bg-red-500' : p < 0.5 ? 'bg-amber-500' : 'bg-green-500')} style={{ width: p * 100 + '%' }} />
                                    </span>
                                    <span>{d.free} jam</span>
                                </button>
                            );
                        })}
                    </div>
                    <Button size="icon" variant="ghost" className="h-auto shrink-0" onClick={() => setStripFrom(addDays(stripFrom, 14))} aria-label="14 hari berikutnya"><ChevronRight /></Button>
                </div>
            </Panel>

            {!av ? (
                <Loading />
            ) : (
                <>
                    <Panel
                        title={fmtDateLong(date)}
                        bodyClass="p-0"
                        actions={
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                <span className="flex items-center gap-1"><i className="size-3 rounded border border-green-600 bg-green-100 dark:bg-green-900/40" />Kosong</span>
                                <span className="flex items-center gap-1"><i className="size-3 rounded bg-slate-300 dark:bg-slate-600" />Terisi</span>
                                <span className="flex items-center gap-1"><i className="size-3 rounded bg-muted" />Lewat</span>
                                <b>{totalFree} jam kosong</b>
                            </div>
                        }
                    >
                        <div className="overflow-x-auto p-3">
                            <div className="grid gap-1" style={{ gridTemplateColumns: `minmax(9rem, 11rem) repeat(${av.close - av.open}, minmax(2.75rem, 1fr))` }}>
                                <div className="sticky left-0 z-10 bg-card" />
                                {Array.from({ length: av.close - av.open }, (_, i) => (
                                    <div key={i} className="text-center text-[11px] text-muted-foreground">{hh(av.open + i).slice(0, 2)}</div>
                                ))}
                                {av.fields.map((f: any) => [
                                    <div key={'n' + f.id} className="sticky left-0 z-10 flex flex-col justify-center bg-card pr-2 text-sm font-medium">
                                        <span className="truncate"><span style={{ color: f.color }}>●</span> {f.name}</span>
                                        <small className="text-[11px] font-normal text-muted-foreground">{f.free_hours} kosong · {rp(f.price_day)}/{rp(f.price_night)}</small>
                                    </div>,
                                    ...f.slots.map((s: any) => {
                                        const past = isPast(s.hour);

                                        if (!s.free) {
                                            return (
                                                <div
                                                    key={f.id + '-' + s.hour}
                                                    className="flex h-10 items-center justify-center overflow-hidden rounded bg-slate-300 px-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-100"
                                                    title={`${hh(s.hour)} · ${s.booking.code} ${s.booking.customer_name}${s.booking.team ? ' (' + s.booking.team + ')' : ''} · ${PAY[s.booking.payment_status]}`}
                                                >
                                                    <span className="truncate">{s.booking.start_hour === s.hour ? (s.booking.team || s.booking.customer_name || '').split(' ')[0] : ''}</span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <button
                                                key={f.id + '-' + s.hour}
                                                disabled={past}
                                                title={past ? 'Sudah lewat' : `${hh(s.hour)}–${hh(s.hour + 1)} kosong · ${rp(s.price)} · klik untuk booking`}
                                                onClick={() => book(f.id, s.hour, Math.min(s.hour + dur, av.close))}
                                                className={cn(
                                                    'h-10 rounded text-[11px] font-medium transition',
                                                    past ? 'bg-muted text-transparent' : 'border border-green-600/60 bg-green-50 text-green-800 hover:bg-green-600 hover:text-white dark:bg-green-900/30 dark:text-green-300',
                                                )}
                                            >
                                                {past ? '' : s.price / 1000 + 'k'}
                                            </button>
                                        );
                                    }),
                                ])}
                            </div>
                        </div>
                    </Panel>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <Panel title={`Pilihan jam untuk main ${dur} jam`} actions={<span className="text-xs text-muted-foreground">{options.length} pilihan</span>} bodyClass="p-0 max-h-96 overflow-y-auto">
                            {!options.length ? (
                                <Empty>Tidak ada jam kosong {dur} jam berturut-turut di tanggal ini. Coba durasi lebih pendek atau tanggal lain.</Empty>
                            ) : (
                                <DataTable>
                                    <thead>
                                        <tr><th>Lapangan</th><th>Jam</th><th className="r">Harga</th><th /></tr>
                                    </thead>
                                    <tbody>
                                        {options.map((o) => (
                                            <tr key={o.field.id + '-' + o.start}>
                                                <td><span style={{ color: o.field.color }}>●</span> {o.field.name}</td>
                                                <td className="num">{hh(o.start)}–{hh(o.end)}</td>
                                                <td className="r">{rp(o.price)}</td>
                                                <td className="r"><Button size="sm" onClick={() => book(o.field.id, o.start, o.end)}>Booking</Button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </DataTable>
                            )}
                        </Panel>
                        <Panel title="Ringkasan per lapangan" bodyClass="divide-y p-0">
                            {av.fields.map((f: any) => {
                                const r = freeRanges(f);
                                const booked = [...new Map(f.slots.filter((s: any) => !s.free).map((s: any) => [s.booking.id, s.booking])).values()] as any[];

                                return (
                                    <div key={f.id} className="space-y-2 p-4">
                                        <b className="text-sm"><span style={{ color: f.color }}>●</span> {f.name}</b>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-xs text-muted-foreground">Kosong:</span>
                                            {r.length ? (
                                                r.map(([a, b]) => (
                                                    <Button key={a} size="sm" variant="outline" className="h-7 border-green-600/50 text-green-700 dark:text-green-400" onClick={() => book(f.id, a, Math.min(a + dur, b))}>
                                                        {hh(a)}–{hh(b)} ({b - a} jam)
                                                    </Button>
                                                ))
                                            ) : (
                                                <Badge tone="red">Penuh</Badge>
                                            )}
                                        </div>
                                        {!!booked.length && (
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                Terisi:
                                                {booked.map((b) => (
                                                    <span key={b.id}>
                                                        {hh(b.start_hour)}–{hh(b.end_hour)} {b.team || b.customer_name} <Badge tone={payTone[b.payment_status]}>{PAY[b.payment_status]}</Badge>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </Panel>
                    </div>
                </>
            )}
            {form && <BookingForm preset={form.preset} onClose={() => setForm(null)} onSaved={() => { reload(); reloadDays(); }} />}
        </Page>
    );
}
