const crypto = require('crypto');

function genId() {
  return crypto.randomBytes(12).toString('hex');
}

function matchQuery(doc, query = {}) {
  if (!query || Object.keys(query).length === 0) return true;
  for (const [k, v] of Object.entries(query)) {
    if (k === '$or' && Array.isArray(v)) {
      if (!v.some(sub => matchQuery(doc, sub))) return false;
      continue;
    }
    const docVal = doc[k];
    if (v && typeof v === 'object' && !(v instanceof RegExp) && !(v instanceof Date)) {
      if ('$ne' in v) {
        if (String(docVal) === String(v.$ne)) return false;
        continue;
      }
      if ('$in' in v && Array.isArray(v.$in)) {
        if (!v.$in.map(String).includes(String(docVal))) return false;
        continue;
      }
    }
    if (v instanceof RegExp) {
      if (!v.test(String(docVal || ''))) return false;
      continue;
    }
    if (String(docVal) !== String(v)) return false;
  }
  return true;
}

function wrapDoc(raw, store) {
  if (!raw) return null;
  if (!raw._id) raw._id = genId();
  if (!raw.createdAt) raw.createdAt = new Date();
  if (typeof raw.save !== 'function') {
    Object.defineProperty(raw, 'save', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: async function () {
        const idx = store.findIndex(d => String(d._id) === String(this._id));
        if (idx >= 0) store[idx] = this;
        else store.push(this);
        return this;
      }
    });
  }
  if (typeof raw.toObject !== 'function') {
    Object.defineProperty(raw, 'toObject', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function () {
        return { ...this };
      }
    });
  }
  return raw;
}

function createChainable(itemsPromise) {
  let sortFn = null;
  let limitNum = null;

  const chain = {
    sort(spec) {
      if (spec && typeof spec === 'object') {
        const [[field, dir]] = Object.entries(spec);
        sortFn = (a, b) => {
          const av = a[field] instanceof Date ? a[field].getTime() : a[field];
          const bv = b[field] instanceof Date ? b[field].getTime() : b[field];
          return dir < 0 ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1);
        };
      }
      return chain;
    },
    limit(n) {
      limitNum = n;
      return chain;
    },
    select() {
      return chain;
    },
    lean() {
      return chain;
    },
    then(onFulfilled, onRejected) {
      return itemsPromise.then(list => {
        let res = Array.isArray(list) ? [...list] : list;
        if (Array.isArray(res)) {
          if (sortFn) res.sort(sortFn);
          if (typeof limitNum === 'number') res = res.slice(0, limitNum);
        }
        return res;
      }).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return chain.then(undefined, onRejected);
    }
  };
  return chain;
}

function patchModel(Model) {
  if (!Model || Model.__inMemoryPatched) return;
  Model.__inMemoryPatched = true;
  const store = [];
  Model.__store = store;

  Model.prototype.save = async function () {
    if (!this._id) this._id = genId();
    if (!this.createdAt) this.createdAt = new Date();
    const plain = this.toObject ? this.toObject() : { ...this };
    plain._id = String(plain._id);
    const wrapped = wrapDoc(Object.assign(this, plain), store);
    const idx = store.findIndex(d => String(d._id) === String(wrapped._id));
    if (idx >= 0) store[idx] = wrapped;
    else store.push(wrapped);
    return wrapped;
  };

  Model.find = function (query = {}) {
    const p = Promise.resolve(store.filter(d => matchQuery(d, query)));
    return createChainable(p);
  };

  Model.findOne = function (query = {}) {
    const p = Promise.resolve(store.find(d => matchQuery(d, query)) || null);
    return createChainable(p);
  };

  Model.findById = function (id) {
    const p = Promise.resolve(store.find(d => String(d._id) === String(id)) || null);
    return createChainable(p);
  };

  Model.create = async function (docOrArray) {
    if (Array.isArray(docOrArray)) {
      return Model.insertMany(docOrArray);
    }
    const item = wrapDoc({ ...docOrArray, _id: docOrArray._id ? String(docOrArray._id) : genId(), createdAt: docOrArray.createdAt || new Date() }, store);
    store.push(item);
    return item;
  };

  Model.insertMany = async function (docs = []) {
    const saved = docs.map(d => {
      const plain = d && typeof d.toObject === 'function' ? d.toObject() : { ...d };
      plain._id = plain._id ? String(plain._id) : genId();
      if (!plain.createdAt) plain.createdAt = new Date();
      const wrapped = wrapDoc(plain, store);
      store.push(wrapped);
      return wrapped;
    });
    return saved;
  };

  Model.findOneAndUpdate = function (query = {}, update = {}, opts = {}) {
    const p = (async () => {
      let existing = store.find(d => matchQuery(d, query));
      const setData = update.$set ? { ...update, ...update.$set } : { ...update };
      delete setData.$set;
      if (existing) {
        Object.assign(existing, setData);
        return existing;
      }
      if (opts && opts.upsert) {
        const created = wrapDoc({ ...query, ...setData, _id: genId(), createdAt: new Date() }, store);
        store.push(created);
        return created;
      }
      return null;
    })();
    return createChainable(p);
  };

  Model.findByIdAndUpdate = function (id, update = {}, opts = {}) {
    return Model.findOneAndUpdate({ _id: String(id) }, update, opts);
  };

  Model.updateMany = async function (query = {}, update = {}) {
    const setData = update.$set ? update.$set : update;
    let modifiedCount = 0;
    for (const doc of store) {
      if (matchQuery(doc, query)) {
        Object.assign(doc, setData);
        modifiedCount++;
      }
    }
    return { modifiedCount };
  };

  Model.deleteMany = async function (query = {}) {
    let deletedCount = 0;
    for (let i = store.length - 1; i >= 0; i--) {
      if (matchQuery(store[i], query)) {
        store.splice(i, 1);
        deletedCount++;
      }
    }
    return { deletedCount };
  };

  Model.deleteOne = async function (query = {}) {
    const idx = store.findIndex(d => matchQuery(d, query));
    if (idx >= 0) {
      store.splice(idx, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  };

  Model.countDocuments = async function (query = {}) {
    return store.filter(d => matchQuery(d, query)).length;
  };
}

function attachInMemoryFallback(models = []) {
  for (const m of models) {
    patchModel(m);
  }
}

module.exports = { attachInMemoryFallback };
