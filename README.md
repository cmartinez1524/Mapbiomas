# ¿El fuego abre la puerta al cambio de uso del suelo en Chile?

Evaluación causal a nivel de píxel con MapBiomas Chile (Cobertura y Uso del Suelo, Colecciones 1 y 2) y MapBiomas Fuego (Colección 1) en el centro-sur de Chile, 1999–2024.

**Respuesta corta: no en general; sí en el bosque nativo.** Con la Colección 2, el efecto promedio sobre el paso a uso antrópico queda entre −0,25 y +0,50 pp (k = 1–3, cohortes 2014–2021). El bosque nativo quemado se convierte más (+0,9 pp; +1,4 pp con la Colección 1; hasta +6,4 pp en las cohortes 2022–2023 sin censura). El impacto dominante es la degradación del bosque nativo (+26–27 pp a los dos años). No hay efecto sobre la infraestructura.

Postulación al **Premio MapBiomas Chile, 1.ª edición — Categoría Análisis Técnico o Científico**.

Autor: Cristóbal Martínez Arochas, Ingeniería Civil en Ciencia de Datos, PUCV.

## Pregunta

Entre píxeles con la misma cobertura natural o silvícola el año previo, ¿cuánto aumenta un incendio la probabilidad de pasar a agricultura, pastura o infraestructura, por sobre lo que habría ocurrido sin fuego? ¿Dónde se concentra ese efecto?

Es el dato que falta en el debate sobre prohibir el cambio de uso de suelo en terrenos quemados. En marzo de 2024 la Cámara rechazó esa prohibición de 30 años (62 votos a favor, 72 en contra) y el tema sigue abierto en el Senado.

> **Resultados: ver `HALLAZGOS.md`.** Análisis principal con la Colección 2 (Earth Engine, 19-10-2026): `02b_analisis_causal_col2.ipynb`, `figuras_col2/`, `resultados_col2/`. Replicación con la Colección 1: `02_analisis_causal.ipynb`, `figuras/`, `resultados/`.
>
> Colección 2: `extraccion_gee_col2.js` (pegar en el Code Editor de Earth Engine) → CSV en `datos/col2/` → notebook 02b (`COLECCION = 2`) → `python robustez.py col2` → `python figuras_extra.py col2` → `python figura_replicacion.py`.

## Archivos

| Archivo | Qué hace |
|---|---|
| `HALLAZGOS.md` | Resumen de resultados, validez y limitaciones de la corrida con datos reales. |
| `informe/` | Informe de postulación (`Informe_Premio_MapBiomas_Fuego_CambioUso.pdf/.docx`) y su generador (`build_informe.js`). |
| `figuras_extra.py`, `figura_replicacion.py` | Mapa de focos, conversión persistente y figura de replicación entre colecciones. |
| `extraccion_navegador.js` | **Extracción usada:** lee por ventanas los GeoTIFF públicos de MapBiomas (Cobertura Col. 1 y Fuego Col. 1) sin necesidad de cuenta. |
| `datos/` | Muestra extraída (`muestra_mapbiomas_col1.csv`, 204.182 píxeles), hectáreas quemadas por cohorte y metadatos. |
| `02_analisis_causal.ipynb` | Emparejamiento, estudio de eventos, cotas, heterogeneidad, hectáreas y figuras. Ejecutado con los datos reales (`FUENTE = "real"`, `COLECCION = 1`). |
| `asignar_regiones.py`, `datos/regiones_zona_estudio.geojson` | Región oficial de cada píxel (límites MapBiomas Chile, nivel político 2). |
| `robustez.py`, `prep_real.py` | Conversión persistente, destino de las conversiones transitorias, sensibilidad, placebo, región × cobertura. |
| `figuras/`, `resultados/` | Figuras y tablas de la corrida real. |
| `fuegocausal.py` | Módulo con todo el estimador (reutilizable y documentado). |
| `01_extraccion_gee.ipynb` | Alternativa en Earth Engine con la **Colección 2** (1999–2024); requiere cuenta de Earth Engine. |
| `simular.py`, `validacion_simulada/` | Paisaje sintético con efecto conocido y la validación del estimador. |

## Cómo correrlo

**Ruta usada (sin cuenta):** abre `https://storage.googleapis.com/mapbiomas-public/` en Chrome, pega `extraccion_navegador.js` en la consola y ejecuta `await correr()` (~5–10 min). Copia los 3 archivos descargados a `datos/`, abre el notebook 02 con `FUENTE = "real"`, `COLECCION = 1` y ejecuta todo. Luego corre `python robustez.py`.

**Ruta Colección 2 (Earth Engine):**

1. **Notebook 01:** pon tu ID de proyecto de Earth Engine en `PROYECTO_GEE` y ejecútalo en orden. Las celdas 3.1 y 3.2 verifican el acceso a los datos. Si 3.2 falla, la 3.3 imprime los comandos para ingerir los GeoTIFF de Fuego como assets propios.
2. Espera a que las tareas terminen (*Tasks*) y descarga los CSV de la carpeta de Drive `premio_mapbiomas_fuego` a `./datos/`.
3. **Notebook 02:** cambia `FUENTE = "real"` y ejecuta todo. Las figuras quedan en `figuras/` y las tablas en `resultados/`.

