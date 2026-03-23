declare module 'marked-terminal' {
  import { MarkedExtension } from 'marked';

  interface MarkedTerminalOptions {
    code?: (code: string, lang?: string) => string;
    codespan?: (code: string) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    heading?: (text: string, level: number) => string;
    listitem?: (text: string) => string;
    link?: (href: string, title: string | null, text: string) => string;
    hr?: () => string;
    blockquote?: (text: string) => string;
  }

  export function markedTerminal(options?: MarkedTerminalOptions): MarkedExtension;
}
