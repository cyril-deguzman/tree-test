import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';

export const study = pgTable('study', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tree = pgTable('tree', {
  id: uuid('id').defaultRandom().primaryKey(),
  studyId: uuid('study_id').notNull().references(() => study.id, { onDelete: 'cascade' }),
  nodes: jsonb('nodes').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const task = pgTable('task', {
  id: uuid('id').defaultRandom().primaryKey(),
  studyId: uuid('study_id').notNull().references(() => study.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  expectedNodeIds: text('expected_node_id').array().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const participant = pgTable('participant', {
  id: uuid('id').defaultRandom().primaryKey(),
  studyId: uuid('study_id').notNull().references(() => study.id, { onDelete: 'cascade' }),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const response = pgTable('response', {
  id: uuid('id').defaultRandom().primaryKey(),
  participantId: uuid('participant_id').notNull().references(() => participant.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').notNull().references(() => task.id, { onDelete: 'cascade' }),
  selectedNodeId: text('selected_node_id'),
  isCorrect: boolean('is_correct'),
  confidence: integer('confidence'),
  durationMs: integer('duration_ms'),
  timeToFirstClickMs: integer('time_to_first_click_ms'),
  clickHistory: jsonb('click_history'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
