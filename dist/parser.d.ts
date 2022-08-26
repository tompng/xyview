import { ValueFunction2D, RangeFunction2D } from 'numcore';
export declare type FillMode = {
    positive: boolean;
    negative: boolean;
    zero: boolean;
};
declare type ValueFunction1D = (x: number) => number;
declare type RangeFunction1D = (min: number, max: number) => ReturnType<RangeFunction2D>;
export declare type ParsedEquation2D = {
    type: 'eq';
    key: string;
    fillMode: FillMode;
    valueFunc: ValueFunction2D;
    rangeFunc: RangeFunction2D;
    calcType: 'xy';
    warn?: string;
};
export declare type ParsedEquation1D = {
    type: 'eq';
    key: string;
    fillMode: FillMode;
    valueFunc: ValueFunction1D;
    rangeFunc: RangeFunction1D;
    calcType: 'x' | 'y' | 'fx' | 'fy';
    warn?: string;
};
export declare type ParsedEquation = ParsedEquation1D | ParsedEquation2D;
export declare type ParsedBlank = {
    type: 'blank';
};
export declare type ParsedDefinition = {
    type: 'func' | 'var';
    name: string;
};
export declare type ParsedError = {
    type: 'error';
    error: string;
};
export declare type ParsedFormula = ParsedEquation | ParsedDefinition | ParsedError | ParsedBlank;
export declare function parseFormulas(expressions: string[]): ParsedFormula[];
export {};
