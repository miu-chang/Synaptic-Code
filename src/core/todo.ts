export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export class TodoManager {
  private todos: TodoItem[] = [];

  add(content: string): TodoItem {
    const todo: TodoItem = {
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      content,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.todos.push(todo);
    return todo;
  }

  addMultiple(contents: string[]): TodoItem[] {
    return contents.map((content) => this.add(content));
  }

  update(id: string, updates: Partial<Pick<TodoItem, 'content' | 'status'>>): TodoItem | null {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) return null;

    if (updates.content !== undefined) todo.content = updates.content;
    if (updates.status !== undefined) todo.status = updates.status;
    todo.updatedAt = Date.now();

    return todo;
  }

  setStatus(id: string, status: TodoItem['status']): TodoItem | null {
    return this.update(id, { status });
  }

  startTask(id: string): TodoItem | null {
    return this.setStatus(id, 'in_progress');
  }

  completeTask(id: string): TodoItem | null {
    return this.setStatus(id, 'completed');
  }

  remove(id: string): boolean {
    const index = this.todos.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.todos.splice(index, 1);
    return true;
  }

  clear(): void {
    this.todos = [];
  }

  clearCompleted(): number {
    const before = this.todos.length;
    this.todos = this.todos.filter((t) => t.status !== 'completed');
    return before - this.todos.length;
  }

  get(id: string): TodoItem | undefined {
    return this.todos.find((t) => t.id === id);
  }

  getAll(): TodoItem[] {
    return [...this.todos];
  }

  getPending(): TodoItem[] {
    return this.todos.filter((t) => t.status === 'pending');
  }

  getInProgress(): TodoItem[] {
    return this.todos.filter((t) => t.status === 'in_progress');
  }

  getCompleted(): TodoItem[] {
    return this.todos.filter((t) => t.status === 'completed');
  }

  getNextPending(): TodoItem | undefined {
    return this.todos.find((t) => t.status === 'pending');
  }

  format(): string {
    if (this.todos.length === 0) {
      return 'No tasks in todo list.';
    }

    const statusIcon = (status: TodoItem['status']) => {
      switch (status) {
        case 'completed':
          return '✓';
        case 'in_progress':
          return '→';
        case 'pending':
          return '○';
      }
    };

    return this.todos
      .map((t, i) => `${i + 1}. [${statusIcon(t.status)}] ${t.content}`)
      .join('\n');
  }

  toJSON(): TodoItem[] {
    return this.todos;
  }

  fromJSON(data: TodoItem[]): void {
    this.todos = data;
  }

  getStats(): { total: number; pending: number; inProgress: number; completed: number } {
    return {
      total: this.todos.length,
      pending: this.getPending().length,
      inProgress: this.getInProgress().length,
      completed: this.getCompleted().length,
    };
  }
}
