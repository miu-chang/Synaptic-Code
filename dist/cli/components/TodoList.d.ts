import React from 'react';
interface Todo {
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
}
interface TodoListProps {
    todos: Todo[];
}
export declare function TodoList({ todos }: TodoListProps): React.ReactElement;
/**
 * Compact TODO bar for bottom of screen (Claude Code style)
 * Shows only in-progress and pending tasks inline
 * Press 't' to expand/collapse the full list
 */
interface TodoBarProps {
    todos: Todo[];
    expanded?: boolean;
    onToggle?: () => void;
}
export declare function TodoBar({ todos, expanded, onToggle }: TodoBarProps): React.ReactElement | null;
export {};
//# sourceMappingURL=TodoList.d.ts.map