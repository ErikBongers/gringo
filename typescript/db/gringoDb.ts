import {DBSchema, openDB} from 'idb';
import {PrMeta} from "../aanvragen/observer";

//todo: use typed db: https://github.com/jakearchibald/idb#examples

const DB_VERSION = 1;

interface GringoDB extends DBSchema {
    PrMetas: {
        value: PrMeta;
        key: string;
        indexes: {};
    };
}

const dbGringo = openDB<GringoDB>('gringo', DB_VERSION, {
    upgrade(db) {
        db.createObjectStore("PrMetas", {keyPath: "prId"});
    },
});

export async function get(key: string) {
    return (await dbGringo).get("PrMetas", key);
}
export async function set(key: string, val: PrMeta) {
    return (await dbGringo).put("PrMetas", val, key);
}
export async function del(key: string) {
    return (await dbGringo).delete("PrMetas", key);
}
export async function clear() {
    return (await dbGringo).clear("PrMetas");
}
export async function keys() {
    return (await dbGringo).getAllKeys("PrMetas");
}
export async function setAll(prMetas: PrMeta[]) {
    let tx = (await dbGringo).transaction("PrMetas", 'readwrite');
    await Promise.all(prMetas.map(meta => tx.store.add(meta)));
}

//transition functions:
export async function clearMetasLocal() {
    for(let key in localStorage) {
        if(key.startsWith("gringo.PR"))
            localStorage.removeItem(key);
    }
}
export async function getMetaLocal(prId: string) {
    let jsonMeta = localStorage.getItem("gringo."+prId);
    if(jsonMeta)
        return JSON.parse(jsonMeta) as PrMeta;
    return null;
}

export async function saveMetaLocal(meta: PrMeta) {
    localStorage.setItem("gringo."+meta.prId, JSON.stringify(meta));
}

export async function saveMetasLocal(prMetas: PrMeta[]) {
    for(let meta of prMetas) {
        await saveMetaLocal(meta);
    }
}

