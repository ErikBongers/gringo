import {initializeApp} from "firebase/app";
import {
    collection,
    doc,
    FirestoreDataConverter,
    getDoc,
    getDocs,
    getFirestore,
    query,
    QueryDocumentSnapshot,
    where
} from "firebase/firestore";
import {PrMeta, TarifDef} from "../aanvragen/requests";

export let firestore = {
    savePrMeta,
    fetchPrMeta,
    fetchPrMetas,

    saveTarifDef,
    fetchTarifDefs,

    saveKeyValue,
    fetchKeyValue
}


const firebaseConfig = {
    projectId: "ebo-tain",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "gringo-store");

const prMetaConverter: FirestoreDataConverter<PrMeta> = {
    toFirestore(prMeta: PrMeta) {
        return prMeta;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): PrMeta {
        const data = snapshot.data();
        return {
            prId: data.prId,
            tags: data.tags || [],
            project: data.project,
            changed_date: data.changed_date
        };
    }
};

const tarifDefConverter: FirestoreDataConverter<TarifDef> = {
    toFirestore(tarifDef: TarifDef) {
        return tarifDef;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): TarifDef {
        const data = snapshot.data();
        return {
            commodityCode: data.commodityCode,
            tarif: data.tarif,
            description: data.description
        };
    }
}

async function fetchPrMeta(id: string): Promise<PrMeta | null> {
    try {
        const docRef = doc(db, "pr_meta", id).withConverter(prMetaConverter);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching document:", error);
        throw error;
    }
}

async function fetchKeyValue(key: string): Promise<string | null> {
    try {
        const docRef = doc(db, "key_values", key);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.get("value") as string;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching document:", error);
        throw error;
    }
}

async function fetchPrMetas(changedDateZ: string | null) {
    const prMetaRef = collection(db, "pr_meta").withConverter(prMetaConverter);

    let querySnapshot;
    if (changedDateZ) {
        const q = query(prMetaRef, where("changed_date", ">=", changedDateZ));
        querySnapshot = await getDocs(q);
    } else
        querySnapshot = await getDocs(prMetaRef);

    let metas: PrMeta[] = [];
    querySnapshot.forEach((doc) => {
        metas.push(doc.data());
    });
    return metas;
}

async function fetchTarifDefs(): Promise<TarifDef[]> {
    const tarifDefRef = collection(db, "tarif_defs").withConverter(tarifDefConverter);
    const querySnapshot = await getDocs(tarifDefRef);
    let tarifDefs: TarifDef[] = [];
    querySnapshot.forEach((doc) => {
        tarifDefs.push(doc.data());
    });
    return tarifDefs;
}

async function _save(functionName: string, id: string, data: any) {
    let url = `https://europe-west1-ebo-tain.cloudfunctions.net/${functionName}`;
    let body = {
        id,
        data,
    };
    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
}

async function savePrMeta(prMeta: PrMeta) {
    prMeta.changed_date = new Date().toISOString();
    await _save("save_pr_meta", prMeta.prId, prMeta);
}

async function saveTarifDef(tarifDef: TarifDef) {
    await _save("save_tarif_def", tarifDef.commodityCode, tarifDef);
}

async function saveKeyValue(key: string, value: string) {
    await _save("save_key_value", key, {value});
}
