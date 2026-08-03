<?php
require __DIR__ . '/_bootstrap.php';
require_method('GET');

try {
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $pageSize = min(50, max(1, (int) ($_GET['pageSize'] ?? 10)));
    $offset = ($page - 1) * $pageSize;

    $total = (int) db()->query('SELECT COUNT(*) FROM posts')->fetchColumn();
    $totalPages = max(1, (int) ceil($total / $pageSize));

    $stmt = db()->prepare(
        'SELECT id, title, content, author, created_at FROM posts ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset'
    );
    $stmt->bindValue('limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue('offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $items = array_map(function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'title' => $row['title'],
            'content' => $row['content'],
            'author' => $row['author'],
            'createdAt' => str_replace(' ', 'T', $row['created_at']),
        ];
    }, $stmt->fetchAll());

    json_response([
        'ok' => true,
        'items' => $items,
        'page' => $page,
        'pageSize' => $pageSize,
        'total' => $total,
        'totalPages' => $totalPages,
    ]);
} catch (Throwable $e) {
    log_error($e);
    json_error('게시글을 불러오지 못했습니다.', 500);
}
