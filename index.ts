// deno-lint-ignore-file no-unused-vars ban-unused-ignore

import { ColorPanel, PlainText, ScrollableList, TermControls, Component, TextPanel } from "./ui.ts";
import { readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";

type Node = {
    com: Component,
    x: number, y: number,
    w: number, h: number,

    id: string,
};

type NodeGroup = {
    id: string,
    nodes: Node[],
    visible: boolean,
    zIndex: number
};

type Mode = 'normal' | 'write' | 'search' | 'login' | 'command';

class App {
    // protected components: { com: Component, x: number, y: number, w: number, h: number }[];
    protected groups: NodeGroup[];
    protected size: { w: number, h: number };
    protected mode: Mode;

    protected selected: number;

    protected message_string: string;
    protected command_string: string;
    protected search_string: string;

    protected data = {
        name: 'termcord'
    }

    constructor() {
        const termSize = Deno.consoleSize();

        this.size = { w: termSize.columns, h: termSize.rows };
        this.groups = [];

        this.message_string = '';
        this.search_string  = '';
        this.command_string = '';

        this.mode = 'normal';

        const tP = ''.padStart(Math.floor((50-this.data.name.length)/2));

        this.groups.push({
            id: 'generic_background',
            nodes: [
                { com: new ColorPanel({ bg: [32, 32, 32] }), x: 0, y: 0, w: this.size.w, h: this.size.h, id: 'back' }
            ],
            visible: true,
            zIndex: 0
        })

        this.groups.push({
            id: 'login_modal',
            nodes: [
                {
                    com: new ColorPanel({ bg: [64, 64, 64] }),
                    x: Math.floor((this.size.w-50)/2), y: Math.floor((this.size.h-30)/2),
                    w: 50, h: 30, id: 'modal_back'
                },
                {
                    com: new PlainText(tP + this.data.name + tP, { bg: [12, 12, 12] }),
                    x: Math.floor((this.size.w-50)/2), y: Math.floor((this.size.h-30)/2),
                    w: this.size.w, h: 0, id: 'modal_title'
                }
            ],
            visible: false,
            zIndex: 25
        });

        this.groups.push({
            id: 'chat_server',
            nodes: [
                { com: new ColorPanel({ bg:[16,16,32] }),x:0,y:0,w:this.size.w,h:this.size.h,id:'background' },
                { com: new ScrollableList({ bg_no_item: [16, 16, 32] }), x: 25, y: 1, w: this.size.w-25, h: this.size.h-1-3, id: 'messages' },
                { com: new ScrollableList({ bg_no_item: [32, 16, 16] }), x: 0, y: 0, w: 25, h: this.size.h, id: 'channels' },
                { com: new ColorPanel({ bg: [16, 32, 16] }), x: 25, y: 0, w: this.size.w-25, h: 1, id: 'titlebar_back' },
                { com: new PlainText('Command here', { bg: [16, 32, 16] }), x: 25+1, y: 0, w: this.size.w-25, h: 1, id: 'command' },
                { com: new PlainText(' Server Name'.padEnd(25), {bg:[24,16,16]}), x: 0, y: 0, w: 25, h: 1, id: 'server_name' },
                {
                    com: new TextPanel(' Message #channel-name', {fg:[128,128,128],bg:[32,16,32],alignY:'center',corner:'3thin',cbg:[16,16,32]}),
                    x:26,y:this.size.h-3,w:this.size.w-26-1,h:3, id:'message'
                },
                { com: new PlainText('[N]', {bg:[16,32,16],fg:[100,100,255]}), x: this.size.w-5, y: 0, w: 5, h: 1, id: 'mode' },
            ],
            visible: true,
            zIndex: 5
        });

        this.groups.push({
            id: 'search',
            nodes: [
                { com: new ColorPanel({ bg: [20,20,20] }), x: Math.floor((this.size.w-60)/2), y: Math.floor((this.size.h-15)/2), w: 60, h: 15, id:'search_bg' },
                {
                    com: new TextPanel(' Search here...',{bg:[40,40,40],fg:[128,128,128],alignX:'left',alignY:'center',corner:'3thin',cbg:[20,20,20]}),
                    x: Math.floor((this.size.w-56)/2), y: Math.floor((this.size.h-15)/2)+1,
                    w: 56, h: 3, id: 'textPanel' }
            ],
            visible: true,
            zIndex: 10
        });

        this.selected = 0;
    }

    async start() {
        this.draw();

        for await(const keypress of readKeypress(Deno.stdin)) {
            if(keypress.ctrlKey && keypress.key == 'c') {
                Deno.exit();
            }

            switch(this.mode) {
                case "normal":
                    switch(keypress.key) {
                        case 'i': this.mode = 'write'; break;
                        case 'k': this.mode = 'search'; break;
                        case ':': this.mode = 'command'; this.command_string = ':'; break;
                        case 'l': this.mode = 'login'; break;
                    }
                break;

                case "write":
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
                        case 'return': this.mode='normal'; break;

                        default: this.search_string+=keypress.key; break;
                    }
                break;

                case "login":
                break;
            }

            this.draw();
        }
    }

    draw() {
        console.clear();

        this.groups.sort((a,b)=>a.zIndex-b.zIndex);

        const serverChat = this.getGroupByID('chat_server');
        if(!serverChat) Deno.exit(1);

        const search = this.getGroupByID('search');
        if(!search) Deno.exit(1);

        const loginModal = this.getGroupByID('login_modal');
        if(!loginModal) Deno.exit(1);
        
        const messageBar    = this.getNodeByID(serverChat, 'message')?.com  as TextPanel;
        const commandBar    = this.getNodeByID(serverChat, 'command')?.com  as TextPanel;
        const modeText      = this.getNodeByID(serverChat, 'mode')?.com     as PlainText;
        const searchText    = this.getNodeByID(search, 'textPanel')?.com    as PlainText;

        if(this.message_string != '') { messageBar.setContent(' ' + this.message_string); messageBar.style.fg = [255,255,255]; }
        else { messageBar.setContent(` Message #channel-name`); messageBar.style.fg = [128,128,128]; }

        if(this.command_string != '') { commandBar.setContent(' ' + this.command_string); commandBar.style.fg = [255,255,255]; }
        else { commandBar.setContent(` Enter Command Here`); commandBar.style.fg = [128,128,128]; }

        if(this.search_string != '') { searchText.setContent(' ' + this.search_string); searchText.style.fg = [255,255,255]; }
        else { searchText.setContent(` Search Here...`); searchText.style.fg = [128,128,128]; }

        switch(this.mode) {
            case 'normal':modeText.setContent('[N]'); loginModal.visible=false; search.visible=false; break;
            case 'write':modeText.setContent('[W]'); loginModal.visible=false; search.visible=false; break;
            case 'command':modeText.setContent('[C]'); loginModal.visible=false; search.visible=false; break;
            case 'search':modeText.setContent('[S]'); loginModal.visible=false; search.visible=true; break;
            case 'login':modeText.setContent('[L]'); loginModal.visible=true; serverChat.visible=false; search.visible=false; break;
        }

        for(let i=0;i<this.groups.length;i++) {
            if(!this.groups[i].visible) continue;

            for(let x=0;x<this.groups[i].nodes.length;x++) {
                const comp = this.groups[i].nodes[x];
                comp.com.draw(comp.x, comp.y, comp.w, comp.h);
            }
        }

        switch(this.mode) {
            case 'normal': TermControls.goTo(0, 0); break;
            case 'write': TermControls.goTo(27+this.message_string.length, this.size.h-2);  break;
            case 'command': TermControls.goTo(27+this.command_string.length, 0); break;
            case 'search': { TermControls.goTo(Math.floor((this.size.w-56)/2)+1+this.search_string.length, Math.floor((this.size.h-15)/2)+2); break; }
            case 'login': break;
        }
    }

    protected parseCommand(s: string) {
        const secs = s.split(' ');

        switch(secs[0]) {
            case ':q': console.clear(); Deno.exit(0); break;
        }
    }

    protected getGroupByID(id: string) {
        for(let i=0;i<this.groups.length;i++) {
            if(this.groups[i].id == id) return this.groups[i];
        }
    }

    protected getNodeByID(group: NodeGroup, id: string) {
        for(let i=0;i<group.nodes.length;i++) {
            if(group.nodes[i].id == id) return group.nodes[i];
        }
    }
}

const app = new App();

app.start();