# Hallazgos: ¿el fuego abre la puerta al cambio de uso del suelo?

**Respuesta corta: no en general; sí en el bosque nativo.**

| | Análisis principal | Replicación |
|---|---|---|
| Cobertura | MapBiomas Chile **Colección 2** (1999–2024), vía Earth Engine | **Colección 1** (2000–2022), GeoTIFF públicos |
| Fuego | MapBiomas Fuego Colección 1 (2013–2025) | MapBiomas Fuego Colección 1 (2013–2025) |
| Muestra | 251.680 píxeles, estratificada por región (Valparaíso a La Araucanía) | 204.182 píxeles en 172 ventanas |
| Quemados emparejados | 78.831 (cohortes 2014–2023), ~997.000 ha | 54.682 (cohortes 2014–2021), ~691.000 ha |
| Covariables | SRTM, red vial GRIP4, distancias a usos 2012, región oficial | Terrain Tiles, distancias a usos 2012, región oficial |

## Resultados principales (efecto promedio en los 5 años siguientes, en puntos porcentuales)

| Estimación | Colección 2 | Colección 1 |
|---|---|---|
| Uso antrópico, cota inferior | +0,25 (−0,02 – 0,52) | +0,90 (0,23 – 1,55) |
| Uso antrópico, cota superior | +0,98 (0,75 – 1,25) | +1,81 (1,35 – 2,35) |
| Comparación ingenua | +0,02 | +2,75 |
| Desde **bosque nativo** | **+2,4** (1,8 – 3,2) | +1,0 (0,3 – 1,6) |
| Desde plantación | +0,3 (0,1 – 0,5) | +1,6 (0,6 – 2,6) |
| Desde matorral | −1,1 (−1,4 – −0,7) | −0,4 (n. s.) |
| **Araucanía · bosque nativo** | **+5,4** (3,1 – 7,4) | **+4,9** (3,4 – 6,7) |
| Región de La Araucanía | +1,7 (0,7 – 2,7) | +6,0 (4,1 – 8,7) |
| Región del Biobío | +0,7 (0,1 – 1,2) | +1,9 (0,8 – 3,4) |
| Infraestructura | ≈ 0 (levemente negativo) | ≈ 0 (levemente negativo) |
| Degradación del bosque nativo (k = 2) | **+25,8** (22,5 – 29,5) | **+25,6** (21,2 – 29,1) |

## Qué es robusto (se replica con ambas colecciones)

1. **El efecto promedio sobre el cambio de uso es pequeño**: entre 0,25 y 1,8 de cada 100 ha quemadas, según la colección y la regla. Con la Colección 2, unas 2.500–9.800 ha en 2014–2023.
2. **No hay efecto sobre la infraestructura**: el fuego no acelera la urbanización densa.
3. **El bosque nativo quemado sí se convierte más**, sobre todo en **La Araucanía (~+5 pp)**. El efecto es persistente: +0,9 pp exigiendo uso agropecuario 3 años seguidos.
4. **El mayor impacto es la degradación del bosque nativo**: +26 pp a matorral o pastizal a los 2 años, y todavía +14–16 pp a los 7 años.
5. **Las plantaciones quemadas se cosechan y replantan**: caen y vuelven a su nivel en 6–7 años.

## Qué no es robusto, y por qué

- **El efecto desde plantaciones y el gran efecto regional de La Araucanía en la Colección 1** se deben en buena parte a la leyenda. En la Colección 1, cosecha y suelo desnudo se confunden con "mosaico de usos": la mitad de esos píxeles vuelve a plantación a los 4 años. En la Colección 2, que separa agricultura de pastura, el 63 % sigue en agricultura.
- **Las comparaciones simples tienen un sesgo cuyo signo depende del grupo de comparación.** Con controles cercanos a las cicatrices (Colección 1) exageran el efecto; con controles de toda la región (Colección 2) lo anulan. Los porcentajes descriptivos de "terreno quemado que cambió de uso" no sirven como evidencia.

## Validez (Colección 2)

- **Balance:** todas las diferencias estandarizadas quedan bajo 0,1 después del emparejamiento (máximo 0,092).
- **Tendencias previas:** son pequeñas (−0,25 a −0,11 pp), y su signo sugiere que la cota inferior está sesgada hacia abajo.
- **Robustez:** el efecto es estable a 1, 3 o 5 vecinos y a calipers de 0,05 a 0,2 (0,21–0,25 pp).
- **Filtro del producto Fuego:** se replicó exactamente, con las clases de la Colección 2.

## Lectura para política pública

Una prohibición general de cambio de uso en todo terreno quemado apuntaría a un efecto que en promedio es pequeño. La evidencia respalda dos cosas: **restringir el cambio de uso en bosque nativo quemado** (prioridad en La Araucanía, Biobío, Ñuble y Valparaíso) y **financiar la restauración del bosque nativo quemado**, que es donde está el daño mayor.

## Limitaciones

- Las cohortes 2022–2023 tienen poco seguimiento, y el incendio de Viña del Mar (2024) aún no es evaluable.
- El efecto se presenta como cotas por la censura del producto Fuego.
- A 30 m no se ven parcelaciones de baja densidad.
- Puede quedar confusión no observada (tenencia de la tierra, valor del suelo, planes reguladores).
