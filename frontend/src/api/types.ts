import type { components } from "./schema";

type Schemas = components["schemas"];

export type Level = Schemas["Level"];
export type Section = Schemas["Section"];
export type TopicSummary = Schemas["TopicSummary"];
export type TopicRef = Schemas["TopicRef"];
export type TopicDetail = Schemas["TopicDetail"];
export type BlockKind = Schemas["BlockKind"];
export type Example = Schemas["Example"];
export type MarkedText = Schemas["MarkedText"];
export type GlossedWord = Schemas["GlossedWord"];
export type Notation = Schemas["Notation"];
