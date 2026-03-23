export class TodoManager {
    todos = [];
    add(content) {
        const todo = {
            id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            content,
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.todos.push(todo);
        return todo;
    }
    addMultiple(contents) {
        return contents.map((content) => this.add(content));
    }
    update(id, updates) {
        const todo = this.todos.find((t) => t.id === id);
        if (!todo)
            return null;
        if (updates.content !== undefined)
            todo.content = updates.content;
        if (updates.status !== undefined)
            todo.status = updates.status;
        todo.updatedAt = Date.now();
        return todo;
    }
    setStatus(id, status) {
        return this.update(id, { status });
    }
    startTask(id) {
        return this.setStatus(id, 'in_progress');
    }
    completeTask(id) {
        return this.setStatus(id, 'completed');
    }
    remove(id) {
        const index = this.todos.findIndex((t) => t.id === id);
        if (index === -1)
            return false;
        this.todos.splice(index, 1);
        return true;
    }
    clear() {
        this.todos = [];
    }
    clearCompleted() {
        const before = this.todos.length;
        this.todos = this.todos.filter((t) => t.status !== 'completed');
        return before - this.todos.length;
    }
    get(id) {
        return this.todos.find((t) => t.id === id);
    }
    getAll() {
        return [...this.todos];
    }
    getPending() {
        return this.todos.filter((t) => t.status === 'pending');
    }
    getInProgress() {
        return this.todos.filter((t) => t.status === 'in_progress');
    }
    getCompleted() {
        return this.todos.filter((t) => t.status === 'completed');
    }
    getNextPending() {
        return this.todos.find((t) => t.status === 'pending');
    }
    format() {
        if (this.todos.length === 0) {
            return 'No tasks in todo list.';
        }
        const statusIcon = (status) => {
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
    toJSON() {
        return this.todos;
    }
    fromJSON(data) {
        this.todos = data;
    }
    getStats() {
        return {
            total: this.todos.length,
            pending: this.getPending().length,
            inProgress: this.getInProgress().length,
            completed: this.getCompleted().length,
        };
    }
}
//# sourceMappingURL=todo.js.map