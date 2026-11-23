<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Row;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MasterController extends Controller
{
    private const RULES = [
        'fields' => ['name' => 'required|string|max:255', 'type' => 'nullable|string|max:100', 'price_day' => 'required|integer|min:0', 'price_night' => 'required|integer|min:0', 'night_start' => 'required|integer|between:0,24', 'color' => ['nullable', 'regex:/^#[0-9a-fA-F]{3,8}$/'], 'active' => 'boolean'],
        'customers' => ['name' => 'required|string|max:255', 'phone' => 'nullable|string|max:30', 'team' => 'nullable|string|max:255', 'notes' => 'nullable|string|max:2000'],
        'suppliers' => ['name' => 'required|string|max:255', 'phone' => 'nullable|string|max:30', 'address' => 'nullable|string|max:255'],
        'products' => ['name' => 'required|string|max:255', 'category' => 'required|in:fnb,rental,other', 'unit' => 'nullable|string|max:20', 'price' => 'required|integer|min:0', 'cost' => 'nullable|integer|min:0', 'min_stock' => 'nullable|integer|min:0', 'track_stock' => 'boolean', 'active' => 'boolean'],
    ];

    private const REFS = [
        'fields' => [['bookings', 'field_id']], 'customers' => [['bookings', 'customer_id']],
        'suppliers' => [['purchases', 'supplier_id']], 'products' => [['sale_items', 'product_id'], ['purchase_items', 'product_id']],
    ];

    public function index(string $type): JsonResponse
    {
        return response()->json(DB::table($type)->orderBy($type === 'fields' ? 'id' : 'name')->get());
    }

    public function store(Request $request, string $type): JsonResponse
    {
        $data = $request->validate(self::RULES[$type]);
        $id = DB::table($type)->insertGetId($data + ['created_at' => now(), 'updated_at' => now()]);

        return response()->json(Row::find($type, $id), 201);
    }

    public function update(Request $request, string $type, int $id): JsonResponse
    {
        $rules = array_map(fn ($r) => is_string($r) ? str_replace('required|', 'sometimes|required|', $r) : $r, self::RULES[$type]);
        $data = $request->validate($rules);
        $row = Row::find($type, $id);
        if ($type === 'products' && isset($data['cost']) && (int) $data['cost'] !== (int) $row->cost && $row->stock > 0) {
            throw new DomainException('HPP tidak bisa diubah manual selama masih ada stok, karena nilai persediaan di neraca akan selisih. HPP dihitung otomatis dari pembelian.');
        }
        DB::table($type)->where('id', $id)->update($data + ['updated_at' => now()]);

        return response()->json(Row::find($type, $id));
    }

    public function destroy(string $type, int $id): JsonResponse
    {
        foreach (self::REFS[$type] as [$t, $c]) {
            if (DB::table($t)->where($c, $id)->exists()) {
                throw new DomainException('Data sudah dipakai transaksi, tidak bisa dihapus (nonaktifkan saja).');
            }
        }
        DB::table($type)->where('id', $id)->delete();

        return response()->json(['ok' => true]);
    }
}
