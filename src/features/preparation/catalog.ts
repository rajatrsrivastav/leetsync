import { coreLessons } from './coreContent';
import { practiceLessons } from './practiceContent';
export const preparationLessons = [...coreLessons, ...practiceLessons];
export const lessonById = (id: string) => preparationLessons.find((lesson) => lesson.id === id);
