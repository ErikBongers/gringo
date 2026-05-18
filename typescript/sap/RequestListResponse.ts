namespace Sap {
    export type Nullable<T> = T | null;

    export interface RequestListResponse {
        headerTab: HeaderTab;
        requestList: RequestListItem[];
        buyerMetrics: null;
        aqlQueryStatement: null;
        overviewMap: null;
        gbmetrics: GbMetrics;
    }

    export interface HeaderTab {
        headerTabInfo: HeaderTabInfo[];
    }

    export interface HeaderTabInfo {
        title: string;
        count: number;
        active: boolean;
        value: string;
        requestCount: Nullable<number>;
    }

    export interface RequestListItem {
        id: Nullable<string>;
        reqUniqueName: string;
        reqTitle: Nullable<string>;
        description: Nullable<string>;
        tenantId: string;
        shoppingCartId: Nullable<string>;
        status: string;
        localizedStatus: Nullable<string>;
        totalCost: string;
        currency: string;
        daysSincerequested: string;
        requestedBy: string;
        type: string;
        requestedOn: Nullable<string>;
        respondByDate: Nullable<string>;
        needByDate: Nullable<string>;
        quoteNumber: number;
        images: Nullable<unknown>;
        totalCostMoney: Money;
        timeUpdated: string;
        supplier: Nullable<unknown>;
        formUniqueName: Nullable<string>;
        formDocumentId: Nullable<string>;
        purchaseOrders: Nullable<string[]>;
        reservationIds: Nullable<string[]>;
        approveType: Nullable<string>;
        serviceEntryId: Nullable<string>;
        approvableCost: Nullable<Money>;
        approvableCostInApproverDefaultCurrency: Nullable<Money>;
        lastModifiedDate: string;
        workSpaceDocumentId: Nullable<string>;
        workSpaceTitle: Nullable<string>;
        workSpaceDocumentType: Nullable<string>;
        fieldValueList: Nullable<unknown[]>;
        posMap: Nullable<Record<string, string>>;
        metadataId: Nullable<string>;
        teamId: string;
        teamName: Nullable<string>;
        role: Nullable<string>;
        rfeId: string;
        gbPurchaseOrderList: Nullable<GbPurchaseOrder[]>;
        errorKey: Nullable<string>;
        statusDescription: Nullable<string>;
        okToPullFromBuyer: boolean;
        preparer: string;
        statusKey: string;
        delegation: Nullable<unknown>;
        multiLineRFQ: boolean;
        trform: boolean;
    }

    export interface Money {
        amount: number;
        approxAmountInBaseCurrency: Nullable<number>;
        currency: string;
        currencySymbol: string;
        currencyScale: number;
    }

    export interface GbPurchaseOrder {
        uniqueName: string;
        orderId: string;
        status: Nullable<string>;
        tenant: Nullable<string>;
        user: Nullable<string>;
        action: Nullable<string>;
        userPwdAdapter: Nullable<string>;
        closedForChange: boolean;
        canBeCanceled: Nullable<boolean>;
        canBeChanged: Nullable<boolean>;
        canBeCopied: Nullable<boolean>;
        actionComment: Nullable<string>;
        supplierName: Nullable<string>;
        lineItemIndexes: Nullable<number[]>;
        deletedLineItemIndexes: Nullable<number[]>;
        event: Nullable<string>;
    }

    export interface GbMetrics {
        gbInitiationTime: string;
        gbCompletionTime: string;
        gbExecutionTime: string;
    }
}