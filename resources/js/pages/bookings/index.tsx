import { Head } from '@inertiajs/react';
import { CheckCheck, Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import BookingForm from '@/components/futsal/booking-form';
import { Badge, DataTable, DateRange, Empty, Loading, NativeSelect, Page, PageHead, Panel, payTone, Stat, statusTone } from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, qs } from '@/lib/futsal/api';
import { downloadCSV, fmtDate, hh, monthEnd, monthStart, PAY, rp, STATUS, useApi } from '@/lib/futsal/utils';

export default function Bookings() {
    const [flt, setFlt] = useState({ from: monthStart(), to: monthEnd(), field_id: '', status: '', payment_status: '', q: '' });
    const [form, setForm] = useState<any>(null);
    const { data: fields } = useApi<any[]>('/fields');
    const { data: rows, reload } = useApi<any[]>('/bookings' + qs(flt));
    const set = (k: string) => (e: any) => setFlt((p) => ({ ...p, [k]: e.target.value }));
    const active = rows?.filter((r) => r.status !== 'batal') || [];
    const completePast = async () => {
        try {
            const r: any = await api.post('/bookings/complete-past');
            toast.success(`${r.updated} booking lampau ditandai selesai`);
            reload();
        } catch (e: any) {
            toast.error(e.message);
        }
    };
    const exportCsv = () =>
        downloadCSV(`pemesanan_${flt.from}_${flt.to}.csv`, rows || [], [
            { label: 'Kode', key: 'code' },
            { label: 'Tanggal', key: 'date' },
            { label: 'Mulai', value: (r) => hh(r.start_hour) },
            { label: 'Selesai', value: (r) => hh(r.end_hour) },
            { label: 'Lapangan', key: 'field_name' },
            { label: 'Pelanggan', key: 'customer_name' },
            { label: 'HP', key: 'customer_phone' },
            { label: 'Total', key: 'total' },
            { label: 'Dibayar', key: 'paid' },
            { label: 'Sisa', key: 'remaining' },
            { label: 'Status', value: (r) => STATUS[r.status] },
            { label: 'Pembayaran', value: (r) => PAY[r.payment_status] },
        ]);

    return (
        <Page>
            <Head title="Pemesanan" />
            <PageHead title="Pemesanan lapangan" desc="Daftar semua booking, status pembayaran & pelunasan.">
                <Button variant="outline" onClick={completePast}><CheckCheck /> Selesaikan booking lampau</Button>
                <Button variant="outline" onClick={exportCsv} disabled={!rows?.length}><Download /> Ekspor CSV</Button>
                <Button onClick={() => setForm({})}><Plus /> Booking baru</Button>
            </PageHead>
            <Panel>
                <div className="flex flex-wrap items-center gap-2">
                    <DateRange from={flt.from} to={flt.to} onChange={(r) => setFlt((p) => ({ ...p, ...r }))} />
                    <NativeSelect className="w-auto" value={flt.field_id} onChange={set('field_id')} aria-label="Lapangan">
                        <option value="">Semua lapangan</option>
                        {fields?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </NativeSelect>
                    <NativeSelect className="w-auto" value={flt.status} onChange={set('status')} aria-label="Status">
                        <option value="">Semua status</option>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </NativeSelect>
                    <NativeSelect className="w-auto" value={flt.payment_status} onChange={set('payment_status')} aria-label="Pembayaran">
                        <option value="">Semua pembayaran</option>
                        {Object.entries(PAY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </NativeSelect>
                    <Input className="w-full sm:w-60" placeholder="Cari kode / pelanggan / tim" value={flt.q} onChange={set('q')} />
                </div>
            </Panel>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Jumlah booking (aktif)" value={active.length} sub={`${(rows?.length || 0) - active.length} dibatalkan`} />
                <Stat label="Total jam" value={active.reduce((s, r) => s + r.hours, 0) + ' jam'} />
                <Stat label="Nilai booking" value={rp(active.reduce((s, r) => s + r.total, 0))} />
                <Stat label="Belum terbayar" value={rp(active.reduce((s, r) => s + r.remaining, 0))} tone="red" />
            </div>
            <Panel bodyClass="p-0 max-h-[40rem] overflow-y-auto">
                {!rows ? (
                    <Loading />
                ) : (
                    <>
                        <DataTable>
                            <thead className="sticky top-0 z-10 bg-card">
                                <tr><th>Kode</th><th>Tanggal</th><th>Jam</th><th>Lapangan</th><th>Pelanggan</th><th className="r">Total</th><th className="r">Dibayar</th><th className="r">Sisa</th><th>Status</th><th>Pembayaran</th></tr>
                            </thead>
                            <tbody>
                                {rows.map((b) => (
                                    <tr key={b.id} className="cursor-pointer" onClick={() => setForm({ booking: b })}>
                                        <td className="font-mono text-xs">{b.code}</td>
                                        <td>{fmtDate(b.date)}</td>
                                        <td className="num">{hh(b.start_hour)}–{hh(b.end_hour)}</td>
                                        <td><span style={{ color: b.field_color }}>●</span> {b.field_name}</td>
                                        <td>{b.customer_name}<div className="text-xs text-muted-foreground">{b.customer_phone}</div></td>
                                        <td className="r">{rp(b.total)}</td>
                                        <td className="r">{rp(b.paid)}</td>
                                        <td className={'r' + (b.remaining && b.status !== 'batal' ? ' text-red-600' : '')}>{rp(b.remaining)}</td>
                                        <td><Badge tone={statusTone[b.status]}>{STATUS[b.status]}</Badge></td>
                                        <td><Badge tone={payTone[b.payment_status]}>{PAY[b.payment_status]}</Badge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </DataTable>
                        {!rows.length && <Empty>Tidak ada data</Empty>}
                    </>
                )}
            </Panel>
            {form && <BookingForm booking={form.booking} onClose={() => setForm(null)} onSaved={reload} />}
        </Page>
    );
}
