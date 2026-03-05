import {tryUntilThen} from "./globals";

interface PageFilter {
    match: () => boolean;
}

export class HashPageFilter implements PageFilter{
    private readonly urlHash: string;
    constructor(urlHash: string) {
        this.urlHash = urlHash;
    }

    match() {
        return window.location.hash.startsWith(this.urlHash);
    }
}

export class ExactHashPageFilter implements PageFilter{
    private readonly urlHash: string;
    constructor(urlHash: string) {
        this.urlHash = urlHash;
    }

    match() {
        if(!this.urlHash)
            return true; //no hash means always match.
        return window.location.hash === this.urlHash;
    }
}

export class AllPageFilter implements PageFilter{
    constructor() {
    }

    match() {
        return true;
    }
}

export interface Observer {
    onPageChanged: () => void;
    onPageRefreshed: () => void;
    isPageMatching: () => boolean;
    disconnect: () => void;
    observeElement: (element: HTMLElement) => void;
    isPageReallyLoaded: () => boolean;
}

export abstract class BaseObserver implements Observer {
    private readonly onPageChangedCallback: () => void;
    private readonly onPageRefreshedCallback: () => void;
    private pageFilter: PageFilter;
    private readonly onMutation: (mutation: MutationRecord) => boolean;
    private observer: MutationObserver;
    private readonly trackModal: boolean;
    protected constructor(onPageChangedCallback: () => void, pageFilter: PageFilter, onMutationCallback: (mutation: MutationRecord) => boolean, trackModal: boolean = false, onPageLoadedCallback: () => void = undefined) {
        this.onPageChangedCallback = onPageChangedCallback;
        this.onPageRefreshedCallback = onPageLoadedCallback;
        this.pageFilter = pageFilter;
        this.onMutation = onMutationCallback;
        this.trackModal = trackModal;
        if (onMutationCallback) {
            this.observer = new MutationObserver((mutationList, observer) => this.observerCallback(mutationList, observer));
        }
    }

    observerCallback(mutationList: MutationRecord[] , _observer: MutationObserver) {
        for (const mutation of mutationList) {
            if (mutation.type !== "childList") {
                continue;
            }
            if (this.onMutation(mutation)) {
                break;
            }
        }
    }

    isPageMatching = () => this.pageFilter.match();

    onPageRefreshed() {
        if(this.onPageRefreshedCallback)
            if(this.isPageMatching())
                tryUntilThen(this.isPageReallyLoaded, this.onPageRefreshedCallback);
    }

    onPageChanged() {
        if (!this.pageFilter.match()) {
            this.disconnect();
            return;
        }
        if (this.onPageChangedCallback) {
            this.onPageChangedCallback();
        }
        if (!this.onMutation)
            return;
        console.log("Observing main element.");
        if(!document.querySelector("main"))
            console.error("Can't attach observer to element.");
        this.observeElement(document.querySelector("main"));
        if(this.trackModal)
            this.observeElement(document.getElementById("dko3_modal"));
    }

    observeElement(element: HTMLElement) {
        if (!element) {
            console.error("Can't attach observer to element.");
            return;
        }

        const config = {
            attributes: false,
            childList: true,
            subtree: true
        };
        this.observer.observe(element, config);
    }

    disconnect() {
        this.observer?.disconnect();
    }

    abstract isPageReallyLoaded(): boolean;
}
