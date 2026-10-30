# Formatos oficiales verificados

Verificación hecha el **30-10-2026** sobre fuentes oficiales. Donde la fuente oficial no coincidía con el punto de partida del encargo, **manda la fuente oficial** y se indica en la columna «Corrección».

## TOEFL iBT (formato vigente desde el 21-01-2026)

Fuentes:
- ETS, *Test Content and Structure* (pestaña «After 21 Jan 2026»): https://www.in.ets.org/toefl/institutions/ibt/about/content-structure.html
- ETS, *TOEFL iBT® Test: 2026 Update — Test Blueprint and Specifications*: https://www.eu.ets.org/pdfs/toefl/toefl-ibt-test-specifications-2026.pdf
- ETS, *A banded score scale for the TOEFL iBT test* (informe técnico, abril 2026): https://www.mx.ets.org/content/dam/ets-org/pdfs/toefl/score-scale-update-2026.pdf
- ETS TOEFL Access, *Score scale update: what you need to know*: https://toeflaccess.ets.org/help/en/articles/11758616-toefl-ibt-score-scale-update-what-you-need-to-know

### Estructura

| Sección | Tareas | Ítems | Tiempo base | Notas oficiales |
|---|---|---|---|---|
| Reading | Complete the Words · Read in Daily Life (sets de 2 y 3 ítems) · Read an Academic Passage | 50 (incluye ítems sin puntuar) | ≈30 min (blueprint: router + módulo ≈ 18–21 min + 9 min) | Adaptativo en **dos etapas**: módulo *router* y después módulo *lower* o *upper*. Textos de 15–50 palabras (fáciles) hasta ~200 (académicos). En el blueprint, Complete the Words aporta 30 ítems y Daily Life y Academic Passage, 5–15 cada uno. |
| Listening | Listen and Choose a Response (15–19) · Listen to a Conversation (10) · Listen to an Announcement (6–10) · Listen to an Academic Talk (8–16) | 47 (incluye sin puntuar) | ≈29 min (router ≈18 min + lower ≈7 / upper ≈11) | Adaptativo en dos etapas. **El audio se oye una sola vez.** Acentos EE. UU./Canadá, Australia y Reino Unido; audio generado por IA y a veces actores. Audios de ≤6 sílabas tónicas hasta ~250 palabras. |
| Writing | Build a Sentence (10) · Write an Email (1) · Write for an Academic Discussion (1) | 12 | ≈23 min | Lineal. Build a Sentence vale 1 punto; Email y Academic Discussion, 0–5 puntos cada uno (puntuación automática con IA). |
| Speaking | Listen and Repeat (7) · Take an Interview (4) | 11 | ≈8 min | Lineal. Cada ítem 0–5 puntos (puntuación con IA). |

Tiempo total según el blueprint: **1 h 23 min – 1 h 29 min** (la página de estructura suma 90 min y recomienda reservar ~2 h). Orden de secciones mostrado por ETS: Reading → Listening → Writing → Speaking.

Tiempos por tarea **no publicados en las páginas oficiales consultadas** (proceden de preparadores reputados y del propio encargo, y se usan como aproximación): Write an Email ≈ 7 min, Academic Discussion ≈ 10 min, Interview ≈ 45 s por respuesta sin preparación, Listen and Repeat ≈ 8–12 s por frase según longitud.

### Puntuación

- Cada sección y la nota global: escala **1–6 en saltos de 0,5**.
- Global = **media de las cuatro secciones redondeada al 0,5 más cercano**. Ejemplos oficiales: media 5,125 → **5**; media 5,25 → **5,5**. (Implementado como `round(media × 2) / 2`, que reproduce ambos ejemplos.)
- Durante 2026–2028 el informe incluye además **nivel MCER** y una **nota «comparable» 0–120**.
- MCER (informe técnico, tabla 7; igual para las cuatro secciones y la global): 6 = C2 · 5–5,5 = C1 · 4–4,5 = B2 · 3–3,5 = B1 · 2–2,5 = A2 · 1–1,5 = A1. ✅ Coincide con el encargo.

