<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Vary: Origin');
function respond(int $status, string $message): never {
    http_response_code($status);
    echo json_encode(['ok' => $status === 200, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!in_array($origin, ['https://almatcerramientos.com.ar', 'https://www.almatcerramientos.com.ar'], true)) {
    respond(403, 'Origen no permitido.');
}
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Allow: POST, OPTIONS'); respond(405, 'Método no permitido.'); }
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 16000) respond(413, 'Consulta demasiado extensa.');
function field(string $key, int $max): string {
    $value = $_POST[$key] ?? '';
    if (!is_string($value) || strlen($value) > $max || str_contains($value, "\0")) respond(422, 'Revisá los datos ingresados.');
    return trim($value);
}
if (field('_honey', 300) !== '') respond(422, 'No se pudo enviar la consulta.');
$name = field('nombre', 150);
$email = field('email', 254);
$phone = field('telefono', 80);
$service = field('servicio', 120);
$message = field('mensaje', 6000);
$services = ['Aberturas de aluminio', 'Cerramientos de aluminio', 'Vidrios, espejos y templados', 'Cerramientos corredizos y plegadizos', 'Aberturas de PVC', 'Otro / necesito asesoramiento'];
if (strlen($name) < 2 || strlen($message) < 10 || !filter_var($email, FILTER_VALIDATE_EMAIL)
    || preg_match('/[\r\n]/', $email . $name . $phone) || !in_array($service, $services, true)) {
    respond(422, 'Revisá nombre, email, servicio y mensaje.');
}
// Private storage, outside public_html. A locked bounded map limits concurrent abuse.
$dir = dirname(__DIR__, 2) . '/.almat-contact';
if (!is_dir($dir) && !mkdir($dir, 0700, true)) respond(503, 'Servicio temporalmente no disponible.');
$lock = fopen($dir . '/limits.json', 'c+');
if (!$lock || !flock($lock, LOCK_EX)) respond(503, 'Intentá nuevamente en unos minutos.');
$now = time();
$state = json_decode(stream_get_contents($lock), true) ?: [];
foreach ($state as $key => $entry) {
    if ($entry['until'] <= $now) unset($state[$key]);
}
$ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
foreach ([$ip => 5, 'global' => 60] as $key => $limit) {
    if (($state[$key]['count'] ?? 0) >= $limit) {
        flock($lock, LOCK_UN); fclose($lock);
        header('Retry-After: 3600');
        respond(429, 'Recibimos varias consultas. Intentá más tarde o escribinos por WhatsApp.');
    }
}
foreach ([$ip, 'global'] as $key) {
    $state[$key] = ['until' => $state[$key]['until'] ?? $now + 3600, 'count' => ($state[$key]['count'] ?? 0) + 1];
}
rewind($lock); ftruncate($lock, 0); fwrite($lock, json_encode($state)); fflush($lock);
flock($lock, LOCK_UN); fclose($lock);
$id = bin2hex(random_bytes(8));
$body = "Consulta desde la web de ALMAT\nReferencia: $id\n\nNombre: $name\nEmail: $email\nTeléfono: $phone\nServicio: $service\n\n$message\n";
$headers = [
    'From' => 'ALMAT Web <contacto@almatcerramientos.com.ar>',
    'Reply-To' => $email,
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => 'base64',
    'X-ALMAT-Reference' => $id,
];
$sent = mail('almatcerramientos@gmail.com', 'Nueva consulta desde la web de ALMAT', chunk_split(base64_encode($body)), $headers, '-fcontacto@almatcerramientos.com.ar');
// No visitor content is written to application logs.
error_log("ALMAT contact $id " . ($sent ? 'accepted' : 'failed'));
if (!$sent) respond(503, 'No pudimos enviar tu consulta. Intentá nuevamente o escribinos por WhatsApp.');
respond(200, 'Gracias. Tu consulta fue enviada correctamente.');
