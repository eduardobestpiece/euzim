/**
 * Alias de compatibilidade: builds antigos (ex. main @ e144877) importam
 * `@/lib/stories/game-store`, enquanto o módulo canônico é `games-store`.
 */
export {
  type QuizProgress,
  getQuizProgress,
  saveQuizProgress,
} from "@/lib/stories/games-store";
