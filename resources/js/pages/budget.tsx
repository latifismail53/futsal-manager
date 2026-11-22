import { Head } from '@inertiajs/react';
import { Download, Save } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bar, moneyAxis, moneyTooltip } from '@/components/futsal/charts';
import { Badge, DataTable, Loading, NativeSelect, Page, PageHead, Panel, Seg, Stat } from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/futsal/api';
import { downloadCSV, invalidate, MONTHS, MONTHS_FULL, num, pct, rp, useApi } from '@/lib/futsal/utils';
import { cn } from '@/lib/utils';

export default function Budget() {
    const [tab, setTab] = useState('report');
    const [year, setYear] = useState(new Date().getFullYear());

    return (
        <Page>
            <Head title="Anggaran vs Realisasi" />
            <PageHead title="Rencana anggaran vs realisasi" desc="Susun anggaran per akun per bulan lalu bandingkan dengan realisasi dari jurnal.">
                <NativeSelect className="w-auto" value={year} onChange={(e) => setYear(+e.target.value)} aria-label="Tahun">
                    {[-2, -1, 0, 1].map((o) => {
                        const y = new Date().getFullYear() + o;

                        return <option key={y} value={y}>{y}</option>;
                    })}
                </NativeSelect>
                <Seg tabs={[['report', 'Anggaran vs realisasi'], ['input', 'Susun anggaran']]} value={tab} onChange={setTab} />
            </PageHead>
            {tab === 'report' ? <Report year={year} /> : <BudgetInput year={year} />}
        </Page>
    );
}

