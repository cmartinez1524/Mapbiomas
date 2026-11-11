// Genera el informe del Premio MapBiomas Chile en .docx
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, Footer, PageNumber, LevelFormat, PageBreak, TableOfContents,
} = require("docx");

const FIG = (f) => path.join(__dirname, "..", f);
const FONT = "Arial";
const AZUL = "1F3A5F";

// ---------- mini-markup: **negrita**, *cursiva*, _sub_ ----------
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|~[^~]+~|\^[^^]+\^)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else if (t.startsWith("*")) out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    else if (t.startsWith("~")) out.push(new TextRun({ text: t.slice(1, -1), subScript: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), superScript: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const P = (t, o = {}) => new Paragraph({ children: runs(t, o.run || {}), alignment: o.align ?? AlignmentType.JUSTIFIED,
  spacing: { after: o.after ?? 120, line: 288 }, indent: o.indent, keepNext: o.keepNext });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], spacing: { before: 280, after: 140 } });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)], spacing: { before: 200, after: 100 } });
const BUL = (t) => new Paragraph({ numbering: { reference: "vinetas", level: 0 }, children: runs(t), alignment: AlignmentType.JUSTIFIED, spacing: { after: 80, line: 276 } });
const NUM = (t, ref = "numeros") => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), alignment: AlignmentType.JUSTIFIED, spacing: { after: 80, line: 276 } });
const EQ = (t) => new Paragraph({ children: runs(t, { italics: false }), alignment: AlignmentType.CENTER, spacing: { before: 80, after: 120 } });
const REF = (t) => new Paragraph({ children: runs(t, { size: 19 }), alignment: AlignmentType.LEFT, indent: { left: 360, hanging: 360 }, spacing: { after: 70, line: 264 } });

function pngSize(file) { const b = fs.readFileSync(file); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }
let nFig = 0, nTab = 0;
function figura(file, caption, anchoCm = 16) {
  nFig++;
  const [w, h] = pngSize(FIG(file));
  const wpx = anchoCm / 2.54 * 96, hpx = wpx * h / w;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
      children: [new ImageRun({ type: "png", data: fs.readFileSync(FIG(file)), transformation: { width: wpx, height: hpx } })] }),
    new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 200, line: 252 },
      children: [new TextRun({ text: `Figura ${nFig}. `, bold: true, size: 18 }), ...runs(caption, { size: 18 })] }),
  ];
}
const borde = { style: BorderStyle.SINGLE, size: 4, color: "B7C3D0" };
function tabla(caption, cab, filas, anchos, nota) {
  nTab++;
  const total = anchos.reduce((a, b) => a + b, 0);
  const celda = (t, i, header, shade) => new TableCell({
    width: { size: anchos[i], type: WidthType.DXA },
    borders: { top: borde, bottom: borde, left: borde, right: borde },
    shading: header ? { fill: "DCE6F0", type: ShadingType.CLEAR, color: "auto" } : (shade ? { fill: "F5F8FB", type: ShadingType.CLEAR, color: "auto" } : undefined),
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [new Paragraph({ alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: runs(t, { size: 18, bold: header }) })],
  });
  const out = [
    new Paragraph({ keepNext: true, spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: `Tabla ${nTab}. `, bold: true, size: 18 }), ...runs(caption, { size: 18 })] }),
    new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: anchos,
      rows: [new TableRow({ tableHeader: true, children: cab.map((t, i) => celda(t, i, true)) }),
        ...filas.map((f, j) => new TableRow({ children: f.map((t, i) => celda(t, i, false, j % 2 === 1)) }))] }),
  ];
  if (nota) out.push(new Paragraph({ spacing: { before: 60, after: 200 }, children: runs(nota, { size: 16, color: "555555" }) }));
  else out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  return out;
}

