import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Field, Loading, Page, PageHead, Panel } from '@/components/futsal/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/futsal/api';
import { invalidate, useApi } from '@/lib/futsal/utils';

export default function BusinessSettings() {
    const { data } = useApi('/settings');
    const [f, setF] = useState<any>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (data) {
            setF(data);
        }
    }, [data]);
    const inp = (k: string, props: React.ComponentProps<'input'> = {}) => <Input value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />;
    const save = async () => {
        setBusy(true);

        try {
            await api.put('/settings', f);
            invalidate('/');
            toast.success('Pengaturan tersimpan');
            router.reload();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };
    const reset = async () => {
        if (!confirm('Hapus SEMUA data dan isi ulang dengan data demo?')) {
            return;
        }

        setBusy(true);

        try {
            await api.post('/reset-demo');
            invalidate('/');
            toast.success('Data demo dibuat ulang');
            router.visit('/dashboard');
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Page>
            <Head title="Pengaturan Usaha" />
            <PageHead title="Pengaturan usaha" desc="Identitas usaha, jam operasional, dan informasi pada nota/WhatsApp." />
            {!f ? (
                <Loading />
            ) : (
                <div className="grid max-w-3xl gap-4">
                    <Panel title="Profil usaha">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Nama usaha" className="sm:col-span-2">{inp('business_name')}</Field>
                            <Field label="Alamat" className="sm:col-span-2">{inp('address')}</Field>
                            <Field label="No. telepon / WhatsApp">{inp('phone')}</Field>
                            <Field label="Rekening pembayaran">{inp('bank_info', { placeholder: 'BCA 123... a.n. ...' })}</Field>
                            <Field label="Catatan kaki nota" className="sm:col-span-2">{inp('receipt_footer')}</Field>
                            <Field label="Jam buka">{inp('open_hour', { type: 'number', min: 0, max: 23 })}</Field>
                            <Field label="Jam tutup">{inp('close_hour', { type: 'number', min: 1, max: 24 })}</Field>
                        </div>
                        <Button className="mt-4" onClick={save} disabled={busy}>Simpan</Button>
                    </Panel>
                    <Panel title="Data demo">
                        <p className="mb-3 text-sm text-muted-foreground">Aplikasi diisi data contoh 3 bulan terakhir. Reset untuk membuat ulang data demo (semua data saat ini akan terhapus).</p>
                        <Button variant="destructive" onClick={reset} disabled={busy}>Reset ke data demo</Button>
                    </Panel>
                </div>
            )}
        </Page>
    );
}
