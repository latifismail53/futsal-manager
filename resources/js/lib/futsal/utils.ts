import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export const rp = (n: unknown) =>
    'Rp ' + Math.round(+(n as number) || 0).toLocaleString('id-ID');
export const num = (n: unknown) =>
    Math.round(+(n as number) || 0).toLocaleString('id-ID');
export const rpAcc = (n: number) => (n < 0 ? '(' + num(-n) + ')' : num(n));
export const pct = (n: number | null | undefined, d = 1) =>
    n == null || isNaN(n) ? '-' : (+n).toFixed(d).replace('.', ',') + '%';
export const todayStr = () => {
    const d = new Date();

    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
};
export const addDays = (s: string, n: number) => {
    const d = new Date(s + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);

    return d.toISOString().slice(0, 10);
};
export const monthStart = (s = todayStr()) => s.slice(0, 8) + '01';
export const monthEnd = (s = todayStr()) => {
    const [y, m] = s.split('-').map(Number);

    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
export const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
];
export const MONTHS_FULL = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
];
export const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const DAYS_FULL = [
    'Minggu',
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
];
export const fmtDate = (s?: string | null) => {
    if (!s) {
        return '-';
    }

    const d = new Date(s.slice(0, 10) + 'T00:00:00Z');

    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const fmtDateLong = (s: string) => {
    const d = new Date(s + 'T00:00:00Z');

    return `${DAYS_FULL[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const hh = (h: number) => String(h).padStart(2, '0') + ':00';
export const STATUS: Record<string, string> = {
    booked: 'Dipesan',
    selesai: 'Selesai',
    batal: 'Batal',
};
export const PAY: Record<string, string> = {
    belum: 'Belum bayar',
    dp: 'DP',
    lunas: 'Lunas',
};
export const METHOD: Record<string, string> = {
    cash: 'Tunai',
    bank: 'Transfer/Bank',
    credit: 'Kredit (hutang)',
};

/** Ambil data JSON dengan cache memori singkat agar perpindahan halaman terasa instan. */
const memo = new Map<string, { t: number; d: unknown }>();
export function invalidate(prefix = '') {
    for (const k of memo.keys()) {
        if (k.startsWith(prefix)) {
            memo.delete(k);
        }
    }
}

export function useApi<T = any>(url: string | null, deps: unknown[] = []) {
    const cached = url ? (memo.get(url)?.d as T | undefined) : undefined;
    const [data, setData] = useState<T | null>(cached ?? null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(!cached);
    const seq = useRef(0);
    const load = useCallback(() => {
        if (!url) {
            return;
        }

        const id = ++seq.current;
        setLoading(true);
        api.get<T>(url)
            .then((d) => {
                if (id !== seq.current) {
                    return;
                }

                memo.set(url, { t: Date.now(), d });
                setData(d);
                setError(null);
            })
            .catch((e) => id === seq.current && setError(e.message))
            .finally(() => id === seq.current && setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, ...deps]);
    useEffect(() => {
        if (url && memo.get(url)) {
            setData(memo.get(url)!.d as T);
        }

        load();
    }, [load, url]);

    return { data, error, loading, reload: load, setData };
}

const toText = (v: unknown): string =>
    v == null
        ? ''
        : typeof v === 'object'
          ? JSON.stringify(v)
          : String(v as string | number | boolean | bigint);

export function downloadCSV(
    filename: string,
    rows: any[],
    cols?: { label: string; key?: string; value?: (r: any) => unknown }[],
) {
    cols ??= Object.keys(rows[0] || {}).map((k) => ({ label: k, key: k }));

    const esc = (v: unknown) => {
        let s = toText(v);

        // Cegah formula injection saat CSV dibuka di Excel/Sheets.
        if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) {
            s = "'" + s;
        }

        return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [
        cols!.map((c) => esc(c.label)).join(','),
        ...rows.map((r) =>
            cols!.map((c) => esc(c.value ? c.value(r) : r[c.key!])).join(','),
        ),
    ];
    const blob = new Blob(['\ufeff' + lines.join('\n')], {
        type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

export function waLink(phone: string | null | undefined, text: string) {
    let p = String(phone || '').replace(/\D/g, '');

    if (p.startsWith('0')) {
        p = '62' + p.slice(1);
    }

    return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

const escHtml = (s: unknown) =>
    toText(s).replace(
        /[&<>"]/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
    );

type Receipt = {
    settings?: any;
    title: string;
    meta?: [string, string][];
    items?: { name: string; detail?: string; amount: string }[];
    totals?: (string | number)[][];
    footer?: string;
};
export function printReceipt({
    settings,
    title,
    meta = [],
    items = [],
    totals = [],
    footer,
}: Receipt) {
    settings = settings || {};
    const row = (l: unknown, r: unknown, b?: unknown) =>
        `<tr${b ? ' class="b"' : ''}><td>${escHtml(l)}</td><td class="r">${escHtml(r)}</td></tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>
    body{font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;width:280px;margin:0 auto;padding:10px;color:#000}
    h1{font-size:14px;text-align:center;margin:0}.c{text-align:center}.r{text-align:right}
    table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}
    hr{border:0;border-top:1px dashed #000;margin:6px 0}.b td{font-weight:700}.it{font-size:11px;color:#333}
  </style></head><body>
    <h1>${escHtml(settings.business_name || 'Futsal')}</h1>
    <div class="c">${escHtml(settings.address || '')}${settings.phone ? '<br>Telp ' + escHtml(settings.phone) : ''}</div><hr>
    <div class="c"><b>${escHtml(title)}</b></div>
    <table>${meta.map(([l, r]) => row(l, r)).join('')}</table><hr>
    <table>${items.map((i) => `<tr><td colspan="2">${escHtml(i.name)}</td></tr><tr class="it"><td>${escHtml(i.detail || '')}</td><td class="r">${escHtml(i.amount)}</td></tr>`).join('')}</table><hr>
    <table>${totals.map(([l, r, b]) => row(l, r, b)).join('')}</table><hr>
    <div class="c">${escHtml(footer || settings.receipt_footer || 'Terima kasih')}</div>
    <div class="c it">Dicetak ${new Date().toLocaleString('id-ID')}</div>
  </body></html>`;
    const f = document.createElement('iframe');
    f.style.cssText =
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    f.contentDocument!.open();
    f.contentDocument!.write(html);
    f.contentDocument!.close();
    setTimeout(() => {
        f.contentWindow!.focus();
        f.contentWindow!.print();
        setTimeout(() => f.remove(), 1000);
    }, 250);
}

export const withTeam = (name?: string | null, team?: string | null) =>
    team && !String(name || '').includes(team)
        ? `${name} (${team})`
        : name || '';

export function bookingReceipt(b: any, settings: any) {
    printReceipt({
        settings,
        title: 'NOTA BOOKING LAPANGAN',
        meta: [
            ['No.', b.code],
            ['Tanggal main', fmtDateLong(b.date)],
            ['Jam', `${hh(b.start_hour)} - ${hh(b.end_hour)}`],
            ['Lapangan', b.field_name],
            ['Pelanggan', withTeam(b.customer_name, b.team)],
            ['Status', STATUS[b.status]],
        ],
        items: [
            {
                name: `Sewa ${b.field_name}`,
                detail: `${b.end_hour - b.start_hour} jam`,
                amount: rp(b.subtotal),
            },
        ],
        totals: [
            ['Subtotal', rp(b.subtotal)],
            ...(b.discount ? [['Diskon', '- ' + rp(b.discount)]] : []),
            ['TOTAL', rp(b.total), 1],
            ...(b.payments || []).map((p: any) => [
                `Bayar ${fmtDate(p.date)} (${METHOD[p.method]})`,
                rp(p.amount),
            ]),
            ['Sisa tagihan', rp(b.remaining), 1],
        ],
    });
}

export function bookingWAText(b: any, settings: any) {
    settings = settings || {};
    const lines = [
        `Halo ${b.customer_name}, berikut konfirmasi booking di *${settings.business_name || 'lapangan kami'}*:`,
        '',
        `No. booking: *${b.code}*`,
        `Tanggal: ${fmtDateLong(b.date)}`,
        `Jam: ${hh(b.start_hour)} - ${hh(b.end_hour)} (${b.end_hour - b.start_hour} jam)`,
        `Lapangan: ${b.field_name}`,
        `Total: ${rp(b.total)}`,
        `Sudah dibayar: ${rp(b.paid)}`,
        `Sisa: *${rp(b.remaining)}*`,
    ];

    if (b.remaining > 0 && settings.bank_info) {
        lines.push('', `Pembayaran transfer ke ${settings.bank_info}`);
    }

    lines.push('', 'Mohon datang 10 menit sebelum jadwal. Terima kasih!');

    return lines.join('\n');
}

export function saleReceipt(sale: any, settings: any, cash?: number) {
    const paid = +(cash || 0);
    printReceipt({
        settings,
        title: 'NOTA PENJUALAN',
        meta: [
            ['No.', sale.code],
            ['Tanggal', fmtDate(sale.date)],
            ['Pelanggan', sale.customer_name || 'Umum'],
            ['Metode', METHOD[sale.method] || sale.method],
        ],
        items: (sale.items || []).map((i: any) => ({
            name: i.name,
            detail: `${i.qty} x ${rp(i.price)}`,
            amount: rp(i.qty * i.price),
        })),
        totals: [
            ['TOTAL', rp(sale.total), 1],
            ...(paid > 0
                ? [
                      ['Tunai', rp(paid)],
                      ['Kembali', rp(Math.max(0, paid - sale.total))],
                  ]
                : []),
        ],
    });
}

export function useQueryParams() {
    return new URLSearchParams(
        typeof window !== 'undefined' ? window.location.search : '',
    );
}
