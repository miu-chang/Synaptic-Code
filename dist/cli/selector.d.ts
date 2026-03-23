export interface SelectorOption {
    label: string;
    value: string;
    description?: string;
}
export declare function selectOption(title: string, options: SelectorOption[], currentValue?: string): Promise<string | null>;
export declare function selectProvider(): Promise<string | null>;
//# sourceMappingURL=selector.d.ts.map