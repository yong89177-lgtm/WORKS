<?php
require __DIR__ . '/_bootstrap.php';
require_method('POST');

const FEEDBACK_CATEGORIES = ['기타', '제품등록', '기능추가', '버그신고'];

try {
    $body = read_json_body();
    $name = str_or_default($body, 'name');
    $email = str_or_default($body, 'email');
    $title = str_or_default($body, 'title');
    $category = str_or_default($body, 'category', '기타');
    $content = str_or_default($body, 'content');

    if ($name === '' || $title === '' || $content === '') {
        json_error('필수 항목을 입력해주세요.', 400);
    }
    if (!in_array($category, FEEDBACK_CATEGORIES, true)) {
        json_error('잘못된 카테고리입니다.', 400);
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('이메일 형식이 올바르지 않습니다.', 400);
    }
    if (mb_strlen($name) > 100 || mb_strlen($title) > 300) {
        json_error('입력값이 너무 깁니다.', 400);
    }

    $stmt = db()->prepare(
        'INSERT INTO feedback (name, email, title, category, content) VALUES (:name, :email, :title, :category, :content)'
    );
    $stmt->execute([
        'name' => $name,
        'email' => $email,
        'title' => $title,
        'category' => $category,
        'content' => $content,
    ]);

    json_response(['ok' => true, 'id' => (int) db()->lastInsertId()]);
} catch (Throwable $e) {
    log_error($e);
    json_error('요청 등록에 실패했습니다.', 500);
}
