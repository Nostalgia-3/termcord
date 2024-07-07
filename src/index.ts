// deno-lint-ignore-file no-unused-vars ban-unused-ignore

import { ColorPanel, PlainText, ScrollableList, TermControls, Component, TextPanel } from "../src/ui.ts";
import { Keypress, readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";

type Node = {
    com: Component,
    f:()=>{x: number, y: number, w: number, h: number}

    id: string,
};

type NodeGroup = {
    id: string,
    nodes: Node[],
    visible: boolean,
    zIndex: number
};

type Mode = 'normal' | 'write' | 'search' | 'command';

class App {
    // protected components: { com: Component, x: number, y: number, w: number, h: number }[];
    groups: NodeGroup[];
    size: { w: number, h: number };
    mode: Mode;

    message_string: string;
    command_string: string;
    search_string: string;

    // translations for names and such
    t = {
        name: 'Termcord'
    };

    theme = {
        // channel bar
        channels_bg:        [43, 45, 49],
        channel_sel_fg:     [249, 255, 255],
        channel_sel_bg:     [53, 55, 60],

        server_name_bg:     [46, 50, 56],

        // command bar
        command_bg:         [38, 40, 44],

        // list of messages
        messages_bg:        [49, 51, 56],
        // selected message
        message_sel_fg:     [255, 255, 255],
        message_sel_bg:     [46, 48, 53],

        // input message bar
        message_bar_fg:     [255, 255, 255],

        // Ctrl+K search menu
        search_inp_bg:      [30, 31, 34],
        search_bg:          [43, 45, 49],

        // text in general
        text_normal:        [255, 255, 255],
        text_placeholder:   [127, 127, 127],
        text_inp_bg:        [56, 58, 64],

        // generic colors
        g_black:            [0, 0, 0],
        g_red:              [0, 0, 0],
        g_green:            [0, 0, 0],
        g_yellow:           [0, 0, 0],
        g_blue:             [88, 101, 242],
        g_magenta:          [0, 0, 0],
        g_cyan:             [0, 0, 0],
        g_white:            [0, 0, 0]
    };

    constructor() {
        const { columns: w, rows: h } = Deno.consoleSize();
        this.size = { w, h };

        this.groups = [];

        this.message_string = '';
        this.search_string  = '';
        this.command_string = '';

        this.mode = 'normal';

        // load theme

        // generic background for everything
        this.groups.push({
            id: 'generic_background',
            nodes: [
                { com: new ColorPanel({ bg: this.theme.messages_bg }), f:()=>({x: 0, y: 0, w: this.size.w, h: this.size.h}), id: 'back' }
            ],
            visible: true,
            zIndex: 0
        });

        // ui for servers (e.g. channels)
        this.groups.push({
            id: 'chat_server',
            nodes: [
                {
                    com: new ColorPanel({ bg:this.theme.messages_bg }),
                    f:()=>({x:0,y:0,w:this.size.w,h:this.size.h}),
                    id:'background'
                },
                {
                    com: new ScrollableList({ bg_no_item:this.theme.messages_bg }),
                    f:()=>({x: 25, y: 1, w: this.size.w-25, h: this.size.h-1-3}),
                    id: 'messages'
                },
                {
                    com: new ScrollableList({ bg_no_item:this.theme.channels_bg }),
                    f:()=>({x: 0, y: 0, w: 25, h: this.size.h}),
                    id: 'channels'
                },
                {
                    com: new ColorPanel({ bg:this.theme.command_bg }),
                    f:()=>({x: 25, y: 0, w: this.size.w-25, h: 1}),
                    id: 'titlebar_back'
                },
                {
                    com: new PlainText('Command here', { bg:this.theme.command_bg }),
                    f:()=>({x: 25+1, y: 0, w: this.size.w-25, h: 1}),
                    id: 'command'
                },
                {
                    com: new PlainText(' Server Name'.padEnd(25), {bg:this.theme.server_name_bg}),
                    f: ()=>({x: 0, y: 0, w: 25, h: 1}),
                    id: 'server_name'
                },
                {
                    com: new TextPanel(' Message #channel-name', {fg:this.theme.text_placeholder,bg:this.theme.text_inp_bg,alignY:'center',corner:'3thin',cbg:this.theme.messages_bg }),
                    f:()=>({x:26,y:this.size.h-3,w:this.size.w-26-1,h:3}),
                    id:'message'
                },
                {
                    com: new PlainText('[N]', {bg:this.theme.command_bg,fg:this.theme.g_blue}),
                    f:()=>({x: this.size.w-5, y: 0, w: 5, h: 1,}),
                    id: 'mode'
                },
            ],
            visible: true,
            zIndex: 5
        });

        // search modal
        this.groups.push({
            id: 'search',
            nodes: [
                {
                    com: new ColorPanel({ bg: this.theme.search_bg }),
                    f: ()=>({x: Math.floor((this.size.w-60)/2), y: Math.floor((this.size.h-15)/2), w: 60, h: 15,}),
                    id:'search_bg'
                },
                {
                    com: new TextPanel(' Search here...',{bg:this.theme.search_inp_bg,fg:[128,128,128],alignX:'left',alignY:'center',corner:'3thin',cbg:this.theme.search_bg}),
                    f: ()=>({x: Math.floor((this.size.w-56)/2), y: Math.floor((this.size.h-15)/2)+1, w: 56, h: 3}),
                    id: 'textPanel'
                }
            ],
            visible: true,
            zIndex: 10
        });
    }

    async start() {
        this.draw();

        setInterval(this.update,1000/15, this);

        for await(const keypress of readKeypress(Deno.stdin)) {
            this.handleKeypress(keypress);
        }
    }

    update(app: App) {
        const cs = Deno.consoleSize();
        if(app.size.w != cs.columns || app.size.h != cs.rows) {
            app.draw();
        }
    }

    handleKeypress(keypress: Keypress) {
        if(keypress.ctrlKey && keypress.key == 'c') {
            Deno.exit();
        }

        switch(this.mode) {
            case "normal":
                switch(keypress.key) {
                    case 'i': this.mode = 'write'; break;
                    case 'k': this.mode = 'search'; break;
                    case ':': this.mode = 'command'; this.command_string = ':'; break;
                }
            break;

            case 'write':
                switch(keypress.key) { 
                    case 'escape': this.mode = 'normal'; break;
                    case 'space': this.message_string+=' '; break;
                    case 'backspace': this.message_string = this.message_string.slice(0,this.message_string.length-1); break;

                    default: this.message_string+=keypress.key; break;
                }
            break;

            case 'command':
                switch(keypress.key) {
                    case 'escape': this.mode = 'normal'; this.command_string = ''; break;
                    case 'space': this.command_string+=' '; break;
                    case 'backspace': this.command_string = this.command_string.slice(0,this.command_string.length-1); break;
                    case 'return': this.parseCommand(this.command_string); this.command_string = ''; this.mode = 'normal'; break;

                    default: this.command_string+=keypress.key; break;
                }
            break;

            case 'search':
                switch(keypress.key) {
                    case 'escape': this.mode = 'normal'; this.search_string = ''; break;
                    case 'space': this.search_string+=' '; break;
                    case 'backspace': this.search_string = this.search_string.slice(0,this.search_string.length-1); break;
                    case 'return': this.mode='normal'; this.search_string = ''; break;

                    default: this.search_string+=keypress.key; break;
                }
            break;
        }

        this.draw();
    }

    draw() {
        console.clear();

        this.groups.sort((a,b)=>a.zIndex-b.zIndex);

        const cs = Deno.consoleSize();
        this.size = { w: cs.columns, h: cs.rows };

        const serverChat = this.getGroupByID('chat_server');
        if(!serverChat) Deno.exit(1);

        const search = this.getGroupByID('search');
        if(!search) Deno.exit(1);
        
        const messageBar    = this.getNodeByID(serverChat, 'message')?.com  as TextPanel;
        const commandBar    = this.getNodeByID(serverChat, 'command')?.com  as TextPanel;
        const modeText      = this.getNodeByID(serverChat, 'mode')?.com     as PlainText;
        const searchText    = this.getNodeByID(search, 'textPanel')?.com    as PlainText;

        if(this.message_string != '') { messageBar.setContent(' ' + this.message_string); messageBar.style.fg = [255,255,255]; }
        else { messageBar.setContent(` Message #channel-name`); messageBar.style.fg = [128,128,128]; }

        if(this.command_string != '') { commandBar.setContent('' + this.command_string); commandBar.style.fg = [255,255,255]; }
        else { commandBar.setContent(` `); commandBar.style.fg = [128,128,128]; }

        if(this.search_string != '') { searchText.setContent(' ' + this.search_string); searchText.style.fg = [255,255,255]; }
        else { searchText.setContent(` Search Here...`); searchText.style.fg = [128,128,128]; }

        switch(this.mode) {
            case 'normal':  modeText.setContent('[N]'); search.visible=false; break;
            case 'write':   modeText.setContent('[W]'); search.visible=false; break;
            case 'command': modeText.setContent('[C]'); search.visible=false; break;
            case 'search':  modeText.setContent('[S]'); search.visible=true; break;
        }

        for(let i=0;i<this.groups.length;i++) {
            if(!this.groups[i].visible) continue;

            
            for(let x=0;x<this.groups[i].nodes.length;x++) {
                const comp = this.groups[i].nodes[x];

                const c = comp.f();

                comp.com.draw(c.x, c.y, c.w, c.h);
            }
        }

        switch(this.mode) {
            case 'normal': TermControls.goTo(0, 0); break;
            case 'write': TermControls.goTo(27+this.message_string.length, this.size.h-2);  break;
            case 'command': TermControls.goTo(26+this.command_string.length, 0); break;
            case 'search': { TermControls.goTo(Math.floor((this.size.w-56)/2)+1+this.search_string.length, Math.floor((this.size.h-15)/2)+2); break; }
        }
    }

    parseCommand(s: string) {
        const secs = s.split(' ');

        switch(secs[0]) {
            case ':q': console.clear(); Deno.exit(0); break;
        }
    }

    getGroupByID(id: string) {
        for(let i=0;i<this.groups.length;i++) {
            if(this.groups[i].id == id) return this.groups[i];
        }
    }

    getNodeByID(group: NodeGroup, id: string) {
        for(let i=0;i<group.nodes.length;i++) {
            if(group.nodes[i].id == id) return group.nodes[i];
        }
    }
}

const app = new App();

app.start();