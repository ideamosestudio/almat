# Envío propio de consultas

La web permanece en GitHub Pages. Ambos formularios hacen POST por HTTPS a
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
