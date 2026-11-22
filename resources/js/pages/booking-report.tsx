import { Head } from '@inertiajs/react';
import { Download, Printer, X } from 'lucide-react';
import { useState } from 'react';
import {
    Bar,
    Doughnut,
    Line,
    moneyAxis,
    moneyTooltip,
} from '@/components/futsal/charts';
import {
    Badge,
    COLORS,
    DataTable,
    DateRange,
    Empty,
    Loading,
    NativeSelect,
    Page,
    PageHead,
    Panel,
    payTone,
    Seg,
    Stat,
    statusTone,
} from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { qs } from '@/lib/futsal/api';
import {
    addDays,
    DAYS,
    DAYS_FULL,
    downloadCSV,
    fmtDate,
    hh,
    num,
    PAY,
    pct,
    rp,
    STATUS,
    todayStr,
    useApi,
} from '@/lib/futsal/utils';

type Drill = { label: string; fn: (r: any) => boolean } | null;
const wday = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay();

export default function BookingReport() {
    const [f, setF] = useState({
        from: addDays(todayStr(), -29),
        to: todayStr(),
        field_id: '',
        status: '',
        payment_status: '',
        customer_id: '',
    });
    const [metric, setMetric] = useState('revenue');
    const [drill, setDrill] = useState<Drill>(null);
    const { data: fields } = useApi<any[]>('/fields');
    const { data: customers } = useApi<any[]>('/customers');
    const { data: d } = useApi('/reports/bookings' + qs(f));
    const set = (k: string) => (e: any) =>
        setF((p) => ({ ...p, [k]: e.target.value }));
    const mLabel = (
        {
            revenue: 'Pendapatan',
            count: 'Jumlah booking',
            hours: 'Jam terpakai',
        } as Record<string, string>
    )[metric];
    const fmtM = (v: number) => (metric === 'revenue' ? rp(v) : num(v));
    const rows: any[] = d?.rows.filter((r: any) => !drill || drill.fn(r)) || [];
    const maxHeat = d ? Math.max(1, ...d.heat.flat()) : 1;
    const isRp = metric === 'revenue';
    const yAxis = isRp ? moneyAxis : { beginAtZero: true };
    const tip = isRp ? moneyTooltip : {};
    const click = (fn: (i: number) => void) => (_: unknown, el: any[]) =>
        el[0] && fn(el[0].index);

    return (
        <Page>
            <Head title="Laporan Pemesanan" />
            <PageHead
                title="Laporan pemesanan interaktif"
                desc="Klik grafik (tanggal, lapangan, hari, jam, pelanggan) untuk memfilter tabel detail."
            >
                <Button variant="outline" onClick={() => window.print()}>
                    <Printer /> Cetak
                </Button>
                <Button
                    variant="outline"
                    disabled={!rows.length}
                    onClick={() =>
                        downloadCSV(
                            `laporan_pemesanan_${f.from}_${f.to}.csv`,
                            rows,
                            [
                                { label: 'Kode', key: 'code' },
                                { label: 'Tanggal', key: 'date' },
                                {
                                    label: 'Jam',
                                    value: (r) =>
                                        `${hh(r.start_hour)}-${hh(r.end_hour)}`,
                                },
                                { label: 'Durasi', key: 'hours' },
                                { label: 'Lapangan', key: 'field_name' },
                                { label: 'Pelanggan', key: 'customer_name' },
                                { label: 'Total', key: 'total' },
                                { label: 'Diskon', key: 'discount' },
                                { label: 'Dibayar', key: 'paid' },
                                { label: 'Sisa', key: 'remaining' },
                                {
                                    label: 'Status',
                                    value: (r) => STATUS[r.status],
                                },
                                {
                                    label: 'Pembayaran',
                                    value: (r) => PAY[r.payment_status],
                                },
                            ],
                        )
                    }
                >
                    <Download /> Ekspor CSV
                </Button>
            </PageHead>
            <Panel>
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                    <DateRange
                        from={f.from}
                        to={f.to}
                        onChange={(r) => setF((p) => ({ ...p, ...r }))}
                    />
                    <NativeSelect
                        className="w-auto"
                        value={f.field_id}
                        onChange={set('field_id')}
                        aria-label="Lapangan"
                    >
                        <option value="">Semua lapangan</option>
                        {fields?.map((x) => (
                            <option key={x.id} value={x.id}>
                                {x.name}
                            </option>
                        ))}
                    </NativeSelect>
                    <NativeSelect
                        className="w-auto"
                        value={f.status}
                        onChange={set('status')}
                        aria-label="Status"
                    >
                        <option value="">Semua status</option>
                        {Object.entries(STATUS).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </NativeSelect>
                    <NativeSelect
                        className="w-auto"
                        value={f.payment_status}
                        onChange={set('payment_status')}
                        aria-label="Pembayaran"
                    >
                        <option value="">Semua pembayaran</option>
                        {Object.entries(PAY).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v}
                            </option>
                        ))}
                    </NativeSelect>
                    <NativeSelect
                        className="w-auto max-w-56"
                        value={f.customer_id}
                        onChange={set('customer_id')}
                        aria-label="Pelanggan"
                    >
                        <option value="">Semua pelanggan</option>
                        {customers?.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </NativeSelect>
                    <div className="flex items-center gap-2 sm:ml-auto">
                        <span className="text-xs text-muted-foreground">
                            Metrik
                        </span>
                        <Seg
                            tabs={[
                                ['revenue', 'Rp'],
                                ['count', 'Booking'],
                                ['hours', 'Jam'],
                            ]}
                            value={metric}
                            onChange={setMetric}
                        />
                    </div>
                </div>
            </Panel>
            {!d ? (
                <Loading rows={10} />
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <Stat
                            label="Booking aktif"
                            value={num(d.summary.bookings)}
                            sub={`${d.summary.cancelled} batal (${pct(d.summary.cancelRate)})`}
                        />
                        <Stat
                            label="Jam terpakai"
                            value={num(d.summary.hours) + ' jam'}
                            sub={`Okupansi ${pct(d.summary.occupancy)}`}
                        />
                        <Stat
                            label="Nilai booking"
                            value={rp(d.summary.revenue)}
                            sub={`Rata-rata ${rp(d.summary.avg)}`}
                        />
                        <Stat
                            label="Sudah dibayar"
                            value={rp(d.summary.paid)}
                            tone="green"
                        />
                        <Stat
                            label="Belum dibayar"
                            value={rp(d.summary.outstanding)}
                            tone={d.summary.outstanding ? 'red' : undefined}
                        />
                        <Stat
                            label="Pelanggan unik"
                            value={num(d.summary.customers)}
                            sub={`Diskon ${rp(d.summary.discount)}`}
                        />
                    </div>
                    <Panel
                        title={`${mLabel} harian`}
                        actions={
                            <span className="text-xs text-muted-foreground">
                                Klik titik untuk melihat booking di tanggal
                                tersebut
                            </span>
                        }
                    >
                        <div className="h-64">
                            <Line
                                data={{
                                    labels: d.byDate.map((x: any) =>
                                        fmtDate(x.date).slice(0, 6),
                                    ),
                                    datasets: [
                                        {
                                            label: mLabel,
                                            data: d.byDate.map(
                                                (x: any) => x[metric],
                                            ),
                                            borderColor: '#16a34a',
                                            backgroundColor:
                                                'rgba(22,163,74,.1)',
                                            fill: true,
                                            tension: 0.25,
                                            pointRadius: 3,
                                        },
                                    ],
                                }}
                                options={
                                    {
                                        plugins: {
                                            legend: { display: false },
                                            tooltip: tip,
                                        },
                                        scales: {
                                            y: yAxis,
                                            x: { grid: { display: false } },
                                        },
                                        onClick: click((i) => {
                                            const dt = d.byDate[i].date;
                                            setDrill({
                                                label: 'Tanggal ' + fmtDate(dt),
                                                fn: (r) => r.date === dt,
                                            });
                                        }),
                                    } as any
                                }
                            />
                        </div>
                    </Panel>
                    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        <Panel title="Per lapangan">
                            <div className="h-52">
                                <Doughnut
                                    data={{
                                        labels: d.byField.map(
                                            (x: any) => x.name,
                                        ),
                                        datasets: [
                                            {
                                                data: d.byField.map(
                                                    (x: any) => x[metric],
                                                ),
                                                backgroundColor: d.byField.map(
                                                    (x: any) => x.color,
                                                ),
                                            },
                                        ],
                                    }}
                                    options={
                                        {
                                            plugins: {
                                                legend: { position: 'bottom' },
                                                tooltip: {
                                                    callbacks: {
                                                        label: (c: any) =>
                                                            `${c.label}: ${fmtM(c.parsed)}`,
                                                    },
                                                },
                                            },
                                            onClick: click((i) => {
                                                const x = d.byField[i];
                                                setDrill({
                                                    label: x.name,
                                                    fn: (r) =>
                                                        r.field_id ===
                                                        x.field_id,
                                                });
                                            }),
                                        } as any
                                    }
                                />
                            </div>
                            <DataTable className="mt-3">
                                <thead>
                                    <tr>
                                        <th>Lapangan</th>
                                        <th className="r">Jam</th>
                                        <th className="r">Okupansi</th>
                                        <th className="r">Pendapatan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {d.byField.map((x: any) => (
                                        <tr
                                            key={x.field_id}
                                            className="cursor-pointer"
                                            onClick={() =>
                                                setDrill({
                                                    label: x.name,
                                                    fn: (r) =>
                                                        r.field_id ===
                                                        x.field_id,
                                                })
                                            }
                                        >
                                            <td>
                                                <span
                                                    style={{ color: x.color }}
                                                >
                                                    ●
                                                </span>{' '}
                                                {x.name}
                                            </td>
                                            <td className="r">{x.hours}</td>
                                            <td className="r">
                                                {pct(x.occupancy)}
                                            </td>
                                            <td className="r">
                                                {rp(x.revenue)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </DataTable>
                        </Panel>
                        <Panel title="Per hari dalam minggu">
                            <div className="h-72">
                                <Bar
                                    data={{
                                        labels: DAYS_FULL,
                                        datasets: [
                                            {
                                                label: mLabel,
                                                data: d.byWeekday.map(
                                                    (x: any) => x[metric],
                                                ),
                                                backgroundColor:
                                                    d.byWeekday.map((x: any) =>
                                                        x.weekday === 0 ||
                                                        x.weekday === 6
                                                            ? '#2563eb'
                                                            : '#16a34a',
                                                    ),
                                            },
                                        ],
                                    }}
                                    options={
                                        {
                                            plugins: {
                                                legend: { display: false },
                                                tooltip: tip,
                                            },
                                            scales: {
                                                y: yAxis,
                                                x: { grid: { display: false } },
                                            },
                                            onClick: click((wd) =>
                                                setDrill({
                                                    label:
                                                        'Hari ' + DAYS_FULL[wd],
                                                    fn: (r) =>
                                                        wday(r.date) === wd,
                                                }),
                                            ),
                                        } as any
                                    }
                                />
                            </div>
                        </Panel>
                        <Panel title="Status & pembayaran">
                            <div className="h-52">
                                <Doughnut
                                    data={{
                                        labels: d.byStatus.map(
                                            (x: any) => STATUS[x.status],
                                        ),
                                        datasets: [
                                            {
                                                data: d.byStatus.map(
                                                    (x: any) => x.count,
                                                ),
                                                backgroundColor: d.byStatus.map(
                                                    (x: any) =>
                                                        (
                                                            {
                                                                booked: '#2563eb',
                                                                selesai:
                                                                    '#16a34a',
                                                                batal: '#c2410c',
                                                            } as Record<
                                                                string,
                                                                string
                                                            >
                                                        )[x.status],
                                                ),
                                            },
                                        ],
                                    }}
                                    options={
                                        {
                                            plugins: {
                                                legend: { position: 'bottom' },
                                            },
                                            onClick: click((i) => {
                                                const s = d.byStatus[i].status;
                                                setDrill({
                                                    label:
                                                        'Status ' + STATUS[s],
                                                    fn: (r) => r.status === s,
                                                });
                                            }),
                                        } as any
                                    }
                                />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {Object.entries(PAY).map(([k, v]) => (
                                    <Button
                                        key={k}
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            setDrill({
                                                label: 'Pembayaran ' + v,
                                                fn: (r) =>
                                                    r.status !== 'batal' &&
                                                    r.payment_status === k,
                                            })
                                        }
                                    >
                                        <Badge tone={payTone[k]}>{v}</Badge>{' '}
                                        {
                                            d.rows.filter(
                                                (r: any) =>
                                                    r.status !== 'batal' &&
                                                    r.payment_status === k,
                                            ).length
                                        }
                                    </Button>
                                ))}
                            </div>
                        </Panel>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                        <Panel
                            title="Peta okupansi (hari × jam)"
                            actions={
                                <span className="text-xs text-muted-foreground">
                                    Jumlah jam terpakai; klik sel
                                </span>
                            }
                        >
                            <div className="overflow-x-auto">
                                <div
                                    className="grid min-w-[32rem] gap-0.5 text-[10px]"
                                    style={{
                                        gridTemplateColumns: `2.5rem repeat(${d.close - d.open}, minmax(1.4rem, 1fr))`,
                                    }}
                                >
                                    <div />
                                    {Array.from(
                                        { length: d.close - d.open },
                                        (_, i) => (
                                            <div
                                                key={i}
                                                className="text-center text-muted-foreground"
                                            >
                                                {d.open + i}
                                            </div>
                                        ),
                                    )}
                                    {[1, 2, 3, 4, 5, 6, 0].map((wd) => [
                                        <div
                                            key={'l' + wd}
                                            className="flex items-center text-xs font-medium"
                                        >
                                            {DAYS[wd]}
                                        </div>,
                                        ...Array.from(
                                            { length: d.close - d.open },
                                            (_, i) => {
                                                const h = d.open + i;
                                                const v = d.heat[wd][h];
                                                const a = v / maxHeat;

                                                return (
                                                    <button
                                                        key={wd + '-' + h}
                                                        title={`${DAYS_FULL[wd]} ${hh(h)}: ${v} jam`}
                                                        className="flex h-7 items-center justify-center rounded-sm transition hover:ring-2 hover:ring-primary"
                                                        style={{
                                                            background: `rgba(22,163,74,${0.06 + a * 0.9})`,
                                                            color:
                                                                a > 0.5
                                                                    ? '#fff'
                                                                    : undefined,
                                                        }}
                                                        onClick={() =>
                                                            setDrill({
                                                                label: `${DAYS_FULL[wd]} ${hh(h)}`,
                                                                fn: (r) =>
                                                                    wday(
                                                                        r.date,
                                                                    ) === wd &&
                                                                    r.start_hour <=
                                                                        h &&
                                                                    r.end_hour >
                                                                        h,
                                                            })
                                                        }
                                                    >
                                                        {v || ''}
                                                    </button>
                                                );
                                            },
                                        ),
                                    ])}
                                </div>
                            </div>
                        </Panel>
                        <Panel title="Pemakaian per jam operasional">
                            <div className="h-64">
                                <Bar
                                    data={{
                                        labels: d.byHour.map((x: any) =>
                                            hh(x.hour),
                                        ),
                                        datasets: [
                                            {
                                                label: isRp
                                                    ? 'Pendapatan'
                                                    : 'Jam terpakai',
                                                data: d.byHour.map((x: any) =>
                                                    isRp ? x.revenue : x.hours,
                                                ),
                                                backgroundColor: d.byHour.map(
                                                    (x: any) =>
                                                        x.hour >= 17
                                                            ? '#2563eb'
                                                            : '#16a34a',
                                                ),
                                            },
                                        ],
                                    }}
                                    options={
                                        {
                                            plugins: {
                                                legend: { display: false },
                                                tooltip: tip,
                                            },
                                            scales: {
                                                y: yAxis,
                                                x: { grid: { display: false } },
                                            },
                                            onClick: click((i) => {
                                                const h = d.byHour[i].hour;
                                                setDrill({
                                                    label: 'Jam ' + hh(h),
                                                    fn: (r) =>
                                                        r.start_hour <= h &&
                                                        r.end_hour > h,
                                                });
                                            }),
                                        } as any
                                    }
                                />
                            </div>
                        </Panel>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                        <Panel title="Pelanggan teratas">
                            <div className="h-72">
                                <Bar
                                    data={{
                                        labels: d.byCustomer
                                            .slice(0, 10)
                                            .map((x: any) => x.team || x.name),
                                        datasets: [
                                            {
                                                label: mLabel,
                                                data: d.byCustomer
                                                    .slice(0, 10)
                                                    .map((x: any) => x[metric]),
                                                backgroundColor: COLORS[1],
                                            },
                                        ],
                                    }}
                                    options={
                                        {
                                            indexAxis: 'y',
                                            plugins: {
                                                legend: { display: false },
                                                tooltip: {
                                                    callbacks: {
                                                        label: (c: any) =>
                                                            fmtM(c.parsed.x),
                                                    },
                                                },
                                            },
                                            scales: { x: yAxis },
                                            onClick: click((i) => {
                                                const x = d.byCustomer[i];
                                                setDrill({
                                                    label: x.name,
                                                    fn: (r) =>
                                                        r.customer_id ===
                                                        x.customer_id,
                                                });
                                            }),
                                        } as any
                                    }
                                />
                            </div>
                        </Panel>
                        <Panel
                            title="Rekap pelanggan"
                            bodyClass="p-0 max-h-80 overflow-y-auto"
                        >
                            <DataTable>
                                <thead className="sticky top-0 bg-card">
                                    <tr>
                                        <th>Pelanggan</th>
                                        <th className="r">Booking</th>
                                        <th className="r">Jam</th>
                                        <th className="r">Nilai</th>
                                        <th className="r">Sisa tagihan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {d.byCustomer.map((x: any) => (
                                        <tr
                                            key={x.customer_id}
                                            className="cursor-pointer"
                                            onClick={() =>
                                                setDrill({
                                                    label: x.name,
                                                    fn: (r) =>
                                                        r.customer_id ===
                                                        x.customer_id,
                                                })
                                            }
                                        >
                                            <td>{x.name}</td>
                                            <td className="r">{x.count}</td>
                                            <td className="r">{x.hours}</td>
                                            <td className="r">
                                                {rp(x.revenue)}
                                            </td>
                                            <td
                                                className={
                                                    'r' +
                                                    (x.outstanding
                                                        ? ' text-red-600'
                                                        : '')
                                                }
                                            >
                                                {rp(x.outstanding)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </DataTable>
                        </Panel>
                    </div>
                    <Panel
                        title={
                            <span className="flex flex-wrap items-center gap-2">
                                Detail booking{' '}
                                {drill && (
                                    <Badge tone="blue">{drill.label}</Badge>
                                )}
                            </span>
                        }
                        actions={
                            <>
                                <span className="text-xs text-muted-foreground">
                                    {rows.length} baris ·{' '}
                                    {rp(
                                        rows
                                            .filter((r) => r.status !== 'batal')
                                            .reduce((s, r) => s + r.total, 0),
                                    )}
                                </span>
                                {drill && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setDrill(null)}
                                    >
                                        <X /> Hapus filter grafik
                                    </Button>
                                )}
                            </>
                        }
                        bodyClass="p-0 max-h-[30rem] overflow-y-auto"
                    >
                        <DataTable>
                            <thead className="sticky top-0 bg-card">
                                <tr>
                                    <th>Kode</th>
                                    <th>Tanggal</th>
                                    <th>Jam</th>
                                    <th>Lapangan</th>
                                    <th>Pelanggan</th>
                                    <th className="r">Total</th>
                                    <th className="r">Dibayar</th>
                                    <th className="r">Sisa</th>
                                    <th>Status</th>
                                    <th>Bayar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((b) => (
                                    <tr key={b.id}>
                                        <td className="font-mono text-xs">
                                            {b.code}
                                        </td>
                                        <td>{fmtDate(b.date)}</td>
                                        <td className="num">
                                            {hh(b.start_hour)}–{hh(b.end_hour)}
                                        </td>
                                        <td>
                                            <span
                                                style={{ color: b.field_color }}
                                            >
                                                ●
                                            </span>{' '}
                                            {b.field_name}
                                        </td>
                                        <td>{b.customer_name}</td>
                                        <td className="r">{rp(b.total)}</td>
                                        <td className="r">{rp(b.paid)}</td>
                                        <td
                                            className={
                                                'r' +
                                                (b.remaining &&
                                                b.status !== 'batal'
                                                    ? ' text-red-600'
                                                    : '')
                                            }
                                        >
                                            {rp(b.remaining)}
                                        </td>
                                        <td>
                                            <Badge tone={statusTone[b.status]}>
                                                {STATUS[b.status]}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Badge
                                                tone={payTone[b.payment_status]}
                                            >
                                                {PAY[b.payment_status]}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </DataTable>
                        {!rows.length && <Empty>Tidak ada data</Empty>}
                    </Panel>
                </>
            )}
        </Page>
    );
}
