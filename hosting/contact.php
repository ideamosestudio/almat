<?php
declare(strict_types=1);
namespace AlmatContact;

ini_set('display_errors', '0');
ini_set('log_errors', '1');
umask(0077);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
header("Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
header('X-Frame-Options: DENY');
header('Strict-Transport-Security: max-age=31536000');
header('Vary: Origin');

$storage = dirname(__DIR__, 2) . '/.almat-contact';
$requestId = bin2hex(random_bytes(8));
// Logs contain only random request references, outcome codes and UTC times.
function audit(string $event): void {
    global $storage, $requestId;
    if (!is_dir($storage)) return;
    $file = @fopen($storage . '/events.jsonl', 'c+');
    if (!$file) return;
    if (flock($file, LOCK_EX)) {
        $size = fstat($file)['size'];
        if ($size > 262144) { ftruncate($file, 0); rewind($file); }
        else fseek($file, 0, SEEK_END);
        fwrite($file, json_encode(['time' => gmdate('c'), 'request' => $requestId, 'event' => $event]) . "\n");
        fflush($file);
        flock($file, LOCK_UN);
    }
    fclose($file);
}
function respond(int $status, string $message, string $event): never {
    global $requestId;
    audit($event);
    http_response_code($status);
    echo json_encode(['ok' => $status === 200, 'message' => $message, 'reference' => $requestId], JSON_UNESCAPED_UNICODE);
    exit;
}
set_exception_handler(function (\Throwable $error): never {
    respond(503, 'Servicio temporalmente no disponible. Intentá más tarde o escribinos por WhatsApp.', 'internal_failure');
});
if (!is_dir($storage) && !@mkdir($storage, 0700, true) && !is_dir($storage)) {
    respond(503, 'Servicio temporalmente no disponible.', 'storage_unavailable');
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!in_array($origin, ['https://almatcerramientos.com.ar', 'https://www.almatcerramientos.com.ar'], true)) {
    respond(403, 'Origen no permitido.', 'origin_rejected');
}
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if ($method !== 'POST') { header('Allow: POST, OPTIONS'); respond(405, 'Método no permitido.', 'method_rejected'); }
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 16000) respond(413, 'Consulta demasiado extensa.', 'size_rejected');
$contentType = strtolower(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]);
if (!in_array($contentType, ['application/x-www-form-urlencoded', 'multipart/form-data'], true)) {
    respond(415, 'Formato no permitido.', 'type_rejected');
}
if ($_FILES) respond(422, 'No se admiten archivos adjuntos.', 'files_rejected');
if (array_diff(array_keys($_POST), ['nombre', 'email', 'telefono', 'servicio', 'mensaje', '_honey'])) {
    respond(422, 'Campos no permitidos.', 'fields_rejected');
}
function field(string $key, int $maxBytes): string {
    $value = $_POST[$key] ?? '';
    if (!is_string($value) || strlen($value) > $maxBytes || !preg_match('//u', $value)
        || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value)) {
        respond(422, 'Revisá los datos ingresados.', 'input_rejected');
    }
    return trim($value);
}
if (field('_honey', 300) !== '') respond(422, 'No se pudo enviar la consulta.', 'honeypot_rejected');
$name = field('nombre', 400);
$email = field('email', 254);
$phone = field('telefono', 160);
$service = field('servicio', 120);
$message = field('mensaje', 12000);
$services = ['Aberturas de aluminio', 'Cerramientos de aluminio', 'Vidrios, espejos y templados', 'Cerramientos corredizos y plegadizos', 'Aberturas de PVC', 'Otro / necesito asesoramiento'];
if (mb_strlen($name, 'UTF-8') < 2 || mb_strlen($name, 'UTF-8') > 100
    || mb_strlen($phone, 'UTF-8') > 40 || mb_strlen($message, 'UTF-8') < 10 || mb_strlen($message, 'UTF-8') > 3000
    || !filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $email . $name . $phone)
    || !in_array($service, $services, true)) {
    respond(422, 'Revisá nombre, email, servicio y mensaje.', 'validation_rejected');
}
// A locked, bounded state file. Corruption or failed writes stop sending (fail closed).
$existingState = is_file($storage . '/limits.json');
$lock = @fopen($storage . '/limits.json', 'c+');
if (!$lock || !flock($lock, LOCK_EX)) respond(503, 'Intentá nuevamente en unos minutos.', 'lock_failed');
if (fstat($lock)['size'] > 131072) respond(503, 'Servicio temporalmente no disponible.', 'rate_state_invalid');
$raw = stream_get_contents($lock);
if ($existingState && $raw === '') respond(503, 'Servicio temporalmente no disponible.', 'rate_state_empty');
$state = $raw === '' ? [] : json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
if (!is_array($state)) respond(503, 'Servicio temporalmente no disponible.', 'rate_state_invalid');
$now = time();
foreach ($state as $key => $entry) {
    if (!is_array($entry) || !isset($entry['until'], $entry['count']) || !is_int($entry['until']) || !is_int($entry['count']) || $entry['count'] < 0) {
        respond(503, 'Servicio temporalmente no disponible.', 'rate_state_invalid');
    }
    if ($entry['until'] <= $now) unset($state[$key]);
}
$ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
foreach ([$ip => 5, 'global' => 60] as $key => $limit) {
    if (($state[$key]['count'] ?? 0) >= $limit) {
        flock($lock, LOCK_UN); fclose($lock);
        header('Retry-After: 3600');
        respond(429, 'Recibimos varias consultas. Intentá más tarde o escribinos por WhatsApp.', 'rate_limited');
    }
}
foreach ([$ip, 'global'] as $key) {
    $state[$key] = ['until' => $state[$key]['until'] ?? $now + 3600, 'count' => ($state[$key]['count'] ?? 0) + 1];
}
$encoded = json_encode($state, JSON_THROW_ON_ERROR);
rewind($lock);
if (!ftruncate($lock, 0) || fwrite($lock, $encoded) !== strlen($encoded) || !fflush($lock)) {
    respond(503, 'Servicio temporalmente no disponible.', 'rate_write_failed');
}
flock($lock, LOCK_UN); fclose($lock);
$body = "Consulta desde la web de ALMAT\nReferencia: $requestId\n\nNombre: $name\nEmail: $email\nTeléfono: $phone\nServicio: $service\n\n$message\n";
$headers = [
    'From' => 'ALMAT Web <contacto@almatcerramientos.com.ar>',
    'Reply-To' => $email,
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => 'base64',
    'X-ALMAT-Reference' => $requestId,
];
$sent = mail('almatcerramientos@gmail.com', 'Nueva consulta desde la web de ALMAT', chunk_split(base64_encode($body)), $headers, '-fcontacto@almatcerramientos.com.ar');
if (!$sent) respond(503, 'No pudimos enviar tu consulta. Intentá nuevamente o escribinos por WhatsApp.', 'mail_failed');
respond(200, 'Gracias. Tu consulta fue enviada correctamente.', 'mail_accepted');
