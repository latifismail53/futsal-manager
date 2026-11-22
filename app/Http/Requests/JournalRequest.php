<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class JournalRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'description' => ['required', 'string', 'max:250'],
            'lines' => ['required', 'array', 'min:2'],
            'lines.*.account_code' => ['required', 'exists:accounts,code'],
            'lines.*.debit' => ['nullable', 'integer', 'min:0'],
            'lines.*.credit' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
