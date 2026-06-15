export interface SapValidation {
    valid: boolean;
    message: string | null;
    severity: "Info" | "Justification" | string;
    messageSource: string | null;
    tierName: string | null;
    parentNIC: number;
    lineType: number;
    skipValidationMessage: boolean;
}