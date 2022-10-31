/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
    CompletionItem,
    CompletionItemKind, createConnection, Diagnostic,
    DiagnosticSeverity, DidChangeConfigurationNotification, InitializeParams, InitializeResult, ProposedFeatures, TextDocumentPositionParams, TextDocuments, TextDocumentSyncKind
} from "vscode-languageserver/node";

import { TextDocument } from "vscode-languageserver-textdocument";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion.
            completionProvider: {
                resolveProvider: true,
            },
        },
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true,
            },
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(
            DidChangeConfigurationNotification.type,
            undefined
        );
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((_event) => {
            connection.console.log("[XXX] Workspace folder change event received.");
        });
    }
});

// The example settings
interface ExampleSettings {
    maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    } else {
        globalSettings = <ExampleSettings>(
            (change.settings.languageServerExample || defaultSettings)
        );
    }

    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: "languageServerExample",
        });
        documentSettings.set(resource, result);
    }
    return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    // In this simple example we get the settings for every validate run.
    const settings = await getDocumentSettings(textDocument.uri);

    // The validator creates diagnostics for all uppercase words length 2 and more
    const text = textDocument.getText();
    const pattern = /\b[A-Z]{2,}\b/g;
    let m: RegExpExecArray | null;

    let problems = 0;
    const diagnostics: Diagnostic[] = [];
    while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
        problems++;
        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Warning,
            range: {
                start: textDocument.positionAt(m.index),
                end: textDocument.positionAt(m.index + m[0].length),
            },
            message: `${m[0]} is all uppercase.`,
            source: "ex",
        };
        if (hasDiagnosticRelatedInformationCapability) {
            diagnostic.relatedInformation = [
                {
                    location: {
                        uri: textDocument.uri,
                        range: Object.assign({}, diagnostic.range),
                    },
                    message: "Spelling matters",
                },
                {
                    location: {
                        uri: textDocument.uri,
                        range: Object.assign({}, diagnostic.range),
                    },
                    message: "Particularly for names",
                },
            ];
        }
        diagnostics.push(diagnostic);
    }

    // Send the computed diagnostics to VSCode.
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
    // Monitored files have change in VSCode
    connection.console.log("[XXX] We received an file change event");
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        // The pass parameter contains the position of the text document in
        // which code complete got requested. For the example we ignore this
        // info and always provide the same completion items.
        return [
            {
                label: "TypeScript",
                kind: CompletionItemKind.Text,
                data: 1,
            },
            {
                label: "JavaScript",
                kind: CompletionItemKind.Text,
                data: 2,
            },
        ];
    }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    if (item.data === 1) {
        item.detail = "TypeScript details";
        item.documentation = "TypeScript documentation";
    } else if (item.data === 2) {
        item.detail = "JavaScript details";
        item.documentation = "JavaScript documentation";
    }
    return item;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

import * as http from "http";

const requestListener = function(req: any, res: any) {
    res.writeHead(200);
    // <link rel="stylesheet" href="https://raw.githubusercontent.com/otsaloma/markdown-css/master/tufte.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
    // <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tufte-css/1.8.0/tufte.min.css" integrity="sha512-F5lKjC1GKbwLFXdThwMWx8yF8TX/WVrdhWYN9PWb6eb5hIRLmO463nrpqLnEUHxy2EHIzfC4dq/mncHD6ndR+g==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    let htmlString = `<html>
<head>
<meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/morphdom@2.6.1/dist/morphdom.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/markdown-it/13.0.1/markdown-it.min.js" integrity="sha512-SYfDUYPg5xspsG6OOpXU366G8SZsdHOhqk/icdrYJ2E/WKZxPxze7d2HD3AyXpT7U22PZ5y74xRpqZ6A2bJ+kQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css" integrity="sha512-NhSC1YmyruXifcj/KFRWoC561YpHpc5Jtzgvbuzx5VozKpWvQ+4nXhPdFgmx8xqexRcpAglTj9sIBWINXa8x5w==" crossorigin="anonymous" referrerpolicy="no-referrer" />

<script src="https://cdnjs.cloudflare.com/ajax/libs/viz.js/2.1.2/viz.js" integrity="sha512-vnRdmX8ZxbU+IhA2gLhZqXkX1neJISG10xy0iP0WauuClu3AIMknxyDjYHEpEhi8fTZPyOCWgqUCnEafDB/jVQ==" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/viz.js/2.1.2/full.render.js" integrity="sha512-1zKK2bG3QY2JaUPpfHZDUMe3dwBwFdCDwXQ01GrKSd+/l0hqPbF+aak66zYPUZtn+o2JYi1mjXAqy5mW04v3iA==" crossorigin="anonymous"></script>

<script>
</script>

<style>
${customCSS}


.focus {
    background-color: #ff0000;
}
.focus::after {
    background-color: #000000;
    transition: background-color 1000ms linear;
    -webkit-transition: background-color 1000ms linear;
    -ms-transition: background-color 1000ms linear;
}

#mdText {
    height: 100vh;
    min-height: 100vh;
}

