# Contenido de Umbral: esquema y reglas

Todo el contenido (ejercicios, simulacros, temario, vocabulario, vídeos) vive en **JSON** bajo `src/content/`, separado del código. El esquema exacto está en [`src/content/schema.ts`](../src/content/schema.ts) (Zod); este documento lo explica y fija las reglas de calidad.

```bash
npm run test:content   # valida TODOS los JSON (esquema + coherencia)
```

La validación comprueba, además del esquema: ids únicos y en kebab-case, índices de respuesta en rango, que cada respuesta de hueco respete su límite de palabras, que los `{{placeholders}}` de las plantillas tengan su ítem, que cada `evidence` aparezca **literalmente** en el texto o guion, que cada texto IELTS tenga 700–950 palabras y 13–14 preguntas, que cada parte de Listening IELTS tenga exactamente 10 preguntas, y que Complete the Words tenga 10 huecos bien formados.

## 1. Bancos (carpeta → tipo)

Cada archivo es **un array JSON** de objetos del tipo indicado. Un banco puede repartirse en varios archivos que empiecen por el mismo nombre (`academic-passage-1.json`, `academic-passage-2.json`…).

| Banco | Archivos | Tipo (schema.ts) |
|---|---|---|
| TOEFL Complete the Words | `toefl/reading/complete-words*.json` | `ToeflCtwSet` |
| TOEFL Read in Daily Life | `toefl/reading/daily-life*.json` | `ToeflReadingSet` (`task: "daily-life"`) |
| TOEFL Read an Academic Passage | `toefl/reading/academic-passage*.json` | `ToeflReadingSet` (`task: "academic-passage"`) |
| TOEFL Listen and Choose a Response | `toefl/listening/choose-response*.json` | `ToeflListeningSet` |
| TOEFL Listen to a Conversation | `toefl/listening/conversation*.json` | `ToeflListeningSet` |
| TOEFL Listen to an Announcement | `toefl/listening/announcement*.json` | `ToeflListeningSet` |
| TOEFL Listen to an Academic Talk | `toefl/listening/academic-talk*.json` | `ToeflListeningSet` |
| TOEFL Build a Sentence | `toefl/writing/build-sentence*.json` | `ToeflBuildItem` |
| TOEFL Write an Email | `toefl/writing/email*.json` | `ToeflEmailTask` |
| TOEFL Academic Discussion | `toefl/writing/academic-discussion*.json` | `ToeflDiscussionTask` |
| TOEFL Listen and Repeat | `toefl/speaking/listen-repeat*.json` | `ToeflRepeatSet` |
| TOEFL Take an Interview | `toefl/speaking/interview*.json` | `ToeflInterviewSet` |
| IELTS Reading (textos) | `ielts/reading/*.json` | `IeltsReadingPassage` |
| IELTS Listening (partes) | `ielts/listening/*.json` | `IeltsListeningPart` |
| IELTS Writing Task 1 | `ielts/writing/task1*.json` | `IeltsTask1` |
| IELTS Writing Task 2 | `ielts/writing/task2*.json` | `IeltsTask2` |
| IELTS Speaking Part 1/2/3 | `ielts/speaking/part1*.json` … | `IeltsSpeakingP1/P2/P3` |
| Mazos de vocabulario (AWL, temas…) | `study/vocab/*.json` | `Deck` |
| Gramática | `study/grammar/grammar*.json` | `GrammarTopic` |
| Drills de gramática y vocabulario | `study/grammar/drills*.json` | `DrillItem` |
| Conectores | `study/grammar/connectors*.json` | `ConnectorGroup` |
| Lecciones / guías | `study/lessons/*.json` | `Lesson` |
| Vídeos | `study/videos*.json` | `Video` |
| Recursos oficiales | `study/resources*.json` | `Resource` |

## 2. Campos comunes

- `id`: kebab-case, único dentro del banco. Convención: `<examen>-<tarea>-<nº>`, p. ej. `toefl-ap-07`, `ielts-r-m1-p2` (simulacro 1, texto 2).
- `difficulty`: `easy | medium | hard`. En TOEFL, los sets del módulo `lower` deben ser `easy`/`medium` y los del `upper`, `medium`/`hard`.
- `usage`: `practice` (banco de práctica) o `mock` (reservado para simulacros: no aparece en práctica).
- `mock`: número de simulacro (1, 2, 3, 4…), sólo si `usage = mock`. La app detecta sola los simulacros disponibles.
- `module` (sólo TOEFL Reading/Listening de simulacro): `router` (módulo 1, igual para todos), `lower` o `upper` (módulo 2).

## 3. Ítems (preguntas)

Todas las preguntas comparten `id`, `qtype` (tipo fino, ver `QTYPES` en schema.ts), `explanation` y `evidence` opcional.

| `kind` | Uso | Respuesta |
|---|---|---|
| `mcq` | Tipo test de una respuesta | `answer`: índice (0 = A) |
| `multi` | "Choose TWO letters" | `answers`: índices; vale 1 punto por letra |
| `judge` | TRUE/FALSE/NOT GIVEN (`scale: "tfng"`) o YES/NO/NOT GIVEN (`"ynng"`) | `answer` |
| `gap` | Huecos (notas, formularios, tablas, frases, resumen, respuesta corta, etiquetas) | `answers` (variantes aceptadas), `maxWords`, `allowNumber` |
| `match` | Emparejar con `group.options` (encabezados, rasgos, finales, letras de mapa) | `answer`: clave de la opción |

