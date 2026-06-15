export interface RequisitionContext {
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
    requisitionId: string;
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