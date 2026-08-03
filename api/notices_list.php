<?php
require __DIR__ . '/_bootstrap.php';
require_method('GET');

try {
    $stmt = db()->query('SELECT id, title, content, author, created_at FROM notices ORDER BY created_at DESC, id DESC');
    $items = array_map(function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'title' => $row['title'],
            'content' => $row['content'],
            'author' => $row['author'],
            'createdAt' => str_replace(' ', 'T', $row['created_at']),
        ];
    }, $stmt->fetchAll());

    json_response(['ok' => true, 'items' => $items]);
} catch (Throwable $e) {
    log_error($e);
    json_error('공지사항을 불러오지 못했습니다.', 500);
}
