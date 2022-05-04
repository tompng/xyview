import { ValueFunction2D, RangeFunction2D } from 'numcore';
export declare type ParsedFormula = {
    valueFunc: ValueFunction2D;
    rangeFunc: RangeFunction2D;
    mode: {
        positive: boolean;
        negative: boolean;
        zero: boolean;
    };
};
export declare function parseFormula(exp: string): ParsedFormula;
declare type RenderingRange = {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
};
export declare function render(canvas: HTMLCanvasElement, size: number, offset: number, range: RenderingRange, formula: ParsedFormula, renderMode: {
    color: string;
    lineWidth: number;
    fillAlpha: number;
}): void;
export {};
