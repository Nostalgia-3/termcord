import { writeAllSync } from 'https://deno.land/std@0.224.0/io/mod.ts';

export type ScrollableStyle = {
    text_align?: 'left' | 'center' | 'right',
    fg?: number[],
    bg?: number[],
    fg_selected?: number[],
    bg_selected?: number[],
    bg_no_item?: number[],

    // inner text settings
    marginLeft?: number,
    marginRight?: number,
    
    bold?: boolean,
    italics?: boolean,
    underline?: boolean,
    strikethrough?: boolean
};

export type PlainTextStyle = {
    fg?: number[],
    bg?: number[],

    bold?: boolean,
    italics?: boolean,
    underline?: boolean,
    strikethrough?: boolean
};

export type ColorPanelStyle = {
    bg?: number[]
};

export type TextPanelStyle = {
    fg?: number[],
    bg?: number[],

    bold?: boolean,
    italics?: boolean,
    underline?: boolean,
    strikethrough?: boolean,

    /**
     * The alignment across the X-axis of the inner text
     */
    alignX?: 'left' | 'center' | 'right',
    /**
     * The alignment across the Y-axis of the inner text
     */
    alignY?: 'top' | 'center' | 'bottom',

    /**
     * Dertermines the style of the corners
     */
    corner?: 'regular' | '3thin' | '3thintop' | '3thinbottom',
    cbg?: number[]
};

export const TermControls = {
    write: (s: string) => { writeAllSync(Deno.stdout, new TextEncoder().encode(s)); },

    goTo: (x: number, y: number) => { TermControls.write(`\x1b[${y+1};${x+1}H`); },

    setX: (x: number) => { TermControls.write(`\x1b[${x}G`); },

    goUp:       (y: number) => { TermControls.write(`\x1b[${y}A`); },
    goDown:     (y: number) => { TermControls.write(`\x1b[${y}B`); },
    goRight:    (x: number) => { TermControls.write(`\x1b[${x}C`); },
    goLeft:     (x: number) => { TermControls.write(`\x1b[${x}D`); },

    bell: () => { TermControls.write(`\x07`); },

    bold: () => { return `\x1b[1m` },
    italics: () => { return `\x1b[3m` },
    underline: () => { return `\x1b[4m` },
    strikethrough: () => { return `\x1b[9m` },

    goToString: (x: number, y: number) => { return `\x1b[${y+1};${x+1}H`; },

    rgb: (c: number[], foreground: boolean) => { return (`\x1b[${foreground ? '38' : '48'};2;${c[0]};${c[1]};${c[2]}m`); },
    clear: () => { return `\x1b[0m`; }
};

/**
 * Format a format string
 * @param s A Format String
 * @returns A string with ansi escape codes
 */
export function formatStyleString(s: string, fg: number[], bg: number[]): string {
    const st = s
        .replaceAll(`$F_BLACK`,     `\x1b[30m`)
        .replaceAll(`$F_RED`,       `\x1b[31m`)
        .replaceAll(`$F_GREEN`,     `\x1b[32m`)
        .replaceAll(`$F_YELLOW`,    `\x1b[33m`)
        .replaceAll(`$F_BLUE`,      `\x1b[34m`)
        .replaceAll(`$F_MAGENTA`,   `\x1b[35m`)
        .replaceAll(`$F_CYAN`,      `\x1b[36m`)
        .replaceAll(`$F_WHITE`,     `\x1b[37m`)
        .replaceAll(`$F_GRAY`,      `\x1b[38;2;127;127;127m`)
        .replaceAll(`$B_BLACK`,     `\x1b[40m`)
        .replaceAll(`$B_RED`,       `\x1b[41m`)
        .replaceAll(`$B_GREEN`,     `\x1b[42m`)
        .replaceAll(`$B_YELLOW`,    `\x1b[43m`)
        .replaceAll(`$B_BLUE`,      `\x1b[44m`)
        .replaceAll(`$B_MAGENTA`,   `\x1b[45m`)
        .replaceAll(`$B_CYAN`,      `\x1b[46m`)
        .replaceAll(`$B_WHITE`,     `\x1b[47m`)
        .replaceAll(`$BOLD`,        `\x1b[1m`)
        .replaceAll(`$ITALICS`,     `\x1b[3m`)
        .replaceAll(`$UNDERLINE`,   `\x1b[4m`)
        .replaceAll(`$STRIKE`,      `\x1b[9m`)
        .replaceAll(`$NO_BOLD`,     `\x1b[0m`) // fill these out
        .replaceAll(`$NO_ITALICS`,  `\x1b[0m`) // fill these out
        .replaceAll(`$NO_UNDERLINE`,`\x1b[0m`) // fill these out
        .replaceAll(`$NO_STRIKE`,   `\x1b[0m`) // fill these out
        .replaceAll(`$RESET`,       `\x1b[0m${TermControls.rgb(fg, true)}${TermControls.rgb(bg, false)}`)
    ;

    return st;
}

