<?php
require __DIR__ . '/_bootstrap.php';
require_method('GET');

try {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        json_error('잘못된 요청입니다.', 400);
    }

    $stmt = db()->prepare(
        'SELECT a.*, (SELECT COUNT(*) FROM agent_likes l WHERE l.agent_id = a.id) AS like_count
         FROM agents a WHERE a.id = :id'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Agent를 찾을 수 없습니다.', 404);
    }

    $vid = visitor_id();
    $likedStmt = db()->prepare('SELECT 1 FROM agent_likes WHERE agent_id = :id AND visitor_id = :vid');
    $likedStmt->execute(['id' => $id, 'vid' => $vid]);
    $likedByMe = (bool) $likedStmt->fetchColumn();

    $detail = map_agent_row($row);
    $detail['likedByMe'] = $likedByMe;
    json_response(array_merge(['ok' => true], $detail));
} catch (Throwable $e) {
    log_error($e);
    json_error('Agent 정보를 불러오지 못했습니다.', 500);
}
