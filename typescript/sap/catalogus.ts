export interface CatalogSearchResponse {
    catalogItems: CatalogItem[];
    catalogFacets: unknown[];
    adhocItems: unknown[];
    dynamicPriceItemsContainer: DynamicPriceItemsContainer;
    searchResultCount: number;
    buyerMetrics: BuyerMetrics;
    multiCatalogFilterFeatureEnabled: boolean;
    facetsName: string[];
    gbmetrics: ExecutionMetrics;
}

export interface CatalogItem {
    supplier: unknown | null;
    key: string;
    supplierERPVendorId: string;
    supplierId: string;
    subscriptionBaseId: string;
    catalogName: string;
    catalogType: string | null;
    itemId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    imageUrl: string;
    unitOfMeasure: string;
    unitPrice: Price;
    thumbNail: Thumbnail;
    type: "system:catalogitem" | string;
    formCategory: unknown | null;
    formRelated: unknown | null;
    formLocation: unknown | null;
    punchOutItem: boolean;
    spotBuyItem: boolean;
    categoryType: boolean;
    leadTime: number;
    shipToLocation: unknown | null;
    hasParametricOptions: boolean;
    parametricFieldValues: unknown | null;
    parametricUIFields: unknown | null;
    favoriate: boolean;
    supplierUrl: string | null;
    manufacturerUrl: string | null;
    currency: string;
    shortName: string;
    partial: boolean;
    internalPartId: boolean;
    punchOutLevel: string | null;
    defaultRelevance: number | null;
    classificationCode: string | null;
    commodityCode: string;
    commodityDomain: string;
    commodityName: string;
    auxiliaryid: string | null;
    supplierName: string;
    hasImage: boolean;
    dynamicPriced: boolean;
    dynamicPriceFetchStatus: string;
    dynamicPriceRequestContainer: unknown | null;
    unitOfMeasureId: string;
    supplierLocationANID: string | null;
    hazardousMaterials: boolean;
    greenCertification: boolean;
    isPreferredItem: boolean;
    quantityInterval: number;
    minQty: number;
    packingQuantity: number | null;
    incomplete: boolean;
    hasAdditionalSpec: boolean;
    contentUOM: string | null;
    specificationFieldMap: Record<string, unknown>;
    catalogItemSpecList: CatalogItemSpec[];
    catalogAdditionalSpecList: Record<string, unknown>;
    priceBasisQuantityDetails: unknown[];
    buyerMetrics: BuyerMetrics | null;
    hasExtendedData: boolean;
    auxImages: unknown[];
    scaledPrices: ScaledPrices;
    attachments: unknown[] | null;
    mandatoryItems: unknown[] | null;
    similarItems: unknown[] | null;
    accessories: unknown[] | null;
    followupProducts: unknown[] | null;
    spareParts: unknown[] | null;
    displayLaneFields: unknown[] | null;
    priceUnitQuantity: number | null;
    stockData: Record<string, unknown>;
    reservationDate: string | null;
    greenCertificationDisplayField: string;
    hazardousMaterialsDisplayField: string;
    functionalDocumentTileDetails: unknown | null;
    gbmetrics: ExecutionMetrics | null;
    kitItem: boolean;
    formType: boolean;
}

export interface Price {
    amount: number;
    currency: string;
    currencySymbol: string;
    currencyScale: number;
}

export interface Thumbnail {
    fileStat: string;
    contentType: string;
}

export interface CatalogItemSpec {
    fieldName: string;
    fieldLabel: string;
    fieldValue: string | number | boolean | Price | null;
    isCustom: boolean;
}

export interface ScaledPrices {
    minQty: number;
    interval: number;
    priceOptions: unknown[] | null;
    originalMinQtyIsNull: boolean;
}

export interface DynamicPriceItemsContainer {
    request: unknown | null;
    catalogItemKeyToCatalogItemIndexMap: Record<string, number>;
}

export interface BuyerMetrics {
    buyerInitiationTIme: string;
    buyerCompletionTime: string;
    buyerExecutionTime: string;
}

export interface ExecutionMetrics {
    gbInitiationTime: string;
    gbCompletionTime: string;
    gbExecutionTime: string;
}
