import {fetchPrMetas} from "./fireStore";
import {PrMeta, saveMeta} from "../aanvragen/requests";

let prMetasCache: Map<string, PrMeta> | null = null;

export interface MetaCache {
    get: (prId: string) => Promise<PrMeta>;
}

export async function getMetaCache(): Promise<MetaCache> {
    if (!prMetasCache) {
        let prMetas = await fetchPrMetas(null);
        prMetasCache = new Map(prMetas.map(m => [m.prId, m]));
    }

    return {get: fetchMetaCached};
}

async function fetchMetaCached(prId: string) {
    let meta = prMetasCache!.get(prId); //! only accessed via getMetaCache
    if (!meta) {
        meta = {prId, tags: []};
        await saveMeta(meta);
        prMetasCache!.set(prId, meta); //! only accessed via getMetaCache
    }
    return meta;
}