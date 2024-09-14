# termcord

A bad terminal client for Discord written in Deno.

## Notice

Development on Termcord will basically be minimal until I can find, or make a good TUI library. The way I was doing UI before sucked and I want something more akin to web development (particularly with a flexbox type structure). I might do a few updates to the Discord Controller here and there, but until then, this won't really be usable.

## Quick Start

NOTE: the following instructions are not great, but I do not want to setup a login system. Have fun putting your token in a random file 👍.

Assuming you have installed Deno, run `deno run -A src/index.ts` to setup the termcord directory (located at `~/.termcord` on Linux and `%Appdata%/termcord` on Windows). There, you can find a `secrets.json`, with a field for a token. Put your Discord token there, and restart. Then, type `:connect`.

## Themes

Themes are put in `.termcord/themes`, and are JSON files. Theme names cannot have spaces, as you cannot (currently) select them with the command bar if they do.
You can select themes by using the `:theme` command (syntax: `:theme <file name without .json>`).