Dependencias: `earthengine-api` (y opcionalmente `geemap`) para el 01; `numpy pandas scikit-learn matplotlib` para el 02.

## Diseño metodológico

- **Unidad:** píxel de 30 m. **Tratamiento:** primer incendio detectado en el año *g*. El análisis principal usa las cohortes 2014–2021; las de 2022–2023 se analizan aparte, porque el filtro del producto Fuego se trunca al final de la serie y no las censura.
- **Elegibilidad:** el píxel está en el mismo grupo de cobertura (bosque, matorral, pastizal/estepa o silvicultura) en *g−2* y *g−1*.
- **Controles:** píxeles nunca quemados entre 2013 y 2025, del mismo grupo basal y la misma región. Se emparejan por puntaje de propensión 1:1 con reemplazo y caliper de 0,2 DE del logit.
- **Covariables (fijadas en 2012):** elevación, pendiente, orientación, distancias a caminos (GRIP4), zona urbana, agricultura y plantaciones, coordenadas e inestabilidad previa de la cobertura.
- **Estimando:** ATT_k, la diferencia en la probabilidad de estar en la clase de destino *k* años después del incendio. Los destinos son uso antrópico (agricultura, pastura e infraestructura), cada uno por separado, silvicultura y degradación de bosque.
- **Efecto resumen:** promedio de k = 1–3 solo con cohortes balanceadas (observables en los tres años). Robustez con k = 1–5.
- **Inferencia:** bootstrap por bloques espaciales de unos 10 km, ponderado por superficie.
- **Ponderación:** según las hectáreas quemadas por región y cohorte, para escalar el ATT a hectáreas atribuibles.

### El punto crítico: el filtro del producto Fuego

Según el ATBD y el repositorio `mapbiomas/chile-fire`, el filtro LULC borra la quema de todo píxel cuya cobertura es infraestructura, agricultura, pastura o agua durante 4 años consecutivos desde el año del incendio. Esto oculta justamente las conversiones inmediatas y estables al uso antrópico, el fenómeno que se quiere medir. Un análisis ingenuo lo subestima sin saberlo. Se corrige en dos pasos:

1. **Regla simétrica:** se excluye de tratados y controles todo píxel que el filtro habría borrado en *g*.
2. **Identificación parcial (cotas):**
   - La regla *conservadora* mantiene controles con conversión posterior, que pueden ser incendios ocultos. Da la cota inferior.
   - La regla *estricta* los descarta. Da la cota superior, deliberadamente amplia, porque trata toda conversión estable de los controles como incendio oculto.

En la simulación, el efecto verdadero (6,9 %) queda dentro de las cotas (6,2 %–10,1 %), mientras el contraste ingenuo marca 5,2 % (Fig. 6).

## Plan hasta la postulación (cierre: 29–30 oct 2026; meta: entregar el 28)

| Fecha | Tarea |
|---|---|
| Dom 18 – Lun 19 | Correr el notebook 01: verificar el acceso, lanzar las exportaciones y escribir al profesor revisor. |
| Mar 20 – Mié 21 | Correr el notebook 02 con los datos reales y revisar el balance y la sensibilidad (k vecinos, caliper). |
| Jue 22 – Sáb 24 | Redactar el informe: introducción, objetivos, metodología, resultados y discusión, como piden las bases. |
| Dom 25 | Mapa de cicatrices con el efecto por zona; resumen ejecutivo para política pública. |
| Lun 26 – Mar 27 | Revisión del profesor (carta de revisión → criterio "Validación" = 2); repo público en GitHub. |
| Mié 28 | Anexo I firmado, PDF final y postulación en el formulario. |

## Checklist de las bases

- [ ] Usa datos de MapBiomas Chile: Cobertura Col. 2 + Fuego Col. 1 (req. 1).
- [ ] Trabajo concluido con resultados verificables (req. 3).
- [ ] En español (req. 5).
- [ ] Código público en GitHub o anexado (req. 8).
- [ ] Cita según https://chile.mapbiomas.org/terminos-de-uso/ (req. 9).
- [ ] Anexo I firmado por todos los autores (req. 10).
- [ ] Postulado por el formulario oficial antes del cierre.

## Limitaciones a declarar

- Fuego parte en 2013, así que no hay historia de quemas anterior.
- La cobertura llega a 2024: las cohortes recientes tienen menos años de seguimiento.
- Con resultados absorbentes, los coeficientes pre-incendio son ~0 por construcción. La validez descansa en el balance, la estabilidad previa y la simulación.
- El bootstrap no re-empareja en cada réplica, una aproximación estándar.
- Los errores de clasificación de MapBiomas afectan a ambos grupos.
