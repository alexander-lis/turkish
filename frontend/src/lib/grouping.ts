import type { Section, TopicSummary } from "../api/types.ts";

export interface TopicGroup {
  key: string;
  title: string;
  topics: TopicSummary[];
}

/**
 * Темы по уровням. Учебный маршрут идёт по неубыванию уровней, поэтому достаточно
 * резать его там, где уровень меняется: группы получаются в порядке от A1 к B2.
 */
export function groupByLevel(topics: TopicSummary[]): TopicGroup[] {
  const groups: TopicGroup[] = [];
  for (const topic of topics) {
    const last = groups.at(-1);
    if (last?.key === topic.level) {
      last.topics.push(topic);
    } else {
      groups.push({ key: topic.level, title: topic.level, topics: [topic] });
    }
  }
  return groups;
}

/** Темы по разделам: разделы в заданном порядке, темы внутри — в порядке маршрута. */
export function groupBySection(
  topics: TopicSummary[],
  sections: Section[],
): TopicGroup[] {
  return sections
    .map((section) => ({
      key: section.id,
      title: section.title,
      topics: topics.filter((topic) => topic.section_id === section.id),
    }))
    .filter((group) => group.topics.length > 0);
}