export function clearStyleString(s: string) {
    return s
    .replaceAll(`$F_BLACK`,     ``)
    .replaceAll(`$F_RED`,       ``)
    .replaceAll(`$F_GREEN`,     ``)
    .replaceAll(`$F_YELLOW`,    ``)
    .replaceAll(`$F_BLUE`,      ``)
    .replaceAll(`$F_MAGENTA`,   ``)
    .replaceAll(`$F_CYAN`,      ``)
    .replaceAll(`$F_WHITE`,     ``)
    .replaceAll(`$F_GRAY`,      ``)
    .replaceAll(`$B_BLACK`,     ``)
    .replaceAll(`$B_RED`,       ``)
    .replaceAll(`$B_GREEN`,     ``)
    .replaceAll(`$B_YELLOW`,    ``)
    .replaceAll(`$B_BLUE`,      ``)
    .replaceAll(`$B_MAGENTA`,   ``)
    .replaceAll(`$B_CYAN`,      ``)
    .replaceAll(`$B_WHITE`,     ``)
    .replaceAll(`$BOLD`,        ``)
    .replaceAll(`$ITALICS`,     ``)
    .replaceAll(`$UNDERLINE`,   ``)
    .replaceAll(`$STRIKE`,      ``)
    .replaceAll(`$NO_BOLD`,     ``) // fill these out
    .replaceAll(`$NO_ITALICS`,  ``) // fill these out
    .replaceAll(`$NO_UNDERLINE`,``) // fill these out
    .replaceAll(`$NO_STRIKE`,   ``) // fill these out
    .replaceAll(`$RESET`,       ``)
    ;
}

export abstract class Component {
    abstract draw(x: number, y: number, width: number, height: number): void;
}

export class ScrollableList implements Component {
    protected items: string[];
    protected index: number; 
    style: ScrollableStyle;

    constructor(style?: ScrollableStyle) {
        this.style = {
            text_align: style?.text_align ?? 'center',
            fg: style?.fg ?? [255, 255, 255],
            bg: style?.bg ?? [0, 0, 0],
            fg_selected: style?.fg_selected ?? [0, 0, 0],
            bg_selected: style?.bg_selected ?? [255, 255, 255],
            bg_no_item: style?.bg_no_item ?? [0, 0, 0],

            marginLeft: style?.marginLeft ?? 1,
            marginRight: style?.marginRight ?? 1,

            bold: style?.bold ?? false,
            italics: style?.italics ?? false,
            underline: style?.underline ?? false,
            strikethrough: style?.strikethrough ?? false
        };

        this.items = [];
        this.index = 0;
    }

    getSelectedItem() {
        return this.items[this.index];
    }

    getSelectedIndex() { return this.index; }

    setIndex(n: number) {
        this.index = n;
    }

    goUp() {
        this.index--;
        
        if(this.index<0) {
            this.index = this.items.length-1;
        }
    }

    goDown() {
        this.index++;

        if(this.index>=this.items.length) {
            this.index = 0;
        }
    }

    addItem(item: string) {
        this.items.push(item);
    }

    clearItems() {
        this.items = [];
        this.index = 0;
    }

