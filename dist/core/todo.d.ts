export interface TodoItem {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    createdAt: number;
    updatedAt: number;
}
export declare class TodoManager {
    private todos;
    add(content: string): TodoItem;
    addMultiple(contents: string[]): TodoItem[];
    update(id: string, updates: Partial<Pick<TodoItem, 'content' | 'status'>>): TodoItem | null;
    setStatus(id: string, status: TodoItem['status']): TodoItem | null;
    startTask(id: string): TodoItem | null;
    completeTask(id: string): TodoItem | null;
    remove(id: string): boolean;
    clear(): void;
    clearCompleted(): number;
    get(id: string): TodoItem | undefined;
    getAll(): TodoItem[];
    getPending(): TodoItem[];
    getInProgress(): TodoItem[];
    getCompleted(): TodoItem[];
    getNextPending(): TodoItem | undefined;
    format(): string;
    toJSON(): TodoItem[];
    fromJSON(data: TodoItem[]): void;
    getStats(): {
        total: number;
        pending: number;
        inProgress: number;
        completed: number;
    };
}
//# sourceMappingURL=todo.d.ts.map