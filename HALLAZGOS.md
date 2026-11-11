# Hallazgos: ¿el fuego abre la puerta al cambio de uso del suelo?

**Respuesta corta: no en general; sí en el bosque nativo.**

| | Análisis principal | Replicación |
|---|---|---|
| Cobertura | MapBiomas Chile **Colección 2** (1999–2024), vía Earth Engine | **Colección 1** (2000–2022), GeoTIFF públicos |
| Fuego | MapBiomas Fuego Colección 1 (2013–2025) | MapBiomas Fuego Colección 1 (2013–2025) |
| Muestra | 251.680 píxeles, estratificada por región (Valparaíso a La Araucanía) | 204.182 píxeles en 172 ventanas |
| Quemados emparejados | 57.167 (cohortes 2014–2021), 709.891 ha | 54.682 (cohortes 2014–2021), 606.729 ha |
| Covariables | SRTM, red vial GRIP4, distancias a usos 2012, región oficial | Terrain Tiles, distancias a usos 2012, región oficial |

## Cómo se resume el efecto

- **Efecto resumen:** promedio de k = 1 a 3 solo con **cohortes balanceadas**, es decir, observables en los tres años (Col. 2: 2014–2021; Col. 1: 2014–2019). Coincide con el promedio de ATT₁–ATT₃ del estudio de eventos. Como robustez se calcula k = 1–5 (Col. 2: 2014–2019; Col. 1: 2014–2017).
- **Cohortes 2022–2023 (Col. 2):** quedan fuera del análisis principal. La ventana de 4 años del filtro del producto Fuego se trunca al final de la serie, así que el filtro no borra sus conversiones inmediatas y esas cohortes no son comparables con las anteriores. Se analizan aparte.
- Todas las estimaciones, incluida la conversión persistente, se ponderan por las hectáreas quemadas que representa cada píxel.

## Resultados principales (k = 1–3, cohortes balanceadas, puntos porcentuales)

| Estimación | Colección 2 | Colección 1 |
|---|---|---|
| Uso antrópico, cota inferior | −0,25 (−0,42 – −0,07) | +1,20 (0,50 – 1,82) |
| Uso antrópico, cota superior | +0,50 (0,36 – 0,67) | +2,08 (1,44 – 2,66) |
| Hectáreas atribuibles | −1.749 a +3.523 ha | 7.274 a 12.612 ha |
| Comparación ingenua | −0,11 | +3,09 |
| Cota inferior, k = 1–5 | −0,47 (−0,64 – −0,29) | +0,82 (0,07 – 1,52) |
| Desde **bosque nativo** | **+0,94** (0,44 – 1,78) | **+1,36** (0,71 – 2,15) |
| Desde plantación | −0,02 (n. s.) | +1,93 (0,73 – 3,23) |
| Desde matorral (atribuible al lugar, ver placebo) | −1,23 (−1,55 – −0,93) | −0,12 (n. s.) |
| Valparaíso · bosque nativo | **+3,2** (1,3 – 6,3) | +1,8 (0,4 – 3,1) |
| Araucanía · bosque nativo | **+1,3** (0,2 – 2,8) | **+6,3** (3,5 – 10,0) |
| Región de La Araucanía | +0,18 (n. s.) | +9,3 (6,3 – 12,1) |
| Región del Biobío | −0,15 (n. s.) | +2,2 (0,9 – 3,7) |
| Infraestructura | ≈ 0 (levemente negativo) | ≈ 0 (levemente negativo) |
| Degradación del bosque nativo (k = 2) | **+26,7** (23,2 – 30,0) | **+25,6** (21,2 – 29,1) |
| Degradación del bosque nativo (k = 7) | +14,0 | +15,9 |

**Cohortes 2022–2023 sin censura (Col. 2, k = 1):** +2,1 pp (2022) y +1,4 pp (2023); desde **bosque nativo +6,4 pp (4,6 – 8,6)**, plantación +0,7, matorral +0,9 (n. s.).

