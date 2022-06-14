import { ParsedFormula, ParsedEquation, ParsedEquation1D } from './parser';
import { CalcResult1D } from './renderer';
export declare type Size = {
    width: number;
    height: number;
};
import { TupleMap } from './tuplemap';
export declare type RenderOption = {
    background: string | null;
    order: ('axis' | 'graph' | 'label')[];
    lineWidth: number;
    axisInterval: number | null;
    axisWidth: number;
    labelSize: number | null;
};
declare type Vector2D = {
    x: number;
    y: number;
};
export declare type Viewport = {
    center: Vector2D;
    sizePerPixel: Vector2D;
};
declare type FormulaAppearance = {
    color: string | null;
    fillAlpha?: number;
};
declare type FormulaExpression = {
    tex: string;
    plain?: undefined;
} | {
    tex?: undefined;
    plain: string;
};
declare type FormulaResult = {
    parsed: ParsedFormula;
};
export declare type FormulaInput = FormulaExpression & FormulaAppearance;
export declare type Formula = FormulaInput & FormulaResult;
export declare type UpdateAttributes = {
    size?: Partial<Size>;
    viewport?: Partial<Viewport>;
    rendering?: Partial<RenderOption>;
    formulas?: FormulaInput[];
    inChange?: boolean;
    calcPaused?: boolean;
};
declare type Panel = {
    canvases: TupleMap<RenderKey, HTMLCanvasElement>;
    dx: number;
    dy: number;
    ix: number;
    iy: number;
};
declare type RenderKey = [string, number, ParsedEquation];
export declare class View {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    formulas: Formula[];
    rendering: RenderOption;
    viewport: Viewport;
    needsRender: boolean;
    calcPaused: boolean;
    panelSize: number;
    calculationTime: number;
    panels: Map<string, Panel>;
    cache: TupleMap<[ix: number | null, iy: number | null, delta: number, parsed: ParsedEquation1D], CalcResult1D>;
    constructor(info?: UpdateAttributes);
    updateFormulas(inputs: FormulaInput[]): Formula[];
    updateRendering(rendering: RenderOption): void;
    invalidatePanels(): void;
    release(): void;
    updateSize({ width, height }: Size): void;
    updateViewport(viewport: Viewport): void;
    update({ size, viewport, rendering, formulas, calcPaused }: UpdateAttributes): void;
    panelRange(): {
        ixMin: number;
        ixMax: number;
        iyMin: number;
        iyMax: number;
    };
    isCalculationCompleted(): boolean;
    calculate(): void;
    render(calculate?: boolean): void;
    prepareAxisLabelRenderer(ctx: CanvasRenderingContext2D): {
        renderLabel: () => void;
        renderAxis: () => void;
    };
}
export {};
