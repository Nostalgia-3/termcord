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
            
            if(this.index == i) {
                text += TermControls.rgb(this.style.bg_selected as number[], false);
                text += TermControls.rgb(this.style.fg_selected as number[], true);
            } else {
                text += TermControls.rgb(this.style.bg as number[], false);
                text += TermControls.rgb(this.style.fg as number[], true);
            }

            text += ''.padStart(paddingLeft, ' ');  // left padding
            text += this.parseTextStyle();          // start text style
            text += content;                        // actual content
            text += this.clearTextStyle();          // stop text style
            text += ''.padStart(paddingRight, ' '); // right padding

            text += TermControls.clear();           // remove any item styles

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

    protected calculatePadding(isLeftPadding: boolean, content: string, text_align: 'left' | 'center' | 'right', width: number) {
        const margin = (isLeftPadding) ? this.style.marginLeft as number : this.style.marginRight as number;

        switch(text_align) {
            case 'left':
                if(isLeftPadding) { return margin; }
                else { return Math.floor(width - (content.length + margin)); }

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
            this.content.substring(0, width) +
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
            this.content.substring(0, width) +
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
        switch(alignX) {
            case 'left': return x;
            case 'center': return Math.floor((w-this.content.length)/2+x);
            case 'right': return w+x-this.content.length;
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