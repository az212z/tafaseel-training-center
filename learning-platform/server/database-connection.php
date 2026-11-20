<?php
declare(strict_types=1);

final class DatabaseBusyException extends RuntimeException {}

/** Retry connection establishment only; a query or transaction is never replayed. */
function connectDatabase(callable $factory, bool $hostingRateLimit = false): PDO
{
    for ($attempt = 0; ; $attempt++) {
        try {
            $connection = $factory();
            if ($connection->inTransaction()) {
                $connection->rollBack();
            }
            return $connection;
        } catch (PDOException $error) {
            $driver = (int) ($error->errorInfo[1] ?? 0);
            $rateLimited =
                $hostingRateLimit &&
                $driver === 2002 &&
                str_contains(
                    strtolower($error->getMessage()),
                    "operation not permitted",
                );
            $temporary =
                $rateLimited ||
                in_array($driver, [1040, 1203], true) ||
                ($driver === 2002 &&
                    preg_match(
                        "/resource temporarily unavailable|connection refused|try again/i",
                        $error->getMessage(),
                    ));
            if (!$temporary || $attempt >= 3) {
                if ($rateLimited) {
                    throw new DatabaseBusyException(
                        "الخدمة مشغولة مؤقتًا. أعد المحاولة بعد لحظات.",
                        0,
                        $error,
                    );
                }
                throw $error;
            }
            usleep(
                $rateLimited
                    ? random_int(1050000, 1300000)
                    : random_int(20000, 50000) * (1 << $attempt),
            );
        }
    }
}
