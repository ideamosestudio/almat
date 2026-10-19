# Conectar Almat a GitHub Pages conservando el correo

Preparado el 19/10/2026. No se modificaron DNS ni ajustes de Pages.

## Estado comprobado

- Repositorio: https://github.com/ideamosestudio/almat (main b051981).
- Pages usa Actions y ya tiene el dominio almatcerramientos.com.ar configurado. HTTPS obligatorio todavía está desactivado.
- https://ideamosestudio.github.io/almat/ redirige al dominio; este sigue sirviendo WordPress desde el hosting actual.
- DNS autoritativos: dns1.servidoraweb.net y dns2.servidoraweb.net. No cambiar nameservers.
- A principal: 167.250.5.104. MX prioridad 0: almatcerramientos.com.ar.
- mail es CNAME al dominio principal: AMBOS dependen del A que se pretende cambiar.
- www es CNAME al dominio principal. webmail y ftp tienen A propio 167.250.5.104.
- SPF: v=spf1 ip4:167.250.5.104 include:servidoraweb.net +a +mx +ip4:167.250.5.28 ~all
- DMARC: v=DMARC1; p=none;. Existe DKIM en default._domainkey.
- La consulta AAAA principal no devolvió dirección. Revisar CAA y toda la zona antes del corte.
- El formulario usa FormSubmit y almatcerramientos@gmail.com; su entrega y activación no se verificaron ni se enviaron mensajes de prueba.

## Cambios de código preparados

ALMAT_CUSTOM_DOMAIN=true compila para https://almatcerramientos.com.ar/ y rutas desde /.
Sin esa variable se conserva el modo de desarrollo para https://ideamosestudio.github.io/almat/.
El workflow activa el modo dominio. El sitemap, robots, canonical y retorno de ambos formularios siguen el destino elegido.
No se necesita CNAME en el artefacto: con Actions se usa el dominio guardado en Settings > Pages.

Validación local en PowerShell:

```powershell
npm.cmd ci
$env:ALMAT_CUSTOM_DOMAIN = 'true'
npm.cmd run build
Remove-Item Env:ALMAT_CUSTOM_DOMAIN
npm.cmd run build
```

## Orden de migración

1. Obtener una exportación completa de la zona y confirmar con el hosting que 167.250.5.104 es el destino SMTP/IMAP correcto y que mail.almatcerramientos.com.ar tiene certificado válido. Confirmar Email Routing local en cPanel, sin cambiarlo a remoto por el alojamiento web externo.
2. Revisar clientes de correo: si usan almatcerramientos.com.ar como servidor SMTP/IMAP/POP, migrarlos primero a mail.almatcerramientos.com.ar o al hostname certificado que indique el hosting. También revisar autoconfig/autodiscover/SRV y accesos de cPanel/webmail que dependan del dominio raíz.
3. Reemplazar mail CNAME por mail A 167.250.5.104 (no pueden coexistir). Validar resolución y TLS del correo.
4. Reemplazar el MX principal por prioridad 0, mail.almatcerramientos.com.ar. Conservar DKIM, DMARC y registros de validación. Confirmar con el hosting un SPF que mantenga los emisores existentes y elimine la dependencia +a del dominio web; propuesta: v=spf1 ip4:167.250.5.104 include:servidoraweb.net +mx +ip4:167.250.5.28 ~all. No crear un segundo SPF.
5. Esperar al menos el TTL anterior de 3600 segundos desde la última modificación de mail/MX antes de cambiar el A web. Comprobar DNS autoritativos y resolvers públicos y probar recepción/envío real con autorización del usuario.
6. Incorporar esta rama a main y esperar Deploy to GitHub Pages exitoso. Verificar el artefacto antes del cambio DNS. Configurar/verificar propiedad del dominio en GitHub con el TXT que entregue GitHub; no inventar su valor.
7. Sustituir solo el A principal por los cuatro A de Pages: 185.199.108.153, 185.199.109.153, 185.199.110.153 y 185.199.111.153. Cambiar www a CNAME ideamosestudio.github.io (sin /almat). No modificar mail, webmail, ftp, MX, DKIM o DMARC en este paso. No conservar A/AAAA web incompatibles. Si existe CAA, verificar que permita el certificado de Pages.
8. Esperar validación DNS y emisión del certificado en Pages; activar Enforce HTTPS cuando esté disponible. Comprobar dominio raíz y www, rutas internas, imágenes, canonical, sitemap, robots y retorno de formularios. Revisar escritorio y móvil. La emisión y propagación pueden demorar.
9. Probar correo entrante y saliente, autenticación SPF/DKIM/DMARC, SMTP/IMAP y webmail. No considerar completada la migración por resolver DNS solamente.

## Reversión

Conservar WordPress y archivos del hosting. Si falla la web, restaurar A principal 167.250.5.104 y www CNAME almatcerramientos.com.ar. La configuración independiente de mail/MX puede mantenerse; no volver a acoplar el correo innecesariamente. La reversión DNS también está sujeta a cachés. Revertir el commit del sitio solo si se necesita recuperar el build anterior.

## Referencias

- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https

## Validación realizada

Ambos modos compilaron con Astro sin errores ni advertencias. scripts/check-build.mjs verificó las cuatro páginas, canonical, enlaces y recursos locales, retorno de formularios, robots y sitemap. El workflow valida los PR sin desplegar; solo main puede publicar. No se probó entrega de correo ni se cambió el sitio público.
