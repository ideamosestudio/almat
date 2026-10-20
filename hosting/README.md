# Envío propio de consultas

La web permanece en GitHub Pages. Hay un único formulario por página que hace POST por HTTPS a
`https://mail.almatcerramientos.com.ar/almat-api/contact.php`, alojado en cPanel.
No usan FormSubmit ni necesitan activar una cuenta externa.

Instalar `contact.php` en `/home3/almatcerramiento/public_html/almat-api/contact.php`.
Este archivo no se incluye en `dist`: GitHub Pages no ejecuta PHP.
El hostname `mail` ya apunta al hosting y tiene certificado TLS válido.

El destinatario está fijo en el servidor: `almatcerramientos@gmail.com`.
Remitente y envelope sender: `contacto@almatcerramientos.com.ar`.
Reply-To: email validado del visitante. Se usa el MTA local mediante PHP `mail()`;
no hay contraseñas SMTP ni credenciales en JavaScript.

Controles: tamaño máximo, validación de campos, rechazo de inyección de cabeceras,
honeypot, lista de orígenes permitidos y límite de 5 intentos válidos por IP/hora
y 60 globales/hora. CORS no sustituye el límite: un cliente externo puede falsificar
Origin. Los contadores, sin contenido ni IP en claro, se guardan fuera de public_html,
en `~/.almat-contact/limits.json`, con bloqueo para solicitudes concurrentes.
Los datos del formulario solo se limpian tras respuesta satisfactoria del servidor.

HTTP 200 significa aceptación por el MTA local; no prueba recepción en la bandeja
de Gmail. Revisar Track Delivery de cPanel y confirmar recepción/Spam para comprobar
entrega. Los logs de aplicación solo contienen una referencia aleatoria y resultado.

Las futuras actualizaciones de este backend deben copiarse al hosting, validarse con
`php -l` y comprobarse por HTTPS. El workflow Pages solo publica el frontend.

## Instalación y operación

Requiere PHP 8.2 o superior con mbstring y MTA local configurado. Copiar también
`.htaccess` y `.user.ini` al directorio `almat-api`. Guardar una copia previa fuera
de `public_html`; aplicar primero `php -l hosting/contact.php` y `php tests/contact.php`
sobre una copia de staging. Las 26 pruebas sustituyen `mail()` únicamente en su
proceso aislado y no envían mensajes.

La carpeta `~/.almat-contact` debe tener permisos 0700 y sus archivos 0600.
No borrar contadores para resolver errores sin investigar la causa: ante datos
corruptos o almacenamiento no disponible, el servicio deja de enviar (503).
`events.jsonl` contiene fecha UTC, referencia aleatoria y código de resultado;
se limita a unos 256 KiB. No almacena mensajes, emails ni IP en claro. El hosting
puede mantener sus propios logs de acceso y entrega con otra política de retención.
Revisar periódicamente `mail_failed`, `internal_failure` y `rate_limited`; no se
configuró un servicio externo de alertas.

El endpoint devuelve CSP restrictiva, HSTS sin includeSubDomains, nosniff,
Referrer-Policy, Permissions-Policy y X-Frame-Options. `.htaccess` extiende estos
controles a errores de Apache dentro de `almat-api`. `.user.ini` limita recursos
y errores visibles; las opciones de sistema dependen de la configuración del proveedor.
Verificar los headers por HTTPS tras copiar y esperar la recarga de PHP si corresponde.

El frontend publica su CSP mediante Astro y su política de referrer mediante meta.
GitHub Pages no aplica este `.htaccess`: los restantes headers HTTP del sitio
requieren un proxy/CDN configurable o un cambio de plataforma. Ver
`docs/security-performance-review.md`.
