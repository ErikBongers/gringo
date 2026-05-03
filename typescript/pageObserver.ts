import {tryUntilThen} from "./globals";

interface PageFilter {
    match: () => boolean;
}

export class AllPageFilter implements PageFilter{
    match = () => true;
}

export class PartialUrlPageFilter implements PageFilter{
    private readonly partialUrl: string;
    constructor(partialUrl: string) {
        this.partialUrl = partialUrl;
    }

    match() {
        return window.location.href.includes(this.partialUrl);
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
    private readonly onPageChangedCallback?: () => void;
    private readonly onPageRefreshedCallback?: () => void;
    private pageFilter: PageFilter;
    private readonly onMutation?: (mutation: MutationRecord) => boolean;
    private observer: MutationObserver;
    private readonly trackModal: boolean;
    protected constructor(onPageChangedCallback: (() => void) | undefined, pageFilter: PageFilter, onMutationCallback: ((mutation: MutationRecord) => boolean) | undefined, trackModal: boolean = false, onPageRefreshedCallback?: () => void) {
        this.onPageChangedCallback = onPageChangedCallback;
        this.onPageRefreshedCallback = onPageRefreshedCallback;
        this.pageFilter = pageFilter;
        this.onMutation = onMutationCallback;
        this.trackModal = trackModal;
        if (onMutationCallback) {
            this.observer = new MutationObserver((mutationList, observer) => this.observerCallback(mutationList, observer));
        }
    }

    observerCallback(mutationList: MutationRecord[] , _observer: MutationObserver) {
        if(!this.onMutation)
            return;
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
        if(!document.querySelector("main")) //TODO
            console.error("Can't attach observer to element.");
        this.observeElement(document.querySelector("main")!);
        if(this.trackModal)
            this.observeElement(document.getElementById("dko3_modal")!);
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

export abstract class PartialUrlObserver extends BaseObserver {
    protected constructor(partialUrl: string, onMutationCallback: (mutation: MutationRecord) => boolean, trackModal: boolean = false, onPageRefreshedCallback?: () => void) {
        super(undefined, new PartialUrlPageFilter(partialUrl), onMutationCallback, trackModal, onPageRefreshedCallback);
    }
}
