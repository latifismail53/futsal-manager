<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PurchaseRequest;
use App\Http\Requests\SaleRequest;
use App\Http\Requests\StockAdjustmentRequest;
use App\Services\Inventory;
use App\Support\Row;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TradeController extends Controller
{
    public function sales(Request $request): JsonResponse
    {
        $this->validateDates($request, 'from', 'to');
        $items = DB::table('sale_items')->groupBy('sale_id')->selectRaw("sale_id, GROUP_CONCAT(CONCAT(name, ' x', qty) SEPARATOR ', ') items_text");

        return response()->json(DB::table('sales as s')->leftJoinSub($items, 'i', 'i.sale_id', '=', 's.id')
            ->whereBetween('s.date', [$request->input('from', '0000-01-01'), $request->input('to', '9999-12-31')])
            ->orderByDesc('s.date')->orderByDesc('s.id')->select('s.*', 'i.items_text')->get());
    }

    public function sale(int $id): JsonResponse
    {
        return response()->json([...(array) Row::find('sales', $id, 'Penjualan'), 'items' => DB::table('sale_items')->where('sale_id', $id)->get()]);
    }

    public function storeSale(SaleRequest $request): JsonResponse
    {
        return response()->json(Inventory::createSale($request->validated()), 201);
    }

    public function destroySale(int $id): JsonResponse
    {
        Inventory::deleteSale($id);

        return response()->json(['ok' => true]);
    }

    public function purchases(Request $request): JsonResponse
    {
        $this->validateDates($request, 'from', 'to');
        $items = DB::table('purchase_items')->groupBy('purchase_id')->selectRaw("purchase_id, GROUP_CONCAT(description SEPARATOR ', ') items_text");

        return response()->json(DB::table('purchases as p')->leftJoin('suppliers as s', 's.id', '=', 'p.supplier_id')->leftJoinSub($items, 'i', 'i.purchase_id', '=', 'p.id')
            ->whereBetween('p.date', [$request->input('from', '0000-01-01'), $request->input('to', '9999-12-31')])
            ->orderByDesc('p.date')->orderByDesc('p.id')->select('p.*', 's.name as supplier_name', 'i.items_text')->get());
    }

    public function purchase(int $id): JsonResponse
    {
        $p = DB::table('purchases as p')->leftJoin('suppliers as s', 's.id', '=', 'p.supplier_id')->where('p.id', $id)->select('p.*', 's.name as supplier_name')->first();

        return response()->json([...(array) $p, 'items' => DB::table('purchase_items as i')->leftJoin('accounts as a', 'a.code', '=', 'i.account_code')->where('purchase_id', $id)->select('i.*', 'a.name as account_name')->get()]);
    }

    public function storePurchase(PurchaseRequest $request): JsonResponse
    {
        return response()->json(Inventory::createPurchase($request->validated()), 201);
    }

    public function payPurchase(Request $request, int $id): JsonResponse
    {
        $d = $request->validate(['date' => 'nullable|date_format:Y-m-d', 'method' => 'nullable|in:cash,bank']);
        Inventory::payPurchase($id, $d['date'] ?? null, $d['method'] ?? null);

        return response()->json(['ok' => true]);
    }

    public function destroyPurchase(int $id): JsonResponse
    {
        Inventory::deletePurchase($id);

        return response()->json(['ok' => true]);
    }

    public function adjustments(Request $request): JsonResponse
    {
        $this->validateDates($request, 'from', 'to');

        return response()->json(DB::table('stock_adjustments as a')->join('products as p', 'p.id', '=', 'a.product_id')
            ->whereBetween('a.date', [$request->input('from', today()->startOfMonth()->toDateString()), $request->input('to', today()->toDateString())])
            ->orderByDesc('a.date')->orderByDesc('a.id')->select('a.*', 'p.name', 'p.unit')->get());
    }

    public function storeAdjustment(StockAdjustmentRequest $request): JsonResponse
    {
        $d = $request->validated();

        return response()->json(['adjusted' => Inventory::adjust($d['date'] ?? today()->toDateString(), $d['items'], $d['note'] ?? null)]);
    }

    public function destroyAdjustment(int $id): JsonResponse
    {
        Inventory::deleteAdjustment($id);

        return response()->json(['ok' => true]);
    }

    public function movements(int $id): JsonResponse
    {
        return response()->json(Inventory::movements($id));
    }
}
