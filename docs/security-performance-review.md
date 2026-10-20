# Revisión de seguridad, rendimiento y diseño — 20/10/2026

## Alcance real

Frontend estático Astro en GitHub Pages y un endpoint PHP en cPanel para enviar
consultas a Gmail mediante el MTA del hosting. Sin cuentas, sesiones, base de datos
ni panel administrativo en la aplicación Astro. No se modifican MX/SPF/DKIM/DMARC.
La revisión aplica [OWASP Top 10 2025](https://top10.owasp.org/2025/0x00_2025-Introduction/)
como análisis del stack; no es una certificación ni una prueba de penetración exhaustiva.

## Implementado

- **Acceso y diseño (A01/A06/A07):** destinatario/remitente fijos en PHP; orígenes
  exactos; métodos limitados; sin credenciales en cliente. El formulario es público:
  no corresponde inventar autenticación. CORS no autentica clientes externos.
  Honeypot y límites por IP/global reducen abuso, sin prometer bloquear todo bot.
- **Configuración y transporte (A02/A04):** CSP generada por Astro con hashes de
  scripts/estilos; sin eval ni scripts inline libres. Solo estilos de atributo
  permitidos para imágenes responsive y animaciones. Referrer restringido.
  PHP responde con CSP, frame-ancestors, HSTS, nosniff, Permissions-Policy y
  X-Frame-Options. HTTPS público comprobado sin omitir validación de certificados.
- **Supply chain e integridad (A03/A08):** Astro 7.4.1, check 0.9.11 y herramienta QA
  1.64.1; TypeScript se mantiene en la rama compatible 5.9. Lockfile y npm ci.
  Actions fijadas por SHA, permisos mínimos y despliegue separado de PR.
  Dependabot semanal y auditoría de dependencias en CI. Eliminados un script
  de preparación obsoleto y una función sin consumidores.
- **Validación/inyección (A05):** tipos, UTF-8, longitudes, campos y servicios
  permitidos; rechazo de controles, inyección de cabeceras y adjuntos.
  Correo en texto plano, cabeceras fijas, sin SQL ni interpretación de HTML.
  Mensajes de respuesta mostrados mediante texto, sin insertar HTML del servidor.
- **Logs y excepciones (A09/A10):** respuestas genéricas, referencia aleatoria,
  registro privado acotado sin contenido del visitante. Contadores bloqueados
  y verificación de escrituras; corrupción o fallos de almacenamiento detienen
  envío. Timeout de frontend, datos conservados al fallar y estado accesible.
- **Rendimiento:** logos/WhatsApp de 568.600 a 33.042 bytes (94% menos), fuentes
  latinas locales y preload principal, imágenes responsive WebP con dimensiones,
  calidad ajustada en hero y fotografía pesada. Mapa de Google carga solo al
  solicitarlo. Lecturas/escrituras de layout agrupadas y parallax limitado a
  imágenes cercanas. Contenido visible sin JS; animaciones inferiores conservadas.
- **Accesibilidad/SEO/diseño:** un formulario por página, etiquetas y roles,
  foco/teclado del menú, reduced-motion, campos móviles de 16px, canonical,
  sitemap y un h1 por página. Footer más compacto y legible, trayectoria
  “Tres décadas abriendo posibilidades” y separación del crédito/WhatsApp.

## Validación

- Build Astro y tipos, comprobación de las cuatro rutas y assets, CSP, presupuesto
  JS/CSS, número de formularios, metadatos y mapa diferido.
- 26 pruebas aisladas del endpoint en PHP del hosting: validación, métodos,
  inyección, destinatario fijo, contenido plano, límites, estado corrupto y
  transporte fallido. No envían correos reales.
- npm audit sin vulnerabilidades conocidas en la revisión. Escaneo de patrones
  de claves privadas y tokens en archivos versionados/historia: no coincidencias
  detectadas. Este escaneo no garantiza detectar cualquier secreto posible.
- Referencia pública previa: [PageSpeed móvil](https://pagespeed.web.dev/analysis/https-almatcerramientos-com-ar/a420rkzu6t?form_factor=mobile),
  rendimiento 81, accesibilidad 90, buenas prácticas 100, SEO 100;
  LCP de laboratorio 4,4 s, TBT 0 ms, CLS 0. Los datos de campo de 28 días
  (LCP 3 s, CLS 0,06) incluyen versiones anteriores y no se actualizan al publicar.
  Una medición de laboratorio no equivale a aprobación de Core Web Vitals reales.

### Resultado publicado

PR #5 integrada en `a36ea817b979ebc75f158e4793cb93f2df24bc4d`.
El workflow Pages `39476252433` terminó correctamente; el dominio sirvió CSP,
logos WebP, texto nuevo del footer y un único formulario. Consola del navegador
sin errores en la comprobación. Revisados contacto a 390 px, footer a 1366 px,
galería, validación de campos, menú móvil con Escape y mapa bajo demanda.

[PageSpeed posterior, 15:38 ART](https://pagespeed.web.dev/analysis/https-almatcerramientos-com-ar/manu5l5uz2?form_factor=mobile):

| Medición de laboratorio | Antes | Después |
| --- | ---: | ---: |
| Rendimiento móvil | 81 | 100 |
| Accesibilidad móvil | 90 | 100 |
| LCP móvil | 4,4 s | 1,7 s |
| Rendimiento escritorio | 99 | 100 |
| LCP escritorio | 0,9 s | 0,5 s |

Buenas prácticas y SEO móvil permanecen en 100; TBT 0 ms y CLS 0 en ambas
mediciones nuevas. Las puntuaciones pueden variar entre ejecuciones y no eliminan
los límites de headers/caché ni sustituyen pruebas manuales.

Endpoint actualizado con respaldo en `~/almat-backup-security-20261020/`.
Comprobación pública: 422 ante datos incompletos, headers de seguridad presentes
y acceso a `almat-api/error_log` bloqueado con 403. HTTPS raíz devuelve 200;
HTTP y www redirigen al dominio canónico HTTPS; gzip activo. No se enviaron
correos reales durante esta revisión.

## Límites y tareas de hosting

GitHub Pages no ofrece headers personalizados mediante archivos del repositorio.
La CSP meta y referrer se aplican en HTML; **HSTS, X-Content-Type-Options,
Permissions-Policy y frame-ancestors del dominio principal quedan pendientes**
de un proxy/CDN configurable. No se simulan mediante meta ineficaces. La política
de caché de Pages y compresión pertenecen al servicio; los assets usan nombres
versionados. Una capa configurable permitiría cache immutable para assets,
HSTS tras estabilidad y estos headers:

```text
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Content-Security-Policy: frame-ancestors 'none'
```

La última CSP HTTP complementaría la CSP meta existente; no reemplazarla por
una política que bloquee recursos necesarios. No usar includeSubDomains/preload
sin revisar todos los servicios. Cambiar DNS/proxy requiere plan específico para
no interferir con el hostname mail, correo ni certificados; no se hizo aquí.

El cPanel conserva una instalación WordPress anterior. Esta revisión no afirma
que WordPress/plugins estén actualizados ni elimina su contenido. El proveedor
debe aislar el vhost del API de esa instalación o retirar su exposición web con
backup y comprobar que mail/webmail/cPanel siguen accesibles.

HTTP 200 del formulario significa aceptación por el MTA, no llegada confirmada
a Gmail. La bandeja de destino debe confirmar recepción y Spam. La revisión
automática usa transporte simulado y no prueba esa entrega. Los registros
privados no generan alertas automáticas; revisar errores/abuso periódicamente.
