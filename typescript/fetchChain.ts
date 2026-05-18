import {TokenScanner} from "./tokenScanner";
import * as def from "./def";
import HeaderInfo = chrome.declarativeNetRequest.HeaderInfo;

export class FetchChain {
    private lastText: string | undefined = "";

    get() {
        return this.lastText;
    }

    getJson() {
        if(this.lastText === undefined)
            return null;
        return JSON.parse(this.lastText);
    }

    set(text: string) {
        this.lastText = text;
    }

    async fetch(url?: string) {
        this.lastText = await fetchText(url ?? this.lastText ?? "--null--");
        return this.lastText;
    }

    async post(url: string, body: string | object) {
        this.lastText = await fetchTextPost(url, body);
        return this.lastText;
    }

    findDocReadyLoadUrl() {
        this.lastText = getDocReadyLoadUrl(this.lastText ?? "--null--");
        return this.lastText;
    }

    findDocReadyLoadScript() {
        this.lastText = getDocReadyLoadScript(this.lastText ?? "--null--")?.result();
        return this.lastText;
    }

    find(...args: string[]) {
        this.lastText = new TokenScanner(this.lastText ?? "--null--").find(...args).result();
        return this.lastText;
    }

    getQuotedString() {
        let daString= "";
        let scanner = new TokenScanner(this.lastText ?? "--null--").captureString((res => daString = res));
        this.lastText  = scanner.result();
        return daString;
    }

    clipTo(end: string) {
        this.lastText = new TokenScanner(this.lastText ??  "--null--").clipTo(end).result();
    }

    div() {
        let el = document.createElement("div");
        el.innerHTML = this.lastText ?? "";
        return el;
    }

    includes(text: string): boolean {
        return this.lastText?.includes(text) ?? false;
    }
}

export function findDocReady(scanner: TokenScanner) {
    return scanner.find("$", "(", "document", ")", ".", "ready", "(");
}

export function getDocReadyLoadUrl(text: string) {
    let scanner = new TokenScanner(text);
    while (true) {
        let docReady = findDocReady(scanner);
        if (!docReady.valid)
            return undefined;
        let url = docReady
            .clone()
            .clipTo("</script>")
            .find(".", "load", "(")
            .clipString()
            .result();
        if (url)
            return url;
        scanner = docReady;
    }
}

export function getDocReadyLoadScript(text: string) {
    let scanner = new TokenScanner(text);
    while (true) {
        let docReady = findDocReady(scanner);
        if (!docReady.valid)
            return undefined;
        let script = docReady
            .clone()
            .clipTo("</script>");
        let load = script
            .clone()
            .find(".", "load", "(");
        if (load.valid)
            return script;
        scanner = docReady;
    }
}

export async function fetchText(url: string) {
    let res = await fetch(url);
    return res.text();
}

export async function fetchTextPost(url: string, body: string | object) {
    let bodyText: string;
    let headers: HeadersInit;
    if(typeof body == "string") {
        bodyText = body;
        headers = {
            "Content-Type": "text/plain",
        };
    }
    else {
        bodyText = JSON.stringify(body);
        headers = {
            "Content-Type": "application/json",
        };
    }
    let res = await fetch(url, {
        method: "POST",
        body: bodyText,
        headers
    });
    return res.text();
}