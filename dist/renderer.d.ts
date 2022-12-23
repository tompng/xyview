import { ParsedEquation1D, ParsedEquation2D, ParsedParametric } from './parser';
declare type RenderingRange = {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
};
export declare function render2D(canvas: HTMLCanvasElement, size: number, offset: number, range: RenderingRange, formula: ParsedEquation2D, renderMode: {
    color: string;
    lineWidth: number;
    fillAlpha: number;
}): void;
declare type RangeResult1D = {
    fills: [number, number][];
    plots: number[];
    alphaFills: [number, number, number][];
};
declare type CurveResult = number[][];
export declare type CalcResult1D = RangeResult1D | CurveResult;
export declare function calc1DRange(formula: ParsedEquation1D, size: number, min: number, max: number): RangeResult1D;
export declare function calc1DCurves(formula: ParsedEquation1D, size: number, min: number, max: number): CurveResult;
export declare function render1D(canvas: HTMLCanvasElement, size: number, offset: number, range: RenderingRange, formula: ParsedEquation1D, result: RangeResult1D | CurveResult, renderMode: {
    color: string;
    lineWidth: number;
    fillAlpha: number;
}): void;
export declare function renderParametric(canvas: HTMLCanvasElement, size: number, offset: number, range: RenderingRange, formula: ParsedParametric, renderMode: {
    color: string;
    lineWidth: number;
    fillAlpha: number;
}): void;
export declare function renderPoint(canvas: HTMLCanvasElement, size: number, offset: number, range: RenderingRange, point: {
    x: number;
    y: number;
}, renderMode: {
    color: string;
    lineWidth: number;
    fillAlpha: number;
}): void;
export {};