- `explanation`: por qué la correcta lo es **y** por qué fallan los distractores principales. Puede ir en inglés sencillo o en español.
- `evidence`: cita **literal** (copiada tal cual) del texto o guion que da la respuesta. La app la resalta al corregir. Obligatoria salvo en NOT GIVEN (donde no hay evidencia) y en Choose a Response.
- `optionNotes`: una nota por opción (muy recomendable en TOEFL).

En IELTS las preguntas se agrupan en `groups` con su instrucción literal (`"Questions 1–5\nComplete the notes below.\nWrite ONE WORD AND/OR A NUMBER for each answer."`), opciones compartidas (`options: [{key, text}]`) y, para notas/formularios/tablas/flujo/resumen, una `template` con `{{idDelItem}}` donde va cada hueco (tablas con sintaxis markdown `| a | b |`). Los mapas y planos usan `diagram` (lienzo `width`×`height`, formas `shapes` y `markers` con la letra de cada sitio).

## 4. Composición de cada simulacro

### TOEFL iBT (por cada simulacro)

| Sección | Módulo 1 (`router`) | Módulo 2 (`lower` y `upper`, cada uno) |
|---|---|---|
| Reading | 1 Complete the Words (10 huecos) · 2 Daily Life (uno de 2 preguntas y otro de 3) · 1 Academic Passage (5 preguntas) | 1 Complete the Words · 1 Daily Life (3 preguntas) · 1 Academic Passage (5 preguntas) |
| Listening | 8 Choose a Response · 2 Conversations (2 preguntas c/u) · 1 Announcement (2 preguntas) · 1 Academic Talk (4 preguntas) | 7 Choose a Response · 1 Conversation · 1 Announcement · 1 Academic Talk |

Writing (lineal): 10 Build a Sentence + 1 Email + 1 Academic Discussion. Speaking (lineal): 1 Listen and Repeat (7 frases) + 1 Interview (4 preguntas).

### IELTS Academic (por cada simulacro)

Listening: partes 1, 2, 3 y 4 (10 preguntas cada una). Reading: textos 1, 2 y 3 (13–14 preguntas cada uno, 40 en total: 13 + 13 + 14). Writing: 1 Task 1 + 1 Task 2. Speaking: 1 Part 1 (2 temas: usa dos sets P1), 1 Part 2 y 1 Part 3 enlazada.

## 5. Reglas de calidad y legalidad

1. **Todo es original.** Nada copiado de ETS, Cambridge, British Council ni IDP: ni textos, ni guiones, ni preguntas. Se imita el estilo, la longitud, la dificultad y los tipos de pregunta.
2. **Respuestas inequívocas.** Cada respuesta correcta debe poder justificarse con el texto; cada distractor debe ser plausible pero claramente incorrecto para quien entiende el texto. En TFNG, la diferencia FALSE (el texto contradice) / NOT GIVEN (el texto no lo dice) debe ser nítida.
3. **Longitudes.** TOEFL Academic Passage ≈ 180–300 palabras; Complete the Words ≈ 70–100 palabras; Daily Life ≈ 40–200 palabras. IELTS Reading 700–950 palabras por texto. IELTS Listening: guion de 450–800 palabras por parte.
4. **Huecos IELTS.** La respuesta aparece tal cual en el texto/guion; respeta el límite de palabras; incluye variantes (`["colour", "color"]`, `["3", "three"]`). En Listening, el orden de las preguntas sigue el orden del audio.
5. **Audio (TTS).** Los guiones se leen con la Web Speech API: escribe frases naturales, sin acotaciones entre paréntesis ni efectos de sonido. Para deletrear, usa letras separadas por guiones ("That's S-M-Y-T-H-E") y números como se dicen. Varía los acentos (`en-GB`, `en-US`, `en-AU`, `en-CA`, `en-NZ`).
6. **Simulacros:** el contenido `mock` no se reutiliza en práctica.

## 6. Ejemplos mínimos

```json
// toefl/reading/complete-words.json
[{
  "id": "toefl-ctw-01", "difficulty": "medium", "usage": "practice",
  "task": "complete-words", "title": "Desert plants",
  "text": "Desert plants have developed remarkable strategies to survive long droughts. Many [[species|spec]] store water in [[thick|thi]] stems, while [[others|oth]] ..."
}]
```

```json
// ielts/listening/part1.json (fragmento de un grupo)
{
  "id": "g1", "qtype": "form-completion",
  "instructions": "Questions 1–5\nComplete the form below.\nWrite ONE WORD AND/OR A NUMBER for each answer.",
  "title": "Riverside Sports Centre – Membership form",
  "template": "Name: Anna {{q1}}\nPostcode: {{q2}}\nPreferred class: {{q3}} yoga",
  "items": [
    { "id": "q1", "kind": "gap", "qtype": "form-completion", "answers": ["Kowalski"], "maxWords": 1, "allowNumber": true,
      "explanation": "She spells it: K-O-W-A-L-S-K-I.", "evidence": "It's K-O-W-A-L-S-K-I" }
  ]
}
```

Para añadir contenido: crea o amplía el JSON, ejecuta `npm run test:content` y listo; la app lo detecta sola (carga por `import.meta.glob`).
