<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PurchaseRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'date' => ['nullable', 'date_format:Y-m-d'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'method' => ['required', 'in:cash,bank,credit'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.account_code' => ['nullable', 'required_without:items.*.product_id', 'exists:accounts,code'],
            'items.*.description' => ['nullable', 'string', 'max:255'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.price' => ['required', 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return ['items.required' => 'Item pembelian kosong', 'items.*.account_code.required_without' => 'Setiap item harus memilih produk atau akun beban/aset'];
    }
}
