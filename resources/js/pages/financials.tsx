import { Head } from '@inertiajs/react';
import { Download, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
    Bar,
    Doughnut,
    moneyAxis,
    moneyTooltip,
} from '@/components/futsal/charts';
import {
    Badge,
    COLORS,
    DateRange,
    Loading,
    Page,
    PageHead,
    Panel,
    Seg,
    Stat,
} from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { qs } from '@/lib/futsal/api';
import {
    downloadCSV,
    fmtDateLong,
    MONTHS,
    pct,
    rp,
    rpAcc,
    todayStr,
    useApi,
} from '@/lib/futsal/utils';
import { cn } from '@/lib/utils';

export default function Financials() {
    const [tab, setTab] = useState('pl');
    const [r, setR] = useState({
        from: `${new Date().getFullYear()}-01-01`,
        to: todayStr(),
    });
    const [date, setDate] = useState(todayStr());

    return (
        <Page>
            <Head title="Laporan Keuangan" />
            <PageHead
                title="Laporan keuangan"
                desc="Laba rugi, neraca, dan arus kas disusun otomatis dari jurnal."
            >
                <Seg
                    tabs={[
                        ['pl', 'Laba rugi'],
                        ['bs', 'Neraca'],
                        ['cf', 'Arus kas'],
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            </PageHead>
            <Panel>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                    {tab === 'bs' ? (
                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                            Per tanggal{' '}
                            <Input
                                type="date"
                                className="w-40"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                aria-label="Per tanggal"
                            />
                        </span>
                    ) : (
                        <DateRange from={r.from} to={r.to} onChange={setR} />
                    )}
                    <Button
                        variant="outline"
                        className="sm:ml-auto"
                        onClick={() => window.print()}
                    >
                        <Printer /> Cetak
                    </Button>
                </div>
            </Panel>
            {tab === 'pl' && <ProfitLoss r={r} />}
            {tab === 'bs' && <BalanceSheet date={date} />}
            {tab === 'cf' && <CashFlow r={r} />}
        </Page>
    );
}

function Row({
    label,
    v,
    kind,
    indent,
}: {
    label: ReactNode;
    v: number;
    kind?: 'sub' | 'total' | 'grand';
    indent?: boolean;
}) {
    return (
        <div
            className={cn(
                'num flex justify-between gap-3 py-1.5 text-sm',
                indent && 'pl-5',
                kind === 'sub' && 'border-t font-medium',
                kind === 'total' && 'border-t-2 font-semibold',
                kind === 'grand' &&
                    'border-t-2 border-double text-base font-bold',
            )}
        >
            <span className="min-w-0">{label}</span>
            <span className={cn('shrink-0', v < 0 && 'text-red-600')}>
                {kind === 'grand' ? rp(v) : rpAcc(v)}
            </span>
        </div>
    );
}
const Sec = ({ children }: { children: ReactNode }) => (
    <div className="mt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase first:mt-0">
        {children}
    </div>
);
const chartOpts = (stacked = false) =>
    ({
        scales: {
            y: { ...moneyAxis, stacked },
            x: { stacked, grid: { display: false } },
        },
        plugins: { tooltip: moneyTooltip },
    }) as any;

function ProfitLoss({ r }: { r: { from: string; to: string } }) {
    const { data: d } = useApi('/reports/income-statement' + qs(r));
    const { data: monthly } = useApi<any[]>(
        '/reports/income-monthly?year=' + r.to.slice(0, 4),
    );

    if (!d) {
        return <Loading rows={10} />;
    }

    const rev = d.totalRevenue;
    const costs = [...d.cogs, ...d.expenses, ...d.otherExpense].filter(
        (x: any) => x.amount,
    );

    return (
        <div className="grid items-start gap-4 xl:grid-cols-2">
            <Panel
                title="Laporan laba rugi"
                actions={
                    <span className="text-xs text-muted-foreground">
                        {fmtDateLong(r.from)} – {fmtDateLong(r.to)}
                    </span>
                }
            >
                <Sec>Pendapatan usaha</Sec>
                {d.revenue.map((x: any) => (
                    <Row key={x.code} label={x.name} v={x.amount} indent />
                ))}
                <Row label="Total pendapatan usaha" v={rev} kind="sub" />
                <Sec>Harga pokok penjualan</Sec>
                {d.cogs.map((x: any) => (
                    <Row key={x.code} label={x.name} v={x.amount} indent />
                ))}
                <Row label="Laba kotor" v={d.grossProfit} kind="total" />
                <Sec>Beban operasional</Sec>
                {d.expenses
                    .filter((x: any) => x.amount)
                    .map((x: any) => (
                        <Row key={x.code} label={x.name} v={x.amount} indent />
                    ))}
                <Row
                    label="Total beban operasional"
                    v={d.totalExpense}
                    kind="sub"
                />
                <Row
                    label="Laba operasional"
                    v={d.operatingProfit}
                    kind="total"
                />
                <Sec>Pendapatan & beban lain</Sec>
                {d.otherRevenue.map((x: any) => (
                    <Row key={x.code} label={x.name} v={x.amount} indent />
                ))}
                {d.otherExpense.map((x: any) => (
                    <Row key={x.code} label={x.name} v={-x.amount} indent />
                ))}
                <Row label="Laba (rugi) bersih" v={d.netIncome} kind="grand" />
            </Panel>
            <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-3">
                    <Stat
                        label="Margin kotor"
                        value={pct(rev ? (d.grossProfit / rev) * 100 : 0)}
                    />
                    <Stat
                        label="Margin operasional"
                        value={pct(rev ? (d.operatingProfit / rev) * 100 : 0)}
                    />
                    <Stat
                        label="Margin bersih"
                        value={pct(rev ? (d.netIncome / rev) * 100 : 0)}
                        tone={d.netIncome < 0 ? 'red' : 'green'}
                    />
                </div>
                <Panel title={`Laba rugi per bulan (${r.to.slice(0, 4)})`}>
                    <div className="h-64">
                        {monthly && (
                            <Bar
                                data={{
                                    labels: MONTHS,
                                    datasets: [
                                        {
                                            label: 'Pendapatan',
                                            data: monthly.map((m) => m.revenue),
                                            backgroundColor: '#16a34a',
                                        },
                                        {
                                            label: 'Beban',
                                            data: monthly.map((m) => m.expense),
                                            backgroundColor: '#f59e0b',
                                        },
                                        {
                                            label: 'Laba bersih',
                                            data: monthly.map((m) => m.net),
                                            backgroundColor: '#2563eb',
                                        },
                                    ],
                                }}
                                options={chartOpts()}
                            />
                        )}
                    </div>
                </Panel>
                <Panel title="Komposisi beban">
                    <div className="h-64">
                        <Doughnut
                            data={{
                                labels: costs.map((x: any) => x.name),
                                datasets: [
                                    {
                                        data: costs.map((x: any) => x.amount),
                                        backgroundColor: COLORS,
                                    },
                                ],
                            }}
                            options={
                                {
                                    plugins: {
                                        legend: { position: 'right' },
                                        tooltip: {
                                            callbacks: {
                                                label: (c: any) =>
                                                    `${c.label}: ${rp(c.parsed)}`,
                                            },
                                        },
                                    },
                                } as any
                            }
                        />
                    </div>
                </Panel>
            </div>
        </div>
    );
}

function BalanceSheet({ date }: { date: string }) {
    const { data: d } = useApi('/reports/balance-sheet?date=' + date);

    if (!d) {
        return <Loading rows={10} />;
    }

    const sec = (
        title: string,
        rows: any[],
        total: number,
        totalLabel: string,
    ) => (
        <>
            <Sec>{title}</Sec>
            {rows.map((x) => (
                <Row key={x.code + x.name} label={x.name} v={x.amount} indent />
            ))}
            <Row label={totalLabel} v={total} kind="sub" />
        </>
    );

    return (
        <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                    Neraca per {fmtDateLong(date)}
                </span>
                <Badge tone={d.balanced ? 'green' : 'red'}>
                    {d.balanced
                        ? 'Seimbang: Aset = Kewajiban + Ekuitas'
                        : 'Tidak seimbang'}
                </Badge>
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-2">
                <Panel title="Aset">
                    {sec(
                        'Aset lancar',
                        d.currentAssets,
                        d.totalCurrentAssets,
                        'Total aset lancar',
                    )}
                    {sec(
                        'Aset tetap',
                        d.fixedAssets,
                        d.totalFixedAssets,
                        'Total aset tetap (neto)',
                    )}
                    <Row label="Total aset" v={d.totalAssets} kind="grand" />
                </Panel>
                <Panel title="Kewajiban & ekuitas">
                    {sec(
                        'Kewajiban lancar',
                        d.currentLiabilities,
                        d.totalCurrentLiabilities,
                        'Total kewajiban lancar',
                    )}
                    {sec(
                        'Kewajiban jangka panjang',
                        d.longLiabilities,
                        d.totalLongLiabilities,
                        'Total kewajiban jangka panjang',
                    )}
                    <Row
                        label="Total kewajiban"
                        v={d.totalLiabilities}
                        kind="total"
                    />
                    {sec('Ekuitas', d.equity, d.totalEquity, 'Total ekuitas')}
                    <Row
                        label="Total kewajiban & ekuitas"
                        v={d.totalLiabilities + d.totalEquity}
                        kind="grand"
                    />
                </Panel>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat
                    label="Rasio lancar"
                    value={
                        d.totalCurrentLiabilities
                            ? (
                                  d.totalCurrentAssets /
                                  d.totalCurrentLiabilities
                              ).toFixed(2) + 'x'
                            : '-'
                    }
                    sub="Aset lancar / kewajiban lancar"
                />
                <Stat
                    label="Debt to equity"
                    value={
                        d.totalEquity
                            ? (d.totalLiabilities / d.totalEquity).toFixed(2) +
                              'x'
                            : '-'
                    }
                    sub="Kewajiban / ekuitas"
                />
                <Stat
                    label="Modal kerja"
                    value={rp(d.totalCurrentAssets - d.totalCurrentLiabilities)}
                />
                <Stat
                    label="Ekuitas / aset"
                    value={pct(
                        d.totalAssets
                            ? (d.totalEquity / d.totalAssets) * 100
                            : 0,
                    )}
                />
            </div>
        </>
    );
}

function CashFlow({ r }: { r: { from: string; to: string } }) {
    const { data: d } = useApi('/reports/cash-flow' + qs(r));

    if (!d) {
        return <Loading rows={10} />;
    }

    const sec = (title: string, rows: any[], total: number) => (
        <>
            <Sec>{title}</Sec>
            {rows.map((x) => (
                <Row key={x.code} label={x.name} v={x.amount} indent />
            ))}
            {!rows.length && (
                <div className="py-1.5 pl-5 text-sm text-muted-foreground">
                    Tidak ada
                </div>
            )}
            <Row
                label={'Arus kas bersih dari ' + title.toLowerCase()}
                v={total}
                kind="sub"
            />
        </>
    );
    const csv = () =>
        downloadCSV(
            'arus_kas.csv',
            [
                ...d.operating.map((x: any) => ({ ...x, cat: 'Operasi' })),
                ...d.investing.map((x: any) => ({ ...x, cat: 'Investasi' })),
                ...d.financing.map((x: any) => ({ ...x, cat: 'Pendanaan' })),
            ],
            [
                { label: 'Aktivitas', key: 'cat' },
                { label: 'Keterangan', key: 'name' },
                { label: 'Jumlah', key: 'amount' },
            ],
        );

    return (
        <div className="grid items-start gap-4 xl:grid-cols-2">
            <Panel
                title="Laporan arus kas (metode langsung)"
                actions={
                    <Button size="sm" variant="outline" onClick={csv}>
                        <Download /> CSV
                    </Button>
                }
            >
                {sec('Aktivitas operasi', d.operating, d.totalOperating)}
                {sec('Aktivitas investasi', d.investing, d.totalInvesting)}
                {sec('Aktivitas pendanaan', d.financing, d.totalFinancing)}
                <Row
                    label="Kenaikan (penurunan) kas bersih"
                    v={d.net}
                    kind="total"
                />
                <Row label="Saldo kas & bank awal periode" v={d.opening} />
                <Row
                    label="Saldo kas & bank akhir periode"
                    v={d.closing}
                    kind="grand"
                />
            </Panel>
            <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-3">
                    <Stat
                        label="Operasi"
                        value={rp(d.totalOperating)}
                        tone={d.totalOperating < 0 ? 'red' : 'green'}
                    />
                    <Stat
                        label="Investasi"
                        value={rp(d.totalInvesting)}
                        tone={d.totalInvesting < 0 ? 'red' : 'green'}
                    />
                    <Stat
                        label="Pendanaan"
                        value={rp(d.totalFinancing)}
                        tone={d.totalFinancing < 0 ? 'red' : 'green'}
                    />
                </div>
                <Panel title="Arus kas per bulan">
                    <div className="h-80">
                        <Bar
                            data={{
                                labels: d.monthly.map(
                                    (m: any) =>
                                        MONTHS[+m.month.slice(5) - 1] +
                                        ' ' +
                                        m.month.slice(2, 4),
                                ),
                                datasets: [
                                    {
                                        label: 'Operasi',
                                        data: d.monthly.map(
                                            (m: any) => m.operating,
                                        ),
                                        backgroundColor: '#16a34a',
                                    },
                                    {
                                        label: 'Investasi',
                                        data: d.monthly.map(
                                            (m: any) => m.investing,
                                        ),
                                        backgroundColor: '#d97706',
                                    },
                                    {
                                        label: 'Pendanaan',
                                        data: d.monthly.map(
                                            (m: any) => m.financing,
                                        ),
                                        backgroundColor: '#2563eb',
                                    },
                                ],
                            }}
                            options={chartOpts(true)}
                        />
                    </div>
                </Panel>
            </div>
        </div>
    );
}
