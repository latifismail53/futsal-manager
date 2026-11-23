import { Head } from '@inertiajs/react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    Badge,
    DataTable,
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
} from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/futsal/api';
import { invalidate, rp, useApi } from '@/lib/futsal/utils';
import { cn } from '@/lib/utils';

type Col = [
    key: string,
    label: string,
    type?: 'money' | 'number' | 'color' | 'bool' | 'cat' | 'readonly',
];
const CONF: Record<
    string,
    { label: string; cols: Col[]; empty: Record<string, unknown> }
> = {
    fields: {
        label: 'Lapangan',
        cols: [
            ['name', 'Nama'],
            ['type', 'Jenis'],
            ['price_day', 'Tarif siang', 'money'],
            ['price_night', 'Tarif malam', 'money'],
            ['night_start', 'Mulai tarif malam (jam)', 'number'],
            ['color', 'Warna', 'color'],
            ['active', 'Aktif', 'bool'],
        ],
        empty: {
            name: '',
            type: 'Vinyl',
            price_day: 100000,
            price_night: 150000,
            night_start: 17,
            color: '#15803d',
            active: 1,
        },
    },
    products: {
        label: 'Produk',
        cols: [
            ['name', 'Nama'],
            ['category', 'Kategori', 'cat'],
            ['unit', 'Satuan'],
            ['price', 'Harga jual', 'money'],
            ['cost', 'HPP', 'money'],
            ['stock', 'Stok', 'readonly'],
            ['min_stock', 'Stok minimum', 'number'],
            ['track_stock', 'Lacak stok', 'bool'],
            ['active', 'Aktif', 'bool'],
        ],
        empty: {
            name: '',
            category: 'fnb',
            unit: 'pcs',
            price: 0,
            cost: 0,
            min_stock: 10,
            track_stock: 1,
            active: 1,
        },
    },
    customers: {
        label: 'Pelanggan',
        cols: [
            ['name', 'Nama'],
            ['phone', 'No. HP'],
            ['team', 'Tim'],
            ['notes', 'Catatan'],
        ],
        empty: { name: '', phone: '', team: '', notes: '' },
    },
    suppliers: {
        label: 'Supplier',
        cols: [
            ['name', 'Nama'],
            ['phone', 'Telepon'],
            ['address', 'Alamat'],
        ],
        empty: { name: '', phone: '', address: '' },
    },
};
const CAT: Record<string, string> = {
    fnb: 'Makanan & minuman',
    rental: 'Sewa perlengkapan',
    other: 'Lainnya',
};
const isNum = (t?: string) =>
    t === 'money' || t === 'number' || t === 'readonly';

export default function MasterData() {
    const [tab, setTab] = useState('fields');

    return (
        <Page>
            <Head title="Master Data" />
            <PageHead
                title="Master data"
                desc="Lapangan & tarif, produk, pelanggan, dan supplier."
            >
                <Seg
                    tabs={Object.entries(CONF).map(([k, v]) => [k, v.label])}
                    value={tab}
                    onChange={setTab}
                />
            </PageHead>
            <Crud key={tab} table={tab} />
        </Page>
    );
}

