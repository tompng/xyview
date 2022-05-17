import { ParsedFormula } from './renderer';
export declare type Size = {
    width: number;
    height: number;
};
export declare type RenderOption = {
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
    canvases: HTMLCanvasElement[];
    dx: number;
    dy: number;
    ix: number;
    iy: number;
};
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
    constructor(info?: UpdateAttributes);
    updateFormulas(inputs: FormulaInput[]): Formula[];
    updateRendering(rendering: RenderOption): void;
    invalidatePanels(): void;
    updateSize({ width, height }: Size): void;
    updateViewport(viewport: Viewport): void;
    update({ size, viewport, rendering, formulas, calcPaused }: UpdateAttributes): void;
    calculate(): void;
    render(): void;
    renderAxis(ctx: CanvasRenderingContext2D): void;
}
export {};
