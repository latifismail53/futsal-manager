<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $role = $request->user()?->role;
        abort_unless($role === 'owner' || in_array($role, $roles, true), 403, 'Anda tidak memiliki akses ke menu ini.');

        return $next($request);
    }
}
