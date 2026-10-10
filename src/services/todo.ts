import fs from 'node:fs';
import path from 'node:path';
import type { TodoTask } from '../shared/types';

function tasksPath(userDataPath: string): string {
  return path.join(userDataPath, 'todo-tasks.json');
}

export function readTodoTasks(userDataPath: string, defaults: TodoTask[] = []): TodoTask[] {
  try {
    return JSON.parse(fs.readFileSync(tasksPath(userDataPath), 'utf8')) as TodoTask[];
  } catch {
    return defaults;
  }
}

export function saveTodoTasks(userDataPath: string, value: unknown): TodoTask[] {
  if (!Array.isArray(value) || value.some(task =>
    !task || typeof task.id !== 'string' || typeof task.title !== 'string' ||
    !['routine', 'event'].includes(task.kind) || !Array.isArray(task.completedOn)
  )) {
    throw new Error('Invalid todo task list');
  }
  const tasks = value as TodoTask[];
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(tasksPath(userDataPath), JSON.stringify(tasks, null, 2));
  return tasks;
}