import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().default('User'),
  email: text('email').unique().notNull(),
  password: text('password'),
  password_hash: text('password_hash'),
  role: text('role').default('user').notNull(),
  is_admin: boolean('is_admin').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  student_count: integer('student_count').default(0).notNull(),
  subject_count: integer('subject_count').default(0).notNull(),
  data: text('data'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  user: one(users, {
    fields: [projects.user_id],
    references: [users.id],
  }),
}));