## Qué es robusto (se replica con ambas colecciones)

1. **No hay efecto sobre la infraestructura**: el fuego no acelera la urbanización densa.
2. **El bosque nativo quemado sí se convierte más** (+0,9 / +1,4 pp), con focos en **Valparaíso y La Araucanía** en ambas colecciones. En la Col. 2 es persistente (+0,48 pp exigiendo uso antrópico 3 años seguidos desde k = 2). Sin la censura del filtro (cohortes 2022–2023) el efecto inmediato llega a +6,4 pp: las cifras de las cohortes censuradas son conservadoras.
3. **El mayor impacto es la degradación del bosque nativo**: +26–27 pp a matorral o pastizal a los 2 años, y todavía +14–16 pp a los 7.
4. **Las plantaciones quemadas se cosechan y replantan**: caen y vuelven a su nivel en 6–7 años.

## Qué no es robusto, y por qué

- **El efecto promedio.** Con la Col. 2 es nulo (cotas −0,25 a +0,50 pp); con la Col. 1 es positivo (+1,2 a +2,1 pp), pero viene de plantaciones y de La Araucanía. Eso se debe a la leyenda: en la Col. 1, cosecha y suelo desnudo se confunden con "mosaico de usos" (el 49 % de esos píxeles vuelve a plantación a los 4 años). En la Col. 2, que separa agricultura de pastura, el 63 % sigue en agricultura y el efecto desde plantaciones desaparece.
- **El efecto regional de La Araucanía** (+9,3 pp en Col. 1, n. s. en Col. 2). Lo que se repite es el foco en su **bosque nativo**.
- **La comparación ingenua** exagera con la Col. 1 (3,09 pp, sobre ambas cotas). Con la Col. 2 cae dentro de las cotas (−0,11), pero mezcla efectos de signo opuesto según la cobertura y no muestra dónde está la conversión.

## Validez (Colección 2)

- **Balance:** todas las diferencias estandarizadas quedan bajo 0,1 después del emparejamiento (máximo 0,099; antes, hasta 0,54).
- **Tendencias previas:** son pequeñas (media −0,22 pp en k = −6 a −3), y su signo sugiere que la cota inferior está sesgada hacia abajo.
- **Robustez:** el efecto es estable a 1, 3 o 5 vecinos y a calipers de 0,05 a 0,2 (−0,25 a −0,28 pp).
- **Placebo espacial:** píxeles nunca quemados a menos de 1 km de una quema, comparados con otros a más de 5 km. En bosque nativo es nulo (+0,08 pp; −0,43 – 0,62), así que el efecto del bosque no se debe al lugar. En matorral es −1,34 pp (−1,98 – −0,73), igual que el efecto estimado (−1,23): esa diferencia negativa es del lugar, no del fuego. En el promedio, −0,86 pp. Con la Col. 1: promedio +0,47 (n. s.), bosque +0,27 (n. s.), plantación +1,74.
- **Filtro del producto Fuego:** se replicó exactamente con las clases de la Col. 2. La cota superior es deliberadamente amplia, porque trata como incendio oculto toda conversión estable de los controles.

## Lectura para política pública

Una prohibición general de cambio de uso en todo terreno quemado apuntaría a un efecto que en promedio es nulo. La evidencia respalda dos cosas:

- **Restringir el cambio de uso en bosque nativo quemado**, con prioridad en Valparaíso y La Araucanía y fiscalización en el primer año.
- **Financiar la restauración del bosque nativo quemado**, que es donde está el daño mayor.

## Limitaciones

- Las cohortes 2022–2023 tienen uno o dos años de seguimiento, y el incendio de Viña del Mar (2024) aún no es evaluable.
- El efecto se presenta como cotas por la censura del producto Fuego.
- A 30 m no se ven parcelaciones de baja densidad.
- Puede quedar confusión no observada (tenencia de la tierra, valor del suelo, planes reguladores).
