import { Head } from '@inertiajs/react';
import { Download, Plus, Trash2, X } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import {
    Badge,
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
} from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { api, qs } from '@/lib/futsal/api';
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

const REF: Record<string, string> = {
    manual: 'Manual',
    booking: 'Booking',
    sale: 'Penjualan',
    purchase: 'Pembelian',
    purchase_payment: 'Pelunasan hutang',
    adjust: 'Penyesuaian stok',
};
const TYPE: Record<string, string> = {
    asset: 'Aset',
    liability: 'Kewajiban',
    equity: 'Ekuitas',
    revenue: 'Pendapatan',
    expense: 'Beban',
};
const SUBTYPE: Record<string, string> = {
    current_asset: 'Aset lancar',
    fixed_asset: 'Aset tetap',
    contra_asset: 'Kontra aset',
    current_liability: 'Kewajiban lancar',
    long_liability: 'Kewajiban jangka panjang',
    equity: 'Ekuitas',
    revenue: 'Pendapatan usaha',
    other_revenue: 'Pendapatan lain',
    cogs: 'HPP',
    expense: 'Beban operasional',
    other_expense: 'Beban lain',
};

export default function Accounting() {
    const [tab, setTab] = useState('journal');

    return (
        <Page>
            <Head title="Akuntansi" />
            <PageHead
                title="Akuntansi"
                desc="Jurnal umum (otomatis dari transaksi + manual), buku besar, neraca saldo, dan bagan akun."
            >
                <Seg
                    tabs={[
                        ['journal', 'Jurnal umum'],
                        ['ledger', 'Buku besar'],
                        ['tb', 'Neraca saldo'],
                        ['coa', 'Bagan akun'],
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            </PageHead>
            {tab === 'journal' && <Journal />}
            {tab === 'ledger' && <Ledger />}
            {tab === 'tb' && <TrialBalance />}
            {tab === 'coa' && <Coa />}
        </Page>
    );
}

function Journal() {
    const [f, setF] = useState({
        from: monthStart(),
        to: todayStr(),
        ref_type: '',
        q: '',
    });
    const { data, reload } = useApi<any[]>('/journals' + qs(f));
    const [form, setForm] = useState(false);
    const del = async (id: number) => {
        if (!confirm('Hapus jurnal manual ini?')) {
            return;
        }

        try {
            await api.del('/journals/' + id);
            toast.success('Jurnal dihapus');
            invalidate('/');
            reload();
        } catch (e: any) {
            toast.error(e.message);
        }
    };
    const exportCsv = () =>
        downloadCSV(
            'jurnal.csv',
            (data || []).flatMap((j) =>
                j.lines.map((l: any) => ({
                    ...l,
                    date: j.date,
                    description: j.description,
                    ref: REF[j.ref_type],
                })),
            ),
            [
                { label: 'Tanggal', key: 'date' },
                { label: 'No', key: 'journal_id' },
                { label: 'Keterangan', key: 'description' },
                { label: 'Sumber', key: 'ref' },
                { label: 'Akun', key: 'account_code' },
                { label: 'Nama akun', key: 'account_name' },
                { label: 'Debit', key: 'debit' },
                { label: 'Kredit', key: 'credit' },
            ],
        );

    return (
        <>
            <Panel>
                <div className="flex flex-wrap items-center gap-2">
                    <DateRange
                        from={f.from}
                        to={f.to}
                        onChange={(r) => setF({ ...f, ...r })}
                    />
                    <NativeSelect
                        className="w-auto"
                        value={f.ref_type}
                        onChange={(e) =>
                            setF({ ...f, ref_type: e.target.value })
                        }
                        aria-label="Sumber"
                    >
                        <option value="">Semua sumber</option>
                        {Object.entries(REF).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </NativeSelect>
                    <Input
                        className="w-full sm:w-52"
                        placeholder="Cari keterangan"
                        value={f.q}
                        onChange={(e) => setF({ ...f, q: e.target.value })}
                    />
                    <div className="flex gap-2 sm:ml-auto">
                        <Button
                            variant="outline"
                            onClick={exportCsv}
                            disabled={!data?.length}
                        >
                            <Download /> CSV
                        </Button>
                        <Button onClick={() => setForm(true)}>
                            <Plus /> Jurnal manual
                        </Button>
                    </div>
                </div>
            </Panel>
            <Panel bodyClass="p-0 max-h-[40rem] overflow-y-auto">
                {!data ? (
                    <Loading />
                ) : (
                    <>
                        <DataTable>
                            <thead className="sticky top-0 z-10 bg-card">
                                <tr>
                                    <th>Tanggal</th>
                                    <th>No.</th>
                                    <th>Keterangan / akun</th>
                                    <th>Sumber</th>
                                    <th className="r">Debit</th>
                                    <th className="r">Kredit</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((j) => (
                                    <Fragment key={j.id}>
                                        <tr className="bg-muted/50 font-medium">
                                            <td>{fmtDate(j.date)}</td>
                                            <td className="font-mono text-xs">
                                                JU-{j.id}
                                            </td>
                                            <td>{j.description}</td>
                                            <td>
                                                <Badge
                                                    tone={
                                                        j.ref_type === 'manual'
                                                            ? 'amber'
                                                            : 'blue'
                                                    }
                                                >
                                                    {REF[j.ref_type]}
                                                </Badge>
                                            </td>
                                            <td />
                                            <td />
                                            <td>
                                                {j.ref_type === 'manual' && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="size-7 text-red-600"
                                                        onClick={() =>
                                                            del(j.id)
                                                        }
                                                        aria-label="Hapus jurnal"
                                                    >
                                                        <X />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                        {j.lines.map((l: any) => (
                                            <tr key={l.id}>
                                                <td />
                                                <td />
                                                <td
                                                    className={cn(
                                                        l.credit && 'pl-10',
                                                    )}
                                                >
                                                    <span className="font-mono text-xs text-muted-foreground">
                                                        {l.account_code}
                                                    </span>{' '}
                                                    {l.account_name}
                                                </td>
                                                <td />
                                                <td className="r">
                                                    {l.debit
                                                        ? num(l.debit)
                                                        : ''}
                                                </td>
                                                <td className="r">
                                                    {l.credit
                                                        ? num(l.credit)
                                                        : ''}
                                                </td>
                                                <td />
                                            </tr>
                                        ))}
                                    </Fragment>
                                ))}
                            </tbody>
                        </DataTable>
                        {!data.length && <Empty>Tidak ada jurnal</Empty>}
                        {data.length === 500 && (
                            <p className="p-3 text-xs text-muted-foreground">
                                Menampilkan 500 jurnal terbaru; persempit
                                periode untuk melihat semua.
                            </p>
                        )}
                    </>
                )}
            </Panel>
            {form && (
                <JournalForm
                    onClose={() => setForm(false)}
                    onSaved={() => {
                        invalidate('/');
                        reload();
                    }}
                />
            )}
        </>
    );
}

const TEMPLATES: [string, string[]][] = [
    ['Gaji karyawan', ['6-1100', '1-1200']],
    ['Setoran modal', ['1-1200', '3-1100']],
    ['Prive pemilik', ['3-1200', '1-1200']],
    ['Penyusutan', ['6-1600', '1-2900']],
    ['Setor kas ke bank', ['1-1200', '1-1100']],
    ['Beban lain-lain (tunai)', ['6-1900', '1-1100']],
];
const line = (account_code = '') => ({
    account_code,
    debit: '' as number | '',
    credit: '' as number | '',
});

function JournalForm({
    onClose,
    onSaved,
}: {
    onClose: () => void;
    onSaved: () => void;
}) {
    const { data: accounts } = useApi<any[]>('/accounts');
    const [h, setH] = useState({ date: todayStr(), description: '' });
    const [lines, setLines] = useState([line(), line()]);
    const upd = (i: number, k: string, v: unknown) =>
        setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
    const d = lines.reduce((s, l) => s + (+l.debit || 0), 0);
    const c = lines.reduce((s, l) => s + (+l.credit || 0), 0);
    const ok = d === c && d > 0;
    const save = async () => {
        try {
            await api.post('/journals', { ...h, lines });
            toast.success('Jurnal tersimpan');
            onSaved();
            onClose();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    return (
        <Modal
            wide
            title="Jurnal manual"
            onClose={onClose}
            footer={
                <div className="flex w-full flex-wrap items-center justify-end gap-2">
                    <span
                        className={cn(
                            'text-sm sm:mr-auto',
                            ok ? 'text-green-600' : 'text-red-600',
                        )}
                    >
                        {ok ? 'Seimbang' : `Selisih ${rp(d - c)}`}
                    </span>
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button disabled={!ok} onClick={save}>
                        Simpan jurnal
                    </Button>
                </div>
            }
        >
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Templat:</span>
                {TEMPLATES.map(([name, codes]) => (
                    <Button
                        key={name}
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => {
                            setH({ ...h, description: name });
                            setLines(codes.map((a) => line(a)));
                        }}
                    >
                        {name}
                    </Button>
                ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <Field label="Tanggal">
                    <Input
                        type="date"
                        value={h.date}
                        onChange={(e) => setH({ ...h, date: e.target.value })}
                    />
                </Field>
                <Field label="Keterangan">
                    <Input
                        value={h.description}
                        onChange={(e) =>
                            setH({ ...h, description: e.target.value })
                        }
                    />
                </Field>
            </div>
            <div className="space-y-2">
                {lines.map((l, i) => (
                    <div
                        key={i}
                        className="grid grid-cols-[1fr_1fr_2rem] gap-2 sm:grid-cols-[1fr_9rem_9rem_2rem]"
                    >
                        <NativeSelect
                            className="col-span-3 sm:col-span-1"
                            value={l.account_code}
                            onChange={(e) =>
                                upd(i, 'account_code', e.target.value)
                            }
                            aria-label="Akun"
                        >
                            <option value="">— akun —</option>
                            {accounts?.map((a) => (
                                <option key={a.code} value={a.code}>
                                    {a.code} {a.name}
                                </option>
                            ))}
                        </NativeSelect>
                        <MoneyInput
                            value={l.debit}
                            onChange={(v) => upd(i, 'debit', v)}
                            placeholder="Debit"
                            aria-label="Debit"
                        />
                        <MoneyInput
                            value={l.credit}
                            onChange={(v) => upd(i, 'credit', v)}
                            placeholder="Kredit"
                            aria-label="Kredit"
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() =>
                                setLines(lines.filter((_, j) => j !== i))
                            }
                            aria-label="Hapus baris"
                        >
                            <X />
                        </Button>
                    </div>
                ))}
                <div className="num grid grid-cols-[1fr_1fr_2rem] gap-2 border-t pt-2 text-sm font-semibold sm:grid-cols-[1fr_9rem_9rem_2rem]">
                    <span className="hidden sm:block">Total</span>
                    <span className="text-right">{num(d)}</span>
                    <span className="text-right">{num(c)}</span>
                </div>
            </div>
            <Button
                size="sm"
                variant="outline"
                onClick={() => setLines([...lines, line()])}
            >
                <Plus /> Baris
            </Button>
        </Modal>
    );
}

function Ledger() {
    const { data: accounts } = useApi<any[]>('/accounts');
    const [f, setF] = useState({
        account: '1-1100',
        from: monthStart(),
        to: todayStr(),
    });
    const { data } = useApi('/reports/ledger' + qs(f));

    return (
        <>
            <Panel>
                <div className="flex flex-wrap items-center gap-2">
                    <NativeSelect
                        className="w-full sm:w-64"
                        value={f.account}
                        onChange={(e) =>
                            setF({ ...f, account: e.target.value })
                        }
                        aria-label="Akun"
                    >
                        {accounts?.map((a) => (
                            <option key={a.code} value={a.code}>
                                {a.code} {a.name}
                            </option>
                        ))}
                    </NativeSelect>
                    <DateRange
                        from={f.from}
                        to={f.to}
                        onChange={(r) => setF({ ...f, ...r })}
                    />
                </div>
            </Panel>
            <Panel
                title={
                    data
                        ? `${data.account.code} · ${data.account.name}`
                        : 'Buku besar'
                }
                bodyClass="p-0 max-h-[40rem] overflow-y-auto"
            >
                {!data ? (
                    <Loading />
                ) : (
                    <DataTable>
                        <thead className="sticky top-0 bg-card">
                            <tr>
                                <th>Tanggal</th>
                                <th>No.</th>
                                <th>Keterangan</th>
                                <th className="r">Debit</th>
                                <th className="r">Kredit</th>
                                <th className="r">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-muted/50 font-medium">
                                <td colSpan={5}>Saldo awal</td>
                                <td className="r">{num(data.opening)}</td>
                            </tr>
                            {data.rows.map((r: any, i: number) => (
                                <tr key={i}>
                                    <td>{fmtDate(r.date)}</td>
                                    <td className="font-mono text-xs">
                                        JU-{r.journal_id}
                                    </td>
                                    <td>{r.description}</td>
                                    <td className="r">
                                        {r.debit ? num(r.debit) : ''}
                                    </td>
                                    <td className="r">
                                        {r.credit ? num(r.credit) : ''}
                                    </td>
                                    <td
                                        className={cn(
                                            'r',
                                            r.balance < 0 && 'text-red-600',
                                        )}
                                    >
                                        {num(r.balance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3}>Saldo akhir</td>
                                <td className="r">
                                    {num(
                                        data.rows.reduce(
                                            (s: number, r: any) => s + r.debit,
                                            0,
                                        ),
                                    )}
                                </td>
                                <td className="r">
                                    {num(
                                        data.rows.reduce(
                                            (s: number, r: any) => s + r.credit,
                                            0,
                                        ),
                                    )}
                                </td>
                                <td className="r">{num(data.closing)}</td>
                            </tr>
                        </tfoot>
                    </DataTable>
                )}
            </Panel>
        </>
    );
}

function TrialBalance() {
    const [to, setTo] = useState(todayStr());
    const { data } = useApi('/reports/trial-balance?to=' + to);
    const balanced = data && data.total_debit === data.total_credit;

    return (
        <Panel
            bodyClass="p-0"
            title={
                <span className="flex items-center gap-2 font-normal">
                    Per tanggal{' '}
                    <Input
                        type="date"
                        className="w-40"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        aria-label="Per tanggal"
                    />
                </span>
            }
            actions={
                data && (
                    <Badge tone={balanced ? 'green' : 'red'}>
                        {balanced ? 'Seimbang' : 'Tidak seimbang'}
                    </Badge>
                )
            }
        >
            {!data ? (
                <Loading />
            ) : (
                <DataTable>
                    <thead>
                        <tr>
                            <th>Kode</th>
                            <th>Akun</th>
                            <th>Tipe</th>
                            <th className="r">Mutasi debit</th>
                            <th className="r">Mutasi kredit</th>
                            <th className="r">Saldo debit</th>
                            <th className="r">Saldo kredit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.rows
                            .filter((r: any) => r.debit || r.credit)
                            .map((r: any) => (
                                <tr key={r.code}>
                                    <td className="font-mono text-xs">
                                        {r.code}
                                    </td>
                                    <td>{r.name}</td>
                                    <td className="text-xs text-muted-foreground">
                                        {TYPE[r.type]}
                                    </td>
                                    <td className="r text-muted-foreground">
                                        {num(r.debit)}
                                    </td>
                                    <td className="r text-muted-foreground">
                                        {num(r.credit)}
                                    </td>
                                    <td className="r">
                                        {r.end_debit ? num(r.end_debit) : ''}
                                    </td>
                                    <td className="r">
                                        {r.end_credit ? num(r.end_credit) : ''}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={5}>Total</td>
                            <td className="r">{num(data.total_debit)}</td>
                            <td className="r">{num(data.total_credit)}</td>
                        </tr>
                    </tfoot>
                </DataTable>
            )}
        </Panel>
    );
}

const SUB_FOR: Record<string, string[]> = {
    asset: ['current_asset', 'fixed_asset', 'contra_asset'],
    liability: ['current_liability', 'long_liability'],
    equity: ['equity'],
    revenue: ['revenue', 'other_revenue'],
    expense: ['cogs', 'expense', 'other_expense'],
};

function Coa() {
    const { data, reload } = useApi<any[]>('/accounts');
    const [edit, setEdit] = useState<any>(null);
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

    return (
        <Panel
            bodyClass="p-0"
            title={
                <span className="text-xs font-normal text-muted-foreground">
                    Akun bertanda kas/bank dihitung sebagai kas di laporan arus
                    kas.
                </span>
            }
            actions={
                <Button
                    onClick={() =>
                        setEdit({
                            _new: true,
                            code: '',
                            name: '',
                            type: 'expense',
                            subtype: 'expense',
                            is_cash: 0,
                        })
                    }
                >
                    <Plus /> Akun baru
                </Button>
            }
        >
            {!data ? (
                <Loading />
            ) : (
                <DataTable>
                    <thead>
                        <tr>
                            <th>Kode</th>
                            <th>Nama akun</th>
                            <th>Tipe</th>
                            <th>Kelompok</th>
                            <th>Kas/bank</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((a) => (
                            <tr
                                key={a.code}
                                className="cursor-pointer"
                                onClick={() => setEdit({ ...a })}
                            >
                                <td className="font-mono text-xs">{a.code}</td>
                                <td>{a.name}</td>
                                <td>{TYPE[a.type]}</td>
                                <td className="text-muted-foreground">
                                    {SUBTYPE[a.subtype]}
                                </td>
                                <td>
                                    {a.is_cash ? (
                                        <Badge tone="green">Ya</Badge>
                                    ) : (
                                        ''
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </DataTable>
            )}
            {edit && (
                <Modal
                    title={edit._new ? 'Akun baru' : 'Ubah akun'}
                    onClose={() => setEdit(null)}
                    footer={
                        <div className="flex w-full flex-wrap justify-end gap-2">
                            {!edit._new && (
                                <Button
                                    variant="destructive"
                                    className="sm:mr-auto"
                                    onClick={() =>
                                        confirm('Hapus akun?') &&
                                        run(
                                            () =>
                                                api.del(
                                                    '/accounts/' + edit.code,
                                                ),
                                            'Akun dihapus',
                                        )
                                    }
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
                            <Button
                                onClick={() =>
                                    run(
                                        () =>
                                            edit._new
                                                ? api.post('/accounts', edit)
                                                : api.put(
                                                      '/accounts/' + edit.code,
                                                      edit,
                                                  ),
                                        'Akun tersimpan',
                                    )
                                }
                            >
                                Simpan
                            </Button>
                        </div>
                    }
                >
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Kode">
                            <Input
                                value={edit.code}
                                disabled={!edit._new}
                                placeholder="6-1950"
                                onChange={(e) =>
                                    setEdit({ ...edit, code: e.target.value })
                                }
                            />
                        </Field>
                        <Field label="Nama">
                            <Input
                                value={edit.name}
                                onChange={(e) =>
                                    setEdit({ ...edit, name: e.target.value })
                                }
                            />
                        </Field>
                        <Field label="Tipe">
                            <NativeSelect
                                value={edit.type}
                                disabled={!edit._new}
                                onChange={(e) =>
                                    setEdit({
                                        ...edit,
                                        type: e.target.value,
                                        subtype: SUB_FOR[e.target.value][0],
                                    })
                                }
                            >
                                {Object.entries(TYPE).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                        <Field label="Kelompok">
                            <NativeSelect
                                value={edit.subtype}
                                onChange={(e) =>
                                    setEdit({
                                        ...edit,
                                        subtype: e.target.value,
                                    })
                                }
                            >
                                {SUB_FOR[edit.type].map((k) => (
                                    <option key={k} value={k}>
                                        {SUBTYPE[k]}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Field>
                        {edit.type === 'asset' && (
                            <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                    checked={!!edit.is_cash}
                                    onCheckedChange={(v) =>
                                        setEdit({ ...edit, is_cash: v ? 1 : 0 })
                                    }
                                />{' '}
                                Akun kas / bank
                            </label>
                        )}
                    </div>
                </Modal>
            )}
        </Panel>
    );
}
