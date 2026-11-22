import { Head, Link } from '@inertiajs/react';
import { Plus, ShoppingCart } from 'lucide-react';
import { Badge, DataTable, Empty, Loading, Page, PageHead, Panel, payTone, Stat } from '@/components/futsal/kit';
import { Bar, Line, moneyAxis, moneyTooltip } from '@/components/futsal/charts';
import { Button } from '@/components/ui/button';
import { fmtDate, fmtDateLong, hh, MONTHS, PAY, pct, rp, useApi } from '@/lib/futsal/utils';

export default function Dashboard() {
    const { data: d } = useApi('/dashboard');
    const { data: monthly } = useApi<any[]>('/reports/income-monthly');

    return (
        <Page>
            <Head title="Dashboard" />
            {!d ? (
                <Loading rows={8} />
            ) : (
                <>
                    <PageHead title="Dashboard" desc={fmtDateLong(d.today)}>
                        <Button asChild>
                            <Link href="/jam-kosong" prefetch>
                                <Plus /> Booking lapangan
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/penjualan" prefetch>
                                <ShoppingCart /> Kasir
                            </Link>
                        </Button>
                    </PageHead>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Stat label="Pendapatan bulan ini" value={rp(d.income.totalRevenue + d.income.totalOtherRevenue)} sub={`Sewa lapangan ${rp(d.income.revenue.find((r: any) => r.code === '4-1100')?.amount)}`} />
                        <Stat label="Laba bersih bulan ini" value={rp(d.income.netIncome)} tone={d.income.netIncome < 0 ? 'red' : 'green'} sub={`Margin ${pct(d.income.totalRevenue ? (d.income.netIncome / d.income.totalRevenue) * 100 : 0)}`} />
                        <Stat label="Saldo kas & bank" value={rp(d.cashTotal)} sub={d.cash.map((c: any) => `${c.name} ${rp(c.bal)}`).join(' · ')} />
                        <Stat label="Okupansi hari ini" value={pct(d.occupancyToday)} sub={`Bulan ini ${pct(d.occupancyMonth)}`} />
                        <Stat label="Booking hari ini" value={d.todayBookings.length} sub={`${d.upcoming} booking mendatang`} />
                        <Stat label="Booking belum lunas" value={rp(d.unpaidTotal)} sub={`${d.unpaidCount} booking`} tone={d.unpaidTotal ? 'red' : undefined} />
                        <Stat label="Piutang usaha" value={rp(d.piutang)} />
                        <Stat label="Hutang usaha" value={rp(d.hutang)} />
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                        <Panel title="Pendapatan vs beban 30 hari terakhir">
                            <div className="h-64">
                                <Bar
                                    data={{
                                        labels: d.daily.map((x: any) => fmtDate(x.date).slice(0, 6)),
                                        datasets: [
                                            { label: 'Pendapatan', data: d.daily.map((x: any) => x.revenue), backgroundColor: '#16a34a' },
                                            { label: 'Beban', data: d.daily.map((x: any) => x.expense), backgroundColor: '#f59e0b' },
                                        ],
                                    }}
                                    options={{ scales: { y: moneyAxis, x: { grid: { display: false } } }, plugins: { tooltip: moneyTooltip } } as any}
                                />
                            </div>
                        </Panel>
                        <Panel title="Tren laba rugi tahun ini" actions={<Link className="text-xs text-primary" href="/laporan-keuangan">Detail →</Link>}>
                            <div className="h-64">
                                {monthly && (
                                    <Line
                                        data={{
                                            labels: MONTHS,
                                            datasets: [
                                                { label: 'Pendapatan', data: monthly.map((m) => m.revenue), borderColor: '#16a34a', backgroundColor: '#16a34a' },
                                                { label: 'Beban', data: monthly.map((m) => m.expense), borderColor: '#f59e0b', backgroundColor: '#f59e0b' },
                                                { label: 'Laba bersih', data: monthly.map((m) => m.net), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.08)', fill: true },
                                            ],
                                        }}
                                        options={{ scales: { y: moneyAxis, x: { grid: { display: false } } }, plugins: { tooltip: moneyTooltip } } as any}
                                    />
                                )}
                            </div>
                        </Panel>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-2">
                        <Panel title="Jadwal hari ini" bodyClass="p-0 max-h-96 overflow-y-auto" actions={<Link className="text-xs text-primary" href="/kalender">Kalender →</Link>}>
                            <DataTable>
                                <thead>
                                    <tr><th>Jam</th><th>Lapangan</th><th>Pelanggan</th><th className="r">Total</th><th>Bayar</th></tr>
                                </thead>
                                <tbody>
                                    {d.todayBookings.map((b: any) => (
                                        <tr key={b.id}>
                                            <td className="num">{hh(b.start_hour)}–{hh(b.end_hour)}</td>
                                            <td><span style={{ color: b.field_color }}>●</span> {b.field_name}</td>
                                            <td>{b.customer_name}</td>
                                            <td className="r">{rp(b.total)}</td>
                                            <td><Badge tone={payTone[b.payment_status]}>{PAY[b.payment_status]}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </DataTable>
                            {!d.todayBookings.length && <Empty>Belum ada booking hari ini</Empty>}
                        </Panel>
                        <Panel title="Stok menipis" bodyClass="p-0" actions={<Link className="text-xs text-primary" href="/pembelian">Pembelian →</Link>}>
                            <DataTable>
                                <thead>
                                    <tr><th>Produk</th><th className="r">Stok</th><th className="r">HPP rata-rata</th></tr>
                                </thead>
                                <tbody>
                                    {d.lowStock.map((p: any) => (
                                        <tr key={p.id}>
                                            <td>{p.name}</td>
                                            <td className="r text-red-600">{p.stock} {p.unit}</td>
                                            <td className="r">{rp(p.cost)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </DataTable>
                            {!d.lowStock.length && <Empty>Semua stok aman</Empty>}
                        </Panel>
                    </div>
                </>
            )}
        </Page>
    );
}
