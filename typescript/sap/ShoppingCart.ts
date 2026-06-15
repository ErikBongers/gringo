import {SapValidation} from "./Validation";
import {Money} from "./Money";

export interface LrcField {
    id: string;
    forceRefresh: boolean;
    required: boolean;
    disableDefaulting: boolean;
    type: string;
    maxLength: number;
    name: string;
    label: string | null;
    value: string | null;
    baseId: string | null;
    subType: string | null;
    options: unknown[] | null;
    unitOfMeasure: string | null;
    currency: string | null;
    editable: boolean;
    hidden: boolean;
    listValueSource: string | null;
    tooltip: string | null;
    validation: SapValidation;
    commentInfo: unknown | null;
    urlObj: unknown | null;
    address: unknown | null;
    uniqueName: string | null;
    passwordAdapter: string | null;
    rootCommodityCode: string | null;
    hideChooserClearSelection: boolean;
    purchaseOrgUniqueName: string | null;
    allowCustomValueForAddress: boolean;
    showValidationsOnChangeField: boolean;
    timezone: string;
    dateTimeValue: string | null;
    enableTimeSelection: boolean;
    preferredSupplierLevel: string | null;
    isSplitAccountingType: boolean;
}

export interface Lrc {
    showCheckbox: boolean;
    checkBoxState: boolean;
    checkBoxEditable: boolean;
    serviceStartDate: LrcField;
    serviceEndDate: LrcField;
    limitReq: boolean;
    newReq: boolean;
    limitChecked: boolean;
}

export interface Tenant {
    id: string | null;
    uniqueName: string;
    name: string | null;
    crmCustomerId: string | null;
    productionRealm: string | null;
    buyerAnId: string | null;
    buyerAnIdOriginal: string | null;
    buyerAnSystemId: string | null;
    s4Realm: string | null;
    parentRealmUniqueName: string | null;
    realmType: string | null;
}

export interface Relationships {
    MandatoryItemRelationships: Record<string, unknown[]>;
}

export interface RequisitionItem {
    id: string;
    erpId: string | null;
    contractHeader: boolean;
    tenantId: string;
    requester: string;
    itemKey: string;
    itemSubscriptionUniqueId: string | null;
    itemIsKit: boolean | null;
    itemId: string;
    supplierId: string | null;
    auxiliaryId: string;
    title: string;
    description: string;
    itemCommodityCode: string;
    itemCommodityDomain: string | null;
    unitPrice: number;
    quantity: number;
    unitOfMeasure: string;
    priceUnitQuantity: number | null;
    unitOfMeasureUniqueName: string;
    currency: string;
    totalPrice: number;
    maxAmount: number | null;
    thumbnailUrl: string;

    partialItemParametricField: unknown | null;
    piParametricFields: unknown | null;
    spotbuyItemDetails: unknown | null;
    status: unknown | null;
    shoppingCartId: string | null;
    requestLineId: string | null;

    requisitionLineNumber: string;
    startDate: string | null;
    endDate: string | null;
    isLimitOrder: boolean;

    unitPriceMoney: Money;
    totalPriceMoney: Money;
    maxAmountMoney: Money;
    expectedAmountMoney: Money;
    expectedAmount: number | null;
    requisitionTotalCost: Money;

    erpVendorId: string | null;
    buyerSystemId: string | null;
    supplierAnId: string | null;
    supplierAdHocContactId: string | null;

    isUseAdHocVendor: boolean;
    isSBNCatalogItem: boolean;
    isAdhoc: boolean | null;
    isPunchoutItem: boolean;

    formUniqueName: string | null;
    formDocumentId: string | null;
    formUserId: string | null;
    adhocUniqueName: string | null;
    formPriceRange: string | null;
    preferredSupplierLevel: string | null;
    supplierBean: unknown | null;

    reqUniqueName: string;
    hasERPReqID: boolean;
    stockedItem: boolean;

    plant: string | null;
    storageLocation: string | null;
    buyingGuidance: string | null;
    supplierPartID: string | null;

    relationships: Relationships;

    hasExtendedData: boolean;
    validationMessage: string | null;
    riskEngagementMessage: string | null;
    policyJustification: string | null;
    policyJustificationsMap: Record<string, unknown>;

    messages: unknown | null;
    supplierSelectionPolicyOutput: unknown | null;
    formWidgets: unknown | null;
    leadTime: number | null;
    shouldEvaluatePolicyOnFormChange: boolean | null;
    policyOutputContainer: unknown | null;

    onBehalfOfUserId: string | null;
    onBehalfOfPwdAdapter: string | null;
    resourceType: string | null;
    buyerMetrics: unknown | null;
    browserRequestId: string | null;
    oboContext: unknown | null;

    lrc: Lrc;

    parentReqLineNumber: string | null;
    maxAmountCurrency: string | null;
    isPunchInItem: boolean;

    minimumQuantity: number | null;
    quantityInterval: number | null;
    reservationDate: string | null;

    tenant: Tenant;

    slocQtyMap: Record<string, unknown>;

    gbmetrics: unknown | null;

    serviceItem: boolean;
    leanService: boolean;
    childItem: boolean;
    marketPlaceItem: boolean;
    parentItem: boolean;
    diverseSupplier: boolean;
    enhancedLimitItem: boolean;
}

export type RequisitionItemsResponse = RequisitionItem[];