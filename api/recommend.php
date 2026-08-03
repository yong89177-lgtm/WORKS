<?php
require __DIR__ . '/_bootstrap.php';
require_method('POST');

function aims_tokenize(string $text): array
{
    $text = mb_strtolower($text);
    $parts = preg_split('/[\s,.\/·\-_()\[\]{}!?"\'`~]+/u', $text, -1, PREG_SPLIT_NO_EMPTY);
    if ($parts === false) {
        return [];
    }
    $parts = array_filter($parts, function (string $t): bool {
        return mb_strlen($t) >= 2;
    });
    return array_values(array_unique($parts));
}

try {
    $body = read_json_body();
    $needText = str_or_default($body, 'needText');
    if ($needText === '') {
        json_error('필요한 업무를 입력해주세요.', 400);
    }
    if (mb_strlen($needText) > 500) {
        json_error('내용이 너무 깁니다.', 400);
    }

    $tokens = aims_tokenize($needText);

    $stmt = db()->query(
        'SELECT a.*, (SELECT COUNT(*) FROM agent_likes l WHERE l.agent_id = a.id) AS like_count
         FROM agents a WHERE a.is_placeholder = 0'
    );
    $rows = $stmt->fetchAll();

    $scored = [];
    foreach ($rows as $row) {
        $haystack = mb_strtolower(implode(' ', [
            $row['title'], $row['role_title'], $row['persona_intro'], $row['description'], $row['category'],
        ]));
        $matched = [];
        foreach ($tokens as $t) {
            if (mb_strpos($haystack, $t) !== false) {
                $matched[] = $t;
            }
        }
        $scored[] = ['row' => $row, 'score' => count($matched), 'matched' => $matched];
    }

    usort($scored, function (array $a, array $b): int {
        if ($a['score'] !== $b['score']) {
            return $b['score'] <=> $a['score'];
        }
        return ((int) $b['row']['like_count']) <=> ((int) $a['row']['like_count']);
    });

    $topScore = $scored ? $scored[0]['score'] : 0;
    $noMatch = $topScore === 0;

    $top = array_slice($scored, 0, 3);
    $results = array_map(function (array $entry): array {
        $item = map_agent_row($entry['row']);
        $item['matchedKeywords'] = $entry['matched'];
        return $item;
    }, $top);

    json_response(['ok' => true, 'noMatch' => $noMatch, 'results' => $results]);
} catch (Throwable $e) {
    log_error($e);
    json_error('추천을 처리하지 못했습니다.', 500);
}
