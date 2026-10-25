import {PrMeta, saveMeta} from "../aanvragen/requests";
import {firestore} from "./fireStore";
import {getInfoBlockForCurrentPage} from "../infoBlock/infoBlock";

let prMetasCache: Map<string, PrMeta> | null = null;

export interface MetaCache {
    get: (prId: string) => Promise<PrMeta>;
}

async function upgradeMetas(prMetas: PrMeta[]) {
    let metasToSave: PrMeta[] = [];
    for (let meta of prMetas) {
        if (meta.version < 1) {
            //@ts-ignore
            delete meta.project;
            meta.version = 1;
            metasToSave.push(meta);
        }
    }
    if (metasToSave.length > 0) {
        let infoBlock = getInfoBlockForCurrentPage();
        infoBlock.infoBar.setInfoLine("Updating metadata...");
        infoBlock.progressBar.start(metasToSave.length);
        for (let meta of metasToSave) {
            await saveMeta(meta);
            infoBlock.progressBar.next();
        }
        infoBlock.progressBar.stop();
        infoBlock.infoBar.setInfoLine("");
    }
}

export async function getMetaCache(): Promise<MetaCache> {
    if (!prMetasCache) {
        let prMetas = await firestore.fetchPrMetas(null);
        await upgradeMetas(prMetas);
        prMetasCache = new Map(prMetas.map(m => [m.prId, m]));
    }

    return {get: fetchMetaCached};
}

async function fetchMetaCached(prId: string) {
    let meta = prMetasCache!.get(prId); //! only accessed via getMetaCache
    if (!meta) {
        meta = {prId, tags: [], version: 1};
        await saveMeta(meta);
        prMetasCache!.set(prId, meta); //! only accessed via getMetaCache
    }
    return meta;
}