<?php

return [
    'allow_reset' => (bool) env('FUTSAL_ALLOW_RESET', env('APP_ENV', 'production') !== 'production'),
];
