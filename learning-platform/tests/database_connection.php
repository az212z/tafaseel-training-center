<?php
declare(strict_types=1);
require dirname(__DIR__) . '/server/database-connection.php';
class ConnectionDouble extends PDO { public bool $dirty=false;public int $rollbacks=0;public function __construct() {} public function inTransaction():bool{return $this->dirty;}public function rollBack():bool{$this->dirty=false;$this->rollbacks++;return true;} }
function connectionError(int $driver, string $message): PDOException {
    $e = new PDOException($message); $e->errorInfo=['HY000',$driver,$message]; return $e;
}
$count=0;$connection=new ConnectionDouble();
$result=connectDatabase(function() use (&$count,$connection) {
    if (++$count<3) throw connectionError(2002,'Resource temporarily unavailable');
    return $connection;
});
if($result!==$connection || $count!==3) throw new RuntimeException('Temporary connection recovery failed');
echo "PASS A temporary socket refusal recovers without executing or replaying a query\n";
$count=0;$error=connectionError(2002,'Connection refused');$start=microtime(true);
try { connectDatabase(function() use (&$count,$error) { $count++;throw $error; }); throw new RuntimeException('Failure was swallowed'); }
catch(PDOException $e) { if($e!==$error || $count!==4 || microtime(true)-$start>2) throw new RuntimeException('Retry budget or original failure lost'); }
echo "PASS Persistent refusal has four bounded attempts and preserves its original failure\n";
foreach([[1045,'Access denied'],[2002,'No such file or directory']] as [$driver,$message]) {
    $count=0;$error=connectionError($driver,$message);
    try { connectDatabase(function() use (&$count,$error) { $count++;throw $error; }); throw new RuntimeException('Failure was swallowed'); }
    catch(PDOException $e) { if($e!==$error || $count!==1) throw new RuntimeException('Permanent failure was retried'); }
}
echo "PASS Authentication and missing-socket configuration failures are not retried\n";
$connection->dirty=true;
connectDatabase(fn()=>$connection);
if($connection->dirty || $connection->rollbacks!==1) throw new RuntimeException('A reused transaction survived connection initialization');
echo "PASS A reused connection rolls back a leftover transaction before serving another request\n";
$count=0;$start=microtime(true);
connectDatabase(function()use(&$count,$connection){if(++$count===1)throw connectionError(2002,'Operation not permitted');return $connection;},true);
if($count!==2 || microtime(true)-$start<1)throw new RuntimeException('Hosting connection-rate retry did not cross the one-second window');
echo "PASS Hosting connection-rate refusal waits for the next provider window before retrying\n";
