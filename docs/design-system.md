# Sistema editorial de ALMAT

## Tipografía

La escala vive en `:root` dentro de `src/styles/global.css` y se adapta con `clamp()`:

- `--type-display`: H1 de portada.
- `--type-h2`: título principal de sección.
- `--type-h3`: títulos de módulos y servicios.
- `--type-lead`: introducciones y descripciones destacadas.
- `--type-body`: texto general.
- `--type-eyebrow`: etiquetas editoriales en mayúsculas.
- `--type-micro`: numeraciones y referencias.

Las clases reutilizables principales son `.display-title`, `.section-title`, `.lead`, `.body-large`, `.eyebrow` y `.microcopy`.

## Composición

`PageHero.astro` admite las variantes `left`, `center` y `split`. Las portadas actuales usan un único bloque alineado a la izquierda: eyebrow “ABERTURAS Y CERRAMIENTOS”, H1, descripción breve y acciones. En desktop la caja nunca supera el eje medio de la pantalla; el título ocupa como máximo tres líneas y la descripción, como máximo dos. La bajada se compone en Roboto Light, 2 px por encima de la escala base, y su ancho se sincroniza con la línea más larga del título para que nunca la exceda. El eyebrow usa 1 px adicional y el H1 una escala 20% mayor.

Para módulos editoriales se usa `.section-composition` junto con `.section-composition--split` y `.section-support`. El CTA debe permanecer dentro de `.section-support`, junto al texto que explica la acción.

Las fotografías independientes ocupan el ancho de su contenedor y comienzan sobre el eje izquierdo. Una imagen sólo puede compartir fila cuando existe contenido real ocupando la columna contigua; no se usan desplazamientos que produzcan columnas vacías.

## Acciones

`ActionLink.astro` concentra todas las acciones enlazadas:

- `primary`: botón transparente con borde de 3 px.
- `secondary`: segunda acción con el mismo borde de 3 px.
- `light`: variante para fondos oscuros o fotográficos.

Las acciones relacionadas se agrupan con `.cta-group`. Todos los botones invierten fondo y texto al pasar el mouse y prescinden de iconos de flecha. El formulario reutiliza las clases visuales `.cta` y `.cta--primary` para conservar el mismo lenguaje.

## Espaciado

`--space-1` a `--space-7` controlan las distancias internas. Los bloques de texto usan espacios menores que la separación entre bloques o secciones, preservando el ritmo y el espacio negativo.
