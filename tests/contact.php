<?php
declare(strict_types=1);
// Isolated CLI regression suite: namespace mail() stub prevents real delivery.
$suite = sys_get_temp_dir() . '/almat-contact-test-' . bin2hex(random_bytes(5));
mkdir($suite . '/public_html/almat-api', 0700, true);
mkdir($suite . '/.almat-contact', 0700);
copy(__DIR__ . '/../hosting/contact.php', $suite . '/public_html/almat-api/contact.php');
$runner = <<<'PHP'
<?php
namespace AlmatContact {
    function mail(...$args): bool {
        $GLOBALS['mail_calls'][] = $args;
        return $GLOBALS['mail_result'];
    }
}
namespace {
    $input = json_decode(stream_get_contents(STDIN), true);
    $_POST = $input['post'];
    $_FILES = $input['files'] ?? [];
    $_SERVER = array_replace([
        'HTTP_ORIGIN' => 'https://almatcerramientos.com.ar',
        'REQUEST_METHOD' => 'POST', 'CONTENT_TYPE' => 'application/x-www-form-urlencoded',
        'CONTENT_LENGTH' => '600', 'REMOTE_ADDR' => '192.0.2.1'
    ], $input['server'] ?? []);
    $GLOBALS['mail_calls'] = [];
    $GLOBALS['mail_result'] = $input['mail_result'] ?? true;
    ob_start();
    register_shutdown_function(function () {
        $body = ob_get_clean();
        echo json_encode(['status' => http_response_code(), 'body' => json_decode($body, true), 'calls' => $GLOBALS['mail_calls']]);
    });
    require $argv[1];
}
PHP;
file_put_contents($suite . '/runner.php', $runner);
$valid = ['nombre' => 'Prueba técnica', 'email' => 'prueba@example.com', 'telefono' => '',
    'servicio' => 'Otro / necesito asesoramiento', 'mensaje' => 'Consulta técnica sin envío real.', '_honey' => ''];
$passed = 0;
function runCase(string $name, array $input, int $expected, int $calls = 0): array {
    global $suite, $passed;
    $process = proc_open([PHP_BINARY, $suite . '/runner.php', $suite . '/public_html/almat-api/contact.php'],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    fwrite($pipes[0], json_encode($input)); fclose($pipes[0]);
    $result = json_decode(stream_get_contents($pipes[1]), true); fclose($pipes[1]);
    $errors = stream_get_contents($pipes[2]); fclose($pipes[2]);
    proc_close($process);
    if (!$result || $result['status'] !== $expected || count($result['calls']) !== $calls || $errors !== '') {
        throw new RuntimeException("FAIL $name: " . json_encode($result) . $errors);
    }
    $passed++;
    return $result;
}
foreach ([
    'missing fields' => [],
    'honeypot' => array_replace($valid, ['_honey' => 'robot']),
    'array value' => array_replace($valid, ['nombre' => ['x']]),
    'header injection' => array_replace($valid, ['email' => "prueba@example.com\r\nBcc: other@example.com"]),
    'invalid service' => array_replace($valid, ['servicio' => 'inventado']),
    'long message' => array_replace($valid, ['mensaje' => str_repeat('a', 3001)]),
    'control characters' => array_replace($valid, ['nombre' => "Nombre\x01"]),
    'recipient override' => array_replace($valid, ['to' => 'other@example.com']),
] as $name => $post) runCase($name, ['post' => $post], 422);
runCase('foreign origin', ['post' => $valid, 'server' => ['HTTP_ORIGIN' => 'https://attacker.example']], 403);
runCase('missing origin', ['post' => $valid, 'server' => ['HTTP_ORIGIN' => '']], 403);
runCase('wrong method', ['post' => $valid, 'server' => ['REQUEST_METHOD' => 'GET']], 405);
runCase('oversized request', ['post' => $valid, 'server' => ['CONTENT_LENGTH' => '20000']], 413);
runCase('wrong media type', ['post' => $valid, 'server' => ['CONTENT_TYPE' => 'application/json']], 415);
runCase('attachment', ['post' => $valid, 'files' => ['upload' => ['name' => 'file.txt']]], 422);
runCase('preflight', ['post' => [], 'server' => ['REQUEST_METHOD' => 'OPTIONS']], 204);
$result = runCase('valid request', ['post' => $valid], 200, 1);
$mail = $result['calls'][0];
if ($mail[0] !== 'almatcerramientos@gmail.com' || $mail[3]['Reply-To'] !== $valid['email']
    || $mail[4] !== '-fcontacto@almatcerramientos.com.ar'
    || !str_contains(base64_decode($mail[2]), $valid['mensaje'])) throw new RuntimeException('Invalid mail contract');
runCase('HTML stays plain text', ['post' => array_replace($valid, ['mensaje' => '<script>alert("x")</script>'])], 200, 1);
runCase('transport failure', ['post' => $valid, 'mail_result' => false], 503, 1);
runCase('fourth attempt', ['post' => $valid], 200, 1);
runCase('fifth attempt', ['post' => $valid], 200, 1);
runCase('IP rate limit', ['post' => $valid], 429);
$stateFile = $suite . '/.almat-contact/limits.json';
file_put_contents($stateFile, json_encode(['global' => ['count' => 60, 'until' => time() + 3600]]));
runCase('global rate limit', ['post' => $valid, 'server' => ['REMOTE_ADDR' => '192.0.2.2']], 429);
file_put_contents($stateFile, '{"broken":');
runCase('corrupt rate state fails closed', ['post' => $valid], 503);
file_put_contents($stateFile, '');
runCase('empty existing rate state fails closed', ['post' => $valid], 503);
file_put_contents($stateFile, str_repeat('x', 131073));
runCase('oversized rate state fails closed', ['post' => $valid], 503);
file_put_contents($stateFile, json_encode(['global' => ['count' => 'oops', 'until' => time() + 3600]]));
runCase('invalid rate schema fails closed', ['post' => $valid], 503);
$log = file_get_contents($suite . '/.almat-contact/events.jsonl');
if (str_contains($log, $valid['email']) || str_contains($log, $valid['nombre']) || str_contains($log, '192.0.2.1')) {
    throw new RuntimeException('Personal information in event log');
}
echo "PASS: $passed endpoint cases; fixed recipient, plain-text mail, bounded rate state and private logs. No mail sent.\n";
