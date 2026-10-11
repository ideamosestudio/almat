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

`PageHero.astro` admite las variantes `left`, `center` y `split`. Todas mantienen la secuencia eyebrow, H1, descripción y acciones. En pantallas angostas, `split` pasa a una única columna.

Para módulos editoriales se usa `.section-composition` junto con `.section-composition--split` y `.section-support`. El CTA debe permanecer dentro de `.section-support`, junto al texto que explica la acción.

Las fotografías independientes ocupan el ancho de su contenedor y comienzan sobre el eje izquierdo. Una imagen sólo puede compartir fila cuando existe contenido real ocupando la columna contigua; no se usan desplazamientos que produzcan columnas vacías.

## Acciones

`ActionLink.astro` concentra todas las acciones enlazadas:

- `primary`: botón transparente con borde de 3 px.
- `secondary`: enlace editorial subrayado.
- `light`: variante para fondos oscuros o fotográficos.

Las acciones relacionadas se agrupan con `.cta-group`. El formulario reutiliza las clases visuales `.cta` y `.cta--primary` para conservar el mismo lenguaje.

## Espaciado

`--space-1` a `--space-7` controlan las distancias internas. Los bloques de texto usan espacios menores que la separación entre bloques o secciones, preservando el ritmo y el espacio negativo.
