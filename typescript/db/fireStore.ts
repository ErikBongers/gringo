import {initializeApp} from "firebase/app";
import {collection, doc, FirestoreDataConverter, getDoc, getDocs, getFirestore, query, QueryDocumentSnapshot, where} from "firebase/firestore";
import {gringo} from "../globals";
import {PrMeta} from "../aanvragen/requests";

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
    await fetchSinglePrMeta("PR12345");
    await fetchPrMetas("2023-01-01T00:00:00Z");
    await fetchPrMetas(null);
}


async function fetchPrMetas(changedDateZ: string | null) {
    try {
        const prMetaRef = collection(db, "pr_meta");

        let querySnapshot;
        if(changedDateZ) {
            const q = query(prMetaRef, where("changed_date", ">=", changedDateZ));
            querySnapshot = await getDocs(q);
        }
        else
            querySnapshot = await getDocs(prMetaRef);

        querySnapshot.forEach((doc) => {
            gringo(`Document ID (${doc.id}):`, doc.data());
        });
    } catch (error) {
        console.error("Failed to query Firestore:", error);
    }
}