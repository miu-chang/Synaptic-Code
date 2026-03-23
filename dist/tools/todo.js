import { TodoManager } from '../core/todo.js';
// Shared todo manager instance
let todoManager = null;
export function setTodoManager(manager) {
    todoManager = manager;
}
export function getTodoManager() {
    if (!todoManager) {
        todoManager = new TodoManager();
    }
    return todoManager;
}
export const todoWriteTool = {
    definition: {
        type: 'function',
        function: {
            name: 'todo_write',
            description: 'Create or update the todo list. Use this to track tasks and show progress to the user.',
            parameters: {
                type: 'object',
                properties: {
                    todos: {
                        type: 'array',
                        description: 'Array of todo items',
                        items: {
                            type: 'object',
                            properties: {
                                content: {
                                    type: 'string',
                                    description: 'The task description',
                                },
                                status: {
                                    type: 'string',
                                    enum: ['pending', 'in_progress', 'completed'],
                                    description: 'The task status',
                                },
                            },
                            required: ['content', 'status'],
                        },
                    },
                },
                required: ['todos'],
            },
        },
    },
    async execute(args) {
        const { todos } = args;
        const manager = getTodoManager();
        manager.clear();
        for (const todo of todos) {
            const item = manager.add(todo.content);
            manager.setStatus(item.id, todo.status);
        }
        return JSON.stringify({
            success: true,
            todos: manager.getAll(),
            formatted: manager.format(),
        });
    },
};
export const todoAddTool = {
    definition: {
        type: 'function',
        function: {
            name: 'todo_add',
            description: 'Add a new task to the todo list',
            parameters: {
                type: 'object',
                properties: {
                    content: {
                        type: 'string',
                        description: 'The task description',
                    },
                },
                required: ['content'],
            },
        },
    },
    async execute(args) {
        const { content } = args;
        const manager = getTodoManager();
        const todo = manager.add(content);
        return JSON.stringify({
            success: true,
            todo,
            formatted: manager.format(),
        });
    },
};
export const todoUpdateTool = {
    definition: {
        type: 'function',
        function: {
            name: 'todo_update',
            description: 'Update a todo item status',
            parameters: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'The todo item ID',
                    },
                    status: {
                        type: 'string',
                        enum: ['pending', 'in_progress', 'completed'],
                        description: 'The new status',
                    },
                },
                required: ['id', 'status'],
            },
        },
    },
    async execute(args) {
        const { id, status } = args;
        const manager = getTodoManager();
        const todo = manager.setStatus(id, status);
        if (!todo) {
            return JSON.stringify({ error: `Todo not found: ${id}` });
        }
        return JSON.stringify({
            success: true,
            todo,
            formatted: manager.format(),
        });
    },
};
export const todoListTool = {
    definition: {
        type: 'function',
        function: {
            name: 'todo_list',
            description: 'List all todo items',
            parameters: {
                type: 'object',
                properties: {},
            },
        },
    },
    async execute() {
        const manager = getTodoManager();
        return JSON.stringify({
            todos: manager.getAll(),
            stats: manager.getStats(),
            formatted: manager.format(),
        });
    },
};
export const todoTools = [todoWriteTool, todoAddTool, todoUpdateTool, todoListTool];
//# sourceMappingURL=todo.js.map