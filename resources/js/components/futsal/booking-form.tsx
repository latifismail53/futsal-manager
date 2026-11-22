import { MessageCircle, Printer, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge, DataTable, Field, Modal, MoneyInput, NativeSelect, payTone, Stat, statusTone } from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/futsal/api';
import { bookingReceipt, bookingWAText, fmtDate, hh, invalidate, METHOD, PAY, rp, STATUS, todayStr, useApi, waLink } from '@/lib/futsal/utils';
import { cn } from '@/lib/utils';

type Props = { booking?: any; preset?: any; onClose: () => void; onSaved?: () => void };

export default function BookingForm({ booking, preset, onClose, onSaved }: Props) {
    const { data: fields } = useApi<any[]>('/fields');
    const { data: customers, reload: reloadCust } = useApi<any[]>('/customers');
    const { data: settings } = useApi('/settings');
    const isEdit = !!booking?.id;
    const [f, setF] = useState<any>(() => ({
        field_id: booking?.field_id || preset?.field_id || '',
        date: booking?.date || preset?.date || todayStr(),
        start_hour: booking?.start_hour ?? preset?.start_hour ?? 19,
        end_hour: booking?.end_hour ?? preset?.end_hour ?? (preset?.start_hour != null ? preset.start_hour + 1 : 20),
        customer_id: booking?.customer_id || '',
        customer_name: '',
        customer_phone: '',
        team: '',
        discount: booking?.discount || 0,
        status: booking?.status || 'booked',
        notes: booking?.notes || '',
        payment_amount: '',
        payment_method: 'cash',
        payment_date: todayStr(),
        payment_note: 'DP',
    }));
    const [newCust, setNewCust] = useState(false);
    const [subtotal, setSubtotal] = useState(0);
    const [detail, setDetail] = useState<any>(null);
    const [pay, setPay] = useState<any>({ amount: '', method: 'cash', date: todayStr(), note: '' });
    const [busy, setBusy] = useState(false);
    const [rec, setRec] = useState({ on: false, weeks: 4, skip: true });
    const [recCheck, setRecCheck] = useState<any[] | null>(null);
    const [avail, setAvail] = useState<any[] | null>(null);
    const set = (k: string) => (e: any) => setF((p: any) => ({ ...p, [k]: e?.target ? e.target.value : e }));

    useEffect(() => {
        if (!f.field_id && fields?.length) {
            setF((p: any) => ({ ...p, field_id: fields.find((x) => x.active)?.id || fields[0].id }));
        }
    }, [fields, f.field_id]);
    useEffect(() => {
        if (f.field_id) {
            api.get(`/bookings/quote?field_id=${f.field_id}&start=${f.start_hour}&end=${f.end_hour}`).then((r: any) => setSubtotal(r.subtotal));
        }
    }, [f.field_id, f.start_hour, f.end_hour]);
    useEffect(() => {
        if (f.field_id && f.date) {
            api.get(`/availability?date=${f.date}&field_id=${f.field_id}&exclude=${booking?.id || 0}`)
                .then((r: any) => setAvail(r.fields[0]?.slots || []))
                .catch(() => setAvail(null));
        }
    }, [f.field_id, f.date, booking?.id]);
    useEffect(() => {
        if (!rec.on || !f.field_id) {
            setRecCheck(null);

            return;
        }

        const t = setTimeout(
            () => api.post('/bookings/recurring', { ...f, weeks: rec.weeks, preview: 1 }).then((r: any) => setRecCheck(r.dates)).catch(() => setRecCheck(null)),
            250,
        );

        return () => clearTimeout(t);
    }, [rec.on, rec.weeks, f.field_id, f.date, f.start_hour, f.end_hour, f.discount]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadDetail = () => isEdit && api.get('/bookings/' + booking.id).then(setDetail);
    useEffect(() => {
        loadDetail();
    }, [booking?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const clash = avail?.some((s) => !s.free && s.hour >= f.start_hour && s.hour < f.end_hour);
    const pickHour = (s: any) => {
        if (s.free) {
            setF((p: any) => (s.hour === p.end_hour ? { ...p, end_hour: s.hour + 1 } : { ...p, start_hour: s.hour, end_hour: s.hour + 1 }));
        }
    };
    const open = +settings?.open_hour || 8;
    const close = +settings?.close_hour || 24;
    const hours = Array.from({ length: close - open + 1 }, (_, i) => open + i);
    const total = Math.max(0, subtotal - (+f.discount || 0));
    const changed = () => {
        invalidate('/');
        onSaved?.();
    };

    const save = async () => {
        setBusy(true);

        try {
            const body = { ...f, customer_id: newCust ? '' : f.customer_id };

            if (isEdit) {
                await api.put('/bookings/' + booking.id, body);
                toast.success('Booking diperbarui');
            } else if (rec.on) {
                const r: any = await api.post('/bookings/recurring', { ...body, weeks: rec.weeks, skip_conflicts: rec.skip });
                toast.success(`${r.created.length} booking rutin dibuat` + (r.skipped.length ? `, ${r.skipped.length} dilewati karena bentrok` : ''));
            } else {
                await api.post('/bookings', body);
                toast.success('Booking tersimpan');
            }

            reloadCust();
            changed();
            onClose();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };
    const act = async (fn: () => Promise<unknown>, msg: string) => {
        try {
            await fn();
            toast.success(msg);
            loadDetail();
            changed();
        } catch (e: any) {
            toast.error(e.message);
        }
    };
    const addPay = () =>
        act(async () => {
            await api.post(`/bookings/${booking.id}/payments`, pay);
            setPay({ amount: '', method: 'cash', date: todayStr(), note: '' });
        }, 'Pembayaran dicatat & dijurnal');
    const delPay = (id: number) => confirm('Hapus pembayaran ini?') && act(() => api.del('/booking-payments/' + id), 'Pembayaran dihapus');
    const setStatus = (status: string) =>
        act(async () => {
            await api.post(`/bookings/${booking.id}/status`, { status });
            setF((p: any) => ({ ...p, status }));
        }, 'Status: ' + STATUS[status]);
    const remove = async () => {
        if (!confirm('Hapus booking beserta pembayaran & jurnalnya?')) {
            return;
        }

        try {
            await api.del('/bookings/' + booking.id);
            toast.success('Booking dihapus');
            changed();
            onClose();
        } catch (e: any) {
            toast.error(e.message);
        }
    };
    const chip = (cls: string) => cn('min-w-9 cursor-pointer rounded px-1.5 py-1 text-center text-xs font-medium select-none', cls);

    return (
        <Modal
            wide={isEdit}
            title={isEdit ? `Booking ${booking.code}` : 'Booking baru'}
            onClose={onClose}
            footer={
                <div className="flex w-full flex-wrap justify-end gap-2">
                    {isEdit && (
                        <Button variant="destructive" className="sm:mr-auto" onClick={remove}>
                            <Trash2 /> Hapus
                        </Button>
                    )}
                    {isEdit && detail && (
                        <Button variant="outline" onClick={() => bookingReceipt(detail, settings)}>
                            <Printer /> Cetak nota
                        </Button>
                    )}
                    {isEdit && detail && (
                        <Button variant="outline" asChild>
                            <a href={waLink(detail.customer_phone, bookingWAText(detail, settings))} target="_blank" rel="noreferrer">
                                <MessageCircle /> Kirim WhatsApp
                            </a>
                        </Button>
                    )}
                    <Button variant="outline" onClick={onClose}>Batal</Button>
                    <Button onClick={save} disabled={busy || (clash && !rec.on)}>
                        {isEdit ? 'Simpan perubahan' : rec.on ? `Simpan ${recCheck ? recCheck.filter((d) => d.ok).length : ''} booking rutin` : 'Simpan booking'}
                    </Button>
                </div>
            }
        >
            <div className={cn('grid gap-5', isEdit && 'lg:grid-cols-2')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Lapangan">
                        <NativeSelect value={f.field_id} onChange={set('field_id')}>
                            {fields?.filter((x) => x.active || x.id === f.field_id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </NativeSelect>
                    </Field>
                    <Field label="Tanggal">
                        <Input type="date" value={f.date} onChange={set('date')} />
                    </Field>
                    <Field label="Jam mulai">
                        <NativeSelect
                            value={f.start_hour}
                            onChange={(e) => {
                                const v = +e.target.value;
                                setF((p: any) => ({ ...p, start_hour: v, end_hour: Math.max(p.end_hour, v + 1) }));
                            }}
                        >
                            {hours.slice(0, -1).map((x) => <option key={x} value={x}>{hh(x)}</option>)}
                        </NativeSelect>
                    </Field>
                    <Field label="Jam selesai">
                        <NativeSelect value={f.end_hour} onChange={(e) => set('end_hour')(+e.target.value)}>
                            {hours.filter((x) => x > f.start_hour).map((x) => <option key={x} value={x}>{hh(x)} ({x - f.start_hour} jam)</option>)}
                        </NativeSelect>
                    </Field>
                    {avail && (
                        <div className="sm:col-span-2">
                            <span className="text-xs text-muted-foreground">Ketersediaan jam di tanggal ini (klik jam hijau untuk memilih)</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {avail.map((s) => (
                                    <span
                                        key={s.hour}
                                        onClick={() => pickHour(s)}
                                        title={s.free ? 'Kosong' : `Terisi: ${s.booking.code} ${s.booking.customer_name}`}
                                        className={chip(
                                            !s.free
                                                ? 'cursor-not-allowed bg-slate-300 text-slate-600 line-through dark:bg-slate-700 dark:text-slate-300'
                                                : s.hour >= f.start_hour && s.hour < f.end_hour
                                                  ? 'bg-primary text-primary-foreground'
                                                  : 'border border-green-600/50 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                                        )}
                                    >
                                        {hh(s.hour).slice(0, 2)}
                                    </span>
                                ))}
                            </div>
                            {clash && <p className="mt-1 text-xs text-red-600">Jam yang dipilih bentrok dengan booking lain. Pilih jam lain.</p>}
                        </div>
                    )}
                    <div className="grid gap-1.5 sm:col-span-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Pelanggan</span>
                            <label className="flex items-center gap-2 text-xs">
                                <Checkbox checked={newCust} onCheckedChange={(v) => setNewCust(!!v)} /> Pelanggan baru
                            </label>
                        </div>
                        {newCust ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                                <Input placeholder="Nama pelanggan" value={f.customer_name} onChange={set('customer_name')} />
                                <Input placeholder="No. HP" value={f.customer_phone} onChange={set('customer_phone')} />
                                <Input className="sm:col-span-2" placeholder="Nama tim (opsional)" value={f.team} onChange={set('team')} />
                            </div>
                        ) : (
                            <NativeSelect value={f.customer_id} onChange={set('customer_id')} aria-label="Pelanggan">
                                <option value="">— pilih pelanggan —</option>
                                {customers?.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ' · ' + c.phone : ''}</option>)}
                            </NativeSelect>
                        )}
                    </div>
                    <Field label="Diskon (Rp)">
                        <MoneyInput value={f.discount} onChange={set('discount')} />
                    </Field>
                    <Field label="Status">
                        <NativeSelect value={f.status} onChange={set('status')}>
                            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </NativeSelect>
                    </Field>
                    <Field label="Catatan" className="sm:col-span-2">
                        <Textarea rows={2} value={f.notes} onChange={set('notes')} />
                    </Field>
                    <div className="num space-y-1 rounded-lg bg-muted/60 p-3 text-sm sm:col-span-2">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal ({f.end_hour - f.start_hour} jam)</span><span>{rp(subtotal)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Diskon</span><span>- {rp(f.discount)}</span></div>
                        <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{rp(total)}</span></div>
                    </div>
                    {!isEdit && (
                        <div className="space-y-2 rounded-lg border p-3 sm:col-span-2">
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox checked={rec.on} onCheckedChange={(v) => setRec((r) => ({ ...r, on: !!v }))} /> Booking rutin mingguan (hari & jam yang sama)
                            </label>
                            {rec.on && (
                                <>
                                    <div className="flex flex-wrap items-center gap-4 text-xs">
                                        <label className="flex items-center gap-2">
                                            Jumlah minggu
                                            <Input type="number" min={2} max={52} className="h-8 w-20" value={rec.weeks} onChange={(e) => setRec((r) => ({ ...r, weeks: Math.min(52, Math.max(1, +e.target.value || 1)) }))} />
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <Checkbox checked={rec.skip} onCheckedChange={(v) => setRec((r) => ({ ...r, skip: !!v }))} /> Lewati tanggal yang bentrok
                                        </label>
                                    </div>
                                    {recCheck && (
                                        <>
                                            <div className="flex flex-wrap gap-1">
                                                {recCheck.map((d) => (
                                                    <span key={d.date} title={d.error || 'Tersedia'} className={chip(d.ok ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 line-through dark:bg-red-900/40 dark:text-red-300')}>
                                                        {fmtDate(d.date)}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {recCheck.filter((d) => d.ok).length} tanggal tersedia · total {rp(recCheck.reduce((s, d) => s + (d.total || 0), 0))}. Pembayaran dicatat per booking setelah tersimpan.
                                            </p>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    {!isEdit && !rec.on && (
                        <>
                            <Field label="Bayar sekarang (DP/Lunas)">
                                <MoneyInput value={f.payment_amount} onChange={set('payment_amount')} placeholder="0" />
                            </Field>
                            <Field label="Metode">
                                <NativeSelect value={f.payment_method} onChange={set('payment_method')}>
                                    <option value="cash">Tunai</option>
                                    <option value="bank">Transfer/Bank</option>
                                </NativeSelect>
                            </Field>
                            <div className="flex flex-wrap gap-2 sm:col-span-2">
                                <Button size="sm" variant="outline" onClick={() => setF((p: any) => ({ ...p, payment_amount: Math.round((total * 0.3) / 1000) * 1000, payment_note: 'DP' }))}>DP 30%</Button>
                                <Button size="sm" variant="outline" onClick={() => setF((p: any) => ({ ...p, payment_amount: Math.round((total * 0.5) / 1000) * 1000, payment_note: 'DP' }))}>DP 50%</Button>
                                <Button size="sm" variant="outline" onClick={() => setF((p: any) => ({ ...p, payment_amount: total, payment_note: 'Lunas' }))}>Lunas</Button>
                            </div>
                        </>
                    )}
                </div>
                {isEdit && detail && (
                    <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={statusTone[detail.status]}>{STATUS[detail.status]}</Badge>
                            <Badge tone={payTone[detail.payment_status]}>{PAY[detail.payment_status]}</Badge>
                            <span className="flex-1" />
                            {detail.status !== 'selesai' && <Button size="sm" variant="outline" onClick={() => setStatus('selesai')}>Tandai selesai</Button>}
                            {detail.status !== 'batal' && <Button size="sm" variant="destructive" onClick={() => setStatus('batal')}>Batalkan</Button>}
                            {detail.status !== 'booked' && <Button size="sm" variant="outline" onClick={() => setStatus('booked')}>Kembalikan ke dipesan</Button>}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <Stat label="Total" value={rp(detail.total)} />
                            <Stat label="Dibayar" value={rp(detail.paid)} tone="green" />
                            <Stat label="Sisa" value={rp(detail.remaining)} tone={detail.remaining ? 'red' : undefined} />
                        </div>
                        <h3 className="text-sm font-semibold">Riwayat pembayaran</h3>
                        <DataTable className="rounded-lg border">
                            <thead>
                                <tr><th>Tanggal</th><th>Metode</th><th>Ket.</th><th className="r">Nominal</th><th /></tr>
                            </thead>
                            <tbody>
                                {detail.payments.map((p: any) => (
                                    <tr key={p.id}>
                                        <td>{fmtDate(p.date)}</td>
                                        <td>{METHOD[p.method]}</td>
                                        <td>{p.note}</td>
                                        <td className="r">{rp(p.amount)}</td>
                                        <td><Button size="icon" variant="ghost" className="size-7 text-red-600" onClick={() => delPay(p.id)} aria-label="Hapus pembayaran"><X /></Button></td>
                                    </tr>
                                ))}
                                {!detail.payments.length && <tr><td colSpan={5} className="text-muted-foreground">Belum ada pembayaran</td></tr>}
                            </tbody>
                        </DataTable>
                        {detail.status !== 'batal' && (
                            <div className="space-y-3 rounded-lg bg-muted/60 p-3">
                                <h3 className="text-sm font-semibold">Terima pembayaran</h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Nominal"><MoneyInput value={pay.amount} onChange={(v) => setPay((p: any) => ({ ...p, amount: v }))} /></Field>
                                    <Field label="Metode">
                                        <NativeSelect value={pay.method} onChange={(e) => setPay((p: any) => ({ ...p, method: e.target.value }))}>
                                            <option value="cash">Tunai</option>
                                            <option value="bank">Transfer/Bank</option>
                                        </NativeSelect>
                                    </Field>
                                    <Field label="Tanggal"><Input type="date" value={pay.date} onChange={(e) => setPay((p: any) => ({ ...p, date: e.target.value }))} /></Field>
                                    <Field label="Keterangan"><Input value={pay.note} placeholder="Pelunasan" onChange={(e) => setPay((p: any) => ({ ...p, note: e.target.value }))} /></Field>
                                </div>
                                <div className="flex flex-wrap justify-between gap-2">
                                    <Button size="sm" variant="outline" onClick={() => setPay((p: any) => ({ ...p, amount: detail.remaining, note: 'Pelunasan' }))}>Isi sisa ({rp(detail.remaining)})</Button>
                                    <Button size="sm" onClick={addPay}>Catat pembayaran</Button>
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">Pembayaran dicatat sebagai uang muka pelanggan; pendapatan sewa diakui saat booking ditandai selesai.</p>
                    </div>
                )}
            </div>
        </Modal>
    );
}
