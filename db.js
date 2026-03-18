const DB_NAME = 'pppApp';
const DB_VERSION = 1;
const STORE_USERS = 'users';

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_USERS)) {
                const store = db.createObjectStore(STORE_USERS, { keyPath: 'email' });
                store.createIndex('email', 'email', { unique: true });
            }
        };

        request.onsuccess = async (event) => {
            const db = event.target.result;
            await migrateFromLocalStorage(db);
            resolve(db);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

async function migrateFromLocalStorage(db) {
    try {
        const raw = localStorage.getItem('users');
        if (!raw) return;

        const users = JSON.parse(raw);
        if (!Array.isArray(users)) return;

        const tx = db.transaction(STORE_USERS, 'readwrite');
        const store = tx.objectStore(STORE_USERS);

        for (const user of users) {
            const getReq = store.get(user.email);
            await new Promise((resolve) => {
                getReq.onsuccess = () => {
                    if (!getReq.result) {
                        store.add(user);
                    }
                    resolve();
                };
                getReq.onerror = () => resolve();
            });
        }

        // Optionally clear localStorage to avoid confusion.
        // localStorage.removeItem('users');
    } catch (err) {
        console.warn('Migration failed', err);
    }
}

function withStore(mode, callback) {
    return openDb().then((db) =>
        new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_USERS, mode);
            const store = tx.objectStore(STORE_USERS);
            Promise.resolve(callback(store))
                .then(resolve)
                .catch(reject);
            tx.oncomplete = () => {};
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        })
    );
}

function getUserByEmail(email) {
    return withStore('readonly', (store) =>
        new Promise((resolve, reject) => {
            const req = store.get(email);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        })
    );
}

function getAllUsers() {
    return withStore('readonly', (store) =>
        new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        })
    );
}

function addUser(user) {
    return withStore('readwrite', (store) =>
        new Promise((resolve, reject) => {
            const req = store.add(user);
            req.onsuccess = () => resolve(user);
            req.onerror = () => reject(req.error);
        })
    );
}

function updateUser(user) {
    return withStore('readwrite', (store) =>
        new Promise((resolve, reject) => {
            const req = store.put(user);
            req.onsuccess = () => resolve(user);
            req.onerror = () => reject(req.error);
        })
    );
}
