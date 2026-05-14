import React from 'react';

declare module 'react-quill-new' {
    export interface UnprivilegedEditor {
        getLength(): number;
        getText(index?: number, length?: number): string;
        getHTML(): string;
        getBounds(index: number, length?: number): ClientRect;
        getSelection(focus?: boolean): RangeStatic;
        getContents(index?: number, length?: number): DeltaStatic;
    }

    export interface RangeStatic {
        index: number;
        length: number;
    }

    export interface DeltaOperation {
        retain?: number;
        delete?: number;
        insert?: string | Record<string, unknown>;
        attributes?: Record<string, unknown>;
    }

    export interface DeltaStatic {
        ops?: DeltaOperation[];
        retain?: number;
        delete?: number;
        insert?: string | Record<string, unknown>;
        attributes?: Record<string, unknown>;
    }

    export interface Sources {
        API: 'api';
        USER: 'user';
        SILENT: 'silent';
    }

    export interface ReactQuillProps {
        bounds?: string | HTMLElement;
        children?: React.ReactNode;
        className?: string;
        defaultValue?: string | DeltaStatic;
        formats?: string[];
        id?: string;
        modules?: Record<string, unknown>;
        onChange?: (content: string, delta: DeltaStatic, source: Sources, editor: UnprivilegedEditor) => void;
        onChangeSelection?: (range: RangeStatic, source: Sources, editor: UnprivilegedEditor) => void;
        onFocus?: (range: RangeStatic, source: Sources, editor: UnprivilegedEditor) => void;
        onBlur?: (previousRange: RangeStatic, source: Sources, editor: UnprivilegedEditor) => void;
        onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
        onKeyPress?: React.KeyboardEventHandler<HTMLElement>;
        onKeyUp?: React.KeyboardEventHandler<HTMLElement>;
        placeholder?: string;
        preserveWhitespace?: boolean;
        readOnly?: boolean;
        scrollingContainer?: string | HTMLElement;
        style?: React.CSSProperties;
        tabIndex?: number;
        theme?: string;
        value?: string | DeltaStatic;
    }

    export default class ReactQuill extends React.Component<ReactQuillProps> {
        focus(): void;
        blur(): void;
        getEditor(): unknown;
    }
}
