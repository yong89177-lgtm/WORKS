<?php
require __DIR__ . '/_bootstrap.php';
require_method('GET');

try {
    $pdo = db();
    $agentCount = (int) $pdo->query('SELECT COUNT(*) FROM agents')->fetchColumn();
    $teamCount = (int) $pdo->query("SELECT COUNT(DISTINCT org_team) FROM agents WHERE org_team <> ''")->fetchColumn();
    $categoryCount = count(CATEGORIES);

    $counts = array_fill_keys(CATEGORIES, 0);
    $stmt = $pdo->query('SELECT category, COUNT(*) AS c FROM agents GROUP BY category');
    foreach ($stmt->fetchAll() as $row) {
        if (array_key_exists($row['category'], $counts)) {
            $counts[$row['category']] = (int) $row['c'];
        }
    }
    $breakdown = [];
    foreach (CATEGORIES as $cat) {
        $breakdown[] = ['category' => $cat, 'count' => $counts[$cat]];
    }

    json_response([
        'ok' => true,
        'agentCount' => $agentCount,
        'teamCount' => $teamCount,
        'categoryCount' => $categoryCount,
        'categoryBreakdown' => $breakdown,
    ]);
} catch (Throwable $e) {
    log_error($e);
    json_error('통계를 불러오지 못했습니다.', 500);
}