function Crud({ table }: { table: string }) {
    const c = CONF[table];
    const { data, reload } = useApi<any[]>('/' + table);
    const [edit, setEdit] = useState<any>(null);
    const [q, setQ] = useState('');
    const run = async (fn: () => Promise<unknown>, msg: string) => {
        try {
            await fn();
            toast.success(msg);
            setEdit(null);
            invalidate('/');
            reload();
        } catch (e: any) {
            toast.error(e.message);
        }
    };
    const save = () =>
        run(
            () =>
                edit.id
                    ? api.put(`/${table}/${edit.id}`, edit)
                    : api.post('/' + table, edit),
            'Tersimpan',
        );
    const del = () =>
        confirm('Hapus data ini?') &&
        run(() => api.del(`/${table}/${edit.id}`), 'Dihapus');
    const show = (col: Col, v: any) => {
        switch (col[2]) {
            case 'money':
                return rp(v);
            case 'bool':
                return v ? (
                    <Badge tone="green">Ya</Badge>
                ) : (
                    <Badge>Tidak</Badge>
                );
            case 'color':
                return (
                    <span
                        className="inline-block size-4 rounded"
                        style={{ background: v }}
                    />
                );
            case 'cat':
                return CAT[v];
            default:
                return v;
        }
    };
    const rows =
        data?.filter(
            (r) =>
                !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()),
        ) || [];

    return (
        <Panel
            bodyClass="p-0 max-h-[40rem] overflow-y-auto"
            title={
                <div className="relative w-56 font-normal">
                    <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                    <Input
                        className="pl-8"
                        placeholder={`Cari ${c.label.toLowerCase()}…`}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
            }
            actions={
                <Button onClick={() => setEdit({ ...c.empty })}>
                    <Plus /> Tambah {c.label.toLowerCase()}
                </Button>
            }
        >
            {!data ? (
                <Loading />
            ) : (
                <>
                    <DataTable>
                        <thead className="sticky top-0 bg-card">
                            <tr>
                                {c.cols.map((col) => (
                                    <th
                                        key={col[0]}
                                        className={cn(isNum(col[2]) && 'r')}
                                    >
                                        {col[1]}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr
                                    key={r.id}
                                    className="cursor-pointer"
                                    onClick={() => setEdit({ ...r })}
                                >
                                    {c.cols.map((col) => (
                                        <td
                                            key={col[0]}
                                            className={cn(isNum(col[2]) && 'r')}
                                        >
                                            {show(col, r[col[0]])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </DataTable>
                    {!rows.length && <Empty>Tidak ada data</Empty>}
                </>
            )}
            {edit && (
                <Modal
                    title={
                        (edit.id ? 'Ubah ' : 'Tambah ') + c.label.toLowerCase()
                    }
                    onClose={() => setEdit(null)}
                    footer={
                        <div className="flex w-full flex-wrap justify-end gap-2">
                            {edit.id && (
                                <Button
                                    variant="destructive"
                                    className="sm:mr-auto"
                                    onClick={del}
                                >
                                    <Trash2 /> Hapus
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={() => setEdit(null)}
                            >
                                Batal
                            </Button>
                            <Button onClick={save}>Simpan</Button>
                        </div>
                    }
                >
                    <div className="grid gap-3 sm:grid-cols-2">
                        {c.cols
                            .filter(([, , t]) => t !== 'readonly')
                            .map(([k, l, t]) =>
                                t === 'bool' ? (
                                    <label
                                        key={k}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <Checkbox
                                            checked={!!edit[k]}
                                            onCheckedChange={(v) =>
                                                setEdit({
                                                    ...edit,
                                                    [k]: v ? 1 : 0,
                                                })
                                            }
                                        />{' '}
                                        {l}
                                    </label>
                                ) : (
                                    <Field
                                        key={k}
                                        label={l}
                                        className={cn(
                                            (k === 'notes' ||
                                                k === 'address' ||
                                                k === 'name') &&
                                                'sm:col-span-2',
                                        )}
                                    >
                                        {t === 'money' ? (
                                            <MoneyInput
                                                value={edit[k]}
                                                onChange={(v) =>
                                                    setEdit({
                                                        ...edit,
                                                        [k]: v || 0,
                                                    })
                                                }
                                            />
                                        ) : t === 'cat' ? (
                                            <NativeSelect
                                                value={edit[k]}
                                                onChange={(e) =>
                                                    setEdit({
                                                        ...edit,
                                                        [k]: e.target.value,
                                                    })
                                                }
                                            >
                                                {Object.entries(CAT).map(
                                                    ([a, b]) => (
                                                        <option
                                                            key={a}
                                                            value={a}
                                                        >
                                                            {b}
                                                        </option>
                                                    ),
                                                )}
                                            </NativeSelect>
                                        ) : (
                                            <Input
                                                type={
                                                    t === 'number'
                                                        ? 'number'
                                                        : t === 'color'
                                                          ? 'color'
                                                          : 'text'
                                                }
                                                className={cn(
                                                    t === 'color' && 'h-9 p-1',
                                                )}
                                                value={edit[k] ?? ''}
                                                onChange={(e) =>
                                                    setEdit({
                                                        ...edit,
                                                        [k]:
                                                            t === 'number'
                                                                ? +e.target
                                                                      .value
                                                                : e.target
                                                                      .value,
                                                    })
                                                }
                                            />
                                        )}
                                    </Field>
                                ),
                            )}
                    </div>
                    {table === 'products' && (
                        <p className="text-xs text-muted-foreground">
                            Produk sewa (sepatu, rompi, bola) biasanya tidak
                            dilacak stoknya. Stok barang sebaiknya ditambah
                            lewat menu Pembelian agar tercatat di jurnal.
                        </p>
                    )}
                </Modal>
            )}
        </Panel>
    );
}
