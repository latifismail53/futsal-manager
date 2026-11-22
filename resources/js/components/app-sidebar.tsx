import { Link, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    BarChart3,
    BookOpenCheck,
    CalendarDays,
    ClipboardList,
    Clock,
    Database,
    LayoutGrid,
    Package,
    PiggyBank,
    Settings,
    ShoppingCart,
    TrendingUp,
    Truck,
    Users,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';

type Item = [href: string, title: string, icon: LucideIcon, roles: string[]];
const OPS = ['admin', 'kasir'];
const ALL = ['admin', 'kasir', 'akuntan'];

export const NAV: [string, Item[]][] = [
    [
        'Operasional',
        [
            ['/dashboard', 'Dashboard', LayoutGrid, ALL],
            ['/jam-kosong', 'Cek Jam Kosong', Clock, OPS],
            ['/kalender', 'Kalender', CalendarDays, OPS],
            ['/pemesanan', 'Pemesanan', ClipboardList, OPS],
            ['/penjualan', 'Penjualan (Kasir)', ShoppingCart, OPS],
            ['/pembelian', 'Pembelian', Truck, ['admin', 'akuntan']],
            ['/stok', 'Stok & Opname', Package, ['admin']],
            ['/pelanggan', 'Pelanggan', Users, OPS],
            ['/master', 'Master Data', Database, ['admin']],
        ],
    ],
    [
        'Keuangan',
        [
            ['/akuntansi', 'Akuntansi', BookOpenCheck, ['akuntan']],
            ['/laporan-keuangan', 'Laporan Keuangan', TrendingUp, ['akuntan']],
            ['/anggaran', 'Anggaran vs Realisasi', PiggyBank, ['akuntan']],
        ],
    ],
    [
        'Analitik',
        [
            ['/laporan-pemesanan', 'Laporan Pemesanan', BarChart3, ['admin', 'akuntan']],
            ['/pengaturan', 'Pengaturan Usaha', Settings, ['admin']],
        ],
    ],
];

export function AppSidebar() {
    const { auth } = usePage().props;
    const role = (auth.user?.role as string) || '';
    const { isCurrentUrl } = useCurrentUrl();
    const can = (roles: string[]) => role === 'owner' || roles.includes(role);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {NAV.map(([group, items]) => {
                    const visible = items.filter((i) => can(i[3]));

                    return visible.length ? (
                        <SidebarGroup key={group} className="px-2 py-0">
                            <SidebarGroupLabel>{group}</SidebarGroupLabel>
                            <SidebarMenu>
                                {visible.map(([href, title, Icon]) => (
                                    <SidebarMenuItem key={href}>
                                        <SidebarMenuButton asChild isActive={isCurrentUrl(href)} tooltip={{ children: title }}>
                                            <Link href={href} prefetch>
                                                <Icon />
                                                <span>{title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroup>
                    ) : null;
                })}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
