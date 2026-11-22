import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { Badge as UiBadge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const COLORS = [
    '#16a34a',
    '#2563eb',
    '#d97706',
    '#9333ea',
    '#dc2626',
    '#0891b2',
    '#65a30d',
    '#db2777',
];

export function PageHead({
    title,
    desc,
    children,
}: {
    title: string;
    desc?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
                    {title}
                </h1>
                {desc && (
                    <p className="text-sm text-muted-foreground">{desc}</p>
                )}
            </div>
            {children && (
                <div className="flex flex-wrap items-center gap-2">
                    {children}
                </div>
            )}
        </div>
    );
}

export function Page({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6',
                className,
            )}
        >
            {children}
        </div>
    );
}

const toneText: Record<string, string> = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
};

export function useCan(...roles: string[]) {
    const role = usePage().props.auth.user?.role;

    return role === 'owner' || roles.includes(role ?? '');
}

export function Stat({
    label,
    value,
    sub,
    tone,
    onClick,
    compact,
}: {
    label: ReactNode;
    value: ReactNode;
    sub?: ReactNode;
    tone?: string;
    onClick?: () => void;
    compact?: boolean;
}) {
    return (
        <Card
            className={cn(
                'gap-1 py-3',
                onClick && 'cursor-pointer transition hover:border-primary/60',
            )}
            onClick={onClick}
        >
            <CardContent className="px-4">
                <div className="text-xs font-medium text-muted-foreground">
                    {label}
                </div>
                <div
                    className={cn(
                        'num mt-1 truncate font-semibold',
                        compact ? 'text-sm sm:text-base' : 'text-lg sm:text-xl',
                        tone && toneText[tone],
                    )}
                >
                    {value}
                </div>
                {sub && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {sub}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export function Panel({
    title,
    actions,
    children,
    className,
    bodyClass,
}: {
    title?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClass?: string;
}) {
    return (
        <Card className={cn('min-w-0 gap-0 py-0', className)}>
            {(title || actions) && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                    <h2 className="text-sm font-semibold">{title}</h2>
                    {actions && (
                        <div className="flex flex-wrap items-center gap-2">
                            {actions}
                        </div>
                    )}
                </div>
            )}
            <div className={cn('min-w-0 p-4', bodyClass)}>{children}</div>
        </Card>
    );
}

export function Modal({
    title,
    onClose,
    children,
    footer,
    wide,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
}) {
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                className={cn(
                    'max-h-[92dvh] overflow-y-auto',
                    wide ? 'sm:max-w-4xl' : 'sm:max-w-lg',
                )}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="min-w-0 space-y-3">{children}</div>
                {footer && (
                    <DialogFooter className="gap-2">{footer}</DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}

export function Seg({
    tabs,
    value,
    onChange,
    className,
}: {
    tabs: [string, ReactNode][];
    value: string;
    onChange: (k: string) => void;
    className?: string;
}) {
    return (
        <div
            role="tablist"
            className={cn(
                'inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-1 text-sm',
                className,
            )}
        >
            {tabs.map(([k, l]) => (
                <button
                    key={k}
                    role="tab"
                    aria-selected={value === k}
                    onClick={() => onChange(k)}
                    className={cn(
                        'rounded-md px-3 py-1.5 font-medium whitespace-nowrap text-muted-foreground transition',
                        value === k &&
                            'bg-background text-foreground shadow-sm',
                    )}
                >
                    {l}
                </button>
            ))}
        </div>
    );
}

export function Field({
    label,
    children,
    className,
    hint,
}: {
    label: ReactNode;
    children: ReactNode;
    className?: string;
    hint?: ReactNode;
}) {
    return (
        <div className={cn('grid min-w-0 gap-1.5', className)}>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

export const selectCls =
    'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30 [&>option]:bg-background';

export function NativeSelect({
    className,
    ...p
}: React.ComponentProps<'select'>) {
    return <select className={cn(selectCls, className)} {...p} />;
}

const badgeTone: Record<string, string> = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    gray: 'bg-muted text-muted-foreground',
};

export function Badge({
    tone,
    children,
}: {
    tone?: string;
    children: ReactNode;
}) {
    return (
        <UiBadge
            className={cn('border-transparent', badgeTone[tone || 'gray'])}
        >
            {children}
        </UiBadge>
    );
}

export const statusTone: Record<string, string> = {
    booked: 'blue',
    selesai: 'green',
    batal: 'red',
};
export const payTone: Record<string, string> = {
    belum: 'red',
    dp: 'amber',
    lunas: 'green',
};

export function Loading({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-2 p-2">
            {Array.from({ length: rows }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
            ))}
        </div>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return (
        <div className="p-6 text-center text-sm text-muted-foreground">
            {children}
        </div>
    );
}

export function MoneyInput({
    value,
    onChange,
    className,
    ...p
}: {
    value: number | '' | null | undefined;
    onChange: (v: number | '') => void;
} & Omit<React.ComponentProps<'input'>, 'value' | 'onChange'>) {
    return (
        <Input
            inputMode="numeric"
            value={
                value === '' || value == null
                    ? ''
                    : Number(value).toLocaleString('id-ID')
            }
            onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, '');
                onChange(v === '' ? '' : Number(v));
            }}
            className={cn('num text-right', className)}
            {...p}
        />
    );
}

/** Tabel ringkas yang bisa digeser horizontal di layar kecil. */
export function DataTable({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('w-full overflow-x-auto', className)}>
            <table className="w-full min-w-max caption-bottom text-sm [&_.r]:text-right [&_.r]:tabular-nums [&_tbody_tr]:border-b [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/50 [&_tbody_tr:last-child]:border-0 [&_td]:px-3 [&_td]:py-2 [&_tfoot]:border-t [&_tfoot]:bg-muted/40 [&_tfoot]:font-semibold [&_th]:h-9 [&_th]:px-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-muted-foreground [&_thead_tr]:border-b">
                {children}
            </table>
        </div>
    );
}

export function DateRange({
    from,
    to,
    onChange,
    presets = true,
}: {
    from: string;
    to: string;
    onChange: (r: { from: string; to: string }) => void;
    presets?: boolean;
}) {
    const set = (f: string, t: string) => onChange({ from: f, to: t });
    const today = new Date();
    const iso = (d: Date) =>
        new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 10);
    const ms = (o: number) =>
        iso(new Date(today.getFullYear(), today.getMonth() + o, 1));
    const me = (o: number) =>
        iso(new Date(today.getFullYear(), today.getMonth() + o + 1, 0));

    return (
        <div className="flex flex-wrap items-center gap-2">
            {presets && (
                <NativeSelect
                    className="w-auto"
                    value=""
                    aria-label="Periode cepat"
                    onChange={(e) => {
                        const v = e.target.value;
                        const map: Record<string, [string, string]> = {
                            m0: [ms(0), me(0)],
                            m1: [ms(-1), me(-1)],
                            q: [ms(-2), me(0)],
                            y: [
                                iso(new Date(today.getFullYear(), 0, 1)),
                                iso(new Date(today.getFullYear(), 11, 31)),
                            ],
                            '7': [
                                iso(new Date(today.getTime() - 6 * 864e5)),
                                iso(today),
                            ],
                            '30': [
                                iso(new Date(today.getTime() - 29 * 864e5)),
                                iso(today),
                            ],
                        };

                        if (map[v]) {
                            set(...map[v]);
                        }
                    }}
                >
                    <option value="">Periode…</option>
                    <option value="7">7 hari terakhir</option>
                    <option value="30">30 hari terakhir</option>
                    <option value="m0">Bulan ini</option>
                    <option value="m1">Bulan lalu</option>
                    <option value="q">3 bulan terakhir</option>
                    <option value="y">Tahun ini</option>
                </NativeSelect>
            )}
            <Input
                type="date"
                className="w-[9.5rem]"
                value={from}
                onChange={(e) => set(e.target.value, to)}
                aria-label="Dari"
            />
            <span className="text-xs text-muted-foreground">s/d</span>
            <Input
                type="date"
                className="w-[9.5rem]"
                value={to}
                onChange={(e) => set(from, e.target.value)}
                aria-label="Sampai"
            />
        </div>
    );
}
