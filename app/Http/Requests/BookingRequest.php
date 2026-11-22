<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BookingRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'field_id' => ['required', 'integer', 'exists:fields,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'start_hour' => ['required', 'integer', 'between:0,23'],
            'end_hour' => ['required', 'integer', 'between:1,24', 'gt:start_hour'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id', 'required_without:customer_name'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:30'],
            'team' => ['nullable', 'string', 'max:255'],
            'discount' => ['nullable', 'integer', 'min:0'],
            'status' => ['nullable', 'in:booked,selesai,batal'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'payment_amount' => ['nullable', 'integer', 'min:0'],
            'payment_method' => ['nullable', 'in:cash,bank'],
            'payment_date' => ['nullable', 'date_format:Y-m-d'],
            'payment_note' => ['nullable', 'string', 'max:255'],
            'weeks' => ['nullable', 'integer', 'between:1,52'],
            'interval_days' => ['nullable', 'integer', 'between:1,31'],
            'preview' => ['nullable', 'boolean'],
            'skip_conflicts' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return ['end_hour.gt' => 'Jam selesai harus setelah jam mulai', 'customer_id.required_without' => 'Pelanggan wajib diisi'];
    }
}
