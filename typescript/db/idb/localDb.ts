import {DBSchema, IDBPDatabase, openDB} from 'idb';
import {Repository} from "./repository";
import {PrListPrData, PrMeta} from "../../aanvragen/requests";

const DB_VERSION = 2;
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
    PrListData: {
        key: string;
        value: PrListPrData;
        indexes: {};
    }
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
    get PrListData(): Repository<LocalDb, "PrListData"> {
        return this._PrListData;
    }

    private readonly _KeyValues: Repository<LocalDb, "KeyValues">;
    private readonly _PrMetas: Repository<LocalDb, "PrMetas">;
    private readonly _PrListData: Repository<LocalDb, "PrListData">;

    constructor(private db: IDBPDatabase<LocalDb>) {
        this._KeyValues = new Repository<LocalDb, "KeyValues">(this.db, 'KeyValues');
        this._PrMetas = new Repository<LocalDb, "PrMetas">(this.db, 'PrMetas');
        this._PrListData = new Repository<LocalDb, "PrListData">(this.db, 'PrListData');
    }

    private static getDbName(schoolId: string) {
        return `${LOCAL_DB_PREFIX}_${schoolId}`;
    }

    static async get(schoolId: string) {
        return new LocalCache(await openDB<LocalDb>(LocalCache.getDbName(schoolId), DB_VERSION, {
            upgrade(db, oldVersion , newVersion: number) {
                if (oldVersion < 1) {
                    db.createObjectStore("KeyValues", {keyPath: "key"});
                    db.createObjectStore("PrMetas", {keyPath: "prId"});
                }
                if (oldVersion < 2) {
                    db.createObjectStore("PrListData", {keyPath: "prId"});
                }
            },
        }));
    }
}