import {DBSchema, IDBPDatabase, IDBPTransaction, openDB} from 'idb';
import {Repository} from "./repository";
import {getSuppliers, PrListPrData, PrMeta} from "../../aanvragen/requests";
import {AribaLandingPageResource} from "../../sap/LandingPage";

import {Tile} from "../../homePage/tileTable";

const DB_VERSION = 15;
const LOCAL_DB_PREFIX = 'LocalGringoDb';

export interface LocalDb extends DBSchema {
    KeyValues: {
        key: string;
        value: boolean;
        indexes: {};
    },
    PrListData: {
        key: string;
        value: PrListPrData;
        indexes: {};
    },
    Tiles: {
        key: string;
        value: Tile;
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
    get KeyValues(): Repository<LocalDb, "KeyValues"> {
        return this._KeyValues;
    }
    get PrListData(): Repository<LocalDb, "PrListData"> {
        return this._PrListData;
    }
    get Tiles(): Repository<LocalDb, "Tiles"> {
        return this._Tiles;
    }

    private readonly _KeyValues: Repository<LocalDb, "KeyValues">;
    private readonly _PrListData: Repository<LocalDb, "PrListData">;
    private readonly _Tiles: Repository<LocalDb, "Tiles">;

    constructor(private db: IDBPDatabase<LocalDb>) {
        this._KeyValues = new Repository<LocalDb, "KeyValues">(this.db, 'KeyValues');
        this._PrListData = new Repository<LocalDb, "PrListData">(this.db, 'PrListData');
        this._Tiles = new Repository<LocalDb, "Tiles">(this.db, 'Tiles');
    }

    private static getDbName(schoolId: string) {
        return `${LOCAL_DB_PREFIX}_${schoolId}`;
    }

    static async get(schoolId: string) {
        return new LocalCache(await openDB<LocalDb>(LocalCache.getDbName(schoolId), DB_VERSION, {
            async upgrade(db, oldVersion, newVersion: number, transaction) {
                if (oldVersion < 1) {
                    db.createObjectStore("KeyValues", {keyPath: "key"});
                }
                if (oldVersion < 2) {
                    db.createObjectStore("PrListData", {keyPath: "prId"});
                }
                if (oldVersion < 13) {
                    await upgradeTo13(transaction, (prData: PrListPrData) => true);
                }
                if (oldVersion < 14) {
                    //@ts-ignore
                    db.deleteObjectStore("PrMetas");
                }
                if (oldVersion < 15) {
                    db.createObjectStore("Tiles", {keyPath: "id"});
                }
            },
        }));
    }
}

async function upgradeTo13(
    transaction: IDBPTransaction<LocalDb, ["KeyValues", "PrListData", "Tiles"], "versionchange">,
    isInvalid: (prData: PrListPrData) => boolean
) {
    let prDatas = await transaction.objectStore("PrListData").getAll();

    for (const prData of prDatas) {
        if (!isInvalid(prData))
            continue;

        //populate new fields
        for(let item of prData.items) {
            item.grantCode = "";
            item.ledgerCode = "";
        }
        prData.changed_date = "0"; //force re-fetch
        await transaction.objectStore("PrListData").put(prData);
    }
}
