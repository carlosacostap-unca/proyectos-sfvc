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

    export interface DeltaStatic {
        ops?: any[];
        retain?: any;
        delete?: any;
        insert?: any;
        attributes?: any;
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
        modules?: any;
        onChange?: (content: string, delta: DeltaStatic, source: Sources, editor: UnprivilegedEditor) => void;
        onChangeSelection?: (range: RangeStatic, source: Sources, editor: UnprivilegedEditor) => void;
        onFocus?: (range: RangeStatic, source: Sources, editor: UnprivilegedEditor) => void;
        onBlur?: (previousRange: RangeStatic, source: Sources, editor: UnprivilegedEditor) => void;
        onKeyDown?: React.EventHandler<any>;
        onKeyPress?: React.EventHandler<any>;
        onKeyUp?: React.EventHandler<any>;
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
        getEditor(): any;
    }
}