</style>



</head>
<body>
<div id="mdText" class="markdown-body">
</div>

<script>

var md = window.markdownit({
    html: true,
    linkify: true,
    typographer: true
});

const ws = new WebSocket('ws://localhost:9898/');

ws.onopen = function() {
    console.log('WebSocket Client Connected');
};

ws.onmessage = function(e) {
    received = JSON.parse(e.data)
    // if (e.data.action == "reload") {
    //     window.location.reload();
    // }
    // document.querySelector('#mdText').innerHTML = md.render(received.text);
    //
    
    let markdownBody = document.querySelector('#mdText')

    const morphdom = window.morphdom;

    const diff = morphdom(
        markdownBody,
        "<div>" + received.text + "<div>",
        {
            childrenOnly: true,
            onBeforeElUpdated: (fromEl, toEl) => {
                if (fromEl.hasAttribute('open')) {
                    toEl.setAttribute('open', 'true');
                }
                // fromEl.classList.remove("focus")
                
                if (fromEl.isEqualNode(toEl)) {
                    return false;
                } else {

                    fromEl.scrollIntoView({
                        behavior: 'auto',
                        block: 'center',
                        inline: 'center',
                    })

                    // toEl.classList.add("focus")
                    // setTimeout(() => {
                    //     toEl.classList.remove("focus")
                    // }, 2000)
                }



                return true;
            },
            onElUpdated: function(el) {
                // el.previousElementSibling.scrollIntoView()
                // console.log(el.scrollTop, el.scrollHeight, el.clientHeight)
                // el.scrollTop = el.scrollHeight - el.clientHeight;
            },
            onNodeAdded: function(el) {
                if(typeof el.scrollIntoView === 'function' ) {
                    el.scrollIntoView({
                        behavior: 'auto',
                        block: 'center',
                        inline: 'center',
                    })
                }
            },
            getNodeKey: () => null,
        },
    );

    try {
        let viz = new window.Viz();
        for (let element of markdownBody.getElementsByClassName("language-graphviz")) {
          viz.renderSVGElement(element.textContent)
          .then(function(newEl) {
             newEl.setAttribute("width", "100%")
             element.parentNode.replaceWith(newEl)
          });
        }
    } catch (error){
        console.error(error)
    }

};
</script>

</body>
</html>
`;
    res.end(htmlString);
};

var md = require('markdown-it')();

const server = http.createServer(requestListener);
server.listen(8081);

import { WebSocketServer } from "ws";


const wss = new WebSocketServer({ port: 9898 });

wss.on("connection", function connection(ws) {
    ws.on("message", function message(data) {
        console.log("received: %s", data);
    });
    ws.send(
        JSON.stringify({
            action: "update",
            text: md.render(documents.get(currentFocus)?.getText()),
        })
    )
});

let currentFocus = ""

documents.onDidOpen((change) => {
    currentFocus = change.document.uri
    wss.clients.forEach((client) => {
        client.send(
            JSON.stringify({
                action: "update",
                text: md.render(change.document.getText()),
                uri: change.document.uri,
            })
        );
    });
})

documents.onDidChangeContent((change) => {
    currentFocus = change.document.uri
    wss.clients.forEach((client) => {
        client.send(
            JSON.stringify({
                action: "update",
                text: md.render(change.document.getText()),
                uri: change.document.uri,
            })
        );
    });
});


// ul > li p {
//   margin-block-end: 0em !important;
//   margin-block-start: 0em !important;
// }

var customCSS = `

/* Remove space between list items */

@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+Pro:ital,wght@0,200;0,300;0,400;0,600;0,700;0,900;1,200;1,300;1,400;1,600;1,700;1,900&display=swap');

svg {
  fill: white;
}

h1 {
    font-weight: 400;
    font-size: 2rem;
    line-height: 1;
}

h2 {
    font-weight: 400;
    font-size: 1.5rem;
    line-height: 1;
}

h3 {
    font-weight: 400;
    font-size: 1.25rem;
    line-height: 1;
}

h4 {
    font-weight: 400;
    font-size: 1em;
    line-height: 1;
}

@font-face {
  font-family: 'Source Serif Pro';
  font-style: bold;
  font-weight: 400;
}

body {
  background-color: #000000 !important;
}

