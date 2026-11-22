import { Head } from '@inertiajs/react';
import { Download, Minus, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    DataTable,
    DateRange,
    Empty,
    Field,
    Loading,
    Modal,
    MoneyInput,
    NativeSelect,
    Page,
    PageHead,
    Panel,
    Seg,
    Stat,
} from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, qs } from '@/lib/futsal/api';
import {
    downloadCSV,
    fmtDate,
    invalidate,
    METHOD,
    monthStart,
    rp,
    saleReceipt,
    todayStr,
    useApi,
} from '@/lib/futsal/utils';
import { cn } from '@/lib/utils';

const CAT: Record<string, string> = {
    fnb: 'Makanan & minuman',
    rental: 'Sewa perlengkapan',
    other: 'Lainnya',
};

export default function Sales() {
    const [tab, setTab] = useState('pos');

    return (
        <Page>
            <Head title="Penjualan" />
            <PageHead
                title="Penjualan"
                desc="Kasir F&B dan sewa perlengkapan; setiap transaksi otomatis masuk jurnal."
            >
                <Seg
                    tabs={[
                        ['pos', 'Kasir (POS)'],
                        ['history', 'Riwayat penjualan'],
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            </PageHead>
            {tab === 'pos' ? <Pos /> : <History />}
        </Page>
    );
}

function Pos() {
    const { data: products, reload } = useApi<any[]>('/products');
    const { data: settings } = useApi('/settings');
    const [cart, setCart] = useState<any[]>([]);
    const [cat, setCat] = useState('');
    const [q, setQ] = useState('');
    const [meta, setMeta] = useState<any>({
        method: 'cash',
        customer_name: '',
        date: todayStr(),
        cash: '',
    });
    const [last, setLast] = useState<any>(null);
    const [busy, setBusy] = useState(false);
    const add = (p: any) =>
        setCart((c) => {
            if (c.find((x) => x.product_id === p.id)) {
                return c.map((x) =>
                    x.product_id === p.id ? { ...x, qty: x.qty + 1 } : x,
                );
            }

            return [
                ...c,
                {
                    product_id: p.id,
                    name: p.name,
                    price: p.price,
                    qty: 1,
                    stock: p.track_stock ? p.stock : null,
                },
            ];
        });
    const setQty = (id: number, qty: number) =>
        setCart((c) =>
            qty <= 0
                ? c.filter((x) => x.product_id !== id)
                : c.map((x) => (x.product_id === id ? { ...x, qty } : x)),
        );
    const total = cart.reduce((s, x) => s + x.qty * x.price, 0);
    const pay = async () => {
        setBusy(true);

        try {
            const s: any = await api.post('/sales', { ...meta, items: cart });
            toast.success(`Transaksi ${s.code} tersimpan · ${rp(s.total)}`);
            setLast({
                sale: { ...s, items: cart },
                cash: meta.method === 'cash' ? meta.cash : 0,
            });
            setCart([]);
            setMeta((m: any) => ({ ...m, customer_name: '', cash: '' }));
            invalidate('/');
            reload();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };
    const list =
        products?.filter(
            (p) =>
                p.active &&
                (!cat || p.category === cat) &&
                p.name.toLowerCase().includes(q.toLowerCase()),
        ) || [];

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_26rem]">
            <Panel>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Seg
                        tabs={[['', 'Semua'], ...Object.entries(CAT)]}
                        value={cat}
                        onChange={setCat}
                    />
                    <div className="relative w-full sm:w-56">
                        <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                        <Input
                            className="pl-8"
                            placeholder="Cari produk…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </div>
                {!products ? (
                    <Loading />
                ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                        {list.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => add(p)}
                                disabled={p.track_stock && p.stock <= 0}
                                className="flex flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left transition hover:border-primary hover:bg-primary/5 active:scale-[.98] disabled:opacity-40"
                            >
                                <span className="line-clamp-2 text-sm font-medium">
                                    {p.name}
                                </span>
                                <span className="num font-semibold text-primary">
                                    {rp(p.price)}
                                </span>
                                <span
                                    className={cn(
                                        'text-xs text-muted-foreground',
                                        p.track_stock &&
                                            p.stock < 10 &&
                                            'text-red-600',
                                    )}
                                >
                                    {p.track_stock
                                        ? `Stok ${p.stock} ${p.unit}`
                                        : CAT[p.category]}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </Panel>
            <Panel title="Keranjang" className="lg:sticky lg:top-4">
                <div className="divide-y">
                    {cart.map((x) => (
                        <div
                            key={x.product_id}
                            className="flex items-center gap-2 py-2"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm">{x.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {rp(x.price)}
                                </div>
                                {x.stock != null && x.qty > x.stock && (
                                    <div className="text-xs text-red-600">
                                        stok {x.stock}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="size-7"
                                    onClick={() =>
                                        setQty(x.product_id, x.qty - 1)
                                    }
                                    aria-label="Kurangi"
                                >
                                    <Minus />
                                </Button>
                                <Input
                                    type="number"
                                    className="h-7 w-12 px-1 text-center"
                                    value={x.qty}
                                    onChange={(e) =>
                                        setQty(x.product_id, +e.target.value)
                                    }
                                    aria-label="Jumlah"
                                />
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="size-7"
                                    onClick={() =>
                                        setQty(x.product_id, x.qty + 1)
                                    }
                                    aria-label="Tambah"
                                >
                                    <Plus />
                                </Button>
                            </div>
                            <div className="num w-24 text-right text-sm">
                                {rp(x.qty * x.price)}
                            </div>
                        </div>
                    ))}
                    {!cart.length && (
                        <Empty>Klik produk untuk menambahkan</Empty>
                    )}
                </div>
                <div className="num my-3 flex justify-between border-t pt-3 text-lg font-semibold">
                    <span>Total</span>
                    <span>{rp(total)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Metode">
                        <NativeSelect
                            value={meta.method}
                            onChange={(e) =>
                                setMeta({ ...meta, method: e.target.value })
                            }
                        >
                            <option value="cash">Tunai</option>
                            <option value="bank">Transfer/QRIS</option>
                        </NativeSelect>
                    </Field>
                    <Field label="Tanggal">
                        <Input
                            type="date"
                            value={meta.date}
                            onChange={(e) =>
                                setMeta({ ...meta, date: e.target.value })
                            }
                        />
                    </Field>
                    <Field
                        label="Nama pembeli (opsional)"
                        className="col-span-2"
                    >
                        <Input
                            value={meta.customer_name}
                            onChange={(e) =>
                                setMeta({
                                    ...meta,
                                    customer_name: e.target.value,
                                })
                            }
                        />
                    </Field>
                    {meta.method === 'cash' && (
                        <>
                            <Field label="Uang diterima">
                                <MoneyInput
                                    value={meta.cash}
                                    onChange={(v) =>
                                        setMeta({ ...meta, cash: v })
                                    }
                                />
                            </Field>
                            <Field label="Kembalian">
                                <div className="num flex h-9 items-center justify-end text-base font-semibold">
                                    {rp(Math.max(0, (+meta.cash || 0) - total))}
                                </div>
                            </Field>
                        </>
                    )}
                </div>
                <Button
                    className="mt-4 h-11 w-full text-base"
                    disabled={!cart.length || busy}
                    onClick={pay}
                >
                    Bayar {rp(total)}
                </Button>
                {last && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm">
                        <span>
                            Terakhir: <b>{last.sale.code}</b> ·{' '}
                            {rp(last.sale.total)}
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto"
                            onClick={() =>
                                saleReceipt(last.sale, settings, last.cash)
                            }
                        >
                            <Printer /> Cetak nota
                        </Button>
                    </div>
                )}
            </Panel>
        </div>
    );
}

function History() {
    const [r, setR] = useState({ from: monthStart(), to: todayStr() });
    const { data: rows, reload } = useApi<any[]>('/sales' + qs(r));
    const [detail, setDetail] = useState<any>(null);
    const { data: settings } = useApi('/settings');
    const sum = rows?.reduce((s, x) => s + x.total, 0) || 0;
    const del = async (id: number) => {
        if (!confirm('Hapus transaksi? Stok & jurnal akan dibalik.')) {
            return;
        }

        try {
            await api.del('/sales/' + id);
            toast.success('Transaksi dihapus');
            setDetail(null);
            invalidate('/');
            reload();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    return (
        <>
            <Panel>
                <div className="flex flex-wrap items-center gap-2">
                    <DateRange from={r.from} to={r.to} onChange={setR} />
                    <Button
                        variant="outline"
                        disabled={!rows?.length}
                        onClick={() =>
                            downloadCSV('penjualan.csv', rows || [], [
                                { label: 'Kode', key: 'code' },
                                { label: 'Tanggal', key: 'date' },
                                { label: 'Pembeli', key: 'customer_name' },
                                { label: 'Item', key: 'items_text' },
                                {
                                    label: 'Metode',
                                    value: (x) => METHOD[x.method],
                                },
                                { label: 'Total', key: 'total' },
                            ])
                        }
                    >
                        <Download /> Ekspor CSV
                    </Button>
                </div>
            </Panel>
            {rows && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <Stat label="Jumlah transaksi" value={rows.length} />
                    <Stat label="Total penjualan" value={rp(sum)} />
                    <Stat
                        label="Rata-rata / transaksi"
                        value={rp(rows.length ? sum / rows.length : 0)}
                    />
                </div>
            )}
            <Panel bodyClass="p-0 max-h-[38rem] overflow-y-auto">
                {!rows ? (
                    <Loading />
                ) : (
                    <>
                        <DataTable>
                            <thead className="sticky top-0 bg-card">
                                <tr>
                                    <th>Kode</th>
                                    <th>Tanggal</th>
                                    <th>Item</th>
                                    <th>Metode</th>
                                    <th className="r">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((s) => (
                                    <tr
                                        key={s.id}
                                        className="cursor-pointer"
                                        onClick={() =>
                                            api
                                                .get('/sales/' + s.id)
                                                .then(setDetail)
                                        }
                                    >
                                        <td className="font-mono text-xs">
                                            {s.code}
                                        </td>
                                        <td>{fmtDate(s.date)}</td>
                                        <td className="max-w-80 truncate text-xs">
                                            {s.items_text}
                                        </td>
                                        <td>{METHOD[s.method]}</td>
                                        <td className="r">{rp(s.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </DataTable>
                        {!rows.length && <Empty>Tidak ada transaksi</Empty>}
                    </>
                )}
            </Panel>
            {detail && (
                <Modal
                    title={`Penjualan ${detail.code}`}
                    onClose={() => setDetail(null)}
                    footer={
                        <div className="flex w-full flex-wrap justify-end gap-2">
                            <Button
                                variant="destructive"
                                className="sm:mr-auto"
                                onClick={() => del(detail.id)}
                            >
                                <Trash2 /> Hapus transaksi
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => saleReceipt(detail, settings)}
                            >
                                <Printer /> Cetak nota
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setDetail(null)}
                            >
                                Tutup
                            </Button>
                        </div>
                    }
                >
                    <p className="text-sm text-muted-foreground">
                        {fmtDate(detail.date)} · {METHOD[detail.method]}
                        {detail.customer_name
                            ? ' · ' + detail.customer_name
                            : ''}
                    </p>
                    <DataTable className="rounded-lg border">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th className="r">Qty</th>
                                <th className="r">Harga</th>
                                <th className="r">Subtotal</th>
                                <th className="r">HPP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detail.items.map((i: any) => (
                                <tr key={i.id}>
                                    <td>{i.name}</td>
                                    <td className="r">{i.qty}</td>
                                    <td className="r">{rp(i.price)}</td>
                                    <td className="r">{rp(i.qty * i.price)}</td>
                                    <td className="r text-muted-foreground">
                                        {i.track_stock
                                            ? rp(i.qty * i.cost)
                                            : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3}>Total</td>
                                <td className="r">{rp(detail.total)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </DataTable>
                </Modal>
            )}
        </>
    );
}
