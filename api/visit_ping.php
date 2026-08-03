<?php
require __DIR__ . '/_bootstrap.php';
require_method('POST');

try {
    $vid = visitor_id();
    $stmt = db()->prepare('INSERT INTO visits (visitor_id) VALUES (:vid)');
    $stmt->execute(['vid' => $vid]);
    json_response(['ok' => true]);
} catch (Throwable $e) {
    log_error($e);
    json_error('방문 기록에 실패했습니다.', 500);
}
