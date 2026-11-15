import { createBibleCurriculum } from './bibleCurriculumFactory';
import { OLD_TESTAMENT_SEEDS } from './bibleCurriculumOld';
import { NEW_TESTAMENT_SEEDS } from './bibleCurriculumNew';

/** Twenty additional complete bilingual offline Bible lessons, in biblical order.
 * The original twelve bundled stories and their published IDs remain unchanged.
 */
const curriculum = createBibleCurriculum([...OLD_TESTAMENT_SEEDS, ...NEW_TESTAMENT_SEEDS]);
export const EXTRA_BIBLE_STORIES = curriculum.stories;
export const EXTRA_BIBLE_LESSONS = curriculum.lessons;
