type Up = IDBUpgradeNeededEvent;
export function withDB<T>(fn:(db:IDBDatabase)=>Promise<T>|T): Promise<T>{
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open('pulse-db', 1);
    req.onupgradeneeded = (e:Up)=>{
      const db = (e.target as any).result as IDBDatabase;
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath:'id', autoIncrement:true });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath:'key' });
    };
    req.onsuccess = ()=>{
      const db = req.result;
      Promise.resolve(fn(db)).then(resolve, reject).finally(()=> db.close());
    };
    req.onerror = ()=> reject(req.error);
  });
}
export function tx<T>(db:IDBDatabase, store:string, mode:IDBTransactionMode, fn:(s:IDBObjectStore)=>Promise<T>|T): Promise<T>{
  return new Promise((resolve, reject)=>{
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    Promise.resolve(fn(s)).then((v)=>{
      t.oncomplete = ()=> resolve(v);
      t.onerror = ()=> reject(t.error);
    }, reject);
  });
}