html {
    overflow: scroll;
    overflow-y: hidden;
    overflow-x: hidden;
}

.code {
  /* font-family: 'Crimson Pro', serif !important; */
  margin: 7px !important;
  padding-right: 7px !important;
  padding-left: 7px !important;
  /* font-family: 'Crimson Pro', serif !important; */
}

/*
 * github like style
 * https://github.com/iamcco/markdown.css/blob/master/dest/github/markdown.css
 */

:root {
    --color-text-primary: #c9d1d9 !important;
    --color-text-tertiary: #8b949e !important;
    --color-text-link: #58a6ff !important;
    --color-bg-primary: #000000 !important;
    --color-bg-secondary: #000000 !important;
    --color-bg-tertiary: #121212 !important;
    --color-border-primary: #30363d !important;
    --color-border-secondary: #21262d !important;
    --color-border-tertiary: #6e7681 !important;
    --color-kbd-foreground: #b1bac4 !important;
    --color-markdown-blockquote-border: #3b434b !important;
    --color-markdown-table-border: #3b434b !important;
    --color-markdown-table-tr-border: #272c32 !important;
    --color-markdown-code-bg: #f0f6fc26 !important;
}

[data-theme="dark"] {
    --color-text-primary: #c9d1d9 !important;
    --color-text-tertiary: #8b949e !important;
    --color-text-link: #58a6ff !important;
    --color-bg-primary: #000000 !important;
    --color-bg-secondary: #000000 !important;
    --color-bg-tertiary: #121212 !important;
    --color-border-primary: #30363d !important;
    --color-border-secondary: #21262d !important;
    --color-border-tertiary: #6e7681 !important;
    --color-kbd-foreground: #b1bac4 !important;
    --color-markdown-blockquote-border: #3b434b !important;
    --color-markdown-table-border: #3b434b !important;
    --color-markdown-table-tr-border: #272c32 !important;
    --color-markdown-code-bg: #f0f6fc26 !important;
}