function Report({ year }: { year: number }) {
    const cm = new Date().getMonth() + 1;
    const [m, setM] = useState({ from: 1, to: year === new Date().getFullYear() ? cm : 12 });
    const [type, setType] = useState('');
    const { data } = useApi(`/reports/budget?year=${year}&mFrom=${m.from}&mTo=${m.to}`);

    if (!data) {
        return <Loading rows={8} />;
    }

    const rows = data.rows.filter((r: any) => (!type || r.type === type) && (r.budget || r.actual));
    const sum = (t: string, k: string) => data.rows.filter((r: any) => r.type === t).reduce((s: number, r: any) => s + r[k], 0);
    const bRev = sum('revenue', 'budget'), aRev = sum('revenue', 'actual'), bExp = sum('expense', 'budget'), aExp = sum('expense', 'actual');
    const good = aRev - aExp >= bRev - bExp;
    const withBudget = rows.filter((r: any) => r.budget);

    return (
        <>
            <Panel>
                <div className="flex flex-wrap items-center gap-2">
                    <NativeSelect className="w-auto" value={m.from} onChange={(e) => setM({ ...m, from: +e.target.value })} aria-label="Dari bulan">
                        {MONTHS_FULL.map((x, i) => <option key={i} value={i + 1}>{x}</option>)}
                    </NativeSelect>
                    <span className="text-xs text-muted-foreground">s/d</span>
                    <NativeSelect className="w-auto" value={m.to} onChange={(e) => setM({ ...m, to: +e.target.value })} aria-label="Sampai bulan">
                        {MONTHS_FULL.map((x, i) => <option key={i} value={i + 1}>{x}</option>)}
                    </NativeSelect>
                    <Seg tabs={[['', 'Semua'], ['revenue', 'Pendapatan'], ['expense', 'Beban']]} value={type} onChange={setType} />
                    <Button
                        variant="outline"
                        className="sm:ml-auto"
                        onClick={() => downloadCSV(`anggaran_vs_realisasi_${year}.csv`, rows, [{ label: 'Kode', key: 'code' }, { label: 'Akun', key: 'name' }, { label: 'Anggaran', key: 'budget' }, { label: 'Realisasi', key: 'actual' }, { label: 'Selisih', key: 'variance' }, { label: '% Realisasi', value: (r) => r.pct?.toFixed(1) }])}
                    >
                        <Download /> Ekspor CSV
                    </Button>
                </div>
            </Panel>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Pendapatan: realisasi" value={rp(aRev)} sub={`Anggaran ${rp(bRev)} · ${pct(bRev ? (aRev / bRev) * 100 : null)}`} tone={aRev >= bRev ? 'green' : 'red'} />
                <Stat label="Beban: realisasi" value={rp(aExp)} sub={`Anggaran ${rp(bExp)} · ${pct(bExp ? (aExp / bExp) * 100 : null)}`} tone={aExp <= bExp ? 'green' : 'red'} />
                <Stat label="Laba realisasi" value={rp(aRev - aExp)} sub={`Anggaran laba ${rp(bRev - bExp)}`} tone={good ? 'green' : 'red'} />
                <Stat label="Selisih laba" value={rp(aRev - aExp - (bRev - bExp))} tone={good ? 'green' : 'red'} sub={good ? 'Menguntungkan' : 'Tidak menguntungkan'} />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
                <Panel title="Pendapatan & beban bulanan: anggaran vs realisasi">
                    <div className="h-80">
                        <Bar
                            data={{
                                labels: data.monthly.map((x: any) => MONTHS[x.month - 1]),
                                datasets: [
                                    { label: 'Anggaran pendapatan', data: data.monthly.map((x: any) => x.budgetRevenue), backgroundColor: 'rgba(22,163,74,.3)' },
                                    { label: 'Realisasi pendapatan', data: data.monthly.map((x: any) => x.actualRevenue), backgroundColor: '#16a34a' },
                                    { label: 'Anggaran beban', data: data.monthly.map((x: any) => x.budgetExpense), backgroundColor: 'rgba(217,119,6,.3)' },
                                    { label: 'Realisasi beban', data: data.monthly.map((x: any) => x.actualExpense), backgroundColor: '#d97706' },
                                ],
                            }}
                            options={{ scales: { y: moneyAxis, x: { grid: { display: false } } }, plugins: { tooltip: moneyTooltip } } as any}
                        />
                    </div>
                </Panel>
                <Panel title="Pencapaian per akun (% realisasi)">
                    <div className="h-80">
                        <Bar
                            data={{
                                labels: withBudget.map((r: any) => r.name.replace(/^(Beban|Pendapatan) /, '')),
                                datasets: [{ label: '% realisasi', data: withBudget.map((r: any) => r.pct), backgroundColor: withBudget.map((r: any) => (r.favorable ? '#16a34a' : '#c2410c')) }],
                            }}
                            options={{ indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => pct(c.parsed.x) } } }, scales: { x: { ticks: { callback: (v: any) => v + '%' } } } } as any}
                        />
                    </div>
                </Panel>
            </div>
            <Panel bodyClass="p-0">
                <DataTable>
                    <thead><tr><th>Kode</th><th>Akun</th><th className="r">Anggaran</th><th className="r">Realisasi</th><th className="r">Selisih</th><th className="r">% Realisasi</th><th className="w-40">Progres</th><th>Status</th></tr></thead>
                    <tbody>
                        {rows.map((r: any) => (
                            <tr key={r.code}>
                                <td className="font-mono text-xs">{r.code}</td>
                                <td>{r.name}</td>
                                <td className="r">{num(r.budget)}</td>
                                <td className="r">{num(r.actual)}</td>
                                <td className={cn('r', r.favorable ? 'text-green-600' : 'text-red-600')}>{r.variance > 0 ? '+' : ''}{num(r.variance)}</td>
                                <td className="r">{pct(r.pct)}</td>
                                <td><div className="h-1.5 w-full overflow-hidden rounded bg-muted"><div className={cn('h-full', r.favorable ? 'bg-green-500' : 'bg-red-500')} style={{ width: Math.min(100, r.pct || 0) + '%' }} /></div></td>
                                <td>{r.budget ? <Badge tone={r.favorable ? 'green' : 'red'}>{r.favorable ? 'Sesuai/baik' : r.type === 'revenue' ? 'Di bawah target' : 'Melebihi anggaran'}</Badge> : <Badge>Tanpa anggaran</Badge>}</td>
                            </tr>
                        ))}
                    </tbody>
                </DataTable>
            </Panel>
        </>
    );
}

