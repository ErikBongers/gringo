import {TarifDef} from "./aanvragen/requests";
import {firestore} from "./db/fireStore";

export type SessionCache = {
    getTarifDef: (commodityCode: string) => TarifDef | null;
    saveTarifDef: (tarifDef: TarifDef) => Promise<void>;
}

let sessionCache: SessionCache = {
    getTarifDef,
    saveTarifDef,
}

export async function getSessionCache() {
    await createCache();
    return sessionCache;
}

let globalBtwTarifs: Map<string, TarifDef> | null = null;

async function createCache() {
    if (globalBtwTarifs)
        return;

    globalBtwTarifs = new Map<string, TarifDef>();
    let tarifs: TarifDef[];
    try {
        tarifs = await firestore.fetchTarifDefs();
    } catch {
        tarifs = [];
    }
    tarifs.forEach(t => globalBtwTarifs!.set(t.commodityCode, t));
}

function getTarifDef(commodityCode: string) {
    return globalBtwTarifs!.get(commodityCode) ?? null;
}

async function saveTarifDef(tarifDef: TarifDef) {
    globalBtwTarifs!.set(tarifDef.commodityCode, tarifDef);
    await firestore.saveTarifDef(tarifDef);
}