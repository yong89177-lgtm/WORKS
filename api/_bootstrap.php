<?php
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../config.php';

const CATEGORIES = ['기술개발도출지원', '이슈원인분석', 'MRM 과제운영', '제품개발 프로세스'];

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400): void
{
    json_response(['ok' => false, 'error' => $message], $status);
}

function require_method(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        json_error('허용되지 않은 요청입니다.', 405);
    }
}

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode((string) $raw, true);
    return is_array($data) ? $data : [];
}

function str_or_default(array $src, string $key, string $default = ''): string
{
    $v = $src[$key] ?? '';
    $v = is_string($v) ? trim($v) : '';
    return $v === '' ? $default : $v;
}

function visitor_id(): string
{
    if (!empty($_COOKIE['aims_visitor']) && preg_match('/^[a-f0-9]{32}$/', (string) $_COOKIE['aims_visitor'])) {
        return $_COOKIE['aims_visitor'];
    }
    $id = bin2hex(random_bytes(16));
    setcookie('aims_visitor', $id, [
        'expires' => time() + 60 * 60 * 24 * 365,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    $_COOKIE['aims_visitor'] = $id;
    return $id;
}

function map_agent_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'title' => $row['title'],
        'category' => $row['category'],
        'roleTitle' => $row['role_title'],
        'personaIntro' => $row['persona_intro'],
        'description' => $row['description'],
        'orgGroup' => $row['org_group'],
        'orgDept' => $row['org_dept'],
        'orgTeam' => $row['org_team'],
        'uploader' => $row['uploader'],
        'fileUrl' => UPLOAD_URL . $row['file_path'],
        'isPlaceholder' => (bool) $row['is_placeholder'],
        'likeCount' => (int) ($row['like_count'] ?? 0),
        'createdAt' => str_replace(' ', 'T', $row['created_at']),
    ];
}

function log_error(Throwable $e): void
{
    error_log('[AIMS API] ' . $e->getMessage());
}
