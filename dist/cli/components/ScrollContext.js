import { createContext, useContext } from 'react';
export const ScrollContext = createContext({ paused: false });
export function useScrollPaused() {
    return useContext(ScrollContext).paused;
}
//# sourceMappingURL=ScrollContext.js.map