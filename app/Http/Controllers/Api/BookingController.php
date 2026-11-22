<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\BookingRequest;
use App\Services\Bookings;
use App\Services\Journal;
use App\Services\Pricing;
use App\Support\Row;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(Bookings::list($request->only('from', 'to', 'field_id', 'customer_id', 'status', 'q', 'payment_status'), (int) $request->input('limit', 1000)));
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(Bookings::find($id));
    }

    public function quote(Request $request): JsonResponse
    {
        $f = Row::maybe('fields', $request->integer('field_id'));

        return response()->json(['subtotal' => $f ? Pricing::forHours($f, $request->integer('start'), $request->integer('end')) : 0]);
    }

    public function store(BookingRequest $request): JsonResponse
    {
        return response()->json(Bookings::create($request->validated()), 201);
    }

    public function update(BookingRequest $request, int $id): JsonResponse
    {
        return response()->json(Bookings::update($id, $request->validated()));
    }

    public function status(Request $request, int $id): JsonResponse
    {
        Bookings::setStatus($id, $request->validate(['status' => 'required|in:booked,selesai,batal'])['status']);

        return response()->json(['ok' => true]);
    }

    public function completePast(): JsonResponse
    {
        $ids = DB::table('bookings')->where('status', 'booked')->where('date', '<', today()->toDateString())->pluck('id');
        DB::transaction(function () use ($ids) {
            DB::table('bookings')->whereIn('id', $ids)->update(['status' => 'selesai']);
            $ids->each(fn ($id) => Journal::syncBooking($id));
        });

        return response()->json(['updated' => $ids->count()]);
    }

    public function destroy(int $id): JsonResponse
    {
        DB::transaction(function () use ($id) {
            Journal::remove('booking', $id);
            DB::table('bookings')->where('id', $id)->delete();
        });

        return response()->json(['ok' => true]);
    }

    public function addPayment(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['amount' => 'required|integer|min:1', 'method' => 'nullable|in:cash,bank', 'date' => 'nullable|date_format:Y-m-d', 'note' => 'nullable|string|max:255'], ['amount.min' => 'Nominal harus > 0']);
        DB::transaction(function () use ($id, $data) {
            Bookings::insertPayment($id, $data);
            Journal::syncBooking($id);
        });

        return response()->json(['ok' => true]);
    }

    public function deletePayment(int $pid): JsonResponse
    {
        $p = Row::find('booking_payments', $pid, 'Pembayaran');
        DB::transaction(function () use ($p) {
            DB::table('booking_payments')->where('id', $p->id)->delete();
            Journal::syncBooking($p->booking_id);
        });

        return response()->json(['ok' => true]);
    }

    public function availability(Request $request): JsonResponse
    {
        return response()->json(Bookings::availability($request->input('date', today()->toDateString()), $request->integer('field_id') ?: null, $request->integer('exclude')));
    }

    public function availabilityDays(Request $request): JsonResponse
    {
        return response()->json(Bookings::availabilityDays($request->input('from', today()->toDateString()), $request->integer('days', 14), $request->integer('field_id') ?: null));
    }

    public function recurring(BookingRequest $request): JsonResponse
    {
        return response()->json(Bookings::recurring($request->validated()));
    }

    public function cancelSeries(Request $request, string $series): JsonResponse
    {
        $ids = DB::table('bookings')->where('series', $series)->where('status', 'booked')->where('date', '>=', $request->input('from', today()->toDateString()))->pluck('id');
        DB::transaction(function () use ($ids) {
            DB::table('bookings')->whereIn('id', $ids)->update(['status' => 'batal']);
            $ids->each(fn ($id) => Journal::syncBooking($id));
        });

        return response()->json(['cancelled' => $ids->count()]);
    }
}
