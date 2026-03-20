import { Column, ColumnType, Schema, Table } from '@powersync/web';

// PowerSync schema — defines what tables are synced to local SQLite
export const AppSchema = new Schema([
  new Table({
    name: 'knowledge_entries',
    columns: [
      new Column({ name: 'question', type: ColumnType.TEXT }),
      new Column({ name: 'answer', type: ColumnType.TEXT }),
      new Column({ name: 'tags', type: ColumnType.TEXT }),
      new Column({ name: 'user_id', type: ColumnType.TEXT }),
      new Column({ name: 'created_at', type: ColumnType.TEXT }),
      new Column({ name: 'updated_at', type: ColumnType.TEXT }),
    ],
  }),
]);

export type Database = (typeof AppSchema)['types'];
export type KnowledgeEntry = Database['knowledge_entries'];