    draw(x: number, y: number, width: number, height: number) {
        TermControls.goTo(x, y);

        let backgroundText = '';
        for(let i=0;i<height;i++) {
            backgroundText+=`${TermControls.goToString(x, y+i)}${TermControls.rgb(this.style.bg_no_item as number[], false)}${''.padStart(width)}${TermControls.clear()}`;
        }

        TermControls.write(backgroundText);

        for(let i=0;i<(this.items.length > height ? height : this.items.length);i++) {
            TermControls.goTo(x, y+i);
            const content = this.items[i];

            const paddingLeft =  this.calculatePadding(true, content, this.style.text_align as ('left'|'center'|'right'), width);
            const paddingRight = this.calculatePadding(false, content, this.style.text_align as ('left'|'center'|'right'), width);

            let text: string = '';

            let bg = [0, 0, 0];
            let fg = [0, 0, 0];
            
            if(this.index == i) {
                fg = this.style.fg_selected as number[];
                bg = this.style.bg_selected as number[];
            } else {
                fg = this.style.fg as number[];
                bg = this.style.bg as number[];
            }

            text += TermControls.rgb(bg, false);
            text += TermControls.rgb(fg, true);

            text += ''.padStart(paddingLeft, ' ');      // left padding
            text += this.parseTextStyle();              // start text style
            text += formatStyleString(content,fg,bg);   // actual content
            text += this.clearTextStyle();              // stop text style
            text += ''.padStart(paddingRight, ' ');     // right padding

            text += TermControls.clear();               // remove any item styles

            TermControls.write(text);
        }
    }

    protected parseTextStyle() {
        let st = '';

        st += this.style.bold ? TermControls.bold() : '';
        st += this.style.italics ? TermControls.italics() : '';
        st += this.style.underline ? TermControls.underline() : '';
        st += this.style.strikethrough ? TermControls.strikethrough() : '';

        return st;
    }

    protected clearTextStyle() {
        return `\x1b[22;23;24;29m`;
    }

    protected calculatePadding(isLeftPadding: boolean, c: string, text_align: 'left' | 'center' | 'right', width: number) {
        const margin = (isLeftPadding) ? this.style.marginLeft as number : this.style.marginRight as number;

        const content = clearStyleString(c);

        switch(text_align) {
            case 'left':
                if(isLeftPadding) { return margin; }
                else { return Math.floor(width - (content.length + margin) - 1); }

            case 'center':
                if(isLeftPadding) { return Math.floor((width-(content.length+margin))/2); }
                else { return Math.floor((width-(content.length+margin))/2+(((content.length+margin)%2>0)?1:0)); }
            
            case 'right':
                if(isLeftPadding) { return Math.floor(width - (content.length + margin)); }
                else { return margin; }
        }
    }
}

export class ColorPanel implements Component {
    style: ColorPanelStyle;

    constructor(style?: ColorPanelStyle) {
        

        this.style = {
            bg: style?.bg ?? [0, 0, 0]
        };
    }

    draw(x: number, y: number, width: number, height: number): void {
        let backgroundText = '';
        for(let i=0;i<height;i++) {
            backgroundText+=`${TermControls.goToString(x, y+i)}${TermControls.rgb(this.style.bg as number[], false)}${''.padStart(width)}${TermControls.clear()}`;
        }

        TermControls.write(backgroundText);
    }
}

export class PlainText implements Component {
    protected content: string;
    style: PlainTextStyle;

    constructor(content: string, style?: PlainTextStyle) { 
        this.style = {
            fg: style?.fg ?? [255, 255, 255],
            bg: style?.bg ?? [0, 0, 0],

            bold: style?.bold ?? false,
            italics: style?.italics ?? false,
            underline: style?.underline ?? false,
            strikethrough: style?.strikethrough ?? false,
        }

        this.content = content;
    }

    setContent(s: string) { this.content = s; }
    getContent() { return this.content; }

    draw(x: number, y: number, width: number, _height: number): void {
        TermControls.goTo(x, y);

        TermControls.write(
            TermControls.rgb(this.style.fg as number[], true) +
            TermControls.rgb(this.style.bg as number[], false) +
            this.parseTextStyle() +
            formatStyleString(this.content, this.style.fg as number[], this.style.bg as number[]) +
            TermControls.clear()
        );
    }

    protected parseTextStyle() {
        let st = '';

        st += this.style.bold ? TermControls.bold() : '';
        st += this.style.italics ? TermControls.italics() : '';
        st += this.style.underline ? TermControls.underline() : '';
        st += this.style.strikethrough ? TermControls.strikethrough() : '';

        return st;
    }

