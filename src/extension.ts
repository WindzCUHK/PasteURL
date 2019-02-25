'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const vscode = require("vscode");
const copyPaste = require("copy-paste");
const getTitle = require("get-title");
const request = require("request");
const hyperquest = require("hyperquest");
const iconv = require('iconv-lite');

var baseRequest;
function activate(context) {
    configureHttpRequest();
    vscode.workspace.onDidChangeConfiguration(e => configureHttpRequest());
    let paster = new Paster();
    let disposable = vscode.commands.registerCommand('extension.pasteURL', () => {
        paster.paste();
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
class MarkdownLinkFormatter {
    formatLink(text, url) {
        return '[' + text + ']' + '(' + url + ')';
    }
}
class RestructuredTextLinkFormatter {
    formatLink(text, url) {
        return '`' + text + ' <' + url + '>`_';
    }
}
class Paster {
    paste() {
        if (!this._statusBarItem) {
            this._statusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left);
        }
        copyPaste.paste((error, content) => {
            if (content) {
                this.generateMarkDownStyleLink(content);
            }
            else {
                this.showMessage('[PasteURL]: Not a URL.');
            }
        });
    }
    getLanguage() {
        var filename = vscode.window.activeTextEditor.document.fileName;
        if (filename.endsWith(".rst") ||
            filename.endsWith(".rest") ||
            filename.endsWith(".restx")) {
            return 'restructuredtext';
        }
        return vscode.window.activeTextEditor.document.languageId.toLowerCase();
    }
    getLinkFormatter() {
        if (this.getLanguage() == 'restructuredtext') {
            return new RestructuredTextLinkFormatter();
        }
        else {
            return new MarkdownLinkFormatter();
        }
    }
    generateMarkDownStyleLink(url) {
        var document = vscode.window.activeTextEditor.document;
        var selection = vscode.window.activeTextEditor.selection;
        var selectedText = document.getText(selection);
        var isSelectionEmpty = selectedText.length == 0; // || selectedText == ' '
        if (isSelectionEmpty) {
            this.composeTitleAndSelection(url);
        }
        else {
            this.replaceSelectionWithTitleURL(selection, url);
        }
    }
    replaceSelectionWithTitleURL(selection, url) {
        var text = vscode.window.activeTextEditor.document.getText(selection);
        var formattedLink = this.getLinkFormatter().formatLink(text, url);
        vscode.window.activeTextEditor.edit((editBuilder) => {
            editBuilder.replace(selection, formattedLink);
        });
    }
    composeTitleAndSelection(url) {
        var _this = this;
        var headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Safari/604.1.38"
        };
        if (!url.startsWith("http")) {
            url = "http://" + url;
        }
        var date = new Date();
        var seconds = date.getSeconds();
        var padding = seconds < 10 ? '0' : '';
        var timestamp = date.getMinutes() + ':' + padding + seconds;
        var fetchingTitle = 'Getting Title at ' + timestamp;
        var formattedLink = this.getLinkFormatter().formatLink(fetchingTitle, url);
        _this.writeToEditor(formattedLink).then(function (result) {
            // Editing is done async, so we need to make sure previous editing is finished
            const streamHandler = (err, stream) => {
                if (err) {
                    return _this.replaceWith(fetchingTitle, err.message);
                }
                getTitle(stream).then(title => {
                    title = _this.processTitle(title, url);
                    _this.replaceWith(fetchingTitle, title);
                });
            };
            const responseHandler = (err, response) => {
                if (err) {
                    return streamHandler(err);
                }

                const contentType = response.headers['content-type'];
                const charset = contentType.substring(contentType.indexOf('charset=') + 'charset='.length);
                const encoding = charset || 'utf8';

                const stream = response
                    .pipe(iconv.decodeStream(encoding))
                    .pipe(iconv.encodeStream('utf8'));
                streamHandler(null, stream);
            };
            baseRequest(url, { headers: headers }, responseHandler);
        });
    }
    writeToEditor(content) {
        let startLine = vscode.window.activeTextEditor.selection.start.line;
        var selection = vscode.window.activeTextEditor.selection;
        let position = new vscode.Position(startLine, selection.start.character);
        return vscode.window.activeTextEditor.edit((editBuilder) => {
            editBuilder.insert(position, content);
        });
    }
    replaceWith(originalContent, newContent) {
        let document = vscode.window.activeTextEditor.document;
        var range;
        var line;
        for (var i = 0; i < document.lineCount; i++) {
            line = document.lineAt(i).text;
            if (line.includes(originalContent)) {
                range = document.lineAt(i).range;
                break;
            }
        }
        if (range == undefined) {
            return;
        }
        var start = new vscode_1.Position(range.start.line, line.indexOf(originalContent));
        var end = new vscode_1.Position(range.start.line, start.character + originalContent.length);
        var newRange = new vscode_1.Range(start, end);
        vscode.window.activeTextEditor.edit((editBuilder) => {
            editBuilder.replace(newRange, newContent);
        });
    }
    processTitle(title, url) {
        if (title == undefined) {
            return url;
        }
        return title.trim();
    }
    showMessage(content) {
        this._statusBarItem.text = "Paste URL: " + content;
        this._statusBarItem.show();
        setTimeout(() => {
            this._statusBarItem.hide();
        }, 3000);
    }
}
exports.Paster = Paster;
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
function isProxyConfigured() {
    return vscode.workspace.getConfiguration('http') != undefined;
}
function configureHttpRequest() {
    let httpSettings = vscode.workspace.getConfiguration('http');
    if (httpSettings != undefined) {
        let proxy = `${httpSettings.get('proxy')}`;
        if (proxy != undefined && proxy.length != 0) {
            if (!proxy.startsWith("http")) {
                proxy = "http://" + proxy;
            }
            baseRequest = request.defaults({ 'proxy': proxy });
        }
    }
    if (baseRequest == undefined) {
        baseRequest = hyperquest;
    }
}
//# sourceMappingURL=extension.js.map