function BudgetInput({ year }: { year: number }) {
    const { data: accounts } = useApi<any[]>('/accounts');
    const { data: budgets } = useApi<any[]>('/budgets?year=' + year);
    const [grid, setGrid] = useState<Record<string, number>>({});
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (budgets) {
            setGrid(Object.fromEntries(budgets.map((b) => [b.account_code + '|' + b.month, b.amount])));
        }
    }, [budgets]);
    const accs = accounts?.filter((a) => a.type === 'revenue' || a.type === 'expense') || [];
    const cell = (a: string, m: number) => grid[a + '|' + m] || 0;
    const fillRow = (a: string) => {
        const v = prompt('Isi nominal yang sama untuk Jan–Des:', String(cell(a, 1)));

        if (v != null) {
            setGrid((g) => {
                const n = { ...g };

                for (let m = 1; m <= 12; m++) {
                    n[a + '|' + m] = +v.replace(/[^\d]/g, '') || 0;
                }

                return n;
            });
        }
    };
    const save = async () => {
        setBusy(true);

        try {
            const entries = accs.flatMap((a) => Array.from({ length: 12 }, (_, i) => ({ account_code: a.code, month: i + 1, amount: cell(a.code, i + 1) })));
            await api.put('/budgets', { year, entries });
            invalidate('/');
            toast.success('Anggaran tersimpan');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };
    const M = Array.from({ length: 12 }, (_, i) => i + 1);
    const rowSum = (a: string) => M.reduce((s, m) => s + cell(a, m), 0);
    const colSum = (t: string, m: number) => accs.filter((a) => a.type === t).reduce((s, a) => s + cell(a.code, m), 0);

    if (!accounts || !budgets) {
        return <Loading rows={8} />;
    }

    return (
        <Panel
            bodyClass="p-0"
            title={<span className="text-xs font-normal text-muted-foreground">Isi nominal anggaran per bulan. Klik nama akun untuk mengisi 12 bulan sekaligus.</span>}
            actions={<Button onClick={save} disabled={busy}><Save /> Simpan anggaran {year}</Button>}
        >
            <DataTable>
                <thead>
                    <tr><th className="sticky left-0 z-10 bg-card">Akun</th>{MONTHS.map((m) => <th key={m} className="r">{m}</th>)}<th className="r">Total</th></tr>
                </thead>
                <tbody>
                    {['revenue', 'expense'].map((t) => (
                        <Fragment key={t}>
                            <tr className="bg-muted/50"><td colSpan={14} className="text-xs font-semibold uppercase">{t === 'revenue' ? 'Pendapatan' : 'Beban'}</td></tr>
                            {accs.filter((a) => a.type === t).map((a) => (
                                <tr key={a.code}>
                                    <td className="sticky left-0 z-10 bg-card whitespace-nowrap"><button className="text-left text-primary hover:underline" onClick={() => fillRow(a.code)}>{a.name}</button></td>
                                    {M.map((m) => (
                                        <td key={m} className="!p-0.5">
                                            <input
                                                inputMode="numeric"
                                                aria-label={`${a.name} ${MONTHS[m - 1]}`}
                                                value={cell(a.code, m) ? cell(a.code, m).toLocaleString('id-ID') : ''}
                                                onChange={(e) => setGrid((g) => ({ ...g, [a.code + '|' + m]: +e.target.value.replace(/[^\d]/g, '') || 0 }))}
                                                className="num h-8 w-24 rounded border border-input bg-transparent px-1.5 text-right text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
                                            />
                                        </td>
                                    ))}
                                    <td className="r font-semibold">{num(rowSum(a.code))}</td>
                                </tr>
                            ))}
                            <tr className="font-medium">
                                <td className="sticky left-0 z-10 bg-card">Total {t === 'revenue' ? 'pendapatan' : 'beban'}</td>
                                {M.map((m) => <td key={m} className="r text-xs">{num(colSum(t, m))}</td>)}
                                <td className="r">{num(M.reduce((s, m) => s + colSum(t, m), 0))}</td>
                            </tr>
                        </Fragment>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td className="sticky left-0 z-10 bg-muted">Anggaran laba</td>
                        {M.map((m) => <td key={m} className="r text-xs">{num(colSum('revenue', m) - colSum('expense', m))}</td>)}
                        <td className="r">{num(M.reduce((s, m) => s + colSum('revenue', m) - colSum('expense', m), 0))}</td>
                    </tr>
                </tfoot>
            </DataTable>
        </Panel>
    );
}