    protected clearTextStyle() {
        return `\x1b[22;23;24;29m`;
    }
}

export class TextPanel implements Component {
    style: TextPanelStyle;
    protected content: string;

    constructor(content: string, style?: TextPanelStyle) {
        this.content = content;

        this.style = {
            fg: style?.fg ?? [255,255,255],
            bg: style?.bg ?? [0,0,0],

            bold: style?.bold ?? false,
            italics: style?.italics ?? false,
            strikethrough: style?.strikethrough ?? false,
            underline: style?.underline ?? false,

            alignX: style?.alignX ?? 'left',
            alignY: style?.alignY ?? 'top',

            corner: style?.corner ?? 'regular',
            cbg: style?.cbg ?? [0,0,0]
        }
    }
    
    draw(x: number, y: number, width: number, height: number): void {
        let backgroundText = '';
        for(let i=0;i<height;i++) {
            backgroundText+=`${TermControls.goToString(x, y+i)}${TermControls.rgb(this.style.bg as number[], false)}${''.padStart(width)}${TermControls.clear()}`;
        }

        const calcX = this.calcAlignX(x, width, this.style.alignX as 'left'|'center'|'right');
        const calcY = this.calcAlignY(y, height, this.style.alignY as 'top'|'center'|'bottom');

        backgroundText += TermControls.goToString(calcX, calcY);

        backgroundText +=
            TermControls.rgb(this.style.fg as number[], true) +
            TermControls.rgb(this.style.bg as number[], false) +
            this.parseTextStyle() +
            formatStyleString(this.content, this.style.fg as number[], this.style.bg as number[]) +
            TermControls.clear();

        if(this.style.corner == '3thin') {
            backgroundText += `${TermControls.rgb(this.style.bg as number[],true)}`;
            backgroundText += `${TermControls.rgb(this.style.cbg as number[],false)}`;
            backgroundText += `${TermControls.goToString(x, y)}${''.padStart(width,'▄')}${TermControls.clear()}`;
            backgroundText += `${TermControls.rgb(this.style.bg as number[],true)}`;
            backgroundText += `${TermControls.rgb(this.style.cbg as number[],false)}`;
            backgroundText += `${TermControls.goToString(x, y+height-1)}${''.padStart(width,'▀')}${TermControls.clear()}`;
        } else if(this.style.corner == '3thintop') {
            backgroundText += `${TermControls.rgb(this.style.bg as number[],true)}`;
            backgroundText += `${TermControls.rgb(this.style.cbg as number[],false)}`;
            backgroundText += `${TermControls.goToString(x, y)}${''.padStart(width,'▄')}${TermControls.clear()}`;
        } else if(this.style.corner == '3thinbottom') {
            backgroundText += `${TermControls.rgb(this.style.bg as number[],true)}`;
            backgroundText += `${TermControls.rgb(this.style.cbg as number[],false)}`;
            backgroundText += `${TermControls.goToString(x, y+height-1)}${''.padStart(width,'▀')}${TermControls.clear()}`;
        }

        TermControls.write(backgroundText);
    }

    setContent(s: string) { this.content = s; }
    getContent() { return this.content; }

    protected calcAlignX(x: number, w: number, alignX: 'left' | 'center' | 'right') {
        const content = clearStyleString(this.content);
        
        switch(alignX) {
            case 'left': return x;
            case 'center': return Math.floor((w-content.length)/2+x);
            case 'right': return w+x-content.length;
        }
    }

    protected calcAlignY(y: number, h: number, alignY: 'top' | 'center' | 'bottom') {
        switch(alignY) {
            case 'top': return y;
            case 'center': return Math.floor((h)/2+y);
            case 'bottom': return h+y;
        }
    }

    protected parseTextStyle() {
        let st = '';

        st += this.style.bold ? TermControls.bold() : '';
        st += this.style.italics ? TermControls.italics() : '';
        st += this.style.underline ? TermControls.underline() : '';
        st += this.style.strikethrough ? TermControls.strikethrough() : '';

        return st;
    }

    protected clearTextStyle() {
        return `\x1b[22;23;24;29m`;
    }
}