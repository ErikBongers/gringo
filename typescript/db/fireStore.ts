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
import {gringo} from "../globals";
import {PrMeta, TarifDef} from "../aanvragen/requests";

const firebaseConfig = {
    projectId: "ebo-tain",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "gringo-store");

const prMetaConverter: FirestoreDataConverter<PrMeta> = {
    // mapping data going TO the database (handled by your cloud function, but required for the interface type)
    toFirestore(prMeta: PrMeta) {
        return prMeta;
    },
    // mapping data coming FROM the database
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

async function fetchSinglePrMeta(id: string): Promise<PrMeta | null> {
    try {
        // Apply '.withConverter' directly to the document path layout
        const docRef = doc(db, "pr_meta", id).withConverter(prMetaConverter);

        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // 🎉 docSnap.data() is now strictly typed as PrMeta!
            const data: PrMeta = docSnap.data();

            gringo(data.prId); // Safe & autocompleted
            gringo(data.tags); // Safe & autocompleted

            return data;
        } else {
            gringo(`No document found with ID: ${id}`);
            return null;
        }
    } catch (error) {
        console.error("Error fetching document:", error);
        throw error;
    }
}

export async function testIt() {
    // gringo("Fetching all metas...");
    // let metas = await fetchPrMetas(null);
    // gringo("Done fetching all metas.");
    // await (await getLocalCache()).PrMetas.bulkPut(metas);
    // gringo("Done saving metas locally.");
    // await copyCloudtoFireStore();
    // await copyTarifDefsCloudtoFireStore();
}


export async function fetchPrMetas(changedDateZ: string | null) {
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

export async function fetchTarifDefs(): Promise<TarifDef[]> {
    const tarifDefRef = collection(db, "tarif_defs").withConverter(tarifDefConverter);
    const querySnapshot = await getDocs(tarifDefRef);
    let tarifDefs: TarifDef[] = [];
    querySnapshot.forEach((doc) => {
        tarifDefs.push(doc.data());
    });
    return tarifDefs;
}

export async function savePrMetaToFireStore(prMeta: PrMeta) {
    prMeta.changed_date = new Date().toISOString();
    let url = "https://europe-west1-ebo-tain.cloudfunctions.net/save_pr_meta";
    let data = {
        id: prMeta.prId,
        meta: prMeta,
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function saveTarifDefToFireStore(tarifDef: TarifDef) {
    let url = "https://europe-west1-ebo-tain.cloudfunctions.net/save_tarif_def";
    let data = {
        id: tarifDef.commodityCode,
        def: tarifDef,
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

