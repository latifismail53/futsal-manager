function xsrf(): string {
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);

    return m ? decodeURIComponent(m[1]) : '';
}

async function req<T = any>(
    method: string,
    url: string,
    body?: unknown,
): Promise<T> {
    const r = await fetch('/api' + url, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrf(),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
        const first = data.errors
            ? (Object.values(data.errors)[0] as string[])[0]
            : null;
        throw new Error(
            data.error || first || data.message || 'Terjadi kesalahan',
        );
    }

    return data as T;
}

export const api = {
    get: <T = any>(u: string) => req<T>('GET', u),
    post: <T = any>(u: string, b?: unknown) => req<T>('POST', u, b || {}),
    put: <T = any>(u: string, b?: unknown) => req<T>('PUT', u, b),
    del: <T = any>(u: string) => req<T>('DELETE', u),
};

export const qs = (o: Record<string, unknown>) =>
    '?' +
    new URLSearchParams(
        Object.entries(o)
            .filter(([, v]) => v !== '' && v != null)
            .map(([k, v]) => [k, String(v)]),
    ).toString();
