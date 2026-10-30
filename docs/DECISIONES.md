# Decisiones tomadas

Registro de las decisiones de diseño y producto tomadas sin consulta, con su motivo. Orden de prioridad aplicado cuando chocaban: **gratis → fiel al examen → bonito**.

## Producto

| Decisión | Motivo |
|---|---|
| Nombre **Umbral** | «Umbral» es la nota mínima que hay que cruzar (SJTU, KAIST, 7.0 de IELTS). Corto, en español y sin marcas registradas. |
| La app vive en `C:\CHINA\PRACTICA INGLES\web` | Era la carpeta sugerida en el encargo. |
| Formato TOEFL: el de 2026 según el blueprint de ETS | Ver `FORMATOS.md`. Los tiempos por tarea que ETS no publica (7 min el email, 10 min la discusión, 45 s la entrevista) se tratan como aproximados y se indica así. |
| Simulacros TOEFL: módulo 1 = 1 Complete the Words + 2 Daily Life + 1 Academic Passage (20 ítems); módulo 2 = 1 + 1 + 1 (18 ítems) | El blueprint da 50 ítems de Reading **incluidos los no puntuables** y 30 de Complete the Words. Para no alargar sin necesidad, usamos 2 párrafos de Complete the Words por recorrido (20 huecos). Listening: 8 Choose a Response + 2 conversaciones + 1 anuncio + 1 charla en el módulo 1 y 7 + 1 + 1 + 1 en el 2. |
| Tiempos de módulo TOEFL: Reading 18 + 9 min; Listening 18 + 7 (fácil) / 11 (difícil) min; Writing 6 + 7 + 10 min | Valores del blueprint de ETS. Build a Sentence (6 min) se deduce de los 23 min totales menos email y discusión. |
| Enrutado adaptativo: ≥ 60 % de aciertos en el módulo 1 → módulo difícil | ETS no publica el umbral. El módulo fácil limita la banda máxima a 4.5 (como en un test multietapa real). |
| Conversión aciertos → banda TOEFL (R/L) y puntos → banda (W/S) | ETS no publica la conversión. Se usan tablas propias monótonas y prudentes, comprobadas con tests, y siempre se presentan como **estimación**. |
| Writing TOEFL: 30 % Build a Sentence, 70 % Email + Discusión | Las tareas de producción discriminan más nivel; la suma bruta (10 + 5 + 5) daría demasiado peso al Build a Sentence. |
| IELTS: tabla aproximada aciertos/40 → banda ampliamente difundida | IELTS sólo publica anclajes (16/23/30/35 ≈ 5/6/7/8 en Listening; 15/23/30/35 en Academic Reading). La tabla usada respeta esos anclajes. |
| IELTS Writing: (Task 1 + 2 × Task 2) / 3 con el redondeo oficial a media banda | Task 2 cuenta el doble (oficial). El redondeo de la nota de Writing no es público; se usa el mismo que el global. |
| Texto por debajo del mínimo en IELTS: se avisa y se limita la estimación de Task Achievement/Response | La página oficial no fija una penalización automática; la limitación refleja la práctica habitual de corrección y se explica como tal. |
| Mala ortografía en huecos = error; se aceptan variantes UK/US listadas | Regla del examen. La app avisa de que la respuesta estaba «casi bien» para que aprendas. |
| Respuestas «choose TWO» valen 1 punto por letra | Así se puntúa en IELTS; el validador cuenta puntos, no ítems. |
| Speaking: sin evaluación real de pronunciación | El navegador no lo permite gratis. Se usa sólo la confianza del reconocedor de voz como pista débil y se dice explícitamente. |
| Listen and Repeat: precisión palabra a palabra (F1 sobre LCS) → 0–5 | Penaliza tanto palabras que faltan como añadidas; las contracciones no penalizan. |
| Gemini opcional (`gemini-2.5-flash`), clave sólo en el navegador | Tiene capa gratuita. La clave nunca se exporta ni se sube al repo. |
| LanguageTool: API pública con 3 s entre peticiones | Respeta el límite público (~20 peticiones/min por IP). Si falla, la estimación usa sólo el analizador propio. |
| Instrucciones de examen escritas por nosotros | Para no copiar las instrucciones literales de ETS/IELTS, que tienen copyright; se imita el estilo. |
| Score report «tipo oficial» sin logos ni marcas | Requisito del encargo y legal. |
| El contenido de mock no aparece en práctica (`usage: "mock"`) | Para que el simulacro no esté «quemado». |

## Técnica

| Decisión | Motivo |
|---|---|
| Vite 8 + React 19 + TypeScript 7, Tailwind 4, Radix UI, Motion, Lucide, Recharts, Zod | El stack pedido. En lugar de copiar componentes de shadcn/ui con su CLI, se escribieron componentes propios sobre Radix (mismo enfoque, menos dependencias y sin pasos interactivos). |
| `HashRouter` + `base: './'` | Funciona en `https://usuario.github.io/<cualquier-repo>/` sin 404 ni configurar el nombre del repo. |
| Estado con Zustand; progreso en **IndexedDB** (adaptador propio) y preferencias ligeras en localStorage | IndexedDB aguanta mucho más volumen (intentos, SRS); las preferencias se leen antes de pintar para evitar el parpadeo de tema. |
| Exportar/importar progreso en JSON | Sois dos personas en dos navegadores; no hay backend. |
| Contenido en JSON validado con Zod en tests (`npm run test:content`) y cargado bajo demanda con `import.meta.glob` | Separado del código, fácil de ampliar y cada banco es su propio chunk (carga rápida). En el navegador no se vuelve a validar para no penalizar el rendimiento. |
| i18n con pares en línea `t('Inicio', 'Home')` | Para dos idiomas, mantener diccionarios separados es más frágil que tener ambos textos juntos. El contenido de examen siempre va en inglés. |
| TTS con la Web Speech API, voz estable por hablante y acento; troceo por frases | Gratis. Chrome corta locuciones largas si no se trocean. Si falta un acento, se usa el más cercano y se avisa en Ajustes. |
| Reconocimiento de voz con reinicio automático | Chrome detiene SpeechRecognition tras silencios; se relanza mientras se graba. Sin soporte (Firefox/Safari), se graba igualmente y se puede escribir la transcripción. |
| Temporizadores basados en hora de fin (`endsAt`) | Sobreviven a recargas: si cierras la pestaña, el tiempo sigue corriendo como en el examen real (salvo en modo flexible). |
| Autoguardado de simulacros en curso y borradores de práctica | Requisito: retomar si se cierra la pestaña. El audio en curso no se puede reanudar a mitad: la parte vuelve a empezar. |
| PWA con `vite-plugin-pwa` (precache de todo el contenido) | Uso offline del temario y ejercicios; ~3,8 MB precacheados. LanguageTool, Gemini y los vídeos necesitan conexión. |
| Contenido generado por subagentes en paralelo + 4 revisores independientes | Encargo §5. Los revisores corrigieron ~80 problemas (claves dudosas, huecos ambiguos, datos falsos, discrepancias de números en modelos de Task 1). |
| Requisitos SJTU/KAIST precargados | Tomados del encargo (SJTU 4.0 global con R4 L4.5 S4 W4.5; KAIST 4.5). No se han verificado en las webs de las universidades: compruébalos. Editables en Ajustes. |
