import {Money} from "./Money";
import {SapValidation} from "./Validation";

export interface PurchaseRequisition {
    reqId: string;
    erpId: string | null;
    contractHeader: unknown | null;
    status: string;
    isLimitOrder: boolean;
    validityStartDate: number | null;
    validityEndDate: number | null;

    title: SapField<string>;
    shippingAddress: SapField<number>;
    accounting: SapField<number>;
    abacSection: unknown | null;
    projectId: SapField<string>;
    projectTitle: SapField<string>;
    externalSourcingId: string | null;

    onBehalfOfContext: OnBehalfOfContext;

    statusKey: string;
    approvedState: number;

    core: SapSection;
    advanced: SapAdvancedSection;

    exceedsLineItemMaxLimit: boolean;
    lineItems: SapLineItem[];

    deletedLineItems: SapLineItem[] | null;
    stockedLineItems: SapLineItem[] | null;
    rfqFormItem: unknown | null;

    commentMaxLimit: number;
    numberOfComments: number;
    comments: SapSection;

    total: SapField<Money>;
    totalInApproverDefaultCurrency: Money | null;

    isTLCEnabled: boolean;

    netTotal: SapField<Money>;
    taxAmount: SapField<Money | null>;
    chargeAmount: SapField<Money | null>;
    discountAmount: SapField<Money | null>;

    shipping: SapSection | null;

    valid: boolean;
    messages: unknown[] | null;

    dottedPathFieldValues: Record<string, string | number | boolean | Money | null>;

    isShoppingCart: boolean;

    policyJustification: SapField<string>;
    policyJustificationsMap: Record<string, SapField<string>>;

    budgetCheckEnabled: boolean | null;
    mapPOsByStatus: unknown | null;
    mapReservationsByStatus: unknown | null;

    policyOutputContainer: PolicyOutputContainer;

    budgetCheckValid: boolean;

    relationships: {
        MandatoryItemRelationships: Record<string, unknown>;
    };

    showCopyWarningForPunchOutItem: boolean;
    hasOnlyPunchOutItems: boolean;
    hasSpotBuyItems: boolean;

    updatedLineItemDataOnly: unknown | null;
    updatedStockLineItemDataOnly: unknown | null;

    executionTimeParameters: Record<string, unknown>;

    isApprover: boolean;
    isComposer: boolean;
    isWatcher: boolean;

    displayLineItemShippingSummary: boolean;
    displayLineItemAccountingSummary: boolean;

    buyerMetrics: ExecutionMetrics;

    realmType: string;

    hasPolicyValidationOutput: boolean;
    hasAccess: boolean;
    evaluateLineItemPoliciesOnly: boolean;

    fieldSeverity: string | null;
    policySeverity: string | null;
    policyTriggerFieldChanged: boolean;

    gbTeamId: string | null;
    gbTeamName: string | null;
    gbReceivingTeamId: string | null;

    containsOnlyInventoryItems: boolean;

    engagementRequestId: string | null;
    engagementRequestStatus: string | null;
    lineItemsWithCopyFormError: unknown | null;

    active: boolean;

    gbmetrics: ExecutionMetrics;

    originalVersion: boolean;
    warningsOnly: boolean;
    inventoryItemInReq: boolean;
}

export interface SapLineItem {
    imageUrl: string;
    title: string;
    description: string;
    lineNumber: string;
    itemKey: string;

    orderID: string | null;
    formDocumentId: string | null;
    formUniqueName: string | null;
    adhocUniqueName: string | null;
    formPriceLabel: string | null;
    purchaseOrderInfo: string | null;
    requestLineRef: string | null;
    lineItemType: string | null;
    rfeUniqueName: string | null;

    isAdhoc: boolean;
    isSpotBuy: boolean;
    isPunchout: boolean;
    isServiceItem: boolean;
    isLimitItem: boolean;
    isEnhancedLimitItem: boolean;
    isCanceledItem: boolean;
    isClosedForChange: boolean;
    isClosedForReceiving: boolean;

    spotBuyAttributes: unknown | null;

    core: SapSection;
    comments: SapSection;
    attachments: SapSection;

    commentMaxLimit: number;

    price: SapField<Money>;
    quantity: SapField<number>;
    unitOfMeasure: SapField<string>;
    subtotal: SapField<Money>;

    subTotalInApproverDefaultCurrency: Money | null;

    taxAmount: SapField<Money | null>;
    chargeAmount: SapField<Money | null>;
    discountAmount: SapField<Money | null>;
    netAmount: SapField<Money>;
    netAmountInApproverDefaultCurrency: Money | null;
    grossAmount: SapField<Money>;
    grossAmountInApproverDefaultCurrency: Money | null;

    accounting: SapAccountingSection;
    shipping: SapSection;
    advanced: SapSection;

    messages: unknown[] | null;
    policyJustification: SapField<string> | null;
    policyJustificationsMap: Record<string, SapField<string>>;

