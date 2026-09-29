import {DBSchema, IDBPDatabase, openDB} from 'idb';
import {Repository} from "./repository";
import {PrMeta} from "../../aanvragen/requests";

const DB_VERSION = 1;
const LOCAL_DB_PREFIX = 'LocalGringoDb';

export interface LocalDb extends DBSchema {
    KeyValues: {
        key: string;
        value: boolean;
        indexes: {};
    },
    PrMetas: {
        key: string;
        value: PrMeta;
        indexes: {};
    },
}

let cacheMap: Map<string, LocalCache> = new Map();

export async function getLocalCache(schoolId: string = "Berchem") {
    let cache = cacheMap.get(schoolId);
    if(!cache) {
        cache = await LocalCache.get(schoolId);
        cacheMap.set(schoolId, cache);
    }
    return cache;
}


export class LocalCache {
    get PrMetas(): Repository<LocalDb, "PrMetas"> {
        return this._PrMetas;
    }
    get KeyValues(): Repository<LocalDb, "KeyValues"> {
        return this._KeyValues;
    }

    private readonly _KeyValues: Repository<LocalDb, "KeyValues">;
    private readonly _PrMetas: Repository<LocalDb, "PrMetas">;

    constructor(private db: IDBPDatabase<LocalDb>) {
        this._KeyValues = new Repository<LocalDb, "KeyValues">(this.db, 'KeyValues');
        this._PrMetas = new Repository<LocalDb, "PrMetas">(this.db, 'PrMetas');
    }

    private static getDbName(schoolId: string) {
        return `${LOCAL_DB_PREFIX}_${schoolId}`;
    }

    static async get(schoolId: string) {
        return new LocalCache(await openDB<LocalDb>(LocalCache.getDbName(schoolId), DB_VERSION, {
            upgrade(db) {
                db.createObjectStore("KeyValues", {keyPath: "key"});
                db.createObjectStore("PrMetas", {keyPath: "prId"});
            },
        }));
    }
}