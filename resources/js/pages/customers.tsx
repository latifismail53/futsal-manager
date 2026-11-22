import { Head } from '@inertiajs/react';
import { Download, MessageCircle, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import BookingForm from '@/components/futsal/booking-form';
import { Badge, DataTable, Empty, Loading, Modal, Page, PageHead, Panel, payTone, Seg, Stat, statusTone } from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { bookingWAText, DAYS_FULL, downloadCSV, fmtDate, hh, num, PAY, rp, STATUS, todayStr, useApi, waLink, withTeam } from '@/lib/futsal/utils';

export default function Customers() {
    const { data, reload } = useApi<any[]>('/customer-stats');
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('');
    const [sel, setSel] = useState<number | null>(null);
    const rows = useMemo(
        () =>
            (data || []).filter(
                (c) => (!q || `${c.name} ${c.phone} ${c.team}`.toLowerCase().includes(q.toLowerCase())) && (filter !== 'tagihan' || c.outstanding > 0) && (filter !== 'aktif' || c.upcoming > 0),
            ),
        [data, q, filter],
    );
    const tot = (k: string) => (data || []).reduce((s, c) => s + c[k], 0);

    return (
        <Page>
            <Head title="Pelanggan" />
            <PageHead title="Pelanggan" desc="Riwayat booking, total belanja, dan tagihan setiap pelanggan.">
                <Button variant="outline" disabled={!rows.length} onClick={() => downloadCSV('pelanggan.csv', rows.map((c) => ({ Nama: c.name, HP: c.phone, Tim: c.team, Booking: c.bookings, Jam: c.hours, Total: c.total, Dibayar: c.paid, Tagihan: c.outstanding, Terakhir: c.last_date })))}>
                    <Download /> Ekspor CSV
                </Button>
            </PageHead>
            {!data ? (
                <Loading rows={8} />
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Stat label="Jumlah pelanggan" value={num(data.length)} />
                        <Stat label="Total nilai booking" value={rp(tot('total'))} />
                        <Stat label="Tagihan belum lunas" value={rp(tot('outstanding'))} tone="red" sub={`${data.filter((c) => c.outstanding > 0).length} pelanggan`} />
                        <Stat label="Booking akan datang" value={num(tot('upcoming'))} />
                    </div>
                    <Panel bodyClass="p-0">
                        <div className="flex flex-wrap items-center gap-2 border-b p-4">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                                <Input className="pl-8" placeholder="Cari nama, HP, tim…" value={q} onChange={(e) => setQ(e.target.value)} />
                            </div>
                            <Seg tabs={[['', 'Semua'], ['tagihan', 'Ada tagihan'], ['aktif', 'Punya jadwal']]} value={filter} onChange={setFilter} />
                            <span className="text-xs text-muted-foreground sm:ml-auto">{rows.length} pelanggan</span>
                        </div>
                        <DataTable>
                            <thead><tr><th>Pelanggan</th><th>Tim</th><th className="r">Booking</th><th className="r">Jam</th><th className="r">Total</th><th className="r">Tagihan</th><th>Terakhir main</th><th /></tr></thead>
                            <tbody>
                                {rows.map((c) => (
                                    <tr key={c.id} className="cursor-pointer" onClick={() => setSel(c.id)}>
                                        <td><b>{c.name}</b><div className="text-xs text-muted-foreground">{c.phone}</div></td>
                                        <td>{c.team}</td>
                                        <td className="r">{c.bookings}{c.cancelled ? <span className="text-xs text-muted-foreground"> (+{c.cancelled} batal)</span> : ''}</td>
                                        <td className="r">{c.hours}</td>
                                        <td className="r">{rp(c.total)}</td>
                                        <td className={'r' + (c.outstanding ? ' text-red-600' : '')}>{rp(c.outstanding)}</td>
                                        <td>{c.last_date ? fmtDate(c.last_date) : '-'} {c.upcoming ? <Badge tone="blue">{c.upcoming} jadwal</Badge> : ''}</td>
                                        <td className="r"><Button size="sm" variant="outline">Riwayat</Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </DataTable>
                        {!rows.length && <Empty>Tidak ada pelanggan</Empty>}
                    </Panel>
                </>
            )}
            {sel && <History id={sel} onClose={() => setSel(null)} onChanged={reload} />}
        </Page>
    );
}

function History({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
    const { data, reload } = useApi(`/customers/${id}/history`);
    const { data: settings } = useApi('/settings');
    const [tab, setTab] = useState('semua');
    const [edit, setEdit] = useState<any>(null);

    if (!data) {
        return <Modal title="Riwayat pelanggan" onClose={onClose}><Loading /></Modal>;
    }

    const { customer: c, summary: s, bookings } = data as { customer: any; summary: any; bookings: any[] };
    const list = bookings.filter((b) => tab === 'semua' || (tab === 'tagihan' ? b.status !== 'batal' && b.remaining > 0 : tab === 'akan' ? b.status === 'booked' && b.date >= todayStr() : b.status === tab));
    const unpaid = bookings.filter((b) => b.status !== 'batal' && b.remaining > 0);
    const reminder = [
        `Halo ${c.name}, berikut rincian tagihan booking di ${settings?.business_name || 'tempat kami'}:`,
        '',
        ...unpaid.map((b) => `• ${b.code} ${fmtDate(b.date)} ${hh(b.start_hour)}-${hh(b.end_hour)}: ${rp(b.remaining)}`),
        '',
        `Total tagihan: *${rp(s.outstanding)}*`,
        settings?.bank_info ? `Transfer ke ${settings.bank_info}` : '',
        'Terima kasih.',
    ].join('\n');

    return (
        <Modal
            wide
            title={withTeam(c.name, c.team)}
            onClose={onClose}
            footer={
                <div className="flex w-full flex-wrap justify-end gap-2">
                    {c.phone && unpaid.length > 0 && (
                        <Button variant="outline" asChild><a href={waLink(c.phone, reminder)} target="_blank" rel="noreferrer"><MessageCircle /> Kirim tagihan via WhatsApp</a></Button>
                    )}
                    {c.phone && <Button variant="outline" asChild><a href={waLink(c.phone, `Halo ${c.name}, `)} target="_blank" rel="noreferrer">Chat WhatsApp</a></Button>}
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                </div>
            }
        >
            <p className="text-sm text-muted-foreground">{c.phone || 'Tanpa no. HP'}{s.fav_field ? ` · Favorit: ${s.fav_field}, hari ${DAYS_FULL[s.fav_day]}, jam ${hh(+s.fav_hour)}` : ''}</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Stat label="Booking" value={num(s.bookings)} sub={`${s.hours} jam · ${s.cancelled} batal`} />
                <Stat label="Total" value={rp(s.total)} />
                <Stat label="Dibayar" value={rp(s.paid)} tone="green" />
                <Stat label="Tagihan" value={rp(s.outstanding)} tone={s.outstanding ? 'red' : undefined} sub={`${s.upcoming} jadwal akan datang`} />
            </div>
            <Seg tabs={[['semua', 'Semua'], ['akan', 'Akan datang'], ['tagihan', 'Belum lunas'], ['selesai', 'Selesai'], ['batal', 'Batal']]} value={tab} onChange={setTab} />
            <div className="max-h-96 overflow-y-auto rounded-lg border">
                <DataTable>
                    <thead className="sticky top-0 bg-background"><tr><th>Kode</th><th>Tanggal</th><th>Jam</th><th>Lapangan</th><th>Status</th><th className="r">Total</th><th className="r">Sisa</th><th /></tr></thead>
                    <tbody>
                        {list.map((b) => (
                            <tr key={b.id} className="cursor-pointer" onClick={() => setEdit(b)}>
                                <td className="font-mono text-xs">{b.code}</td>
                                <td>{fmtDate(b.date)}</td>
                                <td className="num">{hh(b.start_hour)}–{hh(b.end_hour)}</td>
                                <td>{b.field_name}</td>
                                <td className="space-x-1"><Badge tone={statusTone[b.status]}>{STATUS[b.status]}</Badge>{b.status !== 'batal' && <Badge tone={payTone[b.payment_status]}>{PAY[b.payment_status]}</Badge>}</td>
                                <td className="r">{rp(b.total)}</td>
                                <td className={'r' + (b.remaining && b.status !== 'batal' ? ' text-red-600' : '')}>{b.status === 'batal' ? '-' : rp(b.remaining)}</td>
                                <td onClick={(e) => e.stopPropagation()}>{c.phone && <a className="text-xs text-primary" href={waLink(c.phone, bookingWAText(b, settings))} target="_blank" rel="noreferrer">WA</a>}</td>
                            </tr>
                        ))}
                    </tbody>
                </DataTable>
                {!list.length && <Empty>Tidak ada data</Empty>}
            </div>
            {edit && <BookingForm booking={edit} onClose={() => setEdit(null)} onSaved={() => { reload(); onChanged(); }} />}
        </Modal>
    );
}
