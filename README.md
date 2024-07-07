# termcord

A bad terminal client for Discord written in Deno.

## Quick Start

NOTE: the following instructions are not great, but I do not want to setup a login system. Have fun putting your token in a random file 👍.

Assuming you have installed Deno, run `deno run -A src/index.ts` to setup the termcord directory (located at `~/.termcord` on Linux and `%Appdata%/termcord` on Windows). There, you can find a `secrets.json`, with a field for a token. Put your Discord token there, and restart. Then, type `:connect`.

## Themes

Themes are put in `.termcord/themes`, and are JSON files. Theme names cannot have spaces, as you cannot (currently) select them with the command bar if they do.
You can select themes by using the `:theme` command (syntax: `:theme <file name without .json>`).
