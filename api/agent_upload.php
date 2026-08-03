<?php
require __DIR__ . '/_bootstrap.php';
require_method('POST');

try {
    $title = str_or_default($_POST, 'title');
    $category = str_or_default($_POST, 'category');
    $roleTitle = str_or_default($_POST, 'roleTitle');
    $personaIntro = str_or_default($_POST, 'personaIntro');
    $description = str_or_default($_POST, 'description');
    $orgGroup = str_or_default($_POST, 'orgGroup');
    $orgDept = str_or_default($_POST, 'orgDept');
    $orgTeam = str_or_default($_POST, 'orgTeam');
    $uploader = str_or_default($_POST, 'uploader');

    if ($title === '') {
        json_error('Agent 이름을 입력해주세요.', 400);
    }
    if (mb_strlen($title) > 255) {
        json_error('Agent 이름이 너무 깁니다.', 400);
    }
    if (!in_array($category, CATEGORIES, true)) {
        json_error('카테고리를 선택해주세요.', 400);
    }
    if ($uploader === '') {
        json_error('등록자를 입력해주세요.', 400);
    }

    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        json_error('업로드할 파일을 선택해주세요.', 400);
    }
    $file = $_FILES['file'];
    if ($file['size'] > MAX_UPLOAD_BYTES) {
        json_error('파일은 5MB 이하만 업로드할 수 있습니다.', 400);
    }
    $ext = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['html', 'htm'], true)) {
        json_error('HTML 파일(.html, .htm)만 업로드할 수 있습니다.', 400);
    }

    if (!is_dir(UPLOAD_DIR) && !mkdir(UPLOAD_DIR, 0755, true) && !is_dir(UPLOAD_DIR)) {
        json_error('업로드 폴더를 생성하지 못했습니다.', 500);
    }

    // 원본 파일명은 사용하지 않고 서버가 새 이름을 생성해 경로 조작을 방지합니다.
    $storedName = bin2hex(random_bytes(8)) . '_' . time() . '.' . $ext;
    $destination = UPLOAD_DIR . $storedName;
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        json_error('파일 저장에 실패했습니다.', 500);
    }

    $stmt = db()->prepare(
        'INSERT INTO agents
            (title, category, role_title, persona_intro, description, org_group, org_dept, org_team, uploader, file_path)
         VALUES
            (:title, :category, :role_title, :persona_intro, :description, :org_group, :org_dept, :org_team, :uploader, :file_path)'
    );
    $stmt->execute([
        'title' => $title,
        'category' => $category,
        'role_title' => $roleTitle,
        'persona_intro' => $personaIntro,
        'description' => $description,
        'org_group' => $orgGroup,
        'org_dept' => $orgDept,
        'org_team' => $orgTeam,
        'uploader' => $uploader,
        'file_path' => $storedName,
    ]);

    json_response(['ok' => true, 'id' => (int) db()->lastInsertId()]);
} catch (Throwable $e) {
    log_error($e);
    json_error('Agent 등록에 실패했습니다.', 500);
}