    formPriceLabelField: SapField<unknown> | null;
    hasExtendedData: boolean | null;

    supplier: SapField<string>;

    serviceStartDate: number | null;
    serviceEndDate: number | null;

    details: SapSection;

    shipTo: SapField<string> | null;
    maxAmount: Money | null;
    expectedAmount: Money | null;
    plant: SapField<string> | null;
    storageLocation: SapField<string> | null;

    stockIdentifier: boolean;
    reservationDate: number | null;
    formStatusCode: number;

    priceUnitQuantity: number | null;
    reservationId: string | null;

    isDiverseSupplier: boolean;

    taxCode: string | null;
    taxPercentage: number | null;

    isChildItem: boolean | null;
    isParentItem: boolean | null;
    parentReqLineNumber: string | null;
    childItems: SapLineItem[] | null;

    rfqId: string | null;
    displayRfqIdLink: boolean;

    minimumQuantity: number | null;
    quantityInterval: number | null;

    isUseAdHocVendor: boolean;
    isSBNCatalogItem: boolean | null;
}

export interface SapField<TValue = unknown> {
    id: string;
    forceRefresh: boolean;
    required: boolean;
    disableDefaulting: boolean;
    type: SapFieldType | null;
    maxLength: number;
    name: string | null;
    label: string | null;
    value: TValue;

    baseId: string | null;
    subType: string | null;

    options: Record<string, string | number | boolean> | null;

    unitOfMeasure: string | null;
    currency: string | null;

    editable: boolean;
    hidden: boolean;

    listValueSource: string | null;

    tooltip: SapTooltip | null;
    validation: SapValidation;

    commentInfo: SapCommentInfo | null;
    urlObj: unknown | null;
    address: SapAddress | null;

    uniqueName: string | null;
    passwordAdapter: string | null;
    rootCommodityCode: string | null;

    hideChooserClearSelection: boolean;
    purchaseOrgUniqueName: string | null;
    allowCustomValueForAddress: boolean;
    showValidationsOnChangeField: boolean;

    timezone: string | null;
    dateTimeValue: string | null;
    enableTimeSelection: boolean;

    preferredSupplierLevel: number | null;
    isSplitAccountingType: boolean;
}

export type SapFieldType =
    | "text"
    | "date"
    | "chooser"
    | "radio"
    | "attachment"
    | "textarea"
    | "money"
    | "bigdecimal"
    | "comment"
    | "policy";

export interface SapSection {
    id: string;
    collapsed: boolean;
    hasError: boolean;
    rendered: boolean;
    fields: SapField[] | null;

    canMarkAsSupplierComment: boolean | null;
    canMarkAsSupplierAttachment: boolean | null;

    title?: string;
    description?: string;
}

export interface SapAdvancedSection extends SapSection {
    accounting: SapAccountingSection | null;
    attachments: SapSection;
}

export interface SapAccountingSection extends SapSection {
    title: string;
    description: string;

    withSplit: boolean;
    splitHeader: unknown | null;
    splits: unknown[] | null;

    groupMap: Record<string, SapField[]>;

    summaryKey: string | null;
    blankAccountAssignment: boolean;
}

export interface SapTooltip {
    displayString: string | null;
}

export interface SapCommentInfo {
    user: string;
    content: string;
    timestamp: number;
    source: string;
    shareWithSupplier: boolean;
    dummy: boolean;
    copyApprovable: boolean;
    userUniqueName: string;
}

export interface SapAddress {
    derivedAddress: string;
    lines: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    creatorUniqueName: string | null;
    addressUniqueName: string | null;
    private: boolean | null;
    adhoc: boolean | null;
}

export interface OnBehalfOfContext {
    user: string | null;
    companyCode: string | null;
    companyCode_pu: string | null;
    companyCode_puHierarchyPath: string | null;
    purchaseOrg: string | null;
    companyName: string | null;
    procurementUnit: string | null;
    puHierarchyPath: string | null;
    setId: string | null;
    plant: string | null;
    plantName: string | null;
    plant_cc: string | null;
    plant_pu: string | null;
    plant_puHierarchyPath: string | null;
    popularContainer: string | null;
    project: string | null;
    requisitionId: string | null;
    teamBuyingDefaultLogin: boolean;
    defaultTeamName: string | null;
    gbTeamId: string | null;
    gbReceivingTeamId: string | null;
    stopOBOType: string | null;
    teamName: string | null;
    teamOwnerInactive: boolean;
    oboField: string | null;
    shipTo: string | null;
    oboScenario: boolean;
}

export interface PolicyOutputContainer {
    policyOutputMap: Record<string, unknown>;
    sourcingConfigMaps: unknown | null;
}

export interface ExecutionMetrics {
    buyerInitiationTIme?: string;
    buyerCompletionTime?: string;
    buyerExecutionTime?: string;

    gbInitiationTime?: string;
    gbCompletionTime?: string;
    gbExecutionTime?: string;
}