// ============================ CONTENIDO ============================
const portada = [
  new Paragraph({ spacing: { before: 1400, after: 200 }, alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: "PREMIO MAPBIOMAS CHILE · 1.ª EDICIÓN", bold: true, color: "8A5A00", size: 20 })] }),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "Categoría 1 — Análisis Técnico o Científico", color: "555555", size: 20 })] }),
  new Paragraph({ spacing: { before: 400, after: 300 }, children: [new TextRun({ text: "¿Abre el fuego la puerta al cambio de uso del suelo?", bold: true, size: 52, color: AZUL })] }),
  new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: "Evaluación causal a nivel de píxel con MapBiomas Chile (Cobertura y Uso del Suelo, Colecciones 1 y 2) y MapBiomas Fuego (Colección 1) en el centro-sur de Chile, 1999–2024", size: 26, color: "333333" })] }),
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Cristóbal Martínez Arochas", bold: true, size: 24 })] }),
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Ingeniería Civil en Ciencia de Datos, Pontificia Universidad Católica de Valparaíso", size: 21 })] }),
  new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "c.martinezz1524@gmail.com", size: 21 })] }),
  new Paragraph({ spacing: { before: 900 }, children: [new TextRun({ text: "Valparaíso, octubre de 2026", size: 21, color: "555555" })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

const resumen = [
  H1("Resumen"),
  P("En el debate sobre la Ley de Incendios se ha sostenido que el fuego funciona como un mecanismo para habilitar terrenos, al facilitar su conversión posterior a usos agrícolas, ganaderos o inmobiliarios. Esa tesis se ha discutido con cifras descriptivas que no separan el efecto del incendio de la transformación que esos terrenos habrían tenido igual. Este trabajo estima ese efecto causal combinando, a nivel de píxel de 30 m, las trayectorias anuales de **MapBiomas Chile Cobertura y Uso del Suelo** con las cicatrices de **MapBiomas Fuego (Colección 1)** entre Valparaíso y La Araucanía. El análisis principal usa la **Colección 2** (1999–2024; 251.680 píxeles) y se replica de forma independiente con la **Colección 1** (2000–2022; 204.182 píxeles)."),
  P("El diseño es cuasiexperimental. Cada píxel quemado se empareja por puntaje de propensión con píxeles nunca quemados de la misma cobertura previa, la misma región y condiciones equivalentes de terreno y accesibilidad (incluida la red vial), y se estima un estudio de eventos de diferencias en diferencias apilado por cohorte de incendio. El trabajo identifica además un sesgo propio de los datos: el filtro del producto Fuego elimina las quemas en píxeles que pasan de inmediato y de forma estable a uso agropecuario o urbano. Ese sesgo se trata con una regla de exclusión simétrica y se reportan cotas del efecto; las cohortes 2022–2023, que el filtro aún no alcanza a censurar, se analizan aparte como ventana sin censura."),
  P("**Resultados.** En promedio, el fuego **no** abre la puerta al cambio de uso: con la Colección 2, el efecto sobre el paso a uso antrópico en los tres años siguientes queda acotado entre **−0,25 y +0,50 pp** (cohortes 2014–2021), es decir, entre −1.700 y +3.500 ha sobre ~710.000 ha quemadas. **No hay ningún efecto sobre la expansión de infraestructura.** La puerta sí se abre en el **bosque nativo**: el bosque nativo quemado tiene **+0,9 pp** más de probabilidad de pasar a uso antrópico (+1,4 pp con la Colección 1), con un efecto persistente y focos en Valparaíso y La Araucanía que se repiten en ambas colecciones. En las cohortes recientes, libres de la censura del filtro, el efecto en el bosque nativo llega a **+6,4 pp** al año siguiente del incendio, lo que indica que las cifras de las cohortes censuradas son conservadoras. El impacto dominante del fuego es la **degradación del bosque nativo**: +26–27 pp de probabilidad de quedar como matorral o pastizal a los dos años, y todavía +14–16 pp a los siete, casi idéntico en ambas colecciones. La comparación simple entre quemados y no quemados exagera el efecto con una colección y, con la otra, oculta que el promedio mezcla efectos de signo opuesto. La evidencia respalda restricciones focalizadas en el bosque nativo quemado y una política de restauración, antes que una prohibición general del cambio de uso."),
  P("**Palabras clave:** incendios forestales; cambio de uso del suelo; bosque nativo; inferencia causal; emparejamiento; diferencias en diferencias; MapBiomas; Chile.", { after: 200 }),
  new Paragraph({ children: [new PageBreak()] }),
];

const intro = [
  H1("1. Introducción"),
  P("Chile central y centro-sur concentra la mayor parte de la superficie quemada del país y ha vivido en la última década incendios de magnitud sin precedentes, como la \"tormenta de fuego\" de 2017 y los eventos de 2023 y 2024 (Bowman et al., 2019; Úbeda y Sarricolea, 2016). Estos incendios ocurren sobre un paisaje muy transformado: la expansión de plantaciones exóticas y la pérdida de bosque nativo reconfiguraron el territorio desde la segunda mitad del siglo XX (Echeverría et al., 2006; Heilmayr et al., 2016). La homogeneización del paisaje y la megasequía se han asociado además a un régimen de fuego más activo (McWethy et al., 2018)."),
  P("En la discusión legislativa se instaló una hipótesis complementaria: el fuego no sería solo consecuencia de la transformación del territorio, sino también un medio para inducirla. Según esta tesis, un incendio \"limpia\" vegetación protegida y abarata su reconversión posterior a usos agrícolas, ganaderos o inmobiliarios. Por eso se ha propuesto prohibir el cambio de uso de suelo en terrenos siniestrados durante 30 años, siguiendo la reforma de 2006 de la Ley de Montes española. En marzo de 2024, tras el incendio de la Región de Valparaíso, la Cámara de Diputados aprobó el proyecto de Ley de Incendios (Boletín N.° 16.335-14) pero rechazó esa prohibición por 62 votos a favor, 72 en contra y 11 abstenciones, y el tema sigue abierto en el Senado."),
  P("La posición contraria sostiene que los terrenos que cambian de uso después de quemarse lo habrían hecho igual, porque están cerca de ciudades, caminos y frentes agrícolas que presionan su conversión. Ambas posiciones se han discutido con cifras descriptivas del tipo \"un X % de lo quemado cambió de cobertura\", que no pueden separarlas. El fuego no cae al azar, y comparar quemados con no quemados mezcla el efecto del fuego con diferencias previas entre ambos grupos, un sesgo de selección bien documentado en la evaluación de impacto ambiental (Andam et al., 2008; Ferraro y Hanauer, 2014; Butsic et al., 2017)."),
  P("Una evaluación causal de alcance multirregional requiere trayectorias anuales de cobertura y cicatrices anuales de fuego armonizadas en la misma grilla. **MapBiomas Chile** reúne hoy ambos insumos con acceso abierto: las Colecciones 1 y 2 de cobertura y uso del suelo y el producto MapBiomas Fuego (Colección 1), publicado en agosto de 2026 sobre la misma grilla Landsat de 30 m. Este trabajo es, hasta donde sabemos, el primero en cruzarlos para estimar el efecto causal del fuego sobre el cambio de uso del suelo en Chile."),
  P("El trabajo hace cuatro aportes: (i) una estimación causal, con incertidumbre cuantificada, del efecto del fuego sobre cada destino del suelo; (ii) una replicación independiente con dos colecciones de MapBiomas, que separa los hallazgos robustos de los que dependen del producto; (iii) la identificación y el tratamiento de un sesgo de censura que el filtro del producto Fuego introduce en este tipo de análisis, relevante para cualquier usuario de esos datos; y (iv) un mapa de dónde y sobre qué coberturas el fuego sí abre la puerta a la conversión, útil para focalizar la política pública."),
];

const objetivos = [
  H1("2. Objetivos e hipótesis"),
  P("**Objetivo general.** Estimar el efecto causal de los incendios ocurridos entre 2014 y 2023 sobre la probabilidad de cambio de uso del suelo en el centro-sur de Chile, con datos de MapBiomas Chile."),
  P("**Objetivos específicos:**", { after: 60 }),
  NUM("Construir, a partir de MapBiomas Cobertura y MapBiomas Fuego, un panel de trayectorias anuales a nivel de píxel para áreas quemadas y no quemadas comparables."),
  NUM("Estimar el efecto del fuego (efecto medio sobre los tratados, ATT) sobre el paso a uso antrópico, infraestructura, agricultura, pastura y silvicultura, y sobre la degradación del bosque, para cada año posterior al incendio."),
  NUM("Cuantificar y tratar el sesgo que introduce el filtro de cobertura del producto MapBiomas Fuego."),
  NUM("Identificar en qué coberturas, regiones y distancias a zonas urbanas se concentra el efecto, traducirlo a hectáreas y verificar su robustez con una segunda colección."),
  P("**Hipótesis.** H1: el fuego aumenta la probabilidad de cambio a uso antrópico por sobre la tendencia del territorio (ATT > 0). H2: las comparaciones descriptivas entre quemados y no quemados no reflejan el efecto causal. H3: el efecto es heterogéneo según la cobertura previa y el territorio.", { after: 160 }),
];

const datos = [
  H1("3. Datos y área de estudio"),
  H2("3.1 Productos MapBiomas Chile"),
  P("**Cobertura y Uso del Suelo, Colección 2 (análisis principal; MapBiomas Chile, 2026a).** Mapas anuales a 30 m entre 1999 y 2024, derivados de Landsat, con 19 clases. Las relevantes aquí son:"),
  BUL("bosque (3; primario 59, secundario 60, achaparrado 67), matorral (66), pastizal (12) y estepa (63);"),
  BUL("silvicultura (9), agricultura (18) y pastura (15);"),
  BUL("infraestructura (24)."),
  P("Se accedió a ella en Google Earth Engine (proyecto de investigación no comercial)."),
  P("**Cobertura y Uso del Suelo, Colección 1 (replicación; MapBiomas Chile, 2026b).** Mapas anuales a 30 m entre 2000 y 2022, descargados como GeoTIFF públicos. En esta colección la agricultura y la pastura forman una sola clase, el mosaico de usos (21)."),
  P("**MapBiomas Fuego, Colección 1 (MapBiomas Chile, 2026c).** Área quemada anual a 30 m (2013–2025) sobre la misma grilla Landsat. El análisis toma el año del primer incendio y el número de incendios por píxel."),
  H2("3.2 Área de estudio y diseño muestral"),
  P("El área va de la Región de Valparaíso a La Araucanía. La población elegible son los píxeles con cobertura natural o silvícola en 2012: bosque, matorral, pastizal o estepa, y silvicultura."),
  P("**Colección 2.** Se hizo un muestreo estratificado por región sobre los límites oficiales de MapBiomas Chile (nivel político 2). En cada una de las 7 regiones se tomaron al azar 12.000 píxeles cuyo primer incendio ocurrió entre 2014 y 2023 (tratados) y 24.000 nunca quemados entre 2013 y 2025 (controles potenciales). La muestra final, sin duplicados de borde, es de 251.680 píxeles: 83.944 quemados y 167.736 controles. Cada píxel quemado lleva un peso igual a las hectáreas quemadas elegibles que representa en su región y cohorte, calculadas en Earth Engine. Con ese peso los resultados se escalan a hectáreas."),
  P("**Colección 1.** Para la replicación se usó otro diseño: 172 ventanas de unos 30 km con incendios entre 2014 y 2021, con hasta 400 tratados y 800 controles por ventana. La muestra son 204.182 píxeles: 66.582 quemados y 137.600 controles. Los controles son, por construcción, más cercanos a las cicatrices que en la Colección 2."),
  H2("3.3 Covariables"),
  P("Las covariables previas al incendio se fijaron en 2012, antes de toda cohorte, para no controlar por variables afectadas por el propio fuego:"),
  BUL("elevación, pendiente y orientación (*northness* y *eastness*), según SRTM (30 m) en la Colección 2 y AWS Terrain Tiles (~60–75 m) en la Colección 1;"),
  BUL("distancia a caminos (GRIP4), solo en la Colección 2;"),
  BUL("distancias a infraestructura, agricultura y pastura, y plantaciones según la cobertura MapBiomas 2012;"),
  BUL("latitud, longitud y región administrativa oficial;"),
  BUL("inestabilidad previa de la cobertura: número de cambios de clase en los ocho años anteriores al incendio."),
  ...tabla("Fuentes de datos.", ["Insumo", "Fuente", "Período / resolución", "Uso"], [
    ["Cobertura y uso del suelo", "MapBiomas Chile, Colección 2", "1999–2024 · 30 m", "Análisis principal"],
    ["Cobertura y uso del suelo", "MapBiomas Chile, Colección 1", "2000–2022 · 30 m", "Replicación"],
    ["Área quemada anual", "MapBiomas Fuego, Colección 1", "2013–2025 · 30 m", "Tratamiento (año del primer incendio)"],
    ["Límites regionales", "MapBiomas Chile, nivel político 2", "Vectorial", "Estratos, emparejamiento exacto, heterogeneidad"],
    ["Elevación", "SRTM / AWS Terrain Tiles", "30 m / ~60–75 m", "Elevación, pendiente, orientación"],
    ["Red vial", "GRIP4 (Meijer et al., 2018)", "Vectorial", "Distancia a caminos (Col. 2)"],
  ], [2200, 2600, 1900, 2800]),
];

const metodo = [
  H1("4. Metodología"),
  H2("4.1 Problema de identificación"),
  P("Sea *Y*~i,t~ = 1 si el píxel *i* está en la clase de destino en el año *t*. Para un píxel quemado por primera vez en el año *g* (su cohorte), el parámetro de interés es el efecto medio del tratamiento sobre los tratados *k* años después del incendio:"),
  EQ("ATT~k~ = E[ Y~i,g+k~(1) − Y~i,g+k~(0) | quemado en g ]"),
  P("*Y(0)*, la cobertura que el píxel habría tenido sin fuego, no se observa. Se aproxima con píxeles nunca quemados que eran comparables justo antes del incendio. El supuesto de identificación es que, condicional a la cobertura en *g−1* y *g−2*, la región y las covariables previas, la evolución esperada sin fuego es la misma en quemados y controles."),
  H2("4.2 Diseño apilado por cohorte y emparejamiento"),
  P("Para cada combinación de cohorte *g* y grupo de cobertura previa (bosque, matorral, pastizal o estepa, silvicultura) se construyó un experimento:"),
  BUL("**tratados:** primer incendio en *g*, con el mismo grupo de cobertura en *g−2* y *g−1*;"),
  BUL("**controles:** nunca quemados entre 2013 y 2025, con el mismo grupo en *g−2* y *g−1*."),
  P("Dentro de cada experimento se estimó un puntaje de propensión (regresión logística sobre las covariables estandarizadas y efectos fijos de región; Rosenbaum y Rubin, 1983). Cada tratado se emparejó con su vecino más cercano con reposición, de forma exacta por región y con un caliper de 0,2 desviaciones estándar del logit (Stuart, 2010; Austin, 2011). Apilar experimentos por cohorte (Cengiz et al., 2019) evita los sesgos de las regresiones de efectos fijos con adopción escalonada (Goodman-Bacon, 2021; Callaway y Sant'Anna, 2021)."),
  H2("4.3 Estimación"),
  P("Para cada tratado y cada año relativo *k* se calculó la diferencia entre su resultado y el promedio ponderado de sus controles, normalizada respecto de *k* = −1:"),
  EQ("d~ik~ = (Y~i,g+k~ − Y~i,g−1~) − Σ~j~ w~ij~ (Y~j,g+k~ − Y~j,g−1~),   ATT~k~ = promedio de d~ik~ sobre los tratados"),
  P("Todos los promedios ponderan cada tratado por las hectáreas quemadas que representa. Los coeficientes con *k* < −1 funcionan como prueba de tendencias previas. Los resultados estimados fueron:"),
  BUL("uso antrópico (agricultura, pastura e infraestructura; en la Colección 1, mosaico e infraestructura), que es el resultado principal;"),
  BUL("cada uno de esos destinos por separado y silvicultura;"),
  BUL("degradación a matorral o pastizal, evaluada solo desde bosque."),
  P("**Efecto resumen con cohortes balanceadas.** El efecto resumen es el promedio de *d*~ik~ entre *k* = 1 y 3, calculado **solo con las cohortes observables en los tres años**: 2014–2021 en la Colección 2 y 2014–2019 en la Colección 1. Como el panel es desbalanceado, promediar sin esta restricción haría que las cohortes recientes aporten solo sus primeros años y que el resumen no corresponda a ningún promedio de la curva del estudio de eventos. Con cohortes balanceadas, el resumen coincide con el promedio de ATT~1~ a ATT~3~ de la Figura 2. Como robustez se reporta el promedio de *k* = 1 a 5 con las cohortes que tienen cinco años de seguimiento."),
  H2("4.4 Sesgo de censura del producto Fuego"),
  P("El producto MapBiomas Fuego aplica un filtro posterior a la clasificación, construido con la Colección 2 de cobertura. Descarta la quema de un píxel cuya cobertura es infraestructura, agricultura, pastura o agua durante cuatro años consecutivos desde el año del incendio, y descarta siempre roca, arena, salar, hielo y suelo sin vegetación. El criterio es razonable para mapear el fuego, pero tiene una consecuencia directa para esta pregunta: **las conversiones inmediatas y estables a uso antrópico, justamente las que se quiere medir, desaparecen como incendios.** Un análisis directo las contaría como no quemadas, contaminando los controles."),
  P("Con la Colección 2 el filtro se replicó exactamente, y con la Colección 1 mediante las clases equivalentes. Luego se aplicó una **regla de exclusión simétrica**: se excluye de tratados y controles todo píxel que el filtro habría borrado en el año *g*. Así, el efecto que se estima para las cohortes censuradas excluye por construcción las conversiones inmediatas y estables, por lo que es conservador. Como tampoco se puede saber qué controles con conversión posterior son incendios ocultos, el efecto se acota:"),
  BUL("**Regla conservadora (cota inferior):** mantiene todos los controles."),
  BUL("**Regla estricta (cota superior):** descarta los controles que el filtro habría borrado entre *g+1* y *g+5*. Es una cota deliberadamente amplia: atribuye a posibles incendios ocultos *toda* conversión estable de los controles en esos años, incluidas las habilitaciones sin fuego, y no aplica la misma exclusión a los tratados. En la simulación del Anexo A sobreestima el efecto verdadero (10,1 frente a 6,9 pp), como corresponde a una cota superior."),
  P("**Truncamiento al final de la serie.** La ventana de cuatro años del filtro necesita cobertura hasta *g*+3. Para los incendios de 2022 y 2023 esa ventana se trunca (la Colección 2 termina en 2024) y, en la práctica, el filtro no borra ningún píxel elegible de esas cohortes. Por eso las cohortes 2022–2023 **no son comparables** con las de 2014–2021: en ellas sí se observan las conversiones inmediatas. Se excluyen del análisis principal y se analizan aparte (sección 5.6) como una ventana, de corto plazo, al efecto sin censura."),
  H2("4.5 Inferencia, robustez y validación"),
  P("Los intervalos de confianza al 95 % se obtuvieron con bootstrap por bloques espaciales de ~10 km, ponderado por superficie, que captura la autocorrelación espacial de píxeles vecinos dentro de una misma cicatriz. Los análisis de robustez fueron siete:"),
  BUL("conversión persistente (uso antrópico durante tres años consecutivos);"),
  BUL("sensibilidad al número de vecinos (1, 3 y 5) y al caliper (0,05–0,2);"),
  BUL("horizonte más largo (*k* = 1–5, cohortes con cinco años de seguimiento);"),
  BUL("tendencias previas al incendio;"),
  BUL("placebo espacial: se repite todo el procedimiento tratando como «quemados» a píxeles nunca quemados situados a menos de 1 km de una quema, frente a controles a más de 5 km de cualquier quema; si los lugares propensos al fuego se convirtieran más por razones ajenas al fuego, este placebo sería positivo;"),
  BUL("heterogeneidad por cobertura, región y distancia a zona urbana;"),
  BUL("replicación completa con la Colección 1."),
  P("Antes de usar los datos reales, el estimador se validó sobre un paisaje simulado con efecto conocido (Anexo A)."),
];

const resultados = [
  H1("5. Resultados"),
  P("Los resultados de esta sección corresponden a la Colección 2, cohortes 2014–2021. La sección 5.6 presenta las cohortes 2022–2023 y la 5.7 compara con la Colección 1."),
  H2("5.1 Comparabilidad de los grupos"),
  P("Se emparejaron 57.167 de los 57.177 píxeles quemados elegibles (99,98 %), que representan 709.891 ha quemadas. Antes del emparejamiento, los quemados diferían de los no quemados en latitud, longitud, elevación y distancias a plantaciones, ciudades y agricultura, con diferencias estandarizadas de hasta 0,54. Después del emparejamiento, todas quedan bajo el umbral convencional de 0,1 (máximo 0,099; Figura 1)."),
  ...figura("figuras_col2/fig1_balance.png", "Balance de covariables previas al incendio (Colección 2). Diferencia de medias estandarizada absoluta (promedio ponderado entre experimentos) antes y después del emparejamiento. Línea discontinua: umbral 0,1.", 13),
  H2("5.2 Efecto promedio sobre el cambio a uso antrópico"),
  P("La Figura 2 muestra el estudio de eventos. Antes del incendio los coeficientes son pequeños pero negativos (entre −0,34 y −0,10 pp): los controles tenían algo más de uso antrópico en el pasado (campos abandonados que se revegetaron), lo que, si acaso, sesga la cota inferior hacia abajo. El año del incendio la probabilidad de uso antrópico sube +0,37 pp (IC 95 %: 0,19–0,56). Desde ahí las dos cotas se separan: con la regla estricta el efecto crece hasta cerca de +1 pp hacia el cuarto y quinto año, y con la conservadora se vuelve negativo desde el segundo año (−0,30 pp en *k* = 2 y −0,68 pp en *k* = 5)."),
  ...figura("figuras_col2/fig2_event_study_principal.png", "Efecto del fuego (ATT~k~) sobre la probabilidad de uso antrópico (agricultura, pastura e infraestructura) según los años desde el incendio (Colección 2, cohortes 2014–2021). Bandas: IC 95 % por bootstrap de bloques espaciales. Las dos curvas son las cotas inferior y superior frente al sesgo de censura del producto Fuego.", 15),
  ...tabla("Efecto resumen del fuego sobre el cambio a uso antrópico (promedio de k = 1 a 3, cohortes balanceadas), por colección.", ["Estimador", "Colección 2 (2014–2021)", "Colección 1 (2014–2019)"], [
    ["Emparejado, regla conservadora (cota inferior)", "**−0,25** (−0,42 – −0,07)", "+1,20 (0,50 – 1,82)"],
    ["Emparejado, regla estricta (cota superior)", "**+0,50** (0,36 – 0,67)", "+2,08 (1,44 – 2,66)"],
    ["Ingenuo: quemados vs. no quemados del mismo grupo", "−0,11", "+3,09"],
    ["Hectáreas atribuibles (cota inferior – superior)", "−1.749 – 3.523 ha", "7.274 – 12.612 ha"],
  ], [4200, 2400, 2400], "Efectos en puntos porcentuales; entre paréntesis, IC 95 %. Promedio ponderado por superficie de las diferencias post-incendio en k = 1, 2 y 3, solo con cohortes observables en los tres años; coincide con el promedio de ATT~1~–ATT~3~ de la Figura 2. El estimador ingenuo no empareja ni aplica la regla simétrica. Superficie quemada representada: 709.891 ha (Col. 2) y 606.729 ha (Col. 1)."),
  P("En promedio, **el fuego no aumenta el cambio a uso antrópico**: el efecto queda acotado entre −0,25 y +0,50 de cada 100 hectáreas quemadas, es decir, entre −1.700 y +3.500 ha sobre las ~710.000 ha quemadas que representa la muestra emparejada. Con un horizonte de cinco años (cohortes 2014–2019) la cota inferior es −0,47 pp (−0,64 – −0,29). H1 no se confirma en promedio. Como se verá, el promedio esconde un efecto positivo y claro en el bosque nativo, compensado por efectos negativos en el matorral."),
  P("La Tabla 2 muestra también por qué la comparación ingenua no sirve. Con la Colección 1, cuyos controles están cerca de las cicatrices, **exagera** el efecto (3,09 pp, por sobre ambas cotas). Con la Colección 2 cae dentro de las cotas (−0,11 pp), pero ese acierto es casual: el mismo número resulta de mezclar efectos de signo opuesto según la cobertura y no dice nada de dónde ocurre la conversión. Los porcentajes de \"terreno quemado que cambió de uso\" no son, por sí solos, evidencia para el debate legislativo; se necesita un contrafactual. H2 se confirma de forma parcial."),
  H2("5.3 ¿Hacia dónde va el suelo quemado?"),
  P("La Figura 3 descompone el efecto por destino:"),
  BUL("**Infraestructura:** efecto nulo o levemente negativo (≤ 0,1 pp) en todos los horizontes. No hay evidencia de que el fuego acelere la expansión urbana o los loteos densos."),
  BUL("**Agricultura:** aumento transitorio (+0,43 pp el año del incendio) que se revierte desde el segundo año."),
  BUL("**Pastura:** sin efecto relevante (≤ 0,2 pp)."),
  BUL("**Degradación del bosque nativo:** es el efecto dominante. La probabilidad de que un bosque quemado pase a matorral o pastizal sube **+25,7 pp** al año siguiente y **+26,7 pp** a los dos años, y sigue en +14,0 pp a los siete. Es un orden de magnitud mayor que cualquier efecto sobre la conversión."),
  BUL("**Silvicultura:** cae 4,5 pp a los dos años y 5,2 pp a los tres (cosecha de salvataje) y se recupera hacia el séptimo año (replantación)."),
  ...figura("figuras_col2/fig3_event_study_destinos.png", "Efecto del fuego por tipo de destino (Colección 2, cohortes 2014–2021, regla conservadora). La degradación a matorral o pastizal se evalúa solo desde bosque nativo. Bandas: IC 95 %.", 16),
  ...figura("figuras_col2/fig4_composicion.png", "Proporción de píxeles que dejan su grupo de cobertura previo, según el destino y los años desde el incendio (Colección 2). Izquierda: quemados; derecha: controles emparejados.", 16),
  H2("5.4 Dónde sí abre la puerta: el bosque nativo"),
  P("El efecto promedio es nulo porque mezcla respuestas opuestas según la cobertura previa (Figura 6):"),
  BUL("**Bosque nativo quemado:** **+0,94 pp** (IC 95 %: 0,44–1,78) de probabilidad de pasar a uso antrópico. Es el único grupo con un efecto positivo claro, y es persistente: exigiendo uso antrópico durante tres años seguidos desde *k* = 2, el efecto es +0,48 pp (0,20–0,77; Figura 5)."),
  BUL("**Plantaciones:** sin efecto (−0,02 pp)."),
  BUL("**Matorral:** −1,23 pp (−1,55 – −0,93). El matorral quemado se convierte *menos* que el no quemado. El placebo espacial de la sección 5.5 muestra que esta diferencia se debe al lugar y no al fuego: aparece igual en el matorral no quemado vecino a las quemas."),
  BUL("**Pastizal y estepa:** −1,6 pp, no significativo (pocos tratados)."),
  ...figura("figuras_col2/fig7_persistencia.png", "Conversión persistente (uso antrópico durante tres años consecutivos desde k = 2) en quemados y controles emparejados, por cobertura previa (Colección 2, ponderado por superficie).", 14.5),
  P("Por región (Figuras 6 y 7), ningún efecto promedio es positivo y significativo: Valparaíso (+0,51 pp) y La Araucanía (+0,18 pp) son positivos pero no significativos; Biobío, el Maule y Ñuble son indistinguibles de cero, y la Región Metropolitana (−0,61 pp) y O'Higgins (−0,93 pp) son negativos, por el peso del matorral. La distancia a zonas urbanas tampoco muestra un gradiente positivo: el efecto es nulo o negativo en todos los tramos."),
  P("Combinando región y cobertura (Tabla 3), los focos positivos son todos de **bosque nativo**: Valparaíso (+3,2 pp), La Araucanía (+1,3 pp) y O'Higgins (+0,9 pp). Los dos primeros se repiten con la Colección 1 (sección 5.7)."),
  ...figura("figuras_col2/fig5_heterogeneidad.png", "Heterogeneidad del efecto promedio (k = 1–3, cohortes balanceadas, regla conservadora, Colección 2) por cobertura previa, distancia a zona urbana en 2012 y región. Barras: IC 95 %.", 16),
  ...figura("figuras_col2/fig6_mapa_focos.png", "a) Píxeles quemados muestreados según el año del primer incendio. b) Efecto causal del fuego sobre el cambio a uso antrópico por región (k = 1–3, cohortes balanceadas), sobre los límites oficiales de MapBiomas Chile (Colección 2); n.s. = no significativo al 95 %.", 15),
  ...tabla("Combinaciones de región y cobertura previa (Colección 2; k = 1–3, cohortes 2014–2021; solo combinaciones con al menos 800 tratados).", ["Región · cobertura previa", "Efecto (pp)", "IC 95 %", "Tratados"], [
    ["Valparaíso · bosque nativo", "+3,2", "1,3 – 6,3", "2.240"],
    ["Araucanía · bosque nativo", "+1,3", "0,2 – 2,8", "1.118"],
    ["O'Higgins · bosque nativo", "+0,9", "0,2 – 1,8", "1.866"],
    ["Maule · bosque nativo", "+0,7", "−0,4 – 2,4", "1.460"],
    ["Araucanía · plantación", "+0,6", "0,1 – 1,3", "3.309"],
    ["Metropolitana · bosque nativo", "+0,4", "−0,1 – 0,9", "1.884"],
    ["Biobío · bosque nativo", "+0,4", "−0,1 – 0,8", "897"],
    ["Metropolitana · matorral", "−0,8", "−1,2 – −0,5", "8.324"],
    ["O'Higgins · matorral", "−1,8", "−2,3 – −1,3", "5.274"],
  ], [3800, 1700, 2000, 1500]),
  H2("5.5 Robustez"),
  ...tabla("Pruebas de robustez del efecto principal (uso antrópico, regla conservadora, Colección 2).", ["Prueba", "Resultado"], [
    ["Tendencias previas (k = −6 a −3)", "Media −0,22 pp (sesgo, si existe, hacia abajo)"],
    ["1 vecino, caliper 0,2 (especificación base)", "−0,25 pp (−0,43 – −0,08)"],
    ["3 vecinos, caliper 0,2", "−0,27 pp (−0,42 – −0,12)"],
    ["5 vecinos, caliper 0,1", "−0,28 pp (−0,41 – −0,13)"],
    ["1 vecino, caliper 0,05", "−0,25 pp (−0,43 – −0,08)"],
    ["Horizonte k = 1–5 (cohortes 2014–2019)", "−0,47 pp (−0,64 – −0,29)"],
    ["Persistente desde bosque nativo (3 años desde k = 2)", "+0,48 pp (0,20 – 0,77)"],
    ["Placebo espacial · todas las coberturas (13.147 píxeles)", "−0,86 pp (−1,20 – −0,57)"],
    ["Placebo espacial · bosque nativo", "+0,08 pp (−0,43 – 0,62)"],
    ["Placebo espacial · matorral", "−1,34 pp (−1,98 – −0,73)"],
    ["Placebo espacial · plantación", "−0,54 pp (−0,94 – −0,13)"],
  ], [4800, 4200]),
  P("El efecto es estable a la especificación del emparejamiento. En la validación con datos simulados (Anexo A), el estimador emparejado recupera el efecto verdadero dentro de sus cotas, mientras el contraste ingenuo no."),
  P("El placebo espacial separa lo que se debe al fuego de lo que se debe al lugar. En el **bosque nativo** es nulo (+0,08 pp): los bosques no quemados vecinos a una quema no se convierten más que los lejanos, de modo que el efecto de +0,94 pp no se explica por una mayor presión de uso en las zonas donde ocurren los incendios. En el **matorral**, en cambio, el placebo (−1,34 pp) es tan negativo como el efecto estimado (−1,23 pp): el matorral de las zonas propensas al fuego se convierte menos que el resto aunque no se queme, y esa diferencia no puede atribuirse al fuego. Lo mismo ocurre, en menor medida, con el promedio (−0,86 pp). La cota inferior negativa del efecto promedio refleja entonces, al menos en parte, el lugar y no un efecto protector del fuego, lo que refuerza la lectura de un efecto promedio nulo. Con la Colección 1 el placebo es nulo en el promedio (+0,47 pp; −0,11 – 1,14) y en el bosque nativo (+0,27 pp; −0,24 – 0,84), y positivo en las plantaciones (+1,74 pp), en línea con el efecto de leyenda de la sección 5.7."),
  H2("5.6 Cohortes 2022–2023: una ventana sin censura"),
  P("Las cohortes 2022 y 2023 (incluidos los megaincendios del centro-sur de febrero de 2023) tienen solo uno o dos años de seguimiento, pero el filtro del producto Fuego todavía no alcanza a borrar sus conversiones inmediatas (sección 4.4). Muestran, por lo tanto, lo que la censura oculta en las cohortes anteriores (Tabla 5):"),
  ...tabla("Efecto del fuego sobre el uso antrópico en las cohortes no censuradas (Colección 2).", ["Cohorte · horizonte", "Efecto (pp)", "IC 95 %", "Tratados"], [
    ["2022 · k = 1", "+2,1", "0,8 – 3,8", "5.192"],
    ["2022 · k = 2", "+3,1", "1,3 – 5,3", "5.192"],
    ["2023 · k = 1", "+1,4", "0,9 – 1,9", "16.472"],
    ["2022–2023 · bosque nativo · k = 1", "**+6,4**", "4,6 – 8,6", "2.948"],
    ["2022–2023 · plantación · k = 1", "+0,7", "0,3 – 1,2", "14.469"],
    ["2022–2023 · matorral · k = 1", "+0,9", "−0,1 – 2,1", "4.156"],
  ], [3800, 1700, 2000, 1500], "No comparables con la Tabla 2: aquí no se excluyen las conversiones inmediatas y estables, y el seguimiento es de uno o dos años."),
  P("Sin censura, el efecto inmediato es positivo en todas las coberturas y mucho mayor en el bosque nativo (+6,4 pp, frente a +0,9 pp en las cohortes censuradas). Esto confirma que la regla simétrica entrega una estimación conservadora y que buena parte de la conversión del bosque nativo quemado ocurre de inmediato. Con solo uno o dos años no se puede saber cuánto de ese efecto será persistente; las próximas colecciones de MapBiomas permitirán seguir estas cohortes."),
  H2("5.7 Replicación con la Colección 1"),
  P("La Figura 8 compara las estimaciones clave entre ambas colecciones, obtenidas con muestras, diseños y covariables distintas."),
  P("**Se replican:**", { after: 60 }),
  BUL("la ausencia de efecto sobre la infraestructura;"),
  BUL("la degradación masiva del bosque nativo (+25,6 y +26,7 pp a los dos años; +15,9 y +14,0 pp a los siete);"),
  BUL("la caída y recuperación de las plantaciones;"),
  BUL("el efecto positivo desde bosque nativo (+1,4 pp con la Colección 1 y +0,9 pp con la 2, con intervalos que se superponen);"),
  BUL("los focos de bosque nativo en La Araucanía (+6,3 y +1,3 pp) y Valparaíso (+1,8 y +3,2 pp)."),
  P("**No se replica** el efecto promedio positivo de la Colección 1 (+1,2 a +2,1 pp), que proviene sobre todo de las plantaciones (+1,9 pp) y de La Araucanía (+9,3 pp, con +11,8 pp en plantaciones de esa región). La explicación es la leyenda. En la Colección 1, la mitad (49 %) de los píxeles quemados que aparecen como mosaico de usos al año siguiente vuelven a ser plantación a los cuatro años, lo que indica que la cosecha y el suelo desnudo se confundían con uso agropecuario. En la Colección 2, que separa agricultura de pastura, el 63 % de esos píxeles sigue en agricultura a los cuatro años y el efecto desde plantaciones desaparece (−0,02 pp). Por eso la Colección 2 es la estimación preferida, y los hallazgos que se sostienen en ambas son los que se consideran robustos."),
  ...figura("figuras_col2/fig8_replicacion.png", "Replicación: estimaciones clave con la Colección 1 (gris) y la Colección 2 (rojo). Puntos: efecto promedio k = 1–3 con cohortes balanceadas (regla conservadora, salvo la cota superior); barras: IC 95 %. Panel derecho: degradación del bosque nativo a los dos años.", 16),
];

const discusion = [
  H1("6. Discusión"),
  H2("6.1 Interpretación"),
  P("Los resultados matizan las dos tesis del debate. Contra la tesis del fuego como mecanismo general de habilitación, el efecto promedio sobre el cambio de uso es nulo en la colección más precisa y no alcanza a la infraestructura en ninguna. Contra la tesis de la correlación espuria, hay un efecto causal positivo y replicado en un caso específico: el **bosque nativo quemado** tiene una probabilidad mayor de terminar en uso agropecuario, con focos en Valparaíso y La Araucanía, y ese efecto es mucho mayor cuando se observan las conversiones inmediatas que la censura oculta. Es coherente con un incentivo concentrado justo donde la Ley N.° 20.283 protege la vegetación y el fuego remueve el obstáculo legal y físico a la habilitación."),
  P("El hallazgo más importante es quizás el menos discutido. La principal consecuencia de los incendios sobre el suelo no es la conversión, sino la **degradación persistente del bosque nativo**: uno de cada cuatro bosques quemados pasa a matorral o pastizal y, siete años después, la diferencia con bosques comparables no quemados sigue en 14–16 pp. Es coherente con el arresto sucesional descrito para ecosistemas mediterráneos bajo sequía, y significa que el costo ecológico del fuego en el bosque nativo es mucho mayor que el de la conversión que se busca prohibir."),
  P("En el plano metodológico, los resultados advierten sobre tres riesgos para cualquier análisis con estos datos. Primero, las comparaciones descriptivas pueden exagerar el efecto o esconder efectos de signo opuesto según el grupo de comparación. Segundo, el filtro del producto Fuego censura justamente las conversiones post-incendio, y su efecto cambia al final de la serie, de modo que mezclar cohortes recientes con antiguas sin cuidado produce promedios engañosos. Tercero, las diferencias de leyenda entre colecciones pueden crear conversiones aparentes."),
  H2("6.2 Implicancias para la política pública"),
  P("Una prohibición general de cambio de uso por 30 años en todo terreno quemado apuntaría a un efecto que, en promedio y en la mayor parte del territorio estudiado, es nulo. La evidencia respalda un instrumento **focalizado**, con tres componentes:"),
  BUL("restricciones al cambio de uso en terrenos quemados con **bosque nativo**, con prioridad en Valparaíso y La Araucanía, y fiscalización temprana, porque la conversión ocurre sobre todo en el primer año;"),
  BUL("una política de **restauración activa del bosque nativo quemado**, donde está el mayor impacto;"),
  BUL("monitoreo anual con las nuevas colecciones de MapBiomas para evaluar la ley que se apruebe."),
  H2("6.3 Recomendaciones para los productos MapBiomas"),
  P("El análisis deja tres sugerencias para quienes producen y usan estos datos:"),
  BUL("**Publicar la quema antes del filtro de cobertura**, o una capa que marque los píxeles que el filtro borró. Hoy el producto Fuego elimina las quemas seguidas de cuatro años de uso agropecuario o urbano, que son justamente las conversiones posincendio; con esa capa, cualquier usuario podría medirlas de forma directa en lugar de acotarlas."),
  BUL("**Advertir del truncamiento del filtro al final de la serie.** En los dos últimos años la ventana de cuatro años no está completa y el filtro actúa distinto, por lo que las cohortes recientes no son comparables con las anteriores sin un tratamiento aparte."),
  BUL("**Documentar la equivalencia de leyendas entre colecciones.** La separación de agricultura y pastura en la Colección 2 cambia resultados sustantivos respecto de la Colección 1, donde la cosecha forestal se confundía con mosaico de usos; una tabla de equivalencias y esta advertencia evitarían conclusiones erradas en series que mezclen colecciones."),
  H2("6.4 Limitaciones"),
  BUL("**Horizonte temporal.** La Colección 2 llega a 2024: las cohortes de 2022 y 2023 solo tienen uno o dos años de seguimiento y el incendio de Viña del Mar de 2024 todavía no puede evaluarse."),
  BUL("**Censura.** El filtro del producto Fuego impide observar directamente las conversiones inmediatas en las cohortes 2014–2021, por lo que el efecto se presenta como cotas, y la cota superior es deliberadamente amplia."),
  BUL("**Tendencias previas.** Son pequeñas pero no nulas en la Colección 2. Su signo sugiere que la cota inferior está sesgada hacia abajo. Además, al exigir la misma cobertura en *g−2* y *g−1*, ATT~−2~ y ATT~−1~ son cero por construcción."),
  BUL("**Confusión no observada.** Puede quedar confusión, por ejemplo por tenencia de la tierra, valor del suelo o planes reguladores, que las covariables no incluyen. El placebo espacial la descarta para el bosque nativo, pero la detecta en el matorral y en el promedio, con signo negativo."),
  BUL("**Escala.** A 30 m no se detectan loteos o parcelaciones que conservan vegetación, por lo que el efecto sobre la presión inmobiliaria de baja densidad podría estar subestimado."),
  BUL("**Inferencia.** El bootstrap re-muestrea tratados con sus controles fijos, sin re-emparejar, una aproximación estándar."),
];

const conclusiones = [
  H1("7. Conclusiones"),
  P("Este trabajo cruza por primera vez, a nivel de píxel, con un diseño cuasiexperimental y con dos colecciones de cobertura, los datos de MapBiomas Chile y MapBiomas Fuego para responder si el fuego abre la puerta al cambio de uso del suelo. La respuesta es **no en general, sí en el bosque nativo**:"),
  NUM("En promedio, el efecto del fuego sobre el cambio a uso antrópico queda acotado entre **−0,25 y +0,50 pp** (−1.700 a +3.500 ha en las cohortes 2014–2021): no se distingue de un efecto nulo.", "conclusiones"),
  NUM("**No hay efecto sobre la infraestructura** con ninguna de las dos colecciones.", "conclusiones"),
  NUM("El **bosque nativo quemado** sí se convierte más (+0,9 pp con la Colección 2 y +1,4 pp con la 1), con efecto persistente y focos en Valparaíso y La Araucanía replicados en ambas colecciones. Un placebo espacial descarta que se deba al lugar y no al fuego. Sin la censura del filtro, el efecto inmediato llega a **+6,4 pp**.", "conclusiones"),
  NUM("El principal impacto del fuego es la **degradación persistente del bosque nativo** (+26–27 pp a los dos años y +14–16 pp a los siete).", "conclusiones"),
  NUM("Las cifras descriptivas que se citan en el debate **no reflejan el efecto causal**: exageran con un grupo de comparación y, con otro, esconden efectos de signo opuesto.", "conclusiones"),
  P("Además, el trabajo documenta un sesgo de censura del producto MapBiomas Fuego (y su truncamiento al final de la serie) y un efecto de leyenda entre colecciones, ambos relevantes para cualquier usuario, y propone cómo tratarlos. Los datos abiertos de MapBiomas Chile permiten así pasar de la correlación a la evidencia causal en una discusión legislativa vigente."),
  H1("Disponibilidad de datos y código"),
  P("Todo el análisis es reproducible con datos abiertos. El repositorio incluye:"),
  BUL("los scripts de extracción en Google Earth Engine para la Colección 2 (extraccion_gee_col2.js) y desde los GeoTIFF públicos para la Colección 1 (extraccion_navegador.js);"),
  BUL("el módulo del estimador (fuegocausal.py);"),
  BUL("los notebooks ejecutados (02_analisis_causal.ipynb y 02b_analisis_causal_col2.ipynb);"),
  BUL("los análisis de robustez, incluido el placebo espacial (robustez.py), y las figuras complementarias;"),
  BUL("la muestra, el protocolo y los ejemplos para la validación visual de las conversiones (muestra_validacion.py, figura_ejemplos.py y la carpeta validacion_visual);"),
  BUL("las muestras extraídas."),
  P("Repositorio: **https://github.com/cmartinez1524/Mapbiomas**", { after: 200 }),
];

const refs = [
  H1("Referencias"),
  REF("Andam, K. S., Ferraro, P. J., Pfaff, A., Sanchez-Azofeifa, G. A. y Robalino, J. A. (2008). Measuring the effectiveness of protected area networks in reducing deforestation. *Proceedings of the National Academy of Sciences*, 105(42), 16089–16094."),
  REF("Austin, P. C. (2011). An introduction to propensity score methods for reducing the effects of confounding in observational studies. *Multivariate Behavioral Research*, 46(3), 399–424."),
  REF("Bowman, D. M. J. S., Moreira-Muñoz, A., Kolden, C. A., et al. (2019). Human–environmental drivers and impacts of the globally extreme 2017 Chilean fires. *Ambio*, 48, 350–362."),
  REF("Butsic, V., Lewis, D. J., Radeloff, V. C., Baumann, M. y Kuemmerle, T. (2017). Quasi-experimental methods enable stronger inferences from observational data in ecology. *Basic and Applied Ecology*, 19, 1–10."),
  REF("Callaway, B. y Sant'Anna, P. H. C. (2021). Difference-in-differences with multiple time periods. *Journal of Econometrics*, 225(2), 200–230."),
  REF("Cámara de Diputadas y Diputados de Chile (2024). Proyecto de ley que regula la prevención de incendios forestales y rurales, y otras materias (Boletín N.° 16.335-14). Votación en Sala del 6 de marzo de 2024."),
  REF("Cengiz, D., Dube, A., Lindner, A. y Zipperer, B. (2019). The effect of minimum wages on low-wage jobs. *The Quarterly Journal of Economics*, 134(3), 1405–1454."),
  REF("Echeverría, C., Coomes, D., Salas, J., Rey-Benayas, J. M., Lara, A. y Newton, A. (2006). Rapid deforestation and fragmentation of Chilean temperate forests. *Biological Conservation*, 130(4), 481–494."),
  REF("Ferraro, P. J. y Hanauer, M. M. (2014). Advances in measuring the environmental and social impacts of environmental programs. *Annual Review of Environment and Resources*, 39, 495–517."),
  REF("Goodman-Bacon, A. (2021). Difference-in-differences with variation in treatment timing. *Journal of Econometrics*, 225(2), 254–277."),
  REF("Heilmayr, R., Echeverría, C., Fuentes, R. y Lambin, E. F. (2016). A plantation-dominated forest transition in Chile. *Applied Geography*, 75, 71–82."),
  REF("MapBiomas Chile (2026a). MapBiomas – Colección 2 de la Serie Anual de Mapas de Cobertura y Uso del Suelo de Chile, consultada el 19 de octubre de 2026 a través del enlace: https://chile.mapbiomas.org/ (asset de Google Earth Engine: projects/mapbiomas-chile/assets/LULC/COLLECTION-02/CLASSIFICATIONS/classification-final/clasificacion-final-2)."),
  REF("MapBiomas Chile (2026b). MapBiomas – Colección 1 de la Serie Anual de Mapas de Cobertura y Uso del Suelo de Chile, consultada el 18 de octubre de 2026 a través del enlace: https://chile.mapbiomas.org/ (GeoTIFF: https://storage.googleapis.com/mapbiomas-public/initiatives/chile/coverage/)."),
  REF("MapBiomas Chile (2026c). MapBiomas Fuego – Colección 1 de mapas anuales de área quemada de Chile (2013–2025), consultada el 18 de octubre de 2026 a través del enlace: https://chile.mapbiomas.org/iniciativas-y-productos/fuego/."),
  REF("McWethy, D. B., Pauchard, A., García, R. A., Holz, A., González, M. E., Veblen, T. T., Stahl, J. y Currey, B. (2018). Landscape drivers of recent fire activity (2001–2017) in south-central Chile. *PLoS ONE*, 13(8), e0201195."),
  REF("Meijer, J. R., Huijbregts, M. A. J., Schotten, K. C. G. J. y Schipper, A. M. (2018). Global patterns of current and future road infrastructure. *Environmental Research Letters*, 13(6), 064006."),
  REF("Rosenbaum, P. R. y Rubin, D. B. (1983). The central role of the propensity score in observational studies for causal effects. *Biometrika*, 70(1), 41–55."),
  REF("Stuart, E. A. (2010). Matching methods for causal inference: A review and a look forward. *Statistical Science*, 25(1), 1–21."),
  REF("Úbeda, X. y Sarricolea, P. (2016). Wildfires in Chile: A review. *Global and Planetary Change*, 146, 152–161."),
];

const anexos = [
  new Paragraph({ children: [new PageBreak()] }),
  H1("Anexo A. Validación del estimador con datos simulados"),
  P("Para comprobar que el método recupera el efecto correcto, se simuló un paisaje de 150.000 píxeles con la misma estructura de datos, en el que el efecto del fuego es conocido. En la simulación, la probabilidad de incendio aumenta cerca de caminos y ciudades, que es justamente donde la conversión basal es mayor (confusión). Además, se aplicó el filtro de cobertura del producto Fuego, que borra las conversiones inmediatas (censura). El efecto verdadero promedio (k = 1–5) fue 6,9 pp. El estimador emparejado lo acotó entre 6,2 y 10,1 pp, mientras el contraste ingenuo marcó 5,2 pp."),
  ...figura("validacion_simulada/figuras/fig6_validacion_simulacion.png", "Validación en el paisaje simulado: estimadores frente al efecto verdadero (línea discontinua).", 14),
  H1("Anexo B. Resultados con la Colección 1"),
  P("Con la Colección 1 se emparejaron 54.682 de los 54.689 píxeles quemados elegibles (cohortes 2014–2021; 606.729 ha representadas), con un balance máximo después del emparejamiento de 0,073 (0,45 antes). La Figura 10 muestra el estudio de eventos principal: +0,91 pp el año del incendio, +1,77 pp al año siguiente y +1,27 pp a los dos años, para luego no distinguirse de cero. El efecto resumen (k = 1–3, cohortes balanceadas 2014–2019) fue +1,20 pp (IC 95 %: 0,50–1,82) con la regla conservadora y +2,08 pp (1,44–2,66) con la estricta; con k = 1–5 (cohortes 2014–2017), +0,82 pp (0,07–1,52). Por cobertura: bosque nativo +1,36 pp (0,71–2,15), plantaciones +1,93 pp (0,73–3,23), matorral y pastizal sin efecto. Por región: La Araucanía +9,3 pp y Biobío +2,2 pp; el resto, sin efecto. La sensibilidad del emparejamiento da entre +1,09 y +1,27 pp. La conversión persistente (tres años seguidos desde k = 1) es +0,55 pp (0,12–0,91), pero deja de ser significativa desde k = 2, coherente con el carácter transitorio de las conversiones de plantaciones que se explica en la sección 5.7."),
  ...figura("figuras/fig2_event_study_principal.png", "Estudio de eventos del efecto del fuego sobre el uso antrópico (mosaico agropecuario + infraestructura) con la Colección 1 (cohortes 2014–2021). Bandas: IC 95 %.", 14),
  H1("Anexo C. Clases de MapBiomas Chile utilizadas"),
  ...tabla("Correspondencia de clases.", ["Rol en el análisis", "Colección 2", "Colección 1"], [
    ["Grupo previo: bosque", "3, 59, 60, 67", "3"],
    ["Grupo previo: matorral", "66", "66"],
    ["Grupo previo: pastizal / estepa", "12, 63", "12"],
    ["Grupo previo: silvicultura", "9", "9"],
    ["Resultado: uso antrópico", "18 (agricultura), 15 (pastura), 24 (infraestructura)", "21 (mosaico de usos), 24"],
    ["Filtro del producto Fuego (persistencia 4 años)", "15, 18, 24, 33", "21, 24, 33"],
    ["Filtro del producto Fuego (siempre)", "23, 25, 29, 34, 61", "23, 25, 29, 34, 61"],
  ], [3400, 3300, 2300]),
  new Paragraph({ children: [new PageBreak()] }),
  H1("Anexo D. Resumen para la toma de decisiones"),
  P("**Pregunta.** ¿Los incendios abren la puerta a que terrenos con vegetación se conviertan en uso agrícola, ganadero o urbano? Es la premisa de la propuesta de prohibir por 30 años el cambio de uso en terrenos quemados (Ley de Incendios, Boletín N.° 16.335-14)."),
  P("**Cómo se respondió.** Con datos abiertos de MapBiomas Chile se siguió año a año a más de 57.000 píxeles quemados entre 2014 y 2021 (que representan ~710.000 ha), desde Valparaíso hasta La Araucanía. Cada uno se comparó con un píxel nunca quemado que tenía la misma cobertura, la misma región y condiciones equivalentes de terreno y cercanía a caminos, ciudades, cultivos y plantaciones. Los incendios de 2022 y 2023 se analizaron aparte, y todo se repitió con una segunda colección de mapas."),
  ...tabla("Hallazgos clave.", ["Pregunta", "Respuesta"], [
    ["¿El fuego causa cambio de uso?", "En promedio, no: el efecto queda entre −0,25 y +0,50 de cada 100 ha quemadas"],
    ["¿Abre la puerta a la urbanización?", "No se detecta ningún efecto sobre infraestructura"],
    ["¿Dónde sí abre la puerta?", "En el bosque nativo quemado: +0,9 a +1,4 pp en tres años y hasta +6,4 pp el primer año en los incendios recientes; focos en Valparaíso y La Araucanía"],
    ["¿Cuál es el mayor daño del fuego?", "La degradación del bosque nativo: +26–27 pp a matorral o pastizal, y +14–16 pp siete años después"],
    ["¿Son confiables las cifras que se citan?", "No: según con qué se compare, exageran el efecto o esconden efectos opuestos"],
  ], [3300, 5700]),
  P("**Recomendaciones:**", { after: 60 }),
  NUM("**Focalizar en el bosque nativo.** Restringir el cambio de uso en terrenos quemados con bosque nativo, con prioridad en Valparaíso y La Araucanía, y fiscalizar en el primer año, cuando ocurre la mayor parte de la conversión. Una prohibición pareja para todo terreno quemado apuntaría a un efecto que en promedio es nulo.", "recom"),
  NUM("**Poner la restauración al centro.** El impacto dominante del fuego es la degradación persistente del bosque nativo; la ley debería exigir y financiar su restauración activa.", "recom"),
  NUM("**Monitorear con datos abiertos.** El método se puede repetir cada año con las nuevas colecciones de MapBiomas para evaluar el efecto de la ley que se apruebe.", "recom"),
  H1("Anexo E. Ejemplos de trayectorias de píxeles"),
  P("La Figura 11 muestra, año a año, la cobertura que la Colección 2 asigna a 16 píxeles de bosque nativo quemado, tomados de una muestra aleatoria de 146 píxeles preparada para la validación visual con imágenes de alta resolución (carpeta validacion_visual del repositorio). Ilustra los cuatro destinos que distingue el análisis: la conversión que persiste, la conversión transitoria, la degradación a matorral y la permanencia como bosque. De los 102 píxeles de la muestra clasificados como uso antrópico tres años después del incendio, 48 siguen en uso antrópico en 2024 y 38 vuelven a aparecer como bosque nativo; por eso el análisis informa por separado la conversión persistente (sección 5.5)."),
  ...figura("figuras_col2/fig9_ejemplos_trayectorias.png", "Trayectorias de cobertura (MapBiomas Chile, Colección 2, 1999–2024) de 16 píxeles de bosque nativo quemado. Cada fila es un píxel, identificado por su código en la muestra de validación, su región y el año del incendio (marca negra).", 16),
];

// ============================ DOCUMENTO ============================
const doc = new Document({
  creator: "Cristóbal Martínez Arochas",
  title: "¿Abre el fuego la puerta al cambio de uso del suelo?",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: FONT, color: AZUL }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: FONT, color: "2E5A88" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: { config: [
    { reference: "vinetas", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
    { reference: "numeros", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
    { reference: "recom", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
    { reference: "conclusiones", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Premio MapBiomas Chile 2026 · ", size: 16, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" })] })] }) },
    children: [
      ...portada,
      ...resumen,
      ...intro, ...objetivos, ...datos, ...metodo, ...resultados, ...discusion, ...conclusiones, ...refs, ...anexos,
    ],
  }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(path.join(__dirname, "Informe_Premio_MapBiomas_Fuego_CambioUso.docx"), b); console.log("ok"); });
