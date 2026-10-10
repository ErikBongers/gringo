import {TarifDef} from "./aanvragen/requests";
import {fetchTarifDefs, saveTarifDefToFireStore} from "./db/fireStore";

export let sessionCache = {
    getTarifDef: getTarifDefCached,
    saveTarifDef: saveTarifDefCached,
}

let globalBtwTarifs: Map<string, TarifDef> | null = null;

export async function getBtwTarifsCachedInSession(): Promise<Map<string, TarifDef>> {
    if (globalBtwTarifs)
        return globalBtwTarifs;

    globalBtwTarifs = new Map<string, TarifDef>();
    let tarifs: TarifDef[];
    try {
        tarifs = await fetchTarifDefs();
    } catch {
        tarifs = [];
    }
    tarifs.forEach(t => globalBtwTarifs!.set(t.commodityCode, t));
    return globalBtwTarifs;
}

export async function getTarifDefCached(commodityCode: string) {
    let tarifs = await getBtwTarifsCachedInSession();
    return tarifs.get(commodityCode) ?? null;
}

async function saveTarifDefCached(tarifDef: TarifDef) {
    let tarifs = await getBtwTarifsCachedInSession();
    tarifs.set(tarifDef.commodityCode, tarifDef);
    await saveTarifDefToFireStore(tarifDef);
}