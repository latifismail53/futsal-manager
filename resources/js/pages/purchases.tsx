import { Head } from '@inertiajs/react';
import { Download, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, DataTable, DateRange, Empty, Field, Loading, Modal, MoneyInput, NativeSelect, Page, PageHead, Panel, Stat } from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { api, qs } from '@/lib/futsal/api';
import { downloadCSV, fmtDate, invalidate, METHOD, monthStart, rp, todayStr, useApi } from '@/lib/futsal/utils';

export default function Purchases() {
    const [r, setR] = useState({ from: monthStart(), to: todayStr() });
    const [onlyUnpaid, setOnlyUnpaid] = useState(false);
    const { data: rows, reload } = useApi<any[]>('/purchases' + qs(onlyUnpaid ? {} : r));
    const [form, setForm] = useState(false);
    const [detail, setDetail] = useState<any>(null);
    const [payF, setPayF] = useState({ date: todayStr(), method: 'bank' });
    const list = rows?.filter((p) => !onlyUnpaid || (p.method === 'credit' && !p.paid_date)) || [];
    const unpaid = rows?.filter((p) => p.method === 'credit' && !p.paid_date) || [];
    const run = async (fn: () => Promise<unknown>, msg: string) => {
        try {
            await fn();
            toast.success(msg);
            setDetail(null);
            invalidate('/');
            reload();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    return (
        <Page>
            <Head title="Pembelian" />
            <PageHead title="Pembelian" desc="Pembelian stok barang, biaya operasional, maupun aset — tunai, transfer, atau kredit (hutang).">
                <Button
                    variant="outline"
                    disabled={!list.length}
                    onClick={() => downloadCSV('pembelian.csv', list, [{ label: 'Kode', key: 'code' }, { label: 'Tanggal', key: 'date' }, { label: 'Supplier', key: 'supplier_name' }, { label: 'Item', key: 'items_text' }, { label: 'Metode', value: (x) => METHOD[x.method] }, { label: 'Total', key: 'total' }, { label: 'Dilunasi', key: 'paid_date' }])}
                >
                    <Download /> Ekspor CSV
                </Button>
                <Button onClick={() => setForm(true)}><Plus /> Pembelian baru</Button>
            </PageHead>
            <Panel>
                <div className="flex flex-wrap items-center gap-3">
                    {!onlyUnpaid && <DateRange from={r.from} to={r.to} onChange={setR} />}
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={onlyUnpaid} onCheckedChange={(v) => setOnlyUnpaid(!!v)} /> Hanya hutang belum lunas (semua periode)
                    </label>
                </div>
            </Panel>
            {rows && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <Stat label="Total pembelian" value={rp(list.reduce((s, x) => s + x.total, 0))} sub={`${list.length} transaksi`} />
                    <Stat label="Pembelian kredit" value={rp(list.filter((x) => x.method === 'credit').reduce((s, x) => s + x.total, 0))} />
                    <Stat label="Hutang belum lunas" value={rp(unpaid.reduce((s, x) => s + x.total, 0))} tone="red" sub={`${unpaid.length} faktur`} />
                </div>
            )}
            <Panel bodyClass="p-0 max-h-[38rem] overflow-y-auto">
                {!rows ? (
                    <Loading />
                ) : (
                    <>
                        <DataTable>
                            <thead className="sticky top-0 bg-card"><tr><th>Kode</th><th>Tanggal</th><th>Supplier</th><th>Item</th><th>Metode</th><th className="r">Total</th><th>Status</th></tr></thead>
                            <tbody>
                                {list.map((p) => (
                                    <tr key={p.id} className="cursor-pointer" onClick={() => api.get('/purchases/' + p.id).then(setDetail)}>
                                        <td className="font-mono text-xs">{p.code}</td>
                                        <td>{fmtDate(p.date)}</td>
                                        <td>{p.supplier_name || '-'}</td>
                                        <td className="max-w-72 truncate text-xs">{p.items_text}</td>
                                        <td>{METHOD[p.method]}</td>
                                        <td className="r">{rp(p.total)}</td>
                                        <td>{p.method !== 'credit' ? <Badge tone="green">Lunas</Badge> : p.paid_date ? <Badge tone="green">Lunas {fmtDate(p.paid_date)}</Badge> : <Badge tone="red">Hutang</Badge>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </DataTable>
                        {!list.length && <Empty>Tidak ada data</Empty>}
                    </>
                )}
            </Panel>
            {form && <PurchaseForm onClose={() => setForm(false)} onSaved={() => { invalidate('/'); reload(); }} />}
            {detail && (
                <Modal
                    wide
                    title={`Pembelian ${detail.code}`}
                    onClose={() => setDetail(null)}
                    footer={
                        <div className="flex w-full flex-wrap justify-end gap-2">
                            <Button variant="destructive" className="sm:mr-auto" onClick={() => confirm('Hapus pembelian? Stok & jurnal akan dibalik.') && run(() => api.del('/purchases/' + detail.id), 'Pembelian dihapus')}><Trash2 /> Hapus</Button>
                            <Button variant="outline" onClick={() => setDetail(null)}>Tutup</Button>
                        </div>
                    }
                >
                    <p className="text-sm text-muted-foreground">{fmtDate(detail.date)} · {detail.supplier_name || '-'} · {METHOD[detail.method]}</p>
                    <DataTable className="rounded-lg border">
                        <thead><tr><th>Item</th><th>Akun / produk</th><th className="r">Qty</th><th className="r">Harga</th><th className="r">Subtotal</th></tr></thead>
                        <tbody>
                            {detail.items.map((i: any) => (
                                <tr key={i.id}><td>{i.description}</td><td className="text-xs">{i.product_id ? 'Persediaan' : `${i.account_code} ${i.account_name}`}</td><td className="r">{i.qty}</td><td className="r">{rp(i.price)}</td><td className="r">{rp(i.qty * i.price)}</td></tr>
                            ))}
                        </tbody>
                        <tfoot><tr><td colSpan={4}>Total</td><td className="r">{rp(detail.total)}</td></tr></tfoot>
                    </DataTable>
                    {detail.method === 'credit' && !detail.paid_date && (
                        <div className="space-y-2 rounded-lg bg-muted/60 p-3">
                            <h3 className="text-sm font-semibold">Lunasi hutang</h3>
                            <div className="flex flex-wrap gap-2">
                                <Input type="date" className="w-40" value={payF.date} onChange={(e) => setPayF({ ...payF, date: e.target.value })} aria-label="Tanggal bayar" />
                                <NativeSelect className="w-auto" value={payF.method} onChange={(e) => setPayF({ ...payF, method: e.target.value })} aria-label="Metode bayar">
                                    <option value="bank">Transfer/Bank</option>
                                    <option value="cash">Tunai</option>
                                </NativeSelect>
                                <Button onClick={() => run(() => api.post(`/purchases/${detail.id}/pay`, payF), 'Hutang dilunasi & dijurnal')}>Bayar {rp(detail.total)}</Button>
                            </div>
                        </div>
                    )}
                    {detail.paid_date && <p className="rounded-lg bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900/40 dark:text-green-300">Dilunasi {fmtDate(detail.paid_date)} via {METHOD[detail.paid_method]}</p>}
                </Modal>
            )}
        </Page>
    );
}

const blank = () => ({ kind: 'product', product_id: '', account_code: '', description: '', qty: 1, price: '' as number | '' });

function PurchaseForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const { data: suppliers } = useApi<any[]>('/suppliers');
    const { data: products } = useApi<any[]>('/products');
    const { data: accounts } = useApi<any[]>('/accounts');
    const [f, setF] = useState({ date: todayStr(), supplier_id: '', method: 'cash', notes: '' });
    const [items, setItems] = useState<any[]>([blank()]);
    const [busy, setBusy] = useState(false);
    const accOpts = accounts?.filter((a) => a.type === 'expense' || a.subtype === 'fixed_asset' || (a.subtype === 'current_asset' && !a.is_cash && a.code !== '1-1300')) || [];
    const upd = (i: number, patch: any) => setItems((it) => it.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    const total = items.reduce((s, x) => s + (+x.qty || 0) * (+x.price || 0), 0);
    const save = async () => {
        setBusy(true);

        try {
            await api.post('/purchases', {
                ...f,
                items: items.map((x) => ({
                    product_id: x.kind === 'product' ? x.product_id : null,
                    account_code: x.kind === 'account' ? x.account_code : null,
                    description: x.description || (x.kind === 'product' ? products?.find((p) => p.id === +x.product_id)?.name : accounts?.find((a) => a.code === x.account_code)?.name),
                    qty: x.qty,
                    price: x.price,
                })),
            });
            toast.success('Pembelian tersimpan & dijurnal');
            onSaved();
            onClose();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            wide
            title="Pembelian baru"
            onClose={onClose}
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>Batal</Button>
                    <Button onClick={save} disabled={busy}>Simpan · {rp(total)}</Button>
                </>
            }
        >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label="Tanggal"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
                <Field label="Supplier">
                    <NativeSelect value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}>
                        <option value="">—</option>
                        {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </NativeSelect>
                </Field>
                <Field label="Pembayaran">
                    <NativeSelect value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
                        {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </NativeSelect>
                </Field>
                <Field label="Catatan"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
            </div>
            <div className="space-y-2">
                {items.map((x, i) => (
                    <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-2 md:grid-cols-[8.5rem_1fr_1fr_4.5rem_8rem_7rem_2rem]">
                        <Field label="Jenis">
                            <NativeSelect value={x.kind} onChange={(e) => upd(i, { kind: e.target.value })}>
                                <option value="product">Stok barang</option>
                                <option value="account">Biaya / aset</option>
                            </NativeSelect>
                        </Field>
                        <Field label={x.kind === 'product' ? 'Produk' : 'Akun'}>
                            {x.kind === 'product' ? (
                                <NativeSelect
                                    value={x.product_id}
                                    onChange={(e) => {
                                        const p = products?.find((p) => p.id === +e.target.value);
                                        upd(i, { product_id: e.target.value, ...(p && !x.price ? { price: p.cost } : {}) });
                                    }}
                                >
                                    <option value="">— produk —</option>
                                    {products?.filter((p) => p.track_stock).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </NativeSelect>
                            ) : (
                                <NativeSelect value={x.account_code} onChange={(e) => upd(i, { account_code: e.target.value })}>
                                    <option value="">— akun —</option>
                                    {accOpts.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
                                </NativeSelect>
                            )}
                        </Field>
                        <Field label="Keterangan" className="col-span-2 md:col-span-1"><Input value={x.description} placeholder="opsional" onChange={(e) => upd(i, { description: e.target.value })} /></Field>
                        <Field label="Qty"><Input type="number" value={x.qty} onChange={(e) => upd(i, { qty: e.target.value })} /></Field>
                        <Field label="Harga satuan"><MoneyInput value={x.price} onChange={(v) => upd(i, { price: v })} /></Field>
                        <div className="num flex h-9 items-center justify-end text-sm font-medium">{rp((+x.qty || 0) * (+x.price || 0))}</div>
                        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Hapus baris"><X /></Button>
                    </div>
                ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => setItems([...items, blank()])}><Plus /> Tambah baris</Button>
            <p className="text-xs text-muted-foreground">Stok barang menambah persediaan (HPP rata-rata tertimbang). Biaya/aset langsung dibebankan ke akun yang dipilih (mis. listrik, perawatan, peralatan).</p>
        </Modal>
    );
}
