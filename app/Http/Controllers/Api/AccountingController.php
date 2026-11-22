<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\JournalRequest;
use App\Services\FinancialReports;
use App\Services\Insights;
use App\Services\Journal;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountingController extends Controller
{
    public function accounts(): JsonResponse
    {
        return response()->json(DB::table('accounts')->orderBy('code')->get());
    }

    public function storeAccount(Request $request): JsonResponse
    {
        $d = $request->validate(['code' => 'required|string|max:10|unique:accounts,code', 'name' => 'required|string|max:255', 'type' => 'required|in:asset,liability,equity,revenue,expense',
            'subtype' => 'required|string|max:30', 'is_cash' => 'boolean']);
        DB::table('accounts')->insert($d);
        Journal::flush();

        return response()->json(DB::table('accounts')->where('code', $d['code'])->first(), 201);
    }

    public function updateAccount(Request $request, string $code): JsonResponse
    {
        DB::table('accounts')->where('code', $code)->update($request->validate(['name' => 'required|string|max:255', 'subtype' => 'required|string|max:30', 'is_cash' => 'boolean']));
        Journal::flush();

        return response()->json(DB::table('accounts')->where('code', $code)->first());
    }

    public function destroyAccount(string $code): JsonResponse
    {
        if (DB::table('journal_lines')->where('account_code', $code)->exists()) {
            throw new DomainException('Akun sudah memiliki transaksi');
        }
        DB::table('budgets')->where('account_code', $code)->delete();
        DB::table('accounts')->where('code', $code)->delete();
        Journal::flush();

        return response()->json(['ok' => true]);
    }

    public function journals(Request $request): JsonResponse
    {
        $js = DB::table('journals')->whereBetween('date', [$request->input('from', '0000-01-01'), $request->input('to', '9999-12-31')])
            ->when($request->input('ref_type'), fn ($q, $v) => $q->where('ref_type', $v))
            ->when($request->input('q'), fn ($q, $v) => $q->where('description', 'like', "%{$v}%"))
            ->orderByDesc('date')->orderByDesc('id')->limit(500)->get();
        $lines = DB::table('journal_lines as l')->join('accounts as a', 'a.code', '=', 'l.account_code')->whereIn('journal_id', $js->pluck('id'))
            ->orderBy('l.id')->select('l.*', 'a.name as account_name')->get()->groupBy('journal_id');

        return response()->json($js->map(fn ($j) => [...(array) $j, 'lines' => $lines[$j->id] ?? []]));
    }

    public function storeJournal(JournalRequest $request): JsonResponse
    {
        $d = $request->validated();
        if (collect($d['lines'])->sum('debit') !== collect($d['lines'])->sum('credit')) {
            throw new DomainException('Jurnal tidak seimbang');
        }
        $id = DB::transaction(fn () => Journal::post($d['date'], 'manual', null, $d['description'], $d['lines']));

        return response()->json(['id' => $id], 201);
    }

    public function destroyJournal(int $id): JsonResponse
    {
        $j = DB::table('journals')->find($id) ?? throw new DomainException('Jurnal tidak ditemukan');
        if ($j->ref_type !== 'manual') {
            throw new DomainException('Jurnal otomatis hanya bisa diubah dari transaksi sumbernya');
        }
        DB::table('journals')->where('id', $id)->delete();
        Journal::flush();

        return response()->json(['ok' => true]);
    }

    public function budgets(Request $request): JsonResponse
    {
        return response()->json(DB::table('budgets')->where('year', $request->integer('year', today()->year))->get());
    }

    public function saveBudgets(Request $request): JsonResponse
    {
        $d = $request->validate(['year' => 'required|integer|between:2000,2100', 'entries' => 'array', 'entries.*.month' => 'required|integer|between:1,12',
            'entries.*.account_code' => 'required|exists:accounts,code', 'entries.*.amount' => 'nullable|numeric']);
        DB::table('budgets')->upsert(array_map(fn ($e) => ['year' => $d['year'], 'month' => $e['month'], 'account_code' => $e['account_code'], 'amount' => (int) round($e['amount'] ?? 0)], $d['entries'] ?? []),
            ['year', 'month', 'account_code'], ['amount']);
        Journal::flush();

        return response()->json(['ok' => true]);
    }

    private function range(Request $r): array
    {
        return [$r->input('from', today()->startOfMonth()->toDateString()), $r->input('to', today()->toDateString())];
    }

    public function report(Request $request, string $type): JsonResponse
    {
        [$from, $to] = $this->range($request);

        return response()->json(match ($type) {
            'trial-balance' => FinancialReports::trialBalance('0000-01-01', $request->input('to', today()->toDateString())),
            'income-statement' => FinancialReports::incomeStatement($from, $to),
            'balance-sheet' => FinancialReports::balanceSheet($request->input('date', today()->toDateString())),
            'cash-flow' => FinancialReports::cashFlow($from, $to),
            'ledger' => FinancialReports::ledger($request->input('account', '1-1100'), $from, $to),
            'budget' => FinancialReports::budget($request->integer('year', today()->year), $request->integer('mFrom', 1), $request->integer('mTo', 12)),
            'income-monthly' => Insights::incomeMonthly($request->integer('year', today()->year)),
            'bookings' => Insights::bookingReport([...$request->only('field_id', 'customer_id', 'status', 'payment_status'), 'from' => $from, 'to' => $to]),
            default => abort(404),
        });
    }
}
