export interface Money {
    amount: number;
    approxAmountInBaseCurrency?: number | null;
    currency: string;
    currencySymbol: string;
    currencyScale: number;
}