.markdown-body ol ol,
.markdown-body ul ol,
.markdown-body ol ul,
.markdown-body ul ul,
.markdown-body ol ul ol,
.markdown-body ul ul ol,
.markdown-body ol ul ul,
.markdown-body ul ul ul {
  margin-top: 0;
  margin-bottom: 0;
}
.markdown-body {
  /* font-family: "Helvetica Neue", Helvetica, "Segoe UI", Arial, freesans, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; */
  /* font-family: "source serif pro" */
  font-family: 'Source Serif Pro', serif !important;
  font-size: 16px;
  color: var(--color-text-primary);
  line-height: 1.6;
  word-wrap: break-word;
  padding: 45px;
  background: var(--color-bg-primary);
  /* border: 1px solid var(--color-border-primary); */
  border: none !important;
  -webkit-border-radius: 0 0 3px 3px;
  border-radius: 0 0 3px 3px;
}
.markdown-body > *:first-child {
  margin-top: 0 !important;
}
.markdown-body > *:last-child {
  margin-bottom: 0 !important;
}
.markdown-body .table-of-contents ol {
  list-style: none;
}
.markdown-body .table-of-contents > ol {
  padding-left: 0;
}
.markdown-body * {
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
}
/* .markdown-body h1, */
/* .markdown-body h2, */
/* .markdown-body h3, */
/* .markdown-body h4, */
/* .markdown-body h5, */
/* .markdown-body h6 { */
/*   margin-top: 0.5em; */
/*   margin-bottom: 0.5em; */
/*   font-weight: 500; */
/*   line-height: 1.4; */
/* } */
.markdown-body h1 .anchor,
.markdown-body h2 .anchor,
.markdown-body h3 .anchor,
.markdown-body h4 .anchor,
.markdown-body h5 .anchor,
.markdown-body h6 .anchor {
  margin-left: -26px;
  visibility: visible;
  display: none;
}
.markdown-body h1:hover .anchor,
.markdown-body h2:hover .anchor,
.markdown-body h3:hover .anchor,
.markdown-body h4:hover .anchor,
.markdown-body h5:hover .anchor,
.markdown-body h6:hover .anchor {
  visibility: visible;
}
.markdown-body p,
.markdown-body blockquote,
.markdown-body ul,
.markdown-body ol,
.markdown-body dl,
.markdown-body table,
.markdown-body pre {
  margin-top: 0;
  margin-bottom: 16px;
}
/* .markdown-body h1 { */
/*   margin: 0.5em 0; */
/*   padding-bottom: 0.2em; */
/*   font-size: 2em; */
/*   line-height: 1; */
/*   text-align: right; */
/*   border-bottom: 1px solid var(--color-border-secondary); */
/* } */
/* .markdown-body h2 { */
/*   padding-bottom: 0.2em; */
/*   font-size: 1.8em; */
/*   line-height: 1; */
/* } */
/* .markdown-body h3 { */
/*   font-size: 1.6em; */
/*   line-height: 1; */
/* } */
/* .markdown-body h4 { */
/*   font-size: 1.4em; */
/*   line-height: 1; */
/* } */
/* .markdown-body h5 { */
/*   font-size: 1.2em; */
/*   line-height: 1; */
/* } */
/* .markdown-body h6 { */
/*   font-size: 1em; */
/*   line-height: 1; */
/*   color: var(--color-text-tertiary); */
/* } */
.markdown-body hr {
  margin-top: 20px;
  margin-bottom: 20px;
  height: 0;
  border: 0;
  border-top: 1px solid var(--color-border-primary);
}
.markdown-body ol,
.markdown-body ul {
  padding-left: 2em;
}
.markdown-body ol ol,
.markdown-body ul ol {
  list-style-type: lower-roman;
}
.markdown-body ol ul,
.markdown-body ul ul {
  list-style-type: circle;
}
.markdown-body ol ul ul,
.markdown-body ul ul ul {
  list-style-type: square;
}
.markdown-body ol {
  list-style-type: decimal;
}
.markdown-body ul {
  list-style-type: disc;
}
.markdown-body dl {
  margin-bottom: 1.3em
}
.markdown-body dl dt {
  font-weight: 700;
}
.markdown-body dl dd {
  margin-left: 0;
}
.markdown-body dl dd p {
  margin-bottom: 0.8em;
}
.markdown-body blockquote {
  margin-left: 0;
  margin-right: 0;
  padding: 0 15px;
  color: var(--color-text-tertiary);
  border-left: 4px solid var(--color-markdown-blockquote-border);
}
.markdown-body table {
  display: block;
  width: 100%;
  overflow: auto;
  word-break: normal;
  word-break: keep-all;
  border-collapse: collapse;
  border-spacing: 0;
}
.markdown-body table tr {
  background-color: var(--color-bg-primary);
  border-top: 1px solid var(--color-markdown-table-tr-border);
}
.markdown-body table tr:nth-child(2n) {
  background-color: var(--color-bg-tertiary);
}
.markdown-body table th,
.markdown-body table td {
  padding: 6px 13px;
  border: 1px solid var(--color-markdown-table-border);
}
.markdown-body kbd {
  display: inline-block;
  padding: 5px 6px;
  font: 14px SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;
  line-height: 10px;
  color: var(--color-kbd-foreground);
  vertical-align: middle;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 3px;
  box-shadow: inset 0 -1px 0 var(--color-border-tertiary);
}
.markdown-body pre {
  word-wrap: normal;
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: var(--color-bg-tertiary);
  -webkit-border-radius: 3px;
  border-radius: 3px;
}
.markdown-body pre code {
  display: inline;
  max-width: initial;
  padding: 0;
  margin: 0;
  overflow: initial;
  font-size: 100%;
  line-height: inherit;
  word-wrap: normal;
  white-space: pre;
  border: 0;
  -webkit-border-radius: 3px;
  border-radius: 3px;
  background-color: transparent;
}
.markdown-body pre code:before,
.markdown-body pre code:after {
  content: normal;
}
.markdown-body code {
  /* font-family: Consolas, "Liberation Mono", Menlo, Courier, monospace; */
  font-family: "Iosevka", monospace;
  padding: 0;
  padding-top: 0.2em;
  padding-bottom: 0.2em;
  margin: 0;
  font-size: 85%;
  background-color: var(--color-markdown-code-bg);
  -webkit-border-radius: 3px;
  border-radius: 3px;
}
.markdown-body code:before,
.markdown-body code:after {
  letter-spacing: -0.2em;
}
.markdown-body a {
  color: var(--color-text-link);
  text-decoration: none;
  background: transparent;
}
.markdown-body img {
  max-width: 100%;
  max-height: 100%;
}
.markdown-body strong {
  font-weight: 700;
}
.markdown-body em {
  font-style: italic;
}
.markdown-body del {
  text-decoration: line-through;
}
.task-list-item {
  list-style-type: none;
}
.task-list-item input {
  font: 13px/1.4 Helvetica, arial, nimbussansl, liberationsans, freesans, clean, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  margin: 0 0.35em 0.25em -1.6em;
  vertical-align: middle;
}
.task-list-item input[disabled] {
  cursor: default;
}
.task-list-item input[type="checkbox"] {
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  padding: 0;
}
.task-list-item input[type="radio"] {
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
  padding: 0;
}
`
