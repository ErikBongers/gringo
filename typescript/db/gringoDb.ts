import {DBSchema, openDB} from 'idb';

import {PrMeta} from "../aanvragen/requests";

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
export async function set(val: PrMeta) {
    return (await dbGringo).put("PrMetas", val);
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
    await Promise.all(prMetas.map(meta => tx.store.put(meta)));
}

//transition functions:
export async function clearMetasLocal() {
    return clear();
}
export async function getMetaLocal(prId: string) {
    return get(prId);
}

export async function saveMetaLocal(meta: PrMeta) {
    return set(meta);
}

export async function saveMetasLocal(prMetas: PrMeta[]) {
    return setAll(prMetas);
}

