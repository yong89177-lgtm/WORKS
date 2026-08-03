<?php
require __DIR__ . '/_bootstrap.php';
require_method('POST');

try {
    $body = read_json_body();
    $title = str_or_default($body, 'title');
    $content = str_or_default($body, 'content');
    $author = str_or_default($body, 'author', '관리자');

    if ($title === '' || $content === '') {
        json_error('제목과 내용을 입력해주세요.', 400);
    }
    if (mb_strlen($title) > 200) {
        json_error('제목이 너무 깁니다.', 400);
    }
    if (mb_strlen($content) > 2000) {
        json_error('내용이 너무 깁니다.', 400);
    }
    if (mb_strlen($author) > 100) {
        json_error('작성자 이름이 너무 깁니다.', 400);
    }

    $stmt = db()->prepare('INSERT INTO notices (title, content, author) VALUES (:title, :content, :author)');
    $stmt->execute(['title' => $title, 'content' => $content, 'author' => $author]);

    json_response(['ok' => true, 'id' => (int) db()->lastInsertId()]);
} catch (Throwable $e) {
    log_error($e);
    json_error('공지사항 등록에 실패했습니다.', 500);
}
