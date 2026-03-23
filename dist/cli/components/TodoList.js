import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Box, Text } from 'ink';
export function TodoList({ todos }) {
    if (todos.length === 0) {
        return (_jsx(Box, { paddingX: 1, children: _jsx(Text, { dimColor: true, children: "No tasks" }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "magenta", children: "Tasks" }) }), todos.map((todo, i) => {
                let icon;
                let color;
                switch (todo.status) {
                    case 'completed':
                        icon = '✓';
                        color = 'green';
                        break;
                    case 'in_progress':
                        icon = '→';
                        color = 'yellow';
                        break;
                    default:
                        icon = '○';
                        color = 'gray';
                }
                return (_jsxs(Box, { children: [_jsxs(Text, { color: color, children: [icon, " "] }), _jsx(Text, { strikethrough: todo.status === 'completed', dimColor: todo.status === 'completed', children: todo.content })] }, todo.id));
            })] }));
}
export function TodoBar({ todos, expanded = false, onToggle }) {
    // Filter to show only active tasks (in_progress first, then pending)
    const activeTodos = todos.filter(t => t.status !== 'completed');
    const completedCount = todos.filter(t => t.status === 'completed').length;
    if (todos.length === 0) {
        return null;
    }
    // Sort: in_progress first, then pending
    const sorted = [...activeTodos].sort((a, b) => {
        if (a.status === 'in_progress' && b.status !== 'in_progress')
            return -1;
        if (b.status === 'in_progress' && a.status !== 'in_progress')
            return 1;
        return 0;
    });
    const inProgress = sorted.find(t => t.status === 'in_progress');
    const pendingCount = sorted.filter(t => t.status === 'pending').length;
    // Expanded view - show all todos
    if (expanded) {
        return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "gray", paddingX: 1, marginY: 0, children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, color: "magenta", children: "Tasks" }), _jsxs(Text, { dimColor: true, children: [" (", completedCount, "/", todos.length, " done)"] })] }), todos.map((todo) => {
                    let checkbox;
                    let color;
                    switch (todo.status) {
                        case 'completed':
                            checkbox = '[✓]';
                            color = 'green';
                            break;
                        case 'in_progress':
                            checkbox = '[→]';
                            color = 'yellow';
                            break;
                        default:
                            checkbox = '[ ]';
                            color = 'gray';
                    }
                    return (_jsxs(Box, { children: [_jsxs(Text, { color: color, children: [checkbox, " "] }), _jsx(Text, { strikethrough: todo.status === 'completed', dimColor: todo.status === 'completed', children: todo.content })] }, todo.id));
                }), _jsx(Text, { dimColor: true, children: "Press t to collapse" })] }));
    }
    // Collapsed view - single line
    return (_jsxs(Box, { children: [_jsx(Text, { dimColor: true, color: "gray", children: "[" }), inProgress ? (_jsxs(_Fragment, { children: [_jsx(Text, { color: "yellow", children: "\u2192" }), _jsx(Text, { dimColor: true, color: "gray", children: "] " }), _jsx(Text, { children: inProgress.content.length > 50 ? inProgress.content.slice(0, 50) + '...' : inProgress.content })] })) : pendingCount > 0 ? (_jsxs(_Fragment, { children: [_jsx(Text, { dimColor: true, children: " " }), _jsx(Text, { dimColor: true, color: "gray", children: "] " }), _jsxs(Text, { dimColor: true, children: [pendingCount, " pending"] })] })) : (_jsxs(_Fragment, { children: [_jsx(Text, { color: "green", children: "\u2713" }), _jsx(Text, { dimColor: true, color: "gray", children: "] " }), _jsx(Text, { dimColor: true, children: "All done" })] })), (inProgress && pendingCount > 0) && (_jsxs(Text, { dimColor: true, children: [" +", pendingCount] })), completedCount > 0 && (_jsxs(Text, { color: "green", children: [" \u2713", completedCount] })), _jsx(Text, { dimColor: true, children: " (t:expand)" })] }));
}
//# sourceMappingURL=TodoList.js.map