export type AribaServiceType = "good" | "service";

export type AribaTileType =
    | "Page"
    | "Action"
    | "AdHocItem"
    | "ReqForm"
    | "CatalogItem"
    | "ProcurementForm"
    | "Form"
    | "EForm"
    | "ExternallyManaged"
    | "NonPOInvoice"
    | string;

export interface AribaLandingPageResource {
    id?: string;
    uniqueName: string;
    title?: string;
    description?: string;

    purchasingUnit?: string;
    type: AribaTileType;
    imageUrl?: string;
    targetUrl?: string;
    serviceType?: AribaServiceType;
    tenantId?: string;

    isDelete?: boolean;
    resources?: AribaLandingPageResource[];

    // Tenant-specific or extended fields
    isLimitOrder?: boolean;
    isEnhancedLimitItem?: boolean;
    procurementFormBeanList?: AribaProcurementFormBean[];
    showInstructions?: boolean;
    leaf?: boolean;

    dateFieldMappingPresent?: boolean;
    quantityFieldMappingPresent?: boolean;
    priceFieldMappingPresent?: boolean;

    // Other SAP or tenant-specific attributes
    [key: string]: unknown;
}

export interface AribaProcurementFormBean {
    uniqueName?: string;
    title?: string;
    description?: string;
    resourceType?: string;
    commodityCode?: string;
    serviceType?: AribaServiceType;
    pfLevel?: string;
    pfPurpose?: string;
    displaySequence?: string;
    imageUrl?: string;
    allowSubcategory?: boolean;

    [key: string]: unknown;
}

export type AribaLandingPage = AribaLandingPageResource;