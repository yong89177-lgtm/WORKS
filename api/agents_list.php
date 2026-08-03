<?php
require __DIR__ . '/_bootstrap.php';
require_method('GET');

try {
    $sort = $_GET['sort'] ?? 'default';
    $category = $_GET['category'] ?? 'all';

    $sql = 'SELECT a.*, (SELECT COUNT(*) FROM agent_likes l WHERE l.agent_id = a.id) AS like_count
            FROM agents a';
    $params = [];
    if ($category !== 'all' && in_array($category, CATEGORIES, true)) {
        $sql .= ' WHERE a.category = :category';
        $params['category'] = $category;
    }
    $sql .= $sort === 'popular'
        ? ' ORDER BY like_count DESC, a.created_at DESC'
        : ' ORDER BY a.created_at DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $items = array_map('map_agent_row', $stmt->fetchAll());

    json_response(['ok' => true, 'items' => $items]);
} catch (Throwable $e) {
    log_error($e);
    json_error('Agent 목록을 불러오지 못했습니다.', 500);
}
