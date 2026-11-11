# Protocolo de validación visual

**Objetivo.** Comprobar con imágenes de alta resolución si las conversiones de bosque nativo quemado a uso antrópico que muestra MapBiomas (Colección 2) son reales o errores de clasificación.

**Muestra.** 146 píxeles de bosque nativo quemados entre 2014 y 2021: 102 que el mapa clasifica como agricultura, pastura o infraestructura tres años después del incendio y 44 que no. El orden es aleatorio y la planilla no indica el grupo (revisión a ciegas).

**Ejemplos.** `ejemplos_trayectorias.png` muestra la cobertura año a año de 16 puntos de la muestra, con los cuatro casos que conviene distinguir al revisar: conversión que persiste, conversión transitoria, degradación a matorral y bosque sin cambio.

## Pasos

1. Abrir `muestra_validacion.kml` en Google Earth Pro (de escritorio) y activar **Imágenes históricas** (ícono del reloj).
2. Para cada punto (V001, V002, …), mirar un cuadro de unos 30 × 30 m centrado en el punto:
   - una imagen del año anterior al incendio o lo más cercana posible;
   - una imagen de tres años después del incendio en adelante.
3. Completar en `muestra_validacion.xlsx` (columnas amarillas, con listas desplegables; el `.csv` trae lo mismo):
   - `bosque_antes`: ¿había bosque nativo antes del incendio? (si / no / dudoso)
   - `uso_observado_despues`: bosque, matorral, pastizal, plantación, cultivo, pradera, construcción, camino, suelo desnudo u otro.
   - `conversion_real`: ¿el punto pasó a uso agrícola, ganadero o construido? (si / no / dudoso)
   - `fecha_imagen`: fecha de la imagen posterior usada.
   - `nota`: cualquier duda (sombra, borde entre dos coberturas, imagen de mala calidad).
4. Si no hay imagen útil en el período, marcar `dudoso` y anotarlo.

## Qué se calcula después

Cruzando la planilla con `clave_muestra.csv`:

- **Precisión de las conversiones:** proporción de los 102 puntos «convertidos» en que la conversión es real.
- **Omisión:** proporción de los 44 «no convertidos» en que sí hubo conversión.
- **Error de la clase previa:** proporción de puntos en que no había bosque nativo antes del incendio.

Con esas tres cifras se corrige o se acota el efecto estimado para el bosque nativo.