Concordancia oficial banda 1–6 ↔ escala antigua (informe técnico, tabla 6):

| Banda | Reading 0–30 | Listening 0–30 | Writing 0–30 | Speaking 0–30 | Total 0–120 |
|---|---|---|---|---|---|
| 6 | 29–30 | 28–30 | 29–30 | 28–30 | 114+ |
| 5,5 | 27–28 | 26–27 | 27–28 | 27 | 107+ |
| 5 | 24–26 | 22–25 | 24–26 | 25–26 | 95+ |
| 4,5 | 22–23 | 20–21 | 21–23 | 23–24 | 86+ |
| 4 | 18–21 | 17–19 | 17–20 | 20–22 | 72+ |
| 3,5 | 12–17 | 13–16 | 15–16 | 18–19 | 58+ |
| 3 | 6–11 | 9–12 | 13–14 | 16–17 | 44+ |
| 2,5 | 4–5 | 6–8 | 11–12 | 13–15 | 34+ |
| 2 | 3 | 4–5 | 7–10 | 10–12 | 24+ |
| 1,5 | 2 | 2–3 | 3–6 | 5–9 | 12+ |
| 1 | 0–1 | 0–1 | 0–2 | 0–4 | 0+ |

El total 0–120 de una banda global es la suma de los mínimos de sección («114+» significa 114–120). La app muestra el rango (p. ej. banda 5 → 95–106).

Comparación TOEFL ↔ IELTS publicada por ETS (informe técnico, tabla B1; útil para comparar objetivos):

| IELTS | 9 | 8,5 | 8 | 7,5 | 7 | 6,5 | 6 | 5,5 | 5 | 4,5 | 4 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TOEFL global | 6 | 6 | 6 | 5,5 | 5 | 4,5 | 4 | 3,5 | 2,5 | 2 | 1,5 |

### Correcciones respecto al encargo

| Encargo | Fuente oficial | Corrección |
|---|---|---|
| Reading ~50 ítems, ~30 min | 50 ítems, ≈30 min (página de estructura); 18–21 min + 9 min en el blueprint | Sin cambios; se documenta el rango. |
| Listening ~47 ítems, ~29 min | Igual | Sin cambios. |
| Speaking: Listen and Repeat «con apoyo visual» | El blueprint confirma imagen de los hablantes; 7 ítems | Sin cambios. |
| Total ~90 min | 1 h 23 – 1 h 29 min (blueprint) | Se muestra «≈ 85–90 min». |
| Tiempos por tarea (7 min email, 10 min discusión, 45 s entrevista) | No figuran en las fuentes oficiales consultadas | Se mantienen como aproximación y se indica en la app. |
| Simulacros: módulos de Reading con 2 Complete the Words por recorrido | El blueprint indica 30 ítems de Complete the Words | Nuestros simulacros usan 2 párrafos (20 huecos) por recorrido para no alargar en exceso; anotado en DECISIONES. |

## IELTS Academic

Fuentes:
- https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-listening
- https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-reading
- https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing
- https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking
- https://ielts.org/organisations/ielts-for-organisations/understanding-ielts-scoring
- https://ielts.org/organisations/ielts-for-organisations/test-types/ielts-academic-test/academic-test-format-in-detail
- IDP / British Council (FAQ y calculadora) para el tiempo de revisión en ordenador y la ortografía: https://ielts.idp.com/canada/results/how-ielts-is-marked/ielts-score-calculator · https://takeielts.britishcouncil.org/frequently-asked-questions

