export interface ProcurementForm {
    id: string;
    uniqueName: string;
    title: string;
    commodityCode: string;
    purchasingUnit: string;
    currency: string;
    language: string;
    type: string;
    imageUrl: string;
    targetUrl: string;
    serviceType: string;
    tenantId: string;
    isDelete: boolean;
    isLimitOrder: boolean;
    isEnhancedLimitItem: boolean;
    procurementFormBeanList: unknown[];
    showInstructions: boolean;
    leaf: boolean;
    priceFieldMappingPresent: boolean;
    quantityFieldMappingPresent: boolean;
    dateFieldMappingPresent: boolean;
}