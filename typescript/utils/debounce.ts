export function debounce<Args extends any[]>(
    func: (...args: Args) => void,
    delay: number
): (...args: Args) => void {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return function (this: any, ...args: Args): void {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}
