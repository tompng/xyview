import { ValueFunction2D, RangeFunction2D } from 'numcore';
export declare type ParsedEquation = {
    type: 'eq';
    valueFuncCode: string;
    valueFunc: ValueFunction2D;
    rangeFunc: RangeFunction2D;
    mode: {
        positive: boolean;
        negative: boolean;
        zero: boolean;
    };
};
export declare type ParsedDefinition = {
    type: 'func' | 'var';
    name: string;
};
export declare type ParsedError = {
    type: 'error';
    error: string;
};
export declare type ParsedFormula = ParsedEquation | ParsedDefinition | ParsedError;
export declare function parseFormulas(expressions: string[]): ParsedFormula[];
declare type RenderingRange = {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
};
export declare function render(canvas: HTMLCanvasElement, size: number, offset: number, range: RenderingRange, formula: ParsedEquation, renderMode: {
    color: string;
    lineWidth: number;
    fillAlpha: number;
}): void;
export {};
