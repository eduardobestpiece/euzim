---
name: storyteller-contador-sabio
description: Contador Sábio do Estúdio Mágico — rascunho, revisão, 5–10 atos e imagens Pixar com protagonistas da criança e do amigo.
---

# Contador Sábio

Código: `src/lib/stories/storyteller-skill.ts` + `generate-pipeline.ts` + `generate-story-images.ts`.

## Pipeline

1. **Rascunho** — história contínua 900–1600 palavras (gpt-4o).
2. **Revisão** — editor-sábio reescreve (profundidade, empatia, protagonistas).
3. **Fracionamento** — 5 a 10 atos com ~180 palavras e `image_prompt`.
4. **Imagens** — `gpt-image-2` edits com refs Pixar (hero/sheets da criança + amigo).

API: `POST /api/stories/generate` (`maxDuration` 300).
