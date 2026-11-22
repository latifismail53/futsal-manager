import { Head } from '@inertiajs/react';
import { Download, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    Badge,
    DataTable,
    DateRange,
    Empty,
    Loading,
    Modal,
    Page,
    PageHead,
    Panel,
    Seg,
    Stat,
} from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/futsal/api';
import {
    downloadCSV,
    fmtDate,
    invalidate,
    monthStart,
    num,
    rp,
    todayStr,
    useApi,
} from '@/lib/futsal/utils';
import { cn } from '@/lib/utils';

export default function Stock() {
    const [tab, setTab] = useState('stok');

    return (
        <Page>
            <Head title="Stok & Opname" />
            <PageHead
                title="Stok & opname"
                desc="Pantau stok barang, lakukan stok opname, dan lihat kartu stok. Selisih opname otomatis dijurnal."
            >
                <Seg
                    tabs={[
                        ['stok', 'Daftar stok'],
                        ['opname', 'Stok opname'],
                        ['riwayat', 'Riwayat penyesuaian'],
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            </PageHead>
            {tab === 'stok' ? (
                <StockList />
            ) : tab === 'opname' ? (
                <Opname onDone={() => setTab('riwayat')} />
            ) : (
                <Adjustments />
            )}
        </Page>
    );
}

const isLow = (p: any) => p.stock <= (p.min_stock ?? 10);

function StockList() {
    const { data } = useApi<any[]>('/products');
    const [card, setCard] = useState<number | null>(null);
    const [low, setLow] = useState(false);

    if (!data) {
        return <Loading />;
    }

    const items = data.filter((p) => p.track_stock);
    const rows = items.filter((p) => !low || isLow(p));

    return (
        <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Stat label="Barang dilacak" value={num(items.length)} />
                <Stat
                    label="Nilai persediaan"
                    value={rp(items.reduce((s, p) => s + p.stock * p.cost, 0))}
                />
                <Stat
                    label="Stok menipis"
                    value={num(items.filter(isLow).length)}
                    tone={items.some(isLow) ? 'red' : undefined}
                />
            </div>
            <Panel
                bodyClass="p-0"
                title={
                    <label className="flex items-center gap-2 font-normal">
                        <Checkbox
                            checked={low}
                            onCheckedChange={(v) => setLow(!!v)}
                        />{' '}
                        Hanya stok menipis
                    </label>
                }
                actions={
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            downloadCSV(
                                'stok.csv',
                                rows.map((p) => ({
                                    Produk: p.name,
                                    Satuan: p.unit,
                                    Stok: p.stock,
                                    HPP: p.cost,
                                    Nilai: p.stock * p.cost,
                                })),
                            )
                        }
                    >
                        <Download /> Ekspor CSV
                    </Button>
                }
            >
                <DataTable>
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th>Satuan</th>
                            <th className="r">Stok</th>
                            <th className="r">HPP rata-rata</th>
                            <th className="r">Harga jual</th>
                            <th className="r">Nilai</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((p) => (
                            <tr
                                key={p.id}
                                className="cursor-pointer"
                                onClick={() => setCard(p.id)}
                            >
                                <td>
                                    {p.name}{' '}
                                    {isLow(p) && (
                                        <Badge tone="red">menipis</Badge>
                                    )}
                                </td>
                                <td>{p.unit}</td>
                                <td className="r">{num(p.stock)}</td>
                                <td className="r">{rp(p.cost)}</td>
                                <td className="r">{rp(p.price)}</td>
                                <td className="r">{rp(p.stock * p.cost)}</td>
                                <td className="r">
                                    <Button size="sm" variant="outline">
                                        Kartu stok
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </DataTable>
            </Panel>
            {card && <StockCard id={card} onClose={() => setCard(null)} />}
        </>
    );
}

function StockCard({ id, onClose }: { id: number; onClose: () => void }) {
    const { data } = useApi(`/products/${id}/movements`);

    return (
        <Modal
            wide
            title={data ? `Kartu stok · ${data.product.name}` : 'Kartu stok'}
            onClose={onClose}
        >
            {!data ? (
                <Loading />
            ) : (
                <div className="max-h-[28rem] overflow-y-auto rounded-lg border">
                    <DataTable>
                        <thead className="sticky top-0 bg-background">
                            <tr>
                                <th>Tanggal</th>
                                <th>Ref</th>
                                <th>Jenis</th>
                                <th className="r">Masuk</th>
                                <th className="r">Keluar</th>
                                <th className="r">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map((r: any, i: number) => (
                                <tr key={i}>
                                    <td>{fmtDate(r.date)}</td>
                                    <td className="font-mono text-xs">
                                        {r.ref}
                                    </td>
                                    <td>{r.type}</td>
                                    <td className="r text-green-600">
                                        {r.qty > 0 ? num(r.qty) : ''}
                                    </td>
                                    <td className="r text-red-600">
                                        {r.qty < 0 ? num(-r.qty) : ''}
                                    </td>
                                    <td className="r">{num(r.balance)}</td>
                                </tr>
                            ))}
                            <tr>
                                <td
                                    colSpan={5}
                                    className="text-muted-foreground"
                                >
                                    Saldo awal
                                </td>
                                <td className="r">{num(data.opening)}</td>
                            </tr>
                        </tbody>
                    </DataTable>
                </div>
            )}
        </Modal>
    );
}

function Opname({ onDone }: { onDone: () => void }) {
    const { data, reload } = useApi<any[]>('/products');
    const [actual, setActual] = useState<Record<number, string>>({});
    const [date, setDate] = useState(todayStr());
    const [note, setNote] = useState('Stok opname');
    const items = useMemo(
        () => (data || []).filter((p) => p.track_stock),
        [data],
    );
    const changed = items.filter(
        (p) =>
            actual[p.id] !== undefined &&
            actual[p.id] !== '' &&
            +actual[p.id] !== p.stock,
    );
    const value = changed.reduce(
        (s, p) => s + (+actual[p.id] - p.stock) * p.cost,
        0,
    );
    const save = async () => {
        if (!confirm(`Simpan penyesuaian ${changed.length} barang?`)) {
            return;
        }

        try {
            await api.post('/stock-adjustments', {
                date,
                note,
                items: changed.map((p) => ({
                    product_id: p.id,
                    actual_qty: +actual[p.id],
                })),
            });
            toast.success('Stok disesuaikan & dijurnal');
            setActual({});
            invalidate('/');
            reload();
            onDone();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    if (!data) {
        return <Loading />;
    }

    return (
        <Panel bodyClass="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b p-4">
                <Input
                    type="date"
                    className="w-40"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="Tanggal"
                />
                <Input
                    className="w-full sm:w-56"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Keterangan"
                />
                <span className="text-sm sm:ml-auto">
                    {changed.length} barang selisih · nilai{' '}
                    <b
                        className={
                            value < 0 ? 'text-red-600' : 'text-green-600'
                        }
                    >
                        {rp(value)}
                    </b>
                </span>
                <Button onClick={save} disabled={!changed.length}>
                    Simpan opname
                </Button>
            </div>
            <DataTable>
                <thead>
                    <tr>
                        <th>Produk</th>
                        <th className="r">Stok sistem</th>
                        <th className="r">Stok fisik</th>
                        <th className="r">Selisih</th>
                        <th className="r">Nilai selisih</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((p) => {
                        const v = actual[p.id];
                        const d =
                            v === undefined || v === '' ? 0 : +v - p.stock;

                        return (
                            <tr key={p.id}>
                                <td>
                                    {p.name}{' '}
                                    <span className="text-xs text-muted-foreground">
                                        ({p.unit})
                                    </span>
                                </td>
                                <td className="r">{num(p.stock)}</td>
                                <td className="r">
                                    <Input
                                        type="number"
                                        min={0}
                                        className="ml-auto h-8 w-24 text-right"
                                        value={v ?? ''}
                                        placeholder={String(p.stock)}
                                        onChange={(e) =>
                                            setActual({
                                                ...actual,
                                                [p.id]: e.target.value,
                                            })
                                        }
                                        aria-label={`Stok fisik ${p.name}`}
                                    />
                                </td>
                                <td
                                    className={cn(
                                        'r',
                                        d < 0
                                            ? 'text-red-600'
                                            : d > 0
                                              ? 'text-green-600'
                                              : 'text-muted-foreground',
                                    )}
                                >
                                    {d > 0 ? '+' : ''}
                                    {num(d)}
                                </td>
                                <td className="r">
                                    {d ? rp(d * p.cost) : '-'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </DataTable>
            <p className="border-t p-4 text-xs text-muted-foreground">
                Selisih kurang dicatat ke Beban Lain-lain (6-1900) dan
                mengurangi Persediaan; selisih lebih menambah Persediaan dan
                Pendapatan Lain-lain (4-9100).
            </p>
        </Panel>
    );
}

function Adjustments() {
    const [r, setR] = useState({ from: monthStart(), to: todayStr() });
    const { data, reload } = useApi<any[]>(
        `/stock-adjustments?from=${r.from}&to=${r.to}`,
    );
    const del = async (id: number) => {
        if (!confirm('Batalkan penyesuaian ini? Stok & jurnal dikembalikan.')) {
            return;
        }

        try {
            await api.del('/stock-adjustments/' + id);
            toast.success('Penyesuaian dibatalkan');
            invalidate('/');
            reload();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    return (
        <Panel
            bodyClass="p-0"
            title={<DateRange from={r.from} to={r.to} onChange={setR} />}
        >
            {!data ? (
                <Loading />
            ) : (
                <>
                    <DataTable>
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Produk</th>
                                <th className="r">Sistem</th>
                                <th className="r">Fisik</th>
                                <th className="r">Selisih</th>
                                <th className="r">Nilai</th>
                                <th>Keterangan</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((a) => (
                                <tr key={a.id}>
                                    <td>{fmtDate(a.date)}</td>
                                    <td>{a.name}</td>
                                    <td className="r">{num(a.system_qty)}</td>
                                    <td className="r">{num(a.actual_qty)}</td>
                                    <td
                                        className={cn(
                                            'r',
                                            a.diff < 0
                                                ? 'text-red-600'
                                                : 'text-green-600',
                                        )}
                                    >
                                        {a.diff > 0 ? '+' : ''}
                                        {num(a.diff)}
                                    </td>
                                    <td className="r">{rp(a.diff * a.cost)}</td>
                                    <td>{a.note}</td>
                                    <td>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="size-7 text-red-600"
                                            onClick={() => del(a.id)}
                                            aria-label="Batalkan penyesuaian"
                                        >
                                            <X />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </DataTable>
                    {!data.length && (
                        <Empty>Belum ada penyesuaian pada periode ini</Empty>
                    )}
                </>
            )}
        </Panel>
    );
}
