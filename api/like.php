<?php
require __DIR__ . '/_bootstrap.php';
require_method('POST');

try {
    $body = read_json_body();
    $agentId = (int) ($body['agentId'] ?? 0);
    if ($agentId <= 0) {
        json_error('잘못된 요청입니다.', 400);
    }

    $pdo = db();
    $exists = $pdo->prepare('SELECT 1 FROM agents WHERE id = :id');
    $exists->execute(['id' => $agentId]);
    if (!$exists->fetchColumn()) {
        json_error('Agent를 찾을 수 없습니다.', 404);
    }

    $vid = visitor_id();
    $check = $pdo->prepare('SELECT 1 FROM agent_likes WHERE agent_id = :id AND visitor_id = :vid');
    $check->execute(['id' => $agentId, 'vid' => $vid]);

    if ($check->fetchColumn()) {
        $del = $pdo->prepare('DELETE FROM agent_likes WHERE agent_id = :id AND visitor_id = :vid');
        $del->execute(['id' => $agentId, 'vid' => $vid]);
        $liked = false;
    } else {
        $ins = $pdo->prepare('INSERT INTO agent_likes (agent_id, visitor_id) VALUES (:id, :vid)');
        $ins->execute(['id' => $agentId, 'vid' => $vid]);
        $liked = true;
    }

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM agent_likes WHERE agent_id = :id');
    $countStmt->execute(['id' => $agentId]);
    $likeCount = (int) $countStmt->fetchColumn();

    json_response(['ok' => true, 'liked' => $liked, 'likeCount' => $likeCount]);
} catch (Throwable $e) {
    log_error($e);
    json_error('좋아요 처리에 실패했습니다.', 500);
}