| Sección | Formato oficial |
|---|---|
| Listening | ≈30 min, 4 partes × 10 = 40 preguntas, **se oye una sola vez**. P1 conversación cotidiana (2 personas), P2 monólogo cotidiano, P3 conversación académica (2–4 personas), P4 monólogo académico. Acentos británico, australiano, neozelandés y norteamericano. Tipos: multiple choice, matching, plan/map/diagram labelling, form/note/table/flow-chart completion, sentence completion, short answer. En ordenador, 2 min finales de revisión (en papel, 10 min de traspaso). |
| Reading | 60 min (incluido el traspaso), 3 textos, 2150–2750 palabras en total, 40 preguntas. 11 tipos: multiple choice, TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN, matching information, matching headings, matching features, matching sentence endings, sentence completion, summary/note/table/flow-chart completion, diagram label completion, short answer. |
| Writing | 60 min. Task 1 ≥150 palabras (~20 min), describir un gráfico/tabla/diagrama/proceso/mapa. Task 2 ≥250 palabras (~40 min). **Task 2 cuenta el doble que Task 1.** Se penaliza escribir fuera de tema, en notas o viñetas y el plagio. |
| Speaking | 11–14 min con examinador. Part 1: 4–5 min. Part 2: 1 min de preparación (papel y lápiz) + hasta 2 min hablando (3–4 min en total). Part 3: 4–5 min. |

### Puntuación

- Bandas 0–9 en medias bandas. Cada respuesta correcta de Listening/Reading = 1 punto.
- Global = media de las cuatro destrezas redondeada a la media banda más cercana; **una media que termina en ,25 sube a ,5 y una que termina en ,75 sube a la banda entera siguiente** (6,125 → 6; 6,25 → 6,5; 6,75 → 7).
- Writing y Speaking: 4 criterios con el mismo peso. Writing: Task Achievement (T1) / Task Response (T2), Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy. Speaking: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.
- Aciertos → banda: IELTS sólo publica medias orientativas (Listening: 16 ≈ 5, 23 ≈ 6, 30 ≈ 7, 35 ≈ 8; Academic Reading: 15 ≈ 5, 23 ≈ 6, 30 ≈ 7, 35 ≈ 8) y avisa de que varía entre versiones. La app usa la tabla aproximada ampliamente difundida, coherente con esos puntos de anclaje:

| Banda | 9 | 8,5 | 8 | 7,5 | 7 | 6,5 | 6 | 5,5 | 5 | 4,5 | 4 | 3,5 | 3 | 2,5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Listening | 39–40 | 37–38 | 35–36 | 32–34 | 30–31 | 26–29 | 23–25 | 18–22 | 16–17 | 13–15 | 10–12 | 8–9 | 6–7 | 4–5 |
| Academic Reading | 39–40 | 37–38 | 35–36 | 33–34 | 30–32 | 27–29 | 23–26 | 19–22 | 15–18 | 13–14 | 10–12 | 8–9 | 6–7 | 4–5 |

### Correcciones respecto al encargo

| Encargo | Fuente oficial | Corrección |
|---|---|---|
| «Aviso si no llegas al mínimo (en el IELTS se penaliza)» | La página oficial no fija una penalización automática; dice que un texto corto puede no aportar evidencia suficiente para bandas altas | La app avisa y su **estimación** limita Task Achievement/Response si no se llega al mínimo, explicándolo como práctica de corrección habitual, no como regla oficial. |
| Part 2: «1–2 min hablando» | Hasta 2 min; el examinador corta a los 2 min | Temporizador de 2 min con aviso al minuto. |
| Tablas oficiales de aciertos → banda | IELTS no publica tabla completa | Se usa la tabla aproximada indicada y se marca como orientativa. |
| Ortografía y UK/US | No figura en ielts.org; IDP/British Council: la mala ortografía es error y se aceptan ambas variedades | La app aplica ambas reglas. |

## Fuera de alcance de ambos exámenes

Ni el TOEFL iBT ni el IELTS tienen una sección «Use of English» (es propia de Cambridge). El módulo de Grammar & Vocabulary de Umbral es **entrenamiento transversal** y no puntúa como sección.
