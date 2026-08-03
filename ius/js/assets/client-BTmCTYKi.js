var be = (s, t) => () => (t || s((t = { exports: {} }).exports, t), t.exports);
var Ye = be((tn, ce) => {
  let zt = class {
    static toI8Slice(t, e, n, i) {
      new Int8Array(t.buffer, n, i).set(e, 0);
    }
    static toI8Array(t, e, n, i) {
      const o = new Int8Array(t.buffer, e, n);
      i.set(o, 0);
    }
    static toI16Slice(t, e, n, i) {
      new Int16Array(t.buffer, n, i).set(e, 0);
    }
    static toI16Array(t, e, n, i) {
      const o = new Int16Array(t.buffer, e, n);
      i.set(o, 0);
    }
    static toI32Slice(t, e, n, i) {
      new Int32Array(t.buffer, n, i).set(e, 0);
    }
    static toI32Array(t, e, n, i) {
      const o = new Int32Array(t.buffer, e, n);
      i.set(o, 0);
    }
    static toU8Slice(t, e, n, i) {
      new Uint8Array(t.buffer, n, i).set(e, 0);
    }
    static toU8Array(t, e, n, i) {
      const o = new Uint8Array(t.buffer, e, n);
      i.set(o, 0);
    }
    static toU8CSlice(t, e, n, i) {
      new Uint8ClampedArray(t.buffer, n, i).set(e, 0);
    }
    static toU8CArray(t, e, n, i) {
      const o = new Uint8ClampedArray(t.buffer, e, n);
      i.set(o, 0);
    }
    static toU16Slice(t, e, n, i) {
      new Uint16Array(t.buffer, n, i).set(e, 0);
    }
    static toU16Array(t, e, n, i) {
      const o = new Uint16Array(t.buffer, e, n);
      i.set(o, 0);
    }
    static toU32Slice(t, e, n, i) {
      new Uint32Array(t.buffer, n, i).set(e, 0);
    }
    static toU32Array(t, e, n, i) {
      const o = new Uint32Array(t.buffer, e, n);
      i.set(o, 0);
    }
    static toF32Slice(t, e, n, i) {
      new Float32Array(t.buffer, n, i).set(e, 0);
    }
    static toF32Array(t, e, n, i) {
      const o = new Float32Array(t.buffer, e, n);
      i.set(o, 0);
    }
    static toF64Slice(t, e, n, i) {
      new Float64Array(t.buffer, n, i).set(e, 0);
    }
    static toF64Array(t, e, n, i) {
      const o = new Float64Array(t.buffer, e, n);
      i.set(o, 0);
    }
    static toBigInt64Slice(t, e, n, i) {
      new BigInt64Array(t.buffer, n, i).set(e, 0);
    }
    static toBigInt64Array(t, e, n, i) {
      const o = new BigInt64Array(t.buffer, e, n);
      i.set(o, 0);
    }
    static toBigUint64Slice(t, e, n, i) {
      new BigUint64Array(t.buffer, n, i).set(e, 0);
    }
    static toBigUint64Array(t, e, n, i) {
      const o = new BigUint64Array(t.buffer, e, n);
      i.set(o, 0);
    }
  }, r, V = null;
  function $() {
    return (V === null || V.byteLength === 0) && (V = new Uint8Array(r.memory.buffer)), V;
  }
  let Q = typeof TextDecoder < "u" ? new TextDecoder("utf-8", { ignoreBOM: !0, fatal: !0 }) : { decode: () => {
    throw Error("TextDecoder not available");
  } };
  typeof TextDecoder < "u" && Q.decode();
  const we = 2146435072;
  let it = 0;
  function le(s, t) {
    return it += t, it >= we && (Q = typeof TextDecoder < "u" ? new TextDecoder("utf-8", { ignoreBOM: !0, fatal: !0 }) : { decode: () => {
      throw Error("TextDecoder not available");
    } }, Q.decode(), it = t), Q.decode($().subarray(s, s + t));
  }
  function l(s, t) {
    return s = s >>> 0, le(s, t);
  }
  let u = 0;
  const Z = typeof TextEncoder < "u" ? new TextEncoder("utf-8") : { encode: () => {
    throw Error("TextEncoder not available");
  } }, pe = typeof Z.encodeInto == "function" ? function(s, t) {
    return Z.encodeInto(s, t);
  } : function(s, t) {
    const e = Z.encode(s);
    return t.set(e), {
      read: s.length,
      written: e.length
    };
  };
  function b(s, t, e) {
    if (e === void 0) {
      const _ = Z.encode(s), a = t(_.length, 1) >>> 0;
      return $().subarray(a, a + _.length).set(_), u = _.length, a;
    }
    let n = s.length, i = t(n, 1) >>> 0;
    const o = $();
    let c = 0;
    for (; c < n; c++) {
      const _ = s.charCodeAt(c);
      if (_ > 127) break;
      o[i + c] = _;
    }
    if (c !== n) {
      c !== 0 && (s = s.slice(c)), i = e(i, n, n = c + s.length * 3, 1) >>> 0;
      const _ = $().subarray(i + c, i + n), a = pe(s, _);
      c += a.written, i = e(i, n, c, 1) >>> 0;
    }
    return u = c, i;
  }
  let U = null;
  function S() {
    return (U === null || U.buffer.detached === !0 || U.buffer.detached === void 0 && U.buffer !== r.memory.buffer) && (U = new DataView(r.memory.buffer)), U;
  }
  function P(s) {
    const t = r.__externref_table_alloc();
    return r.__wbindgen_export_4.set(t, s), t;
  }
  function p(s, t) {
    try {
      return s.apply(this, t);
    } catch (e) {
      const n = P(e);
      r.__wbindgen_exn_store(n);
    }
  }
  function g(s) {
    return s == null;
  }
  function K(s, t) {
    return s = s >>> 0, $().subarray(s / 1, s / 1 + t);
  }
  function N(s, t) {
    s = s >>> 0;
    const e = S(), n = [];
    for (let i = s; i < s + 4 * t; i += 4)
      n.push(r.__wbindgen_export_4.get(e.getUint32(i, !0)));
    return r.__externref_drop_slice(s, t), n;
  }
  const Nt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => {
    r.__wbindgen_export_7.get(s.dtor)(s.a, s.b);
  });
  function _t(s, t, e, n) {
    const i = { a: s, b: t, cnt: 1, dtor: e }, o = (...c) => {
      i.cnt++;
      const _ = i.a;
      i.a = 0;
      try {
        return n(_, i.b, ...c);
      } finally {
        --i.cnt === 0 ? (r.__wbindgen_export_7.get(i.dtor)(_, i.b), Nt.unregister(i)) : i.a = _;
      }
    };
    return o.original = i, Nt.register(o, i, i), o;
  }
  function ht(s) {
    const t = typeof s;
    if (t == "number" || t == "boolean" || s == null)
      return `${s}`;
    if (t == "string")
      return `"${s}"`;
    if (t == "symbol") {
      const i = s.description;
      return i == null ? "Symbol" : `Symbol(${i})`;
    }
    if (t == "function") {
      const i = s.name;
      return typeof i == "string" && i.length > 0 ? `Function(${i})` : "Function";
    }
    if (Array.isArray(s)) {
      const i = s.length;
      let o = "[";
      i > 0 && (o += ht(s[0]));
      for (let c = 1; c < i; c++)
        o += ", " + ht(s[c]);
      return o += "]", o;
    }
    const e = /\[object ([^\]]+)\]/.exec(toString.call(s));
    let n;
    if (e && e.length > 1)
      n = e[1];
    else
      return toString.call(s);
    if (n == "Object")
      try {
        return "Object(" + JSON.stringify(s) + ")";
      } catch {
        return "Object";
      }
    return s instanceof Error ? `${s.name}: ${s.message}
${s.stack}` : n;
  }
  function y(s, t) {
    if (!(s instanceof t))
      throw new Error(`expected instance of ${t.name}`);
  }
  function fe(s, t, e, n, i, o, c, _, a, w, m) {
    const v = b(s, r.__wbindgen_malloc, r.__wbindgen_realloc), F = u, q = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), B = u;
    var C = g(n) ? 0 : b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), rt = u, st = g(o) ? 0 : b(o, r.__wbindgen_malloc, r.__wbindgen_realloc), ge = u;
    let Bt = 0;
    g(_) || (y(_, ie), Bt = _.__destroy_into_raw());
    var ue = g(m) ? 0 : b(m, r.__wbindgen_malloc, r.__wbindgen_realloc), de = u;
    return r.createClient(v, F, q, B, e, C, rt, g(i) ? 0 : P(i), st, ge, g(c) ? 3 : (Ae.indexOf(c) + 1 || 3) - 1, Bt, g(a) ? 16777215 : 0, g(w) ? 16777215 : w ? 1 : 0, ue, de);
  }
  function h(s, t) {
    const e = t(s.length * 4, 4) >>> 0;
    for (let n = 0; n < s.length; n++) {
      const i = P(s[n]);
      S().setUint32(e + 4 * n, i, !0);
    }
    return u = s.length, e;
  }
  function f(s) {
    const t = r.__wbindgen_export_4.get(s);
    return r.__externref_table_dealloc(s), t;
  }
  function me(s, t) {
    const e = b(s, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
    return r.getInboxIdForIdentifier(e, n, t);
  }
  function ye(s) {
    let t, e;
    try {
      const o = r.generateInboxId(s);
      var n = o[0], i = o[1];
      if (o[3])
        throw n = 0, i = 0, f(o[2]);
      return t = n, e = i, l(n, i);
    } finally {
      r.__wbindgen_free(t, e, 1);
    }
  }
  function he(s, t, e) {
    const n = b(s, r.__wbindgen_malloc, r.__wbindgen_realloc), i = u, o = r.verifySignedWithPublicKey(n, i, t, e);
    if (o[1])
      throw f(o[0]);
  }
  function ve(s, t) {
    r.wasm_bindgen__convert__closures_____invoke__h231d11d7d151a506(s, t);
  }
  function Ie(s, t) {
    r.wasm_bindgen__convert__closures_____invoke__hfa5440517c90e88d(s, t);
  }
  function Se(s, t, e) {
    r.closure5289_externref_shim(s, t, e);
  }
  function Fe(s, t, e, n) {
    r.closure6231_externref_shim(s, t, e, n);
  }
  const X = Object.freeze({
    Dm: 0,
    0: "Dm",
    Group: 1,
    1: "Group",
    Sync: 2,
    2: "Sync",
    Oneshot: 3,
    3: "Oneshot"
  }), ke = Object.freeze({
    Default: 0,
    0: "Default",
    AdminOnly: 1,
    1: "AdminOnly",
    CustomPolicy: 2,
    2: "CustomPolicy"
  }), xe = Object.freeze({
    Ascending: 0,
    0: "Ascending",
    Descending: 1,
    1: "Descending"
  }), Ae = ["enabled", "disabled"], ot = ["off", "error", "warn", "info", "debug", "trace"], Re = ["default", "no-store", "reload", "no-cache", "force-cache", "only-if-cached"], Me = ["omit", "same-origin", "include"], De = ["same-origin", "no-cors", "cors", "navigate"], Ct = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_apistats_free(s >>> 0, 1));
  class St {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(St.prototype);
      return e.__wbg_ptr = t, Ct.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Ct.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_apistats_free(t, 0);
    }
    /**
     * @returns {bigint}
     */
    get upload_key_package() {
      const t = r.__wbg_get_apistats_upload_key_package(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set upload_key_package(t) {
      r.__wbg_set_apistats_upload_key_package(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get fetch_key_package() {
      const t = r.__wbg_get_apistats_fetch_key_package(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set fetch_key_package(t) {
      r.__wbg_set_apistats_fetch_key_package(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get send_group_messages() {
      const t = r.__wbg_get_apistats_send_group_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set send_group_messages(t) {
      r.__wbg_set_apistats_send_group_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get send_welcome_messages() {
      const t = r.__wbg_get_apistats_send_welcome_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set send_welcome_messages(t) {
      r.__wbg_set_apistats_send_welcome_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get query_group_messages() {
      const t = r.__wbg_get_apistats_query_group_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set query_group_messages(t) {
      r.__wbg_set_apistats_query_group_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get query_welcome_messages() {
      const t = r.__wbg_get_apistats_query_welcome_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set query_welcome_messages(t) {
      r.__wbg_set_apistats_query_welcome_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get subscribe_messages() {
      const t = r.__wbg_get_apistats_subscribe_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set subscribe_messages(t) {
      r.__wbg_set_apistats_subscribe_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get subscribe_welcomes() {
      const t = r.__wbg_get_apistats_subscribe_welcomes(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set subscribe_welcomes(t) {
      r.__wbg_set_apistats_subscribe_welcomes(this.__wbg_ptr, t);
    }
  }
  const Ot = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_client_free(s >>> 0, 1));
  class Ft {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(Ft.prototype);
      return e.__wbg_ptr = t, Ot.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Ot.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_client_free(t, 0);
    }
    /**
     * @returns {Identifier}
     */
    get accountIdentifier() {
      return r.client_accountIdentifier(this.__wbg_ptr);
    }
    /**
     * @returns {string}
     */
    get inboxId() {
      let t, e;
      try {
        const n = r.client_inboxId(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @returns {boolean}
     */
    get isRegistered() {
      return r.client_isRegistered(this.__wbg_ptr) !== 0;
    }
    /**
     * @returns {string}
     */
    get installationId() {
      let t, e;
      try {
        const n = r.client_installationId(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @returns {Uint8Array}
     */
    get installationIdBytes() {
      return r.client_installationIdBytes(this.__wbg_ptr);
    }
    /**
     * @returns {string}
     */
    get appVersion() {
      let t, e;
      try {
        const n = r.client_appVersion(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @returns {string}
     */
    get libxmtpVersion() {
      let t, e;
      try {
        const n = r.client_libxmtpVersion(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * Output booleans should be zipped with the index of input identifiers
     * @param {Identifier[]} account_identifiers
     * @returns {Promise<any>}
     */
    canMessage(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      return r.client_canMessage(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {Promise<void>}
     */
    sendSyncRequest() {
      return r.client_sendSyncRequest(this.__wbg_ptr);
    }
    /**
     * @param {Identifier} identifier
     * @returns {Promise<string | undefined>}
     */
    findInboxIdByIdentifier(t) {
      return r.client_findInboxIdByIdentifier(this.__wbg_ptr, t);
    }
    /**
     * @param {string[]} inbox_ids
     * @param {boolean} refresh_from_network
     * @returns {Promise<InboxState[]>}
     */
    inboxStateFromInboxIds(t, e) {
      const n = h(t, r.__wbindgen_malloc), i = u;
      return r.client_inboxStateFromInboxIds(this.__wbg_ptr, n, i, e);
    }
    /**
     * @returns {Conversations}
     */
    conversations() {
      const t = r.client_conversations(this.__wbg_ptr);
      return xt.__wrap(t);
    }
    /**
     * @returns {Promise<number>}
     */
    syncPreferences() {
      return r.client_syncPreferences(this.__wbg_ptr);
    }
    /**
     * @returns {ApiStats}
     */
    apiStatistics() {
      const t = r.client_apiStatistics(this.__wbg_ptr);
      return St.__wrap(t);
    }
    /**
     * @returns {IdentityStats}
     */
    apiIdentityStatistics() {
      const t = r.client_apiIdentityStatistics(this.__wbg_ptr);
      return Mt.__wrap(t);
    }
    /**
     * @returns {string}
     */
    apiAggregateStatistics() {
      let t, e;
      try {
        const n = r.client_apiAggregateStatistics(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    clearAllStatistics() {
      r.client_clearAllStatistics(this.__wbg_ptr);
    }
    /**
     * @param {string} server_url
     * @returns {Promise<string>}
     */
    uploadDebugArchive(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      return r.client_uploadDebugArchive(this.__wbg_ptr, e, n);
    }
    /**
     * @param {Consent[]} records
     * @returns {Promise<void>}
     */
    setConsentStates(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      return r.client_setConsentStates(this.__wbg_ptr, e, n);
    }
    /**
     * @param {ConsentEntityType} entity_type
     * @param {string} entity
     * @returns {Promise<ConsentState>}
     */
    getConsentState(t, e) {
      const n = b(e, r.__wbindgen_malloc, r.__wbindgen_realloc), i = u;
      return r.client_getConsentState(this.__wbg_ptr, t, n, i);
    }
    /**
     *
     *   * Get the client's inbox state.
     *   *
     *   * If `refresh_from_network` is true, the client will go to the network first to refresh the state.
     *   * Otherwise, the state will be read from the local database.
     *
     * @param {boolean} refresh_from_network
     * @returns {Promise<InboxState>}
     */
    inboxState(t) {
      return r.client_inboxState(this.__wbg_ptr, t);
    }
    /**
     * @param {string} inbox_id
     * @returns {Promise<InboxState>}
     */
    getLatestInboxState(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      return r.client_getLatestInboxState(this.__wbg_ptr, e, n);
    }
    /**
     *
     *   * Get key package statuses for a list of installation IDs.
     *   *
     *   * Returns a JavaScript object mapping installation ID strings to KeyPackageStatus objects.
     *
     * @param {string[]} installation_ids
     * @returns {Promise<any>}
     */
    getKeyPackageStatusesForInstallationIds(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      return r.client_getKeyPackageStatusesForInstallationIds(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {SignatureRequestHandle | undefined}
     */
    createInboxSignatureRequest() {
      const t = r.client_createInboxSignatureRequest(this.__wbg_ptr);
      if (t[2])
        throw f(t[1]);
      return t[0] === 0 ? void 0 : W.__wrap(t[0]);
    }
    /**
     * @param {Identifier} new_identifier
     * @returns {Promise<SignatureRequestHandle>}
     */
    addWalletSignatureRequest(t) {
      return r.client_addWalletSignatureRequest(this.__wbg_ptr, t);
    }
    /**
     * @param {Identifier} identifier
     * @returns {Promise<SignatureRequestHandle>}
     */
    revokeWalletSignatureRequest(t) {
      return r.client_revokeWalletSignatureRequest(this.__wbg_ptr, t);
    }
    /**
     * @returns {Promise<SignatureRequestHandle>}
     */
    revokeAllOtherInstallationsSignatureRequest() {
      return r.client_revokeAllOtherInstallationsSignatureRequest(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array[]} installation_ids
     * @returns {Promise<SignatureRequestHandle>}
     */
    revokeInstallationsSignatureRequest(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      return r.client_revokeInstallationsSignatureRequest(this.__wbg_ptr, e, n);
    }
    /**
     * @param {Identifier} new_recovery_identifier
     * @returns {Promise<SignatureRequestHandle>}
     */
    changeRecoveryIdentifierSignatureRequest(t) {
      return r.client_changeRecoveryIdentifierSignatureRequest(this.__wbg_ptr, t);
    }
    /**
     * @param {SignatureRequestHandle} signature_request
     * @returns {Promise<void>}
     */
    applySignatureRequest(t) {
      return y(t, W), r.client_applySignatureRequest(this.__wbg_ptr, t.__wbg_ptr);
    }
    /**
     * @param {SignatureRequestHandle} signature_request
     * @returns {Promise<void>}
     */
    registerIdentity(t) {
      y(t, W);
      var e = t.__destroy_into_raw();
      return r.client_registerIdentity(this.__wbg_ptr, e);
    }
    /**
     * @param {string} signature_text
     * @returns {Uint8Array}
     */
    signWithInstallationKey(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u, i = r.client_signWithInstallationKey(this.__wbg_ptr, e, n);
      if (i[2])
        throw f(i[1]);
      return f(i[0]);
    }
    /**
     * @param {string} signature_text
     * @param {Uint8Array} signature_bytes
     */
    verifySignedWithInstallationKey(t, e) {
      const n = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), i = u, o = r.client_verifySignedWithInstallationKey(this.__wbg_ptr, n, i, e);
      if (o[1])
        throw f(o[0]);
    }
  }
  const Ut = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_consent_free(s >>> 0, 1));
  class et {
    static __unwrap(t) {
      return t instanceof et ? t.__destroy_into_raw() : 0;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Ut.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_consent_free(t, 0);
    }
    /**
     * @returns {ConsentEntityType}
     */
    get entityType() {
      return r.__wbg_get_consent_entityType(this.__wbg_ptr);
    }
    /**
     * @param {ConsentEntityType} arg0
     */
    set entityType(t) {
      r.__wbg_set_consent_entityType(this.__wbg_ptr, t);
    }
    /**
     * @returns {ConsentState}
     */
    get state() {
      return r.__wbg_get_consent_state(this.__wbg_ptr);
    }
    /**
     * @param {ConsentState} arg0
     */
    set state(t) {
      r.__wbg_set_consent_state(this.__wbg_ptr, t);
    }
    /**
     * @returns {string}
     */
    get entity() {
      let t, e;
      try {
        const n = r.__wbg_get_consent_entity(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set entity(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_consent_entity(this.__wbg_ptr, e, n);
    }
    /**
     * @param {ConsentEntityType} entity_type
     * @param {ConsentState} state
     * @param {string} entity
     */
    constructor(t, e, n) {
      const i = b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), o = u, c = r.consent_new(t, e, i, o);
      return this.__wbg_ptr = c >>> 0, Ut.register(this, this.__wbg_ptr, this), this;
    }
  }
  const at = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_contenttypeid_free(s >>> 0, 1));
  class E {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(E.prototype);
      return e.__wbg_ptr = t, at.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, at.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_contenttypeid_free(t, 0);
    }
    /**
     * @returns {string}
     */
    get authorityId() {
      let t, e;
      try {
        const n = r.__wbg_get_contenttypeid_authorityId(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set authorityId(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_consent_entity(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {string}
     */
    get typeId() {
      let t, e;
      try {
        const n = r.__wbg_get_contenttypeid_typeId(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set typeId(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_contenttypeid_typeId(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {number}
     */
    get versionMajor() {
      return r.__wbg_get_contenttypeid_versionMajor(this.__wbg_ptr) >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set versionMajor(t) {
      r.__wbg_set_contenttypeid_versionMajor(this.__wbg_ptr, t);
    }
    /**
     * @returns {number}
     */
    get versionMinor() {
      return r.__wbg_get_contenttypeid_versionMinor(this.__wbg_ptr) >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set versionMinor(t) {
      r.__wbg_set_contenttypeid_versionMinor(this.__wbg_ptr, t);
    }
    /**
     * @param {string} authority_id
     * @param {string} type_id
     * @param {number} version_major
     * @param {number} version_minor
     */
    constructor(t, e, n, i) {
      const o = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), c = u, _ = b(e, r.__wbindgen_malloc, r.__wbindgen_realloc), a = u, w = r.contenttypeid_new(o, c, _, a, n, i);
      return this.__wbg_ptr = w >>> 0, at.register(this, this.__wbg_ptr, this), this;
    }
  }
  const jt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_conversation_free(s >>> 0, 1));
  class T {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(T.prototype);
      return e.__wbg_ptr = t, jt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, jt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_conversation_free(t, 0);
    }
    /**
     * @returns {ConsentState}
     */
    consentState() {
      const t = r.conversation_consentState(this.__wbg_ptr);
      if (t[2])
        throw f(t[1]);
      return t[0];
    }
    /**
     * @param {ConsentState} state
     */
    updateConsentState(t) {
      const e = r.conversation_updateConsentState(this.__wbg_ptr, t);
      if (e[1])
        throw f(e[0]);
    }
    /**
     * @returns {string}
     */
    id() {
      let t, e;
      try {
        const n = r.conversation_id(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {EncodedContent} encoded_content
     * @returns {Promise<string>}
     */
    send(t) {
      y(t, z);
      var e = t.__destroy_into_raw();
      return r.conversation_send(this.__wbg_ptr, e);
    }
    /**
     * send a message without immediately publishing to the delivery service.
     * @param {EncodedContent} encoded_content
     * @returns {string}
     */
    sendOptimistic(t) {
      let e, n;
      try {
        y(t, z);
        var i = t.__destroy_into_raw();
        const _ = r.conversation_sendOptimistic(this.__wbg_ptr, i);
        var o = _[0], c = _[1];
        if (_[3])
          throw o = 0, c = 0, f(_[2]);
        return e = o, n = c, l(o, c);
      } finally {
        r.__wbindgen_free(e, n, 1);
      }
    }
    /**
     * Publish all unpublished messages
     * @returns {Promise<void>}
     */
    publishMessages() {
      return r.conversation_publishMessages(this.__wbg_ptr);
    }
    /**
     * @returns {Promise<void>}
     */
    sync() {
      return r.conversation_sync(this.__wbg_ptr);
    }
    /**
     * @param {ListMessagesOptions | null} [opts]
     * @returns {Promise<Message[]>}
     */
    findMessages(t) {
      let e = 0;
      return g(t) || (y(t, It), e = t.__destroy_into_raw()), r.conversation_findMessages(this.__wbg_ptr, e);
    }
    /**
     * @param {ListMessagesOptions | null} [opts]
     * @returns {Promise<MessageWithReactions[]>}
     */
    findMessagesWithReactions(t) {
      let e = 0;
      return g(t) || (y(t, It), e = t.__destroy_into_raw()), r.conversation_findMessagesWithReactions(this.__wbg_ptr, e);
    }
    /**
     * @returns {Promise<any>}
     */
    listMembers() {
      return r.conversation_listMembers(this.__wbg_ptr);
    }
    /**
     * @returns {string[]}
     */
    adminList() {
      const t = r.conversation_adminList(this.__wbg_ptr);
      if (t[3])
        throw f(t[2]);
      var e = N(t[0], t[1]).slice();
      return r.__wbindgen_free(t[0], t[1] * 4, 4), e;
    }
    /**
     * @returns {string[]}
     */
    superAdminList() {
      const t = r.conversation_superAdminList(this.__wbg_ptr);
      if (t[3])
        throw f(t[2]);
      var e = N(t[0], t[1]).slice();
      return r.__wbindgen_free(t[0], t[1] * 4, 4), e;
    }
    /**
     * @param {string} inbox_id
     * @returns {boolean}
     */
    isAdmin(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u, i = r.conversation_isAdmin(this.__wbg_ptr, e, n);
      if (i[2])
        throw f(i[1]);
      return i[0] !== 0;
    }
    /**
     * @param {string} inbox_id
     * @returns {boolean}
     */
    isSuperAdmin(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u, i = r.conversation_isSuperAdmin(this.__wbg_ptr, e, n);
      if (i[2])
        throw f(i[1]);
      return i[0] !== 0;
    }
    /**
     * @param {Identifier[]} account_identifiers
     * @returns {Promise<void>}
     */
    addMembers(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      return r.conversation_addMembers(this.__wbg_ptr, e, n);
    }
    /**
     * @param {string} inbox_id
     * @returns {Promise<void>}
     */
    addAdmin(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      return r.conversation_addAdmin(this.__wbg_ptr, e, n);
    }
    /**
     * @param {string} inbox_id
     * @returns {Promise<void>}
     */
    removeAdmin(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      return r.conversation_removeAdmin(this.__wbg_ptr, e, n);
    }
    /**
     * @param {string} inbox_id
     * @returns {Promise<void>}
     */
    addSuperAdmin(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      return r.conversation_addSuperAdmin(this.__wbg_ptr, e, n);
    }
    /**
     * @param {string} inbox_id
     * @returns {Promise<void>}
     */
    removeSuperAdmin(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      return r.conversation_removeSuperAdmin(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {GroupPermissions}
     */
    groupPermissions() {
      const t = r.conversation_groupPermissions(this.__wbg_ptr);
      if (t[2])
        throw f(t[1]);
      return Rt.__wrap(t[0]);
    }
    /**
     * @param {string[]} inbox_ids
     * @returns {Promise<void>}
     */
    addMembersByInboxId(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      return r.conversation_addMembersByInboxId(this.__wbg_ptr, e, n);
    }
    /**
     * @param {Identifier[]} account_identifiers
     * @returns {Promise<void>}
     */
    removeMembers(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      return r.conversation_removeMembers(this.__wbg_ptr, e, n);
    }
    /**
     * @param {string[]} inbox_ids
     * @returns {Promise<void>}
     */
    removeMembersByInboxId(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      return r.conversation_removeMembersByInboxId(this.__wbg_ptr, e, n);
    }
    /**
     * @param {string} group_name
     * @returns {Promise<void>}
     */
    updateGroupName(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      return r.conversation_updateGroupName(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {string}
     */
    groupName() {
      let t, e;
      try {
        const o = r.conversation_groupName(this.__wbg_ptr);
        var n = o[0], i = o[1];
        if (o[3])
          throw n = 0, i = 0, f(o[2]);
        return t = n, e = i, l(n, i);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} group_image_url_square
     * @returns {Promise<void>}
     */
    updateGroupImageUrlSquare(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      return r.conversation_updateGroupImageUrlSquare(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {string}
     */
    groupImageUrlSquare() {
      let t, e;
      try {
        const o = r.conversation_groupImageUrlSquare(this.__wbg_ptr);
        var n = o[0], i = o[1];
        if (o[3])
          throw n = 0, i = 0, f(o[2]);
        return t = n, e = i, l(n, i);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} group_description
     * @returns {Promise<void>}
     */
    updateGroupDescription(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      return r.conversation_updateGroupDescription(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {string}
     */
    groupDescription() {
      let t, e;
      try {
        const o = r.conversation_groupDescription(this.__wbg_ptr);
        var n = o[0], i = o[1];
        if (o[3])
          throw n = 0, i = 0, f(o[2]);
        return t = n, e = i, l(n, i);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {any} callback
     * @returns {StreamCloser}
     */
    stream(t) {
      const e = r.conversation_stream(this.__wbg_ptr, t);
      if (e[2])
        throw f(e[1]);
      return j.__wrap(e[0]);
    }
    /**
     * @returns {bigint}
     */
    createdAtNs() {
      return r.conversation_createdAtNs(this.__wbg_ptr);
    }
    /**
     * @returns {boolean}
     */
    isActive() {
      const t = r.conversation_isActive(this.__wbg_ptr);
      if (t[2])
        throw f(t[1]);
      return t[0] !== 0;
    }
    /**
     * @returns {string | undefined}
     */
    pausedForVersion() {
      const t = r.conversation_pausedForVersion(this.__wbg_ptr);
      if (t[3])
        throw f(t[2]);
      let e;
      return t[0] !== 0 && (e = l(t[0], t[1]).slice(), r.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @returns {string}
     */
    addedByInboxId() {
      let t, e;
      try {
        const o = r.conversation_addedByInboxId(this.__wbg_ptr);
        var n = o[0], i = o[1];
        if (o[3])
          throw n = 0, i = 0, f(o[2]);
        return t = n, e = i, l(n, i);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @returns {Promise<GroupMetadata>}
     */
    groupMetadata() {
      return r.conversation_groupMetadata(this.__wbg_ptr);
    }
    /**
     * @returns {string}
     */
    dmPeerInboxId() {
      let t, e;
      try {
        const o = r.conversation_dmPeerInboxId(this.__wbg_ptr);
        var n = o[0], i = o[1];
        if (o[3])
          throw n = 0, i = 0, f(o[2]);
        return t = n, e = i, l(n, i);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {PermissionUpdateType} permission_update_type
     * @param {PermissionPolicy} permission_policy_option
     * @param {MetadataField | null} [metadata_field]
     * @returns {Promise<void>}
     */
    updatePermissionPolicy(t, e, n) {
      return r.conversation_updatePermissionPolicy(this.__wbg_ptr, t, e, g(n) ? 5 : n);
    }
    /**
     * @param {MessageDisappearingSettings} settings
     * @returns {Promise<void>}
     */
    updateMessageDisappearingSettings(t) {
      y(t, M);
      var e = t.__destroy_into_raw();
      return r.conversation_updateMessageDisappearingSettings(this.__wbg_ptr, e);
    }
    /**
     * @returns {Promise<void>}
     */
    removeMessageDisappearingSettings() {
      return r.conversation_removeMessageDisappearingSettings(this.__wbg_ptr);
    }
    /**
     * @returns {MessageDisappearingSettings | undefined}
     */
    messageDisappearingSettings() {
      const t = r.conversation_messageDisappearingSettings(this.__wbg_ptr);
      if (t[2])
        throw f(t[1]);
      return t[0] === 0 ? void 0 : M.__wrap(t[0]);
    }
    /**
     * @returns {boolean}
     */
    isMessageDisappearingEnabled() {
      const t = r.conversation_isMessageDisappearingEnabled(this.__wbg_ptr);
      if (t[2])
        throw f(t[1]);
      return t[0] !== 0;
    }
    /**
     * @returns {any}
     */
    getHmacKeys() {
      const t = r.conversation_getHmacKeys(this.__wbg_ptr);
      if (t[2])
        throw f(t[1]);
      return f(t[0]);
    }
    /**
     * @returns {Promise<any>}
     */
    getDebugInfo() {
      return r.conversation_getDebugInfo(this.__wbg_ptr);
    }
    /**
     * @returns {Promise<Conversation[]>}
     */
    findDuplicateDms() {
      return r.conversation_findDuplicateDms(this.__wbg_ptr);
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((s) => r.__wbg_conversationdebuginfo_free(s >>> 0, 1));
  const ct = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_conversationlistitem_free(s >>> 0, 1));
  class kt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(kt.prototype);
      return e.__wbg_ptr = t, ct.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, ct.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_conversationlistitem_free(t, 0);
    }
    /**
     * @returns {Conversation}
     */
    get conversation() {
      const t = r.__wbg_get_conversationlistitem_conversation(this.__wbg_ptr);
      return T.__wrap(t);
    }
    /**
     * @param {Conversation} arg0
     */
    set conversation(t) {
      y(t, T);
      var e = t.__destroy_into_raw();
      r.__wbg_set_conversationlistitem_conversation(this.__wbg_ptr, e);
    }
    /**
     * @returns {Message | undefined}
     */
    get lastMessage() {
      const t = r.__wbg_get_conversationlistitem_lastMessage(this.__wbg_ptr);
      return t === 0 ? void 0 : R.__wrap(t);
    }
    /**
     * @param {Message | null} [arg0]
     */
    set lastMessage(t) {
      let e = 0;
      g(t) || (y(t, R), e = t.__destroy_into_raw()), r.__wbg_set_conversationlistitem_lastMessage(this.__wbg_ptr, e);
    }
    /**
     * @returns {boolean | undefined}
     */
    get isCommitLogForked() {
      const t = r.__wbg_get_conversationlistitem_isCommitLogForked(this.__wbg_ptr);
      return t === 16777215 ? void 0 : t !== 0;
    }
    /**
     * @param {boolean | null} [arg0]
     */
    set isCommitLogForked(t) {
      r.__wbg_set_conversationlistitem_isCommitLogForked(this.__wbg_ptr, g(t) ? 16777215 : t ? 1 : 0);
    }
    /**
     * @param {Conversation} conversation
     * @param {Message | null} [last_message]
     * @param {boolean | null} [is_commit_log_forked]
     */
    constructor(t, e, n) {
      y(t, T);
      var i = t.__destroy_into_raw();
      let o = 0;
      g(e) || (y(e, R), o = e.__destroy_into_raw());
      const c = r.conversationlistitem_new(i, o, g(n) ? 16777215 : n ? 1 : 0);
      return this.__wbg_ptr = c >>> 0, ct.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Gt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_conversations_free(s >>> 0, 1));
  class xt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(xt.prototype);
      return e.__wbg_ptr = t, Gt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Gt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_conversations_free(t, 0);
    }
    /**
     * @param {CreateGroupOptions | null} [options]
     * @returns {Conversation}
     */
    createGroupOptimistic(t) {
      let e = 0;
      g(t) || (y(t, tt), e = t.__destroy_into_raw());
      const n = r.conversations_createGroupOptimistic(this.__wbg_ptr, e);
      if (n[2])
        throw f(n[1]);
      return T.__wrap(n[0]);
    }
    /**
     * @param {Identifier[]} account_identifiers
     * @param {CreateGroupOptions | null} [options]
     * @returns {Promise<Conversation>}
     */
    createGroup(t, e) {
      const n = h(t, r.__wbindgen_malloc), i = u;
      let o = 0;
      return g(e) || (y(e, tt), o = e.__destroy_into_raw()), r.conversations_createGroup(this.__wbg_ptr, n, i, o);
    }
    /**
     * @param {string[]} inbox_ids
     * @param {CreateGroupOptions | null} [options]
     * @returns {Promise<Conversation>}
     */
    createGroupByInboxIds(t, e) {
      const n = h(t, r.__wbindgen_malloc), i = u;
      let o = 0;
      return g(e) || (y(e, tt), o = e.__destroy_into_raw()), r.conversations_createGroupByInboxIds(this.__wbg_ptr, n, i, o);
    }
    /**
     * @param {Identifier} account_identifier
     * @param {CreateDMOptions | null} [options]
     * @returns {Promise<Conversation>}
     */
    createDm(t, e) {
      let n = 0;
      return g(e) || (y(e, vt), n = e.__destroy_into_raw()), r.conversations_createDm(this.__wbg_ptr, t, n);
    }
    /**
     * @param {string} inbox_id
     * @param {CreateDMOptions | null} [options]
     * @returns {Promise<Conversation>}
     */
    createDmByInboxId(t, e) {
      const n = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), i = u;
      let o = 0;
      return g(e) || (y(e, vt), o = e.__destroy_into_raw()), r.conversations_createDmByInboxId(this.__wbg_ptr, n, i, o);
    }
    /**
     * @param {string} group_id
     * @returns {Conversation}
     */
    findGroupById(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u, i = r.conversations_findGroupById(this.__wbg_ptr, e, n);
      if (i[2])
        throw f(i[1]);
      return T.__wrap(i[0]);
    }
    /**
     * @param {string} target_inbox_id
     * @returns {Conversation}
     */
    findDmByTargetInboxId(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u, i = r.conversations_findDmByTargetInboxId(this.__wbg_ptr, e, n);
      if (i[2])
        throw f(i[1]);
      return T.__wrap(i[0]);
    }
    /**
     * @param {string} message_id
     * @returns {Message}
     */
    findMessageById(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u, i = r.conversations_findMessageById(this.__wbg_ptr, e, n);
      if (i[2])
        throw f(i[1]);
      return R.__wrap(i[0]);
    }
    /**
     * @returns {Promise<void>}
     */
    sync() {
      return r.conversations_sync(this.__wbg_ptr);
    }
    /**
     * @param {any[] | null} [consent_states]
     * @returns {Promise<number>}
     */
    syncAllConversations(t) {
      var e = g(t) ? 0 : h(t, r.__wbindgen_malloc), n = u;
      return r.conversations_syncAllConversations(this.__wbg_ptr, e, n);
    }
    /**
     * @param {ListConversationsOptions | null} [opts]
     * @returns {Array<any>}
     */
    list(t) {
      let e = 0;
      g(t) || (y(t, se), e = t.__destroy_into_raw());
      const n = r.conversations_list(this.__wbg_ptr, e);
      if (n[2])
        throw f(n[1]);
      return f(n[0]);
    }
    /**
     * @returns {any}
     */
    getHmacKeys() {
      const t = r.conversations_getHmacKeys(this.__wbg_ptr);
      if (t[2])
        throw f(t[1]);
      return f(t[0]);
    }
    /**
     * Returns a 'ReadableStream' of Conversations
     * @param {ConversationType | null} [conversation_type]
     * @returns {Promise<ReadableStream>}
     */
    streamLocal(t) {
      return r.conversations_streamLocal(this.__wbg_ptr, g(t) ? 4 : t);
    }
    /**
     * @param {any} callback
     * @param {ConversationType | null} [conversation_type]
     * @returns {StreamCloser}
     */
    stream(t, e) {
      const n = r.conversations_stream(this.__wbg_ptr, t, g(e) ? 4 : e);
      if (n[2])
        throw f(n[1]);
      return j.__wrap(n[0]);
    }
    /**
     * @param {any} callback
     * @param {ConversationType | null} [conversation_type]
     * @param {any[] | null} [consent_states]
     * @returns {StreamCloser}
     */
    streamAllMessages(t, e, n) {
      var i = g(n) ? 0 : h(n, r.__wbindgen_malloc), o = u;
      const c = r.conversations_streamAllMessages(this.__wbg_ptr, t, g(e) ? 4 : e, i, o);
      if (c[2])
        throw f(c[1]);
      return j.__wrap(c[0]);
    }
    /**
     * @param {any} callback
     * @returns {StreamCloser}
     */
    streamConsent(t) {
      const e = r.conversations_streamConsent(this.__wbg_ptr, t);
      if (e[2])
        throw f(e[1]);
      return j.__wrap(e[0]);
    }
    /**
     * @param {any} callback
     * @returns {StreamCloser}
     */
    streamPreferences(t) {
      const e = r.conversations_streamPreferences(this.__wbg_ptr, t);
      if (e[2])
        throw f(e[1]);
      return j.__wrap(e[0]);
    }
  }
  const Lt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_createdmoptions_free(s >>> 0, 1));
  class vt {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Lt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_createdmoptions_free(t, 0);
    }
    /**
     * @returns {MessageDisappearingSettings | undefined}
     */
    get messageDisappearingSettings() {
      const t = r.__wbg_get_createdmoptions_messageDisappearingSettings(this.__wbg_ptr);
      return t === 0 ? void 0 : M.__wrap(t);
    }
    /**
     * @param {MessageDisappearingSettings | null} [arg0]
     */
    set messageDisappearingSettings(t) {
      let e = 0;
      g(t) || (y(t, M), e = t.__destroy_into_raw()), r.__wbg_set_createdmoptions_messageDisappearingSettings(this.__wbg_ptr, e);
    }
    /**
     * @param {MessageDisappearingSettings | null} [message_disappearing_settings]
     */
    constructor(t) {
      let e = 0;
      g(t) || (y(t, M), e = t.__destroy_into_raw());
      const n = r.createdmoptions_new(e);
      return this.__wbg_ptr = n >>> 0, Lt.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Et = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_creategroupoptions_free(s >>> 0, 1));
  class tt {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Et.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_creategroupoptions_free(t, 0);
    }
    /**
     * @returns {GroupPermissionsOptions | undefined}
     */
    get permissions() {
      const t = r.__wbg_get_creategroupoptions_permissions(this.__wbg_ptr);
      return t === 3 ? void 0 : t;
    }
    /**
     * @param {GroupPermissionsOptions | null} [arg0]
     */
    set permissions(t) {
      r.__wbg_set_creategroupoptions_permissions(this.__wbg_ptr, g(t) ? 3 : t);
    }
    /**
     * @returns {string | undefined}
     */
    get groupName() {
      const t = r.__wbg_get_creategroupoptions_groupName(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = l(t[0], t[1]).slice(), r.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @param {string | null} [arg0]
     */
    set groupName(t) {
      var e = g(t) ? 0 : b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_creategroupoptions_groupName(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {string | undefined}
     */
    get groupImageUrlSquare() {
      const t = r.__wbg_get_creategroupoptions_groupImageUrlSquare(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = l(t[0], t[1]).slice(), r.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @param {string | null} [arg0]
     */
    set groupImageUrlSquare(t) {
      var e = g(t) ? 0 : b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_creategroupoptions_groupImageUrlSquare(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {string | undefined}
     */
    get groupDescription() {
      const t = r.__wbg_get_creategroupoptions_groupDescription(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = l(t[0], t[1]).slice(), r.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @param {string | null} [arg0]
     */
    set groupDescription(t) {
      var e = g(t) ? 0 : b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_creategroupoptions_groupDescription(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {PermissionPolicySet | undefined}
     */
    get customPermissionPolicySet() {
      const t = r.__wbg_get_creategroupoptions_customPermissionPolicySet(this.__wbg_ptr);
      return t === 0 ? void 0 : G.__wrap(t);
    }
    /**
     * @param {PermissionPolicySet | null} [arg0]
     */
    set customPermissionPolicySet(t) {
      let e = 0;
      g(t) || (y(t, G), e = t.__destroy_into_raw()), r.__wbg_set_creategroupoptions_customPermissionPolicySet(this.__wbg_ptr, e);
    }
    /**
     * @returns {MessageDisappearingSettings | undefined}
     */
    get messageDisappearingSettings() {
      const t = r.__wbg_get_createdmoptions_messageDisappearingSettings(this.__wbg_ptr);
      return t === 0 ? void 0 : M.__wrap(t);
    }
    /**
     * @param {MessageDisappearingSettings | null} [arg0]
     */
    set messageDisappearingSettings(t) {
      let e = 0;
      g(t) || (y(t, M), e = t.__destroy_into_raw()), r.__wbg_set_createdmoptions_messageDisappearingSettings(this.__wbg_ptr, e);
    }
    /**
     * @param {GroupPermissionsOptions | null} [permissions]
     * @param {string | null} [group_name]
     * @param {string | null} [group_image_url_square]
     * @param {string | null} [group_description]
     * @param {PermissionPolicySet | null} [custom_permission_policy_set]
     * @param {MessageDisappearingSettings | null} [message_disappearing_settings]
     */
    constructor(t, e, n, i, o, c) {
      var _ = g(e) ? 0 : b(e, r.__wbindgen_malloc, r.__wbindgen_realloc), a = u, w = g(n) ? 0 : b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), m = u, v = g(i) ? 0 : b(i, r.__wbindgen_malloc, r.__wbindgen_realloc), F = u;
      let q = 0;
      g(o) || (y(o, G), q = o.__destroy_into_raw());
      let B = 0;
      g(c) || (y(c, M), B = c.__destroy_into_raw());
      const C = r.creategroupoptions_new(g(t) ? 3 : t, _, a, w, m, v, F, q, B);
      return this.__wbg_ptr = C >>> 0, Et.register(this, this.__wbg_ptr, this), this;
    }
  }
  const gt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_encodedcontent_free(s >>> 0, 1));
  class z {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(z.prototype);
      return e.__wbg_ptr = t, gt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, gt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_encodedcontent_free(t, 0);
    }
    /**
     * @returns {ContentTypeId | undefined}
     */
    get type() {
      const t = r.__wbg_get_encodedcontent_type(this.__wbg_ptr);
      return t === 0 ? void 0 : E.__wrap(t);
    }
    /**
     * @param {ContentTypeId | null} [arg0]
     */
    set type(t) {
      let e = 0;
      g(t) || (y(t, E), e = t.__destroy_into_raw()), r.__wbg_set_encodedcontent_type(this.__wbg_ptr, e);
    }
    /**
     * @returns {any}
     */
    get parameters() {
      return r.__wbg_get_encodedcontent_parameters(this.__wbg_ptr);
    }
    /**
     * @param {any} arg0
     */
    set parameters(t) {
      r.__wbg_set_encodedcontent_parameters(this.__wbg_ptr, t);
    }
    /**
     * @returns {string | undefined}
     */
    get fallback() {
      const t = r.__wbg_get_encodedcontent_fallback(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = l(t[0], t[1]).slice(), r.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @param {string | null} [arg0]
     */
    set fallback(t) {
      var e = g(t) ? 0 : b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_encodedcontent_fallback(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {number | undefined}
     */
    get compression() {
      const t = r.__wbg_get_encodedcontent_compression(this.__wbg_ptr);
      return t === 4294967297 ? void 0 : t;
    }
    /**
     * @param {number | null} [arg0]
     */
    set compression(t) {
      r.__wbg_set_encodedcontent_compression(this.__wbg_ptr, g(t) ? 4294967297 : t >> 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get content() {
      return r.__wbg_get_encodedcontent_content(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set content(t) {
      r.__wbg_set_encodedcontent_content(this.__wbg_ptr, t);
    }
    /**
     * @param {ContentTypeId | null | undefined} type
     * @param {any} parameters
     * @param {string | null | undefined} fallback
     * @param {number | null | undefined} compression
     * @param {Uint8Array} content
     */
    constructor(t, e, n, i, o) {
      let c = 0;
      g(t) || (y(t, E), c = t.__destroy_into_raw());
      var _ = g(n) ? 0 : b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), a = u;
      const w = r.encodedcontent_new(c, e, _, a, g(i) ? 4294967297 : i >> 0, o);
      return this.__wbg_ptr = w >>> 0, gt.register(this, this.__wbg_ptr, this), this;
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((s) => r.__wbg_groupmember_free(s >>> 0, 1));
  const Wt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_groupmetadata_free(s >>> 0, 1));
  class At {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(At.prototype);
      return e.__wbg_ptr = t, Wt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Wt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_groupmetadata_free(t, 0);
    }
    /**
     * @returns {string}
     */
    creatorInboxId() {
      let t, e;
      try {
        const n = r.groupmetadata_creatorInboxId(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @returns {string}
     */
    conversationType() {
      let t, e;
      try {
        const n = r.groupmetadata_conversationType(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
  }
  const Kt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_grouppermissions_free(s >>> 0, 1));
  class Rt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(Rt.prototype);
      return e.__wbg_ptr = t, Kt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Kt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_grouppermissions_free(t, 0);
    }
    /**
     * @returns {GroupPermissionsOptions}
     */
    policyType() {
      const t = r.grouppermissions_policyType(this.__wbg_ptr);
      if (t[2])
        throw f(t[1]);
      return t[0];
    }
    /**
     * @returns {PermissionPolicySet}
     */
    policySet() {
      const t = r.grouppermissions_policySet(this.__wbg_ptr);
      if (t[2])
        throw f(t[1]);
      return G.__wrap(t[0]);
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((s) => r.__wbg_hmackey_free(s >>> 0, 1));
  const Ht = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_identitystats_free(s >>> 0, 1));
  class Mt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(Mt.prototype);
      return e.__wbg_ptr = t, Ht.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Ht.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_identitystats_free(t, 0);
    }
    /**
     * @returns {bigint}
     */
    get publish_identity_update() {
      const t = r.__wbg_get_apistats_upload_key_package(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set publish_identity_update(t) {
      r.__wbg_set_apistats_upload_key_package(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get get_identity_updates_v2() {
      const t = r.__wbg_get_apistats_fetch_key_package(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set get_identity_updates_v2(t) {
      r.__wbg_set_apistats_fetch_key_package(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get get_inbox_ids() {
      const t = r.__wbg_get_apistats_send_group_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set get_inbox_ids(t) {
      r.__wbg_set_apistats_send_group_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get verify_smart_contract_wallet_signature() {
      const t = r.__wbg_get_apistats_send_welcome_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set verify_smart_contract_wallet_signature(t) {
      r.__wbg_set_apistats_send_welcome_messages(this.__wbg_ptr, t);
    }
  }
  const ut = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_inboxstate_free(s >>> 0, 1));
  class Dt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(Dt.prototype);
      return e.__wbg_ptr = t, ut.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, ut.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_inboxstate_free(t, 0);
    }
    /**
     * @returns {string}
     */
    get inboxId() {
      let t, e;
      try {
        const n = r.__wbg_get_inboxstate_inboxId(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set inboxId(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_consent_entity(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {Identifier}
     */
    get recoveryIdentifier() {
      return r.__wbg_get_inboxstate_recoveryIdentifier(this.__wbg_ptr);
    }
    /**
     * @param {Identifier} arg0
     */
    set recoveryIdentifier(t) {
      r.__wbg_set_inboxstate_recoveryIdentifier(this.__wbg_ptr, t);
    }
    /**
     * @returns {Installation[]}
     */
    get installations() {
      const t = r.__wbg_get_inboxstate_installations(this.__wbg_ptr);
      var e = N(t[0], t[1]).slice();
      return r.__wbindgen_free(t[0], t[1] * 4, 4), e;
    }
    /**
     * @param {Installation[]} arg0
     */
    set installations(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      r.__wbg_set_inboxstate_installations(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {Identifier[]}
     */
    get accountIdentifiers() {
      const t = r.__wbg_get_inboxstate_accountIdentifiers(this.__wbg_ptr);
      var e = N(t[0], t[1]).slice();
      return r.__wbindgen_free(t[0], t[1] * 4, 4), e;
    }
    /**
     * @param {Identifier[]} arg0
     */
    set accountIdentifiers(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      r.__wbg_set_inboxstate_accountIdentifiers(this.__wbg_ptr, e, n);
    }
    /**
     * @param {string} inbox_id
     * @param {Identifier} recovery_identifier
     * @param {Installation[]} installations
     * @param {Identifier[]} account_identifiers
     */
    constructor(t, e, n, i) {
      const o = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), c = u, _ = h(n, r.__wbindgen_malloc), a = u, w = h(i, r.__wbindgen_malloc), m = u, v = r.inboxstate_new(o, c, e, _, a, w, m);
      return this.__wbg_ptr = v >>> 0, ut.register(this, this.__wbg_ptr, this), this;
    }
  }
  const dt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_installation_free(s >>> 0, 1));
  class J {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(J.prototype);
      return e.__wbg_ptr = t, dt.register(e, e.__wbg_ptr, e), e;
    }
    static __unwrap(t) {
      return t instanceof J ? t.__destroy_into_raw() : 0;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, dt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_installation_free(t, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get bytes() {
      return r.__wbg_get_installation_bytes(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set bytes(t) {
      r.__wbg_set_installation_bytes(this.__wbg_ptr, t);
    }
    /**
     * @returns {string}
     */
    get id() {
      let t, e;
      try {
        const n = r.__wbg_get_installation_id(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set id(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_conversationdebuginfo_forkDetails(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {bigint | undefined}
     */
    get clientTimestampNs() {
      const t = r.__wbg_get_installation_clientTimestampNs(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : BigInt.asUintN(64, t[1]);
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set clientTimestampNs(t) {
      r.__wbg_set_installation_clientTimestampNs(this.__wbg_ptr, !g(t), g(t) ? BigInt(0) : t);
    }
    /**
     * @param {Uint8Array} bytes
     * @param {string} id
     * @param {bigint | null} [client_timestamp_ns]
     */
    constructor(t, e, n) {
      const i = b(e, r.__wbindgen_malloc, r.__wbindgen_realloc), o = u, c = r.installation_new(t, i, o, !g(n), g(n) ? BigInt(0) : n);
      return this.__wbg_ptr = c >>> 0, dt.register(this, this.__wbg_ptr, this), this;
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((s) => r.__wbg_intounderlyingbytesource_free(s >>> 0, 1));
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((s) => r.__wbg_intounderlyingsink_free(s >>> 0, 1));
  const Vt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_intounderlyingsource_free(s >>> 0, 1));
  class qt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(qt.prototype);
      return e.__wbg_ptr = t, Vt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Vt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_intounderlyingsource_free(t, 0);
    }
    /**
     * @param {ReadableStreamDefaultController} controller
     * @returns {Promise<any>}
     */
    pull(t) {
      return r.intounderlyingsource_pull(this.__wbg_ptr, t);
    }
    cancel() {
      const t = this.__destroy_into_raw();
      r.intounderlyingsource_cancel(t);
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((s) => r.__wbg_keypackagestatus_free(s >>> 0, 1));
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((s) => r.__wbg_lifetime_free(s >>> 0, 1));
  const $t = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_listconversationsoptions_free(s >>> 0, 1));
  class se {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, $t.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_listconversationsoptions_free(t, 0);
    }
    /**
     * @returns {any[] | undefined}
     */
    get consentStates() {
      const t = r.__wbg_get_listconversationsoptions_consentStates(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = N(t[0], t[1]).slice(), r.__wbindgen_free(t[0], t[1] * 4, 4)), e;
    }
    /**
     * @param {any[] | null} [arg0]
     */
    set consentStates(t) {
      var e = g(t) ? 0 : h(t, r.__wbindgen_malloc), n = u;
      r.__wbg_set_listconversationsoptions_consentStates(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {ConversationType | undefined}
     */
    get conversationType() {
      const t = r.__wbg_get_listconversationsoptions_conversationType(this.__wbg_ptr);
      return t === 4 ? void 0 : t;
    }
    /**
     * @param {ConversationType | null} [arg0]
     */
    set conversationType(t) {
      r.__wbg_set_listconversationsoptions_conversationType(this.__wbg_ptr, g(t) ? 4 : t);
    }
    /**
     * @returns {bigint | undefined}
     */
    get createdAfterNs() {
      const t = r.__wbg_get_listconversationsoptions_createdAfterNs(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set createdAfterNs(t) {
      r.__wbg_set_installation_clientTimestampNs(this.__wbg_ptr, !g(t), g(t) ? BigInt(0) : t);
    }
    /**
     * @returns {bigint | undefined}
     */
    get createdBeforeNs() {
      const t = r.__wbg_get_listconversationsoptions_createdBeforeNs(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set createdBeforeNs(t) {
      r.__wbg_set_listconversationsoptions_createdBeforeNs(this.__wbg_ptr, !g(t), g(t) ? BigInt(0) : t);
    }
    /**
     * @returns {boolean | undefined}
     */
    get includeDuplicateDms() {
      const t = r.__wbg_get_listconversationsoptions_includeDuplicateDms(this.__wbg_ptr);
      return t === 16777215 ? void 0 : t !== 0;
    }
    /**
     * @param {boolean | null} [arg0]
     */
    set includeDuplicateDms(t) {
      r.__wbg_set_listconversationsoptions_includeDuplicateDms(this.__wbg_ptr, g(t) ? 16777215 : t ? 1 : 0);
    }
    /**
     * @returns {bigint | undefined}
     */
    get limit() {
      const t = r.__wbg_get_listconversationsoptions_limit(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set limit(t) {
      r.__wbg_set_listconversationsoptions_limit(this.__wbg_ptr, !g(t), g(t) ? BigInt(0) : t);
    }
    /**
     * @param {any[] | null} [consent_states]
     * @param {ConversationType | null} [conversation_type]
     * @param {bigint | null} [created_after_ns]
     * @param {bigint | null} [created_before_ns]
     * @param {boolean | null} [include_duplicate_dms]
     * @param {bigint | null} [limit]
     */
    constructor(t, e, n, i, o, c) {
      var _ = g(t) ? 0 : h(t, r.__wbindgen_malloc), a = u;
      const w = r.listconversationsoptions_new(_, a, g(e) ? 4 : e, !g(n), g(n) ? BigInt(0) : n, !g(i), g(i) ? BigInt(0) : i, g(o) ? 16777215 : o ? 1 : 0, !g(c), g(c) ? BigInt(0) : c);
      return this.__wbg_ptr = w >>> 0, $t.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Jt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_listmessagesoptions_free(s >>> 0, 1));
  class It {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Jt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_listmessagesoptions_free(t, 0);
    }
    /**
     * @returns {any[] | undefined}
     */
    get contentTypes() {
      const t = r.__wbg_get_listmessagesoptions_contentTypes(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = N(t[0], t[1]).slice(), r.__wbindgen_free(t[0], t[1] * 4, 4)), e;
    }
    /**
     * @param {any[] | null} [arg0]
     */
    set contentTypes(t) {
      var e = g(t) ? 0 : h(t, r.__wbindgen_malloc), n = u;
      r.__wbg_set_listmessagesoptions_contentTypes(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {bigint | undefined}
     */
    get sentBeforeNs() {
      const t = r.__wbg_get_listmessagesoptions_sentBeforeNs(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set sentBeforeNs(t) {
      r.__wbg_set_installation_clientTimestampNs(this.__wbg_ptr, !g(t), g(t) ? BigInt(0) : t);
    }
    /**
     * @returns {bigint | undefined}
     */
    get sentAfterNs() {
      const t = r.__wbg_get_listmessagesoptions_sentAfterNs(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set sentAfterNs(t) {
      r.__wbg_set_listconversationsoptions_createdBeforeNs(this.__wbg_ptr, !g(t), g(t) ? BigInt(0) : t);
    }
    /**
     * @returns {bigint | undefined}
     */
    get limit() {
      const t = r.__wbg_get_listmessagesoptions_limit(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set limit(t) {
      r.__wbg_set_listconversationsoptions_limit(this.__wbg_ptr, !g(t), g(t) ? BigInt(0) : t);
    }
    /**
     * @returns {DeliveryStatus | undefined}
     */
    get deliveryStatus() {
      const t = r.__wbg_get_listmessagesoptions_deliveryStatus(this.__wbg_ptr);
      return t === 3 ? void 0 : t;
    }
    /**
     * @param {DeliveryStatus | null} [arg0]
     */
    set deliveryStatus(t) {
      r.__wbg_set_listmessagesoptions_deliveryStatus(this.__wbg_ptr, g(t) ? 3 : t);
    }
    /**
     * @returns {SortDirection | undefined}
     */
    get direction() {
      const t = r.__wbg_get_listmessagesoptions_direction(this.__wbg_ptr);
      return t === 2 ? void 0 : t;
    }
    /**
     * @param {SortDirection | null} [arg0]
     */
    set direction(t) {
      r.__wbg_set_listmessagesoptions_direction(this.__wbg_ptr, g(t) ? 2 : t);
    }
    /**
     * @returns {GroupMessageKind | undefined}
     */
    get kind() {
      const t = r.__wbg_get_listmessagesoptions_kind(this.__wbg_ptr);
      return t === 2 ? void 0 : t;
    }
    /**
     * @param {GroupMessageKind | null} [arg0]
     */
    set kind(t) {
      r.__wbg_set_listmessagesoptions_kind(this.__wbg_ptr, g(t) ? 2 : t);
    }
    /**
     * @param {bigint | null} [sent_before_ns]
     * @param {bigint | null} [sent_after_ns]
     * @param {bigint | null} [limit]
     * @param {DeliveryStatus | null} [delivery_status]
     * @param {SortDirection | null} [direction]
     * @param {any[] | null} [content_types]
     * @param {GroupMessageKind | null} [kind]
     */
    constructor(t, e, n, i, o, c, _) {
      var a = g(c) ? 0 : h(c, r.__wbindgen_malloc), w = u;
      const m = r.listmessagesoptions_new(!g(t), g(t) ? BigInt(0) : t, !g(e), g(e) ? BigInt(0) : e, !g(n), g(n) ? BigInt(0) : n, g(i) ? 3 : i, g(o) ? 2 : o, a, w, g(_) ? 2 : _);
      return this.__wbg_ptr = m >>> 0, Jt.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Yt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_logoptions_free(s >>> 0, 1));
  class ie {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Yt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_logoptions_free(t, 0);
    }
    /**
     * enable structured JSON logging to stdout.Useful for third-party log viewers
     * @returns {boolean}
     */
    get structured() {
      return r.__wbg_get_logoptions_structured(this.__wbg_ptr) !== 0;
    }
    /**
     * enable structured JSON logging to stdout.Useful for third-party log viewers
     * @param {boolean} arg0
     */
    set structured(t) {
      r.__wbg_set_logoptions_structured(this.__wbg_ptr, t);
    }
    /**
     * enable performance metrics for libxmtp in the `performance` tab
     * @returns {boolean}
     */
    get performance() {
      return r.__wbg_get_logoptions_performance(this.__wbg_ptr) !== 0;
    }
    /**
     * enable performance metrics for libxmtp in the `performance` tab
     * @param {boolean} arg0
     */
    set performance(t) {
      r.__wbg_set_logoptions_performance(this.__wbg_ptr, t);
    }
    /**
     * filter for logs
     * @returns {LogLevel | undefined}
     */
    get level() {
      const t = r.__wbg_get_logoptions_level(this.__wbg_ptr);
      return ot[t];
    }
    /**
     * filter for logs
     * @param {LogLevel | null} [arg0]
     */
    set level(t) {
      r.__wbg_set_logoptions_level(this.__wbg_ptr, g(t) ? 7 : (ot.indexOf(t) + 1 || 7) - 1);
    }
    /**
     * @param {boolean} structured
     * @param {boolean} performance
     * @param {LogLevel | null} [level]
     */
    constructor(t, e, n) {
      const i = r.logoptions_new(t, e, g(n) ? 7 : (ot.indexOf(n) + 1 || 7) - 1);
      return this.__wbg_ptr = i >>> 0, Yt.register(this, this.__wbg_ptr, this), this;
    }
  }
  const bt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_message_free(s >>> 0, 1));
  class R {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(R.prototype);
      return e.__wbg_ptr = t, bt.register(e, e.__wbg_ptr, e), e;
    }
    static __unwrap(t) {
      return t instanceof R ? t.__destroy_into_raw() : 0;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, bt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_message_free(t, 0);
    }
    /**
     * @returns {string}
     */
    get id() {
      let t, e;
      try {
        const n = r.__wbg_get_message_id(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set id(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_message_id(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {bigint}
     */
    get sentAtNs() {
      return r.__wbg_get_conversationdebuginfo_epoch(this.__wbg_ptr);
    }
    /**
     * @param {bigint} arg0
     */
    set sentAtNs(t) {
      r.__wbg_set_conversationdebuginfo_epoch(this.__wbg_ptr, t);
    }
    /**
     * @returns {string}
     */
    get convoId() {
      let t, e;
      try {
        const n = r.__wbg_get_message_convoId(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set convoId(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_message_convoId(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {string}
     */
    get senderInboxId() {
      let t, e;
      try {
        const n = r.__wbg_get_message_senderInboxId(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set senderInboxId(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_message_senderInboxId(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {EncodedContent}
     */
    get content() {
      const t = r.__wbg_get_message_content(this.__wbg_ptr);
      return z.__wrap(t);
    }
    /**
     * @param {EncodedContent} arg0
     */
    set content(t) {
      y(t, z);
      var e = t.__destroy_into_raw();
      r.__wbg_set_message_content(this.__wbg_ptr, e);
    }
    /**
     * @returns {GroupMessageKind}
     */
    get kind() {
      return r.__wbg_get_message_kind(this.__wbg_ptr);
    }
    /**
     * @param {GroupMessageKind} arg0
     */
    set kind(t) {
      r.__wbg_set_message_kind(this.__wbg_ptr, t);
    }
    /**
     * @returns {DeliveryStatus}
     */
    get deliveryStatus() {
      return r.__wbg_get_message_deliveryStatus(this.__wbg_ptr);
    }
    /**
     * @param {DeliveryStatus} arg0
     */
    set deliveryStatus(t) {
      r.__wbg_set_message_deliveryStatus(this.__wbg_ptr, t);
    }
    /**
     * @param {string} id
     * @param {bigint} sent_at_ns
     * @param {string} convo_id
     * @param {string} sender_inbox_id
     * @param {EncodedContent} content
     * @param {GroupMessageKind} kind
     * @param {DeliveryStatus} delivery_status
     */
    constructor(t, e, n, i, o, c, _) {
      const a = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), w = u, m = b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), v = u, F = b(i, r.__wbindgen_malloc, r.__wbindgen_realloc), q = u;
      y(o, z);
      var B = o.__destroy_into_raw();
      const C = r.message_new(a, w, e, m, v, F, q, B, c, _);
      return this.__wbg_ptr = C >>> 0, bt.register(this, this.__wbg_ptr, this), this;
    }
  }
  const wt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_messagedisappearingsettings_free(s >>> 0, 1));
  class M {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(M.prototype);
      return e.__wbg_ptr = t, wt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, wt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_messagedisappearingsettings_free(t, 0);
    }
    /**
     * @returns {bigint}
     */
    get fromNs() {
      return r.__wbg_get_conversationdebuginfo_epoch(this.__wbg_ptr);
    }
    /**
     * @param {bigint} arg0
     */
    set fromNs(t) {
      r.__wbg_set_conversationdebuginfo_epoch(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get inNs() {
      return r.__wbg_get_conversationdebuginfo_cursor(this.__wbg_ptr);
    }
    /**
     * @param {bigint} arg0
     */
    set inNs(t) {
      r.__wbg_set_conversationdebuginfo_cursor(this.__wbg_ptr, t);
    }
    /**
     * @param {bigint} from_ns
     * @param {bigint} in_ns
     */
    constructor(t, e) {
      const n = r.messagedisappearingsettings_new(t, e);
      return this.__wbg_ptr = n >>> 0, wt.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Xt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_messagewithreactions_free(s >>> 0, 1));
  class Pt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(Pt.prototype);
      return e.__wbg_ptr = t, Xt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Xt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_messagewithreactions_free(t, 0);
    }
    /**
     * @returns {Message}
     */
    get message() {
      const t = r.__wbg_get_messagewithreactions_message(this.__wbg_ptr);
      return R.__wrap(t);
    }
    /**
     * @param {Message} arg0
     */
    set message(t) {
      y(t, R);
      var e = t.__destroy_into_raw();
      r.__wbg_set_messagewithreactions_message(this.__wbg_ptr, e);
    }
    /**
     * @returns {Message[]}
     */
    get reactions() {
      const t = r.__wbg_get_messagewithreactions_reactions(this.__wbg_ptr);
      var e = N(t[0], t[1]).slice();
      return r.__wbindgen_free(t[0], t[1] * 4, 4), e;
    }
    /**
     * @param {Message[]} arg0
     */
    set reactions(t) {
      const e = h(t, r.__wbindgen_malloc), n = u;
      r.__wbg_set_messagewithreactions_reactions(this.__wbg_ptr, e, n);
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((s) => r.__wbg_multiremoteattachment_free(s >>> 0, 1));
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((s) => r.__wbg_opfs_free(s >>> 0, 1));
  const qe = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_passkeysignature_free(s >>> 0, 1));
  class Pe {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, qe.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_passkeysignature_free(t, 0);
    }
  }
  const lt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_permissionpolicyset_free(s >>> 0, 1));
  class G {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(G.prototype);
      return e.__wbg_ptr = t, lt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, lt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_permissionpolicyset_free(t, 0);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get addMemberPolicy() {
      return r.__wbg_get_permissionpolicyset_addMemberPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set addMemberPolicy(t) {
      r.__wbg_set_permissionpolicyset_addMemberPolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get removeMemberPolicy() {
      return r.__wbg_get_permissionpolicyset_removeMemberPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set removeMemberPolicy(t) {
      r.__wbg_set_permissionpolicyset_removeMemberPolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get addAdminPolicy() {
      return r.__wbg_get_permissionpolicyset_addAdminPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set addAdminPolicy(t) {
      r.__wbg_set_permissionpolicyset_addAdminPolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get removeAdminPolicy() {
      return r.__wbg_get_permissionpolicyset_removeAdminPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set removeAdminPolicy(t) {
      r.__wbg_set_permissionpolicyset_removeAdminPolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get updateGroupNamePolicy() {
      return r.__wbg_get_permissionpolicyset_updateGroupNamePolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set updateGroupNamePolicy(t) {
      r.__wbg_set_permissionpolicyset_updateGroupNamePolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get updateGroupDescriptionPolicy() {
      return r.__wbg_get_permissionpolicyset_updateGroupDescriptionPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set updateGroupDescriptionPolicy(t) {
      r.__wbg_set_permissionpolicyset_updateGroupDescriptionPolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get updateGroupImageUrlSquarePolicy() {
      return r.__wbg_get_permissionpolicyset_updateGroupImageUrlSquarePolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set updateGroupImageUrlSquarePolicy(t) {
      r.__wbg_set_permissionpolicyset_updateGroupImageUrlSquarePolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get updateMessageDisappearingPolicy() {
      return r.__wbg_get_permissionpolicyset_updateMessageDisappearingPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set updateMessageDisappearingPolicy(t) {
      r.__wbg_set_permissionpolicyset_updateMessageDisappearingPolicy(this.__wbg_ptr, t);
    }
    /**
     * @param {PermissionPolicy} add_member_policy
     * @param {PermissionPolicy} remove_member_policy
     * @param {PermissionPolicy} add_admin_policy
     * @param {PermissionPolicy} remove_admin_policy
     * @param {PermissionPolicy} update_group_name_policy
     * @param {PermissionPolicy} update_group_description_policy
     * @param {PermissionPolicy} update_group_image_url_square_policy
     * @param {PermissionPolicy} update_message_disappearing_policy
     */
    constructor(t, e, n, i, o, c, _, a) {
      const w = r.permissionpolicyset_new(t, e, n, i, o, c, _, a);
      return this.__wbg_ptr = w >>> 0, lt.register(this, this.__wbg_ptr, this), this;
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((s) => r.__wbg_reaction_free(s >>> 0, 1));
  const pt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_remoteattachmentinfo_free(s >>> 0, 1));
  class Y {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(Y.prototype);
      return e.__wbg_ptr = t, pt.register(e, e.__wbg_ptr, e), e;
    }
    static __unwrap(t) {
      return t instanceof Y ? t.__destroy_into_raw() : 0;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, pt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_remoteattachmentinfo_free(t, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get secret() {
      return r.__wbg_get_remoteattachmentinfo_secret(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set secret(t) {
      r.__wbg_set_remoteattachmentinfo_secret(this.__wbg_ptr, t);
    }
    /**
     * @returns {string}
     */
    get contentDigest() {
      let t, e;
      try {
        const n = r.__wbg_get_remoteattachmentinfo_contentDigest(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set contentDigest(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_remoteattachmentinfo_contentDigest(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {Uint8Array}
     */
    get nonce() {
      return r.__wbg_get_remoteattachmentinfo_nonce(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set nonce(t) {
      r.__wbg_set_remoteattachmentinfo_nonce(this.__wbg_ptr, t);
    }
    /**
     * @returns {string}
     */
    get scheme() {
      let t, e;
      try {
        const n = r.__wbg_get_remoteattachmentinfo_scheme(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set scheme(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_remoteattachmentinfo_scheme(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {string}
     */
    get url() {
      let t, e;
      try {
        const n = r.__wbg_get_remoteattachmentinfo_url(this.__wbg_ptr);
        return t = n[0], e = n[1], l(n[0], n[1]);
      } finally {
        r.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set url(t) {
      const e = b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_conversationdebuginfo_localCommitLog(this.__wbg_ptr, e, n);
    }
    /**
     * @returns {Uint8Array}
     */
    get salt() {
      return r.__wbg_get_remoteattachmentinfo_salt(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set salt(t) {
      r.__wbg_set_remoteattachmentinfo_salt(this.__wbg_ptr, t);
    }
    /**
     * @returns {number | undefined}
     */
    get contentLength() {
      const t = r.__wbg_get_remoteattachmentinfo_contentLength(this.__wbg_ptr);
      return t === 4294967297 ? void 0 : t;
    }
    /**
     * @param {number | null} [arg0]
     */
    set contentLength(t) {
      r.__wbg_set_remoteattachmentinfo_contentLength(this.__wbg_ptr, g(t) ? 4294967297 : t >>> 0);
    }
    /**
     * @returns {string | undefined}
     */
    get filename() {
      const t = r.__wbg_get_remoteattachmentinfo_filename(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = l(t[0], t[1]).slice(), r.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @param {string | null} [arg0]
     */
    set filename(t) {
      var e = g(t) ? 0 : b(t, r.__wbindgen_malloc, r.__wbindgen_realloc), n = u;
      r.__wbg_set_remoteattachmentinfo_filename(this.__wbg_ptr, e, n);
    }
    /**
     * @param {Uint8Array} secret
     * @param {string} contentDigest
     * @param {Uint8Array} nonce
     * @param {string} scheme
     * @param {string} url
     * @param {Uint8Array} salt
     * @param {number | null} [contentLength]
     * @param {string | null} [filename]
     */
    constructor(t, e, n, i, o, c, _, a) {
      const w = b(e, r.__wbindgen_malloc, r.__wbindgen_realloc), m = u, v = b(i, r.__wbindgen_malloc, r.__wbindgen_realloc), F = u, q = b(o, r.__wbindgen_malloc, r.__wbindgen_realloc), B = u;
      var C = g(a) ? 0 : b(a, r.__wbindgen_malloc, r.__wbindgen_realloc), rt = u;
      const st = r.remoteattachmentinfo_new(t, w, m, n, v, F, q, B, c, g(_) ? 4294967297 : _ >>> 0, C, rt);
      return this.__wbg_ptr = st >>> 0, pt.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Qt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_signaturerequesthandle_free(s >>> 0, 1));
  class W {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(W.prototype);
      return e.__wbg_ptr = t, Qt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Qt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_signaturerequesthandle_free(t, 0);
    }
    /**
     * @returns {Promise<string>}
     */
    signatureText() {
      return r.signaturerequesthandle_signatureText(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} signature_bytes
     * @returns {Promise<void>}
     */
    addEcdsaSignature(t) {
      return r.signaturerequesthandle_addEcdsaSignature(this.__wbg_ptr, t);
    }
    /**
     * @param {PasskeySignature} signature
     * @returns {Promise<void>}
     */
    addPasskeySignature(t) {
      y(t, Pe);
      var e = t.__destroy_into_raw();
      return r.signaturerequesthandle_addPasskeySignature(this.__wbg_ptr, e);
    }
    /**
     * @param {Identifier} account_identifier
     * @param {Uint8Array} signature_bytes
     * @param {bigint} chain_id
     * @param {bigint | null} [block_number]
     * @returns {Promise<void>}
     */
    addScwSignature(t, e, n, i) {
      return r.signaturerequesthandle_addScwSignature(this.__wbg_ptr, t, e, n, !g(i), g(i) ? BigInt(0) : i);
    }
  }
  const Zt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((s) => r.__wbg_streamcloser_free(s >>> 0, 1));
  class j {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(j.prototype);
      return e.__wbg_ptr = t, Zt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Zt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      r.__wbg_streamcloser_free(t, 0);
    }
    /**
     * Signal the stream to end
     * Does not wait for the stream to end.
     */
    end() {
      r.streamcloser_end(this.__wbg_ptr);
    }
    /**
     * End the stream and `await` for it to shutdown
     * Returns the `Result` of the task.
     * End the stream and asynchronously wait for it to shutdown
     * @returns {Promise<void>}
     */
    endAndWait() {
      return r.streamcloser_endAndWait(this.__wbg_ptr);
    }
    /**
     * @returns {Promise<void>}
     */
    waitForReady() {
      return r.streamcloser_waitForReady(this.__wbg_ptr);
    }
    /**
     * Checks if this stream is closed
     * @returns {boolean}
     */
    isClosed() {
      return r.streamcloser_isClosed(this.__wbg_ptr) !== 0;
    }
  }
  const Te = /* @__PURE__ */ new Set(["basic", "cors", "default"]);
  async function Be(s, t) {
    if (typeof Response == "function" && s instanceof Response) {
      if (typeof WebAssembly.instantiateStreaming == "function")
        try {
          return await WebAssembly.instantiateStreaming(s, t);
        } catch (n) {
          if (s.ok && Te.has(s.type) && s.headers.get("Content-Type") !== "application/wasm")
            console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", n);
          else
            throw n;
        }
      const e = await s.arrayBuffer();
      return await WebAssembly.instantiate(e, t);
    } else {
      const e = await WebAssembly.instantiate(s, t);
      return e instanceof WebAssembly.Instance ? { instance: e, module: s } : e;
    }
  }
  function ze() {
    const s = {};
    return s.wbg = {}, s.wbg.__wbg_Error_0497d5bdba9362e5 = function(t, e) {
      return Error(l(t, e));
    }, s.wbg.__wbg_String_8f0eb39a4a4c2f66 = function(t, e) {
      const n = String(e), i = b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), o = u;
      S().setInt32(t + 4, o, !0), S().setInt32(t + 0, i, !0);
    }, s.wbg.__wbg_abort_18ba44d46e13d7fe = function(t) {
      t.abort();
    }, s.wbg.__wbg_abort_4198a1129c47f21a = function(t, e) {
      t.abort(e);
    }, s.wbg.__wbg_add_dd833f9f523abe36 = function(t, e) {
      return t.add(e);
    }, s.wbg.__wbg_append_0342728346e47425 = function() {
      return p(function(t, e, n, i, o) {
        t.append(l(e, n), l(i, o));
      }, arguments);
    }, s.wbg.__wbg_arrayBuffer_d58b858456021d7f = function() {
      return p(function(t) {
        return t.arrayBuffer();
      }, arguments);
    }, s.wbg.__wbg_body_e1e045c770257634 = function(t) {
      const e = t.body;
      return g(e) ? 0 : P(e);
    }, s.wbg.__wbg_buffer_a1a27a0dfa70165d = function(t) {
      return t.buffer;
    }, s.wbg.__wbg_buffer_e495ba54cee589cc = function(t) {
      return t.buffer;
    }, s.wbg.__wbg_byobRequest_56aa768ee4dfed17 = function(t) {
      const e = t.byobRequest;
      return g(e) ? 0 : P(e);
    }, s.wbg.__wbg_byteLength_937f8a52f9697148 = function(t) {
      return t.byteLength;
    }, s.wbg.__wbg_byteOffset_4d94b7170e641898 = function(t) {
      return t.byteOffset;
    }, s.wbg.__wbg_call_f2db6205e5c51dc8 = function() {
      return p(function(t, e, n) {
        return t.call(e, n);
      }, arguments);
    }, s.wbg.__wbg_call_fbe8be8bf6436ce5 = function() {
      return p(function(t, e) {
        return t.call(e);
      }, arguments);
    }, s.wbg.__wbg_cancel_4d78160f447bbbeb = function(t) {
      return t.cancel();
    }, s.wbg.__wbg_catch_b51fce253ee18ec3 = function(t, e) {
      return t.catch(e);
    }, s.wbg.__wbg_clearInterval_dd1e598f425db353 = function(t) {
      return clearInterval(t);
    }, s.wbg.__wbg_clearTimeout_5a54f8841c30079a = function(t) {
      return clearTimeout(t);
    }, s.wbg.__wbg_clearTimeout_6222fede17abcb1a = function(t) {
      return clearTimeout(t);
    }, s.wbg.__wbg_clear_1657d083d00a480f = function(t) {
      t.clear();
    }, s.wbg.__wbg_clear_1da67706bfcd76cf = function(t) {
      t.clear();
    }, s.wbg.__wbg_client_new = function(t) {
      return Ft.__wrap(t);
    }, s.wbg.__wbg_close_290fb040af98d3ac = function() {
      return p(function(t) {
        t.close();
      }, arguments);
    }, s.wbg.__wbg_close_8d9e72339b45f6f5 = function(t) {
      t.close();
    }, s.wbg.__wbg_close_b2641ef0870e518c = function() {
      return p(function(t) {
        t.close();
      }, arguments);
    }, s.wbg.__wbg_code_5e459ca721f994f5 = function(t) {
      return t.code;
    }, s.wbg.__wbg_consent_unwrap = function(t) {
      return et.__unwrap(t);
    }, s.wbg.__wbg_conversation_new = function(t) {
      return T.__wrap(t);
    }, s.wbg.__wbg_conversationlistitem_new = function(t) {
      return kt.__wrap(t);
    }, s.wbg.__wbg_createSyncAccessHandle_05df52d90910c9ce = function(t) {
      return t.createSyncAccessHandle();
    }, s.wbg.__wbg_create_f3f7c1f0898ceb7c = function(t) {
      return Object.create(t);
    }, s.wbg.__wbg_crypto_574e78ad8b13b65f = function(t) {
      return t.crypto;
    }, s.wbg.__wbg_debug_103948ed4c500577 = function(t, e, n, i) {
      console.debug(t, e, n, i);
    }, s.wbg.__wbg_debug_58d16ea352cfbca1 = function(t) {
      console.debug(t);
    }, s.wbg.__wbg_delete_8f0ad80b15b2a784 = function(t, e) {
      return t.delete(e);
    }, s.wbg.__wbg_delete_aca203d8b0528d61 = function(t, e) {
      return t.delete(e);
    }, s.wbg.__wbg_done_4d01f352bade43b7 = function(t) {
      return t.done;
    }, s.wbg.__wbg_enqueue_a62faa171c4fd287 = function() {
      return p(function(t, e) {
        t.enqueue(e);
      }, arguments);
    }, s.wbg.__wbg_entries_14bb5b0fa29e7393 = function(t) {
      return t.entries();
    }, s.wbg.__wbg_entries_41651c850143b957 = function(t) {
      return Object.entries(t);
    }, s.wbg.__wbg_error_51ecdd39ec054205 = function(t) {
      console.error(t);
    }, s.wbg.__wbg_error_624160881466fd69 = function(t, e, n, i) {
      console.error(t, e, n, i);
    }, s.wbg.__wbg_error_7534b8e9a36f1ab4 = function(t, e) {
      let n, i;
      try {
        n = t, i = e, console.error(l(t, e));
      } finally {
        r.__wbindgen_free(n, i, 1);
      }
    }, s.wbg.__wbg_error_e98c298703cffa97 = function(t, e) {
      console.error(l(t, e));
    }, s.wbg.__wbg_fetch_a8e43a4e138dfc93 = function(t, e) {
      return t.fetch(e);
    }, s.wbg.__wbg_fetch_f156d10be9a5c88a = function(t) {
      return fetch(t);
    }, s.wbg.__wbg_fill_45ebe6f76c6747c9 = function(t, e, n, i) {
      return t.fill(e, n >>> 0, i >>> 0);
    }, s.wbg.__wbg_flush_f0630e40db922730 = function() {
      return p(function(t) {
        t.flush();
      }, arguments);
    }, s.wbg.__wbg_from_12ff8e47307bd4c7 = function(t) {
      return Array.from(t);
    }, s.wbg.__wbg_getDate_18ccd9a4e925d3ec = function(t) {
      return t.getDate();
    }, s.wbg.__wbg_getDay_17f53c92a7986053 = function(t) {
      return t.getDay();
    }, s.wbg.__wbg_getDirectoryHandle_812e88ca933e7f14 = function(t, e, n, i) {
      return t.getDirectoryHandle(l(e, n), i);
    }, s.wbg.__wbg_getDirectory_d1926c6af50076e5 = function(t) {
      return t.getDirectory();
    }, s.wbg.__wbg_getFileHandle_1cc9e8420629773c = function(t, e, n, i) {
      return t.getFileHandle(l(e, n), i);
    }, s.wbg.__wbg_getFullYear_1383a5751fab658e = function(t) {
      return t.getFullYear();
    }, s.wbg.__wbg_getHours_94bc6bb5540c2b71 = function(t) {
      return t.getHours();
    }, s.wbg.__wbg_getMinutes_92b2aadc8feb898e = function(t) {
      return t.getMinutes();
    }, s.wbg.__wbg_getMonth_f83b359dffd5f2aa = function(t) {
      return t.getMonth();
    }, s.wbg.__wbg_getRandomValues_3c9c0d586e575a16 = function() {
      return p(function(t, e) {
        globalThis.crypto.getRandomValues(K(t, e));
      }, arguments);
    }, s.wbg.__wbg_getRandomValues_8e6341dd77432a34 = function() {
      return p(function(t, e) {
        globalThis.crypto.getRandomValues(K(t, e));
      }, arguments);
    }, s.wbg.__wbg_getRandomValues_b8f5dbd5f3995a9e = function() {
      return p(function(t, e) {
        t.getRandomValues(e);
      }, arguments);
    }, s.wbg.__wbg_getReader_48e00749fe3f6089 = function() {
      return p(function(t) {
        return t.getReader();
      }, arguments);
    }, s.wbg.__wbg_getSeconds_5bedd376f55ef40c = function(t) {
      return t.getSeconds();
    }, s.wbg.__wbg_getSize_a77eeeffdb4f3fc1 = function() {
      return p(function(t) {
        return t.getSize();
      }, arguments);
    }, s.wbg.__wbg_getTime_2afe67905d873e92 = function(t) {
      return t.getTime();
    }, s.wbg.__wbg_getTimezoneOffset_31f33c0868da345e = function(t) {
      return t.getTimezoneOffset();
    }, s.wbg.__wbg_getUint32_b1236319485e7707 = function(t, e) {
      return t.getUint32(e >>> 0);
    }, s.wbg.__wbg_get_6dd1850282dd8588 = function(t, e) {
      return t.get(e);
    }, s.wbg.__wbg_get_92470be87867c2e5 = function() {
      return p(function(t, e) {
        return Reflect.get(t, e);
      }, arguments);
    }, s.wbg.__wbg_get_a131a44bd1eb6979 = function(t, e) {
      return t[e >>> 0];
    }, s.wbg.__wbg_getdone_8355ddb2bc75c731 = function(t) {
      const e = t.done;
      return g(e) ? 16777215 : e ? 1 : 0;
    }, s.wbg.__wbg_getindex_ba5b3525ad80a881 = function(t, e) {
      return t[e >>> 0];
    }, s.wbg.__wbg_getvalue_c1890a401d13f00b = function(t) {
      return t.value;
    }, s.wbg.__wbg_getwithrefkey_1dc361bd10053bfe = function(t, e) {
      return t[e];
    }, s.wbg.__wbg_groupmetadata_new = function(t) {
      return At.__wrap(t);
    }, s.wbg.__wbg_has_2dc42f1e8cb156db = function(t, e) {
      return t.has(e);
    }, s.wbg.__wbg_has_809e438ee9d787a7 = function() {
      return p(function(t, e) {
        return Reflect.has(t, e);
      }, arguments);
    }, s.wbg.__wbg_headers_0f0cbdc6290b6780 = function(t) {
      return t.headers;
    }, s.wbg.__wbg_inboxstate_new = function(t) {
      return Dt.__wrap(t);
    }, s.wbg.__wbg_info_a1cc312ecc877319 = function(t, e, n, i) {
      console.info(t, e, n, i);
    }, s.wbg.__wbg_info_e56933705c348038 = function(t) {
      console.info(t);
    }, s.wbg.__wbg_installation_new = function(t) {
      return J.__wrap(t);
    }, s.wbg.__wbg_installation_unwrap = function(t) {
      return J.__unwrap(t);
    }, s.wbg.__wbg_instanceof_ArrayBuffer_a8b6f580b363f2bc = function(t) {
      let e;
      try {
        e = t instanceof ArrayBuffer;
      } catch {
        e = !1;
      }
      return e;
    }, s.wbg.__wbg_instanceof_DomException_77720ed8752d7409 = function(t) {
      let e;
      try {
        e = t instanceof DOMException;
      } catch {
        e = !1;
      }
      return e;
    }, s.wbg.__wbg_instanceof_Performance_7c58d8187744b0a5 = function(t) {
      let e;
      try {
        e = t instanceof Performance;
      } catch {
        e = !1;
      }
      return e;
    }, s.wbg.__wbg_instanceof_Response_e80ce8b7a2b968d2 = function(t) {
      let e;
      try {
        e = t instanceof Response;
      } catch {
        e = !1;
      }
      return e;
    }, s.wbg.__wbg_instanceof_Uint8Array_ca460677bc155827 = function(t) {
      let e;
      try {
        e = t instanceof Uint8Array;
      } catch {
        e = !1;
      }
      return e;
    }, s.wbg.__wbg_instanceof_WorkerGlobalScope_11f8a14c11024785 = function(t) {
      let e;
      try {
        e = t instanceof WorkerGlobalScope;
      } catch {
        e = !1;
      }
      return e;
    }, s.wbg.__wbg_iterator_4068add5b2aef7a6 = function() {
      return Symbol.iterator;
    }, s.wbg.__wbg_keys_1abdc63a39dab939 = function(t) {
      return t.keys();
    }, s.wbg.__wbg_keys_a89709494b6fd863 = function(t) {
      return t.keys();
    }, s.wbg.__wbg_length_0ca5b4c83d5d9721 = function(t) {
      return t.length;
    }, s.wbg.__wbg_length_ab6d22b5ead75c72 = function(t) {
      return t.length;
    }, s.wbg.__wbg_length_f00ec12454a5d9fd = function(t) {
      return t.length;
    }, s.wbg.__wbg_mark_05056c522bddc362 = function() {
      return p(function(t, e, n) {
        t.mark(l(e, n));
      }, arguments);
    }, s.wbg.__wbg_mark_24a1a597f4f00679 = function() {
      return p(function(t, e, n, i) {
        t.mark(l(e, n), i);
      }, arguments);
    }, s.wbg.__wbg_measure_0b7379f5cfacac6d = function() {
      return p(function(t, e, n, i, o, c, _) {
        t.measure(l(e, n), l(i, o), l(c, _));
      }, arguments);
    }, s.wbg.__wbg_measure_7728846525e2cced = function() {
      return p(function(t, e, n, i) {
        t.measure(l(e, n), i);
      }, arguments);
    }, s.wbg.__wbg_message_2d95ea5aff0d63b9 = function(t, e) {
      const n = e.message, i = b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), o = u;
      S().setInt32(t + 4, o, !0), S().setInt32(t + 0, i, !0);
    }, s.wbg.__wbg_message_new = function(t) {
      return R.__wrap(t);
    }, s.wbg.__wbg_message_unwrap = function(t) {
      return R.__unwrap(t);
    }, s.wbg.__wbg_messagewithreactions_new = function(t) {
      return Pt.__wrap(t);
    }, s.wbg.__wbg_msCrypto_a61aeb35a24c1329 = function(t) {
      return t.msCrypto;
    }, s.wbg.__wbg_name_2acff1e83d9735f9 = function(t, e) {
      const n = e.name, i = b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), o = u;
      S().setInt32(t + 4, o, !0), S().setInt32(t + 0, i, !0);
    }, s.wbg.__wbg_navigator_6db993f5ffeb46be = function(t) {
      return t.navigator;
    }, s.wbg.__wbg_new0_97314565408dea38 = function() {
      return /* @__PURE__ */ new Date();
    }, s.wbg.__wbg_new_07b483f72211fd66 = function() {
      return new Object();
    }, s.wbg.__wbg_new_186abcfdff244e42 = function() {
      return p(function() {
        return new AbortController();
      }, arguments);
    }, s.wbg.__wbg_new_476169e6d59f23ae = function(t, e) {
      return new Error(l(t, e));
    }, s.wbg.__wbg_new_4796e1cd2eb9ea6d = function() {
      return p(function() {
        return new Headers();
      }, arguments);
    }, s.wbg.__wbg_new_5069c49f18141a33 = function(t, e, n) {
      return new DataView(t, e >>> 0, n >>> 0);
    }, s.wbg.__wbg_new_58353953ad2097cc = function() {
      return new Array();
    }, s.wbg.__wbg_new_8a6f238a6ece86ea = function() {
      return new Error();
    }, s.wbg.__wbg_new_a2957aa5684de228 = function(t) {
      return new Date(t);
    }, s.wbg.__wbg_new_a979b4b45bd55c7f = function() {
      return /* @__PURE__ */ new Map();
    }, s.wbg.__wbg_new_db7d9b0ee94df522 = function(t) {
      return new Set(t);
    }, s.wbg.__wbg_new_e30c39c06edaabf2 = function(t, e) {
      try {
        var n = { a: t, b: e }, i = (c, _) => {
          const a = n.a;
          n.a = 0;
          try {
            return Fe(a, n.b, c, _);
          } finally {
            n.a = a;
          }
        };
        return new Promise(i);
      } finally {
        n.a = n.b = 0;
      }
    }, s.wbg.__wbg_new_e52b3efaaa774f96 = function(t) {
      return new Uint8Array(t);
    }, s.wbg.__wbg_newfromslice_7c05ab1297cb2d88 = function(t, e) {
      return new Uint8Array(K(t, e));
    }, s.wbg.__wbg_newnoargs_ff528e72d35de39a = function(t, e) {
      return new Function(l(t, e));
    }, s.wbg.__wbg_newwithbyteoffsetandlength_3b01ecda099177e8 = function(t, e, n) {
      return new Uint8Array(t, e >>> 0, n >>> 0);
    }, s.wbg.__wbg_newwithintounderlyingsource_b47f6a6a596a7f24 = function(t, e) {
      return new ReadableStream(qt.__wrap(t), e);
    }, s.wbg.__wbg_newwithlength_08f872dc1e3ada2e = function(t) {
      return new Uint8Array(t >>> 0);
    }, s.wbg.__wbg_newwithstrandinit_f8a9dbe009d6be37 = function() {
      return p(function(t, e, n) {
        return new Request(l(t, e), n);
      }, arguments);
    }, s.wbg.__wbg_newwithyearmonthday_eb1c560e7c1fb22a = function(t, e, n) {
      return new Date(t >>> 0, e, n);
    }, s.wbg.__wbg_next_8bb824d217961b5d = function(t) {
      return t.next;
    }, s.wbg.__wbg_next_9eb6fe77da3db3a2 = function() {
      return p(function(t) {
        return t.next();
      }, arguments);
    }, s.wbg.__wbg_next_e2da48d8fff7439a = function() {
      return p(function(t) {
        return t.next();
      }, arguments);
    }, s.wbg.__wbg_node_905d3e251edff8a2 = function(t) {
      return t.node;
    }, s.wbg.__wbg_now_2c95c9de01293173 = function(t) {
      return t.now();
    }, s.wbg.__wbg_now_2f0bbf3fd348701f = function(t) {
      const e = globalThis.performance.now();
      S().setFloat64(t + 8, g(e) ? 0 : e, !0), S().setInt32(t + 0, !g(e), !0);
    }, s.wbg.__wbg_now_7ab37f05ab2d0b81 = function(t) {
      return t.now();
    }, s.wbg.__wbg_now_eb0821f3bd9f6529 = function() {
      return Date.now();
    }, s.wbg.__wbg_onclose_fc9ecf0f4698d22b = function(t) {
      t.on_close();
    }, s.wbg.__wbg_onconsentupdate_fcb6000671002c88 = function(t, e) {
      t.on_consent_update(e);
    }, s.wbg.__wbg_onconversation_d35f29b8b01106b4 = function(t, e) {
      t.on_conversation(T.__wrap(e));
    }, s.wbg.__wbg_onerror_30f14bdbe9fb242d = function(t, e) {
      t.on_error(e);
    }, s.wbg.__wbg_onmessage_9df605f3979a0f9b = function(t, e) {
      t.on_message(R.__wrap(e));
    }, s.wbg.__wbg_onuserpreferenceupdate_9bf50ba273851047 = function(t, e, n) {
      var i = N(e, n).slice();
      r.__wbindgen_free(e, n * 4, 4), t.on_user_preference_update(i);
    }, s.wbg.__wbg_performance_121b9855d716e029 = function() {
      return globalThis.performance;
    }, s.wbg.__wbg_performance_7a3ffd0b17f663ad = function(t) {
      return t.performance;
    }, s.wbg.__wbg_postMessage_54ce7f4b41ac732e = function() {
      return p(function(t, e) {
        t.postMessage(e);
      }, arguments);
    }, s.wbg.__wbg_process_dc0fbacc7c1c06f7 = function(t) {
      return t.process;
    }, s.wbg.__wbg_push_73fd7b5550ebf707 = function(t, e) {
      return t.push(e);
    }, s.wbg.__wbg_queueMicrotask_46c1df247678729f = function(t) {
      queueMicrotask(t);
    }, s.wbg.__wbg_queueMicrotask_8acf3ccb75ed8d11 = function(t) {
      return t.queueMicrotask;
    }, s.wbg.__wbg_randomFillSync_ac0988aba3254290 = function() {
      return p(function(t, e) {
        t.randomFillSync(e);
      }, arguments);
    }, s.wbg.__wbg_random_210bb7fbfa33591d = function() {
      return Math.random();
    }, s.wbg.__wbg_read_4dbc5a78288c4eed = function() {
      return p(function(t, e, n, i) {
        return t.read(K(e, n), i);
      }, arguments);
    }, s.wbg.__wbg_read_8eb30fc4016403e0 = function() {
      return p(function(t, e, n) {
        return t.read(e, n);
      }, arguments);
    }, s.wbg.__wbg_read_f4b89f69cc51efc7 = function(t) {
      return t.read();
    }, s.wbg.__wbg_releaseLock_c589dd51c0812aca = function(t) {
      t.releaseLock();
    }, s.wbg.__wbg_remoteattachmentinfo_new = function(t) {
      return Y.__wrap(t);
    }, s.wbg.__wbg_remoteattachmentinfo_unwrap = function(t) {
      return Y.__unwrap(t);
    }, s.wbg.__wbg_removeEntry_ddd726e5b0218482 = function(t, e, n) {
      return t.removeEntry(l(e, n));
    }, s.wbg.__wbg_require_60cc747a6bc5215a = function() {
      return p(function() {
        return ce.require;
      }, arguments);
    }, s.wbg.__wbg_resolve_0dac8c580ffd4678 = function(t) {
      return Promise.resolve(t);
    }, s.wbg.__wbg_respond_b227f1c3be2bb879 = function() {
      return p(function(t, e) {
        t.respond(e >>> 0);
      }, arguments);
    }, s.wbg.__wbg_setInterval_ed3b5e3c3ebb8a6d = function() {
      return p(function(t, e) {
        return setInterval(t, e);
      }, arguments);
    }, s.wbg.__wbg_setTimeout_2b339866a2aa3789 = function(t, e) {
      return setTimeout(t, e);
    }, s.wbg.__wbg_setTimeout_8f06012fba12034e = function(t, e) {
      globalThis.setTimeout(t, e);
    }, s.wbg.__wbg_setTimeout_db2dbaeefb6f39c7 = function() {
      return p(function(t, e) {
        return setTimeout(t, e);
      }, arguments);
    }, s.wbg.__wbg_setUint32_909f117d6d6c4344 = function(t, e, n) {
      t.setUint32(e >>> 0, n >>> 0);
    }, s.wbg.__wbg_set_3f1d0b984ed272ed = function(t, e, n) {
      t[e] = n;
    }, s.wbg.__wbg_set_7422acbe992d64ab = function(t, e, n) {
      t[e >>> 0] = n;
    }, s.wbg.__wbg_set_c43293f93a35998a = function() {
      return p(function(t, e, n) {
        return Reflect.set(t, e, n);
      }, arguments);
    }, s.wbg.__wbg_set_d6bdfd275fb8a4ce = function(t, e, n) {
      return t.set(e, n);
    }, s.wbg.__wbg_set_fe4e79d1ed3b0e9b = function(t, e, n) {
      t.set(e, n >>> 0);
    }, s.wbg.__wbg_setat_2d0d9be3db4207a9 = function(t, e) {
      t.at = e;
    }, s.wbg.__wbg_setbody_971ec015fc13d6b4 = function(t, e) {
      t.body = e;
    }, s.wbg.__wbg_setcache_a94cd14dc0cc72a2 = function(t, e) {
      t.cache = Re[e];
    }, s.wbg.__wbg_setcreate_62b7d997a9936969 = function(t, e) {
      t.create = e !== 0;
    }, s.wbg.__wbg_setcreate_dcf97058ed33f8f0 = function(t, e) {
      t.create = e !== 0;
    }, s.wbg.__wbg_setcredentials_920d91fb5984c94a = function(t, e) {
      t.credentials = Me[e];
    }, s.wbg.__wbg_setheaders_65a4eb4c0443ae61 = function(t, e) {
      t.headers = e;
    }, s.wbg.__wbg_sethighwatermark_3017ad772d071dcb = function(t, e) {
      t.highWaterMark = e;
    }, s.wbg.__wbg_setmethod_8ce1be0b4d701b7c = function(t, e, n) {
      t.method = l(e, n);
    }, s.wbg.__wbg_setmode_bd35f026f55b6247 = function(t, e) {
      t.mode = De[e];
    }, s.wbg.__wbg_setsignal_8e72abfe7ee03c97 = function(t, e) {
      t.signal = e;
    }, s.wbg.__wbg_signal_b96223519a041faa = function(t) {
      return t.signal;
    }, s.wbg.__wbg_signaturerequesthandle_new = function(t) {
      return W.__wrap(t);
    }, s.wbg.__wbg_size_e6e036b6b1285ed9 = function(t) {
      return t.size;
    }, s.wbg.__wbg_slice_3b17e1df768365f2 = function(t, e, n) {
      return t.slice(e >>> 0, n >>> 0);
    }, s.wbg.__wbg_stack_0ed75d68575b0f3c = function(t, e) {
      const n = e.stack, i = b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), o = u;
      S().setInt32(t + 4, o, !0), S().setInt32(t + 0, i, !0);
    }, s.wbg.__wbg_static_accessor_GLOBAL_487c52c58d65314d = function() {
      const t = typeof global > "u" ? null : global;
      return g(t) ? 0 : P(t);
    }, s.wbg.__wbg_static_accessor_GLOBAL_THIS_ee9704f328b6b291 = function() {
      const t = typeof globalThis > "u" ? null : globalThis;
      return g(t) ? 0 : P(t);
    }, s.wbg.__wbg_static_accessor_SELF_78c9e3071b912620 = function() {
      const t = typeof self > "u" ? null : self;
      return g(t) ? 0 : P(t);
    }, s.wbg.__wbg_static_accessor_WINDOW_a093d21393777366 = function() {
      const t = (() => {
        const e = typeof window < "u" ? window : typeof self < "u" ? self : null;
        return console.log("[XMTP-WASM] WINDOW=", e?.constructor?.name ?? "null", "navigator.storage=", e?.navigator?.storage), e;
      })();
      return g(t) ? 0 : P(t);
    }, s.wbg.__wbg_status_a54682bbe52f9058 = function(t) {
      return t.status;
    }, s.wbg.__wbg_storage_52b923037fa3d04c = function(t) {
      return t.storage;
    }, s.wbg.__wbg_stringify_c242842b97f054cc = function() {
      return p(function(t) {
        return JSON.stringify(t);
      }, arguments);
    }, s.wbg.__wbg_subarray_dd4ade7d53bd8e26 = function(t, e, n) {
      return t.subarray(e >>> 0, n >>> 0);
    }, s.wbg.__wbg_text_ec0e22f60e30dd2f = function() {
      return p(function(t) {
        return t.text();
      }, arguments);
    }, s.wbg.__wbg_then_82ab9fb4080f1707 = function(t, e, n) {
      return t.then(e, n);
    }, s.wbg.__wbg_then_db882932c0c714c6 = function(t, e) {
      return t.then(e);
    }, s.wbg.__wbg_toString_e2fd3ab0d7a3919b = function() {
      return p(function(t, e) {
        return t.toString(e);
      }, arguments);
    }, s.wbg.__wbg_toU8Array_7fa7fb3ae8554ad0 = function(t, e, n, i) {
      zt.toU8Array(t, e >>> 0, n >>> 0, i);
    }, s.wbg.__wbg_toU8Slice_11519abfa5176ae4 = function(t, e, n, i) {
      zt.toU8Slice(t, e, n >>> 0, i >>> 0);
    }, s.wbg.__wbg_truncate_015f5d17c33dc013 = function() {
      return p(function(t, e) {
        t.truncate(e);
      }, arguments);
    }, s.wbg.__wbg_truncate_1b4fd52305f619d7 = function() {
      return p(function(t, e) {
        t.truncate(e >>> 0);
      }, arguments);
    }, s.wbg.__wbg_url_e6ed869ea05b7a71 = function(t, e) {
      const n = e.url, i = b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), o = u;
      S().setInt32(t + 4, o, !0), S().setInt32(t + 0, i, !0);
    }, s.wbg.__wbg_value_17b896954e14f896 = function(t) {
      return t.value;
    }, s.wbg.__wbg_versions_c01dfd4722a88165 = function(t) {
      return t.versions;
    }, s.wbg.__wbg_view_a9ad80dcbad7cf1c = function(t) {
      const e = t.view;
      return g(e) ? 0 : P(e);
    }, s.wbg.__wbg_warn_90607373221a6b1c = function(t, e, n, i) {
      console.warn(t, e, n, i);
    }, s.wbg.__wbg_warn_d89f6637da554c8d = function(t) {
      console.warn(t);
    }, s.wbg.__wbg_write_0afe3c9463f48fc5 = function() {
      return p(function(t, e, n) {
        return t.write(e, n);
      }, arguments);
    }, s.wbg.__wbg_write_20973b686f7a7721 = function() {
      return p(function(t, e, n, i) {
        return t.write(K(e, n), i);
      }, arguments);
    }, s.wbg.__wbindgen_array_new = function() {
      return [];
    }, s.wbg.__wbindgen_array_push = function(t, e) {
      t.push(e);
    }, s.wbg.__wbindgen_bigint_from_i64 = function(t) {
      return t;
    }, s.wbg.__wbindgen_bigint_from_u64 = function(t) {
      return BigInt.asUintN(64, t);
    }, s.wbg.__wbindgen_boolean_get = function(t) {
      const e = t;
      return typeof e == "boolean" ? e ? 1 : 0 : 2;
    }, s.wbg.__wbindgen_cb_drop = function(t) {
      const e = t.original;
      return e.cnt-- == 1 ? (e.a = 0, !0) : !1;
    }, s.wbg.__wbindgen_closure_wrapper20664 = function(t, e, n) {
      return _t(t, e, 5008, ve);
    }, s.wbg.__wbindgen_closure_wrapper22834 = function(t, e, n) {
      return _t(t, e, 5275, Ie);
    }, s.wbg.__wbindgen_closure_wrapper23463 = function(t, e, n) {
      return _t(t, e, 5288, Se);
    }, s.wbg.__wbindgen_debug_string = function(t, e) {
      const n = ht(e), i = b(n, r.__wbindgen_malloc, r.__wbindgen_realloc), o = u;
      S().setInt32(t + 4, o, !0), S().setInt32(t + 0, i, !0);
    }, s.wbg.__wbindgen_in = function(t, e) {
      return t in e;
    }, s.wbg.__wbindgen_init_externref_table = function() {
      const t = r.__wbindgen_export_4, e = t.grow(4);
      t.set(0, void 0), t.set(e + 0, void 0), t.set(e + 1, null), t.set(e + 2, !0), t.set(e + 3, !1);
    }, s.wbg.__wbindgen_is_function = function(t) {
      return typeof t == "function";
    }, s.wbg.__wbindgen_is_object = function(t) {
      const e = t;
      return typeof e == "object" && e !== null;
    }, s.wbg.__wbindgen_is_string = function(t) {
      return typeof t == "string";
    }, s.wbg.__wbindgen_is_undefined = function(t) {
      return t === void 0;
    }, s.wbg.__wbindgen_jsval_loose_eq = function(t, e) {
      return t == e;
    }, s.wbg.__wbindgen_memory = function() {
      return r.memory;
    }, s.wbg.__wbindgen_number_get = function(t, e) {
      const n = e, i = typeof n == "number" ? n : void 0;
      S().setFloat64(t + 8, g(i) ? 0 : i, !0), S().setInt32(t + 0, !g(i), !0);
    }, s.wbg.__wbindgen_number_new = function(t) {
      return t;
    }, s.wbg.__wbindgen_string_get = function(t, e) {
      const n = e, i = typeof n == "string" ? n : void 0;
      var o = g(i) ? 0 : b(i, r.__wbindgen_malloc, r.__wbindgen_realloc), c = u;
      S().setInt32(t + 4, c, !0), S().setInt32(t + 0, o, !0);
    }, s.wbg.__wbindgen_string_new = function(t, e) {
      return l(t, e);
    }, s.wbg.__wbindgen_throw = function(t, e) {
      throw new Error(l(t, e));
    }, s.wbg.__wbindgen_try_into_number = function(t) {
      let e;
      try {
        e = +t;
      } catch (i) {
        e = i;
      }
      return e;
    }, s;
  }
  function Ne(s, t) {
    return r = s.exports, _e.__wbindgen_wasm_module = t, U = null, V = null, r.__wbindgen_start(), r;
  }
  async function _e(s) {
    if (r !== void 0) return r;
    typeof s < "u" && (Object.getPrototypeOf(s) === Object.prototype ? { module_or_path: s } = s : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), typeof s > "u" && (s = new URL("/js/assets/bindings_wasm_bg.wasm", self.location.href));
    const t = ze();
    (typeof s == "string" || typeof Request == "function" && s instanceof Request || typeof URL == "function" && s instanceof URL) && (s = fetch(s));
    const { instance: e, module: n } = await Be(await s, t);
    return Ne(e, n);
  }
  class nt {
    authorityId;
    typeId;
    versionMajor;
    versionMinor;
    constructor(t) {
      this.authorityId = t.authorityId, this.typeId = t.typeId, this.versionMajor = t.versionMajor, this.versionMinor = t.versionMinor;
    }
    toString() {
      return `${this.authorityId}/${this.typeId}:${this.versionMajor}.${this.versionMinor}`;
    }
    static fromString(t) {
      const [e, n] = t.split(":"), [i, o] = e.split("/"), [c, _] = n.split(".");
      return new nt({ authorityId: i, typeId: o, versionMajor: Number(c), versionMinor: Number(_) });
    }
    sameAs(t) {
      return this.authorityId === t.authorityId && this.typeId === t.typeId;
    }
  }
  const te = (s) => {
    return new z((t = s.type, new E(t.authorityId, t.typeId, t.versionMajor, t.versionMinor)), new Map(Object.entries(s.parameters)), s.fallback, s.compression, s.content);
    var t;
  }, Ce = (s) => {
    return { type: (t = s.type, { authorityId: t.authorityId, typeId: t.typeId, versionMajor: t.versionMajor, versionMinor: t.versionMinor }), parameters: s.parameters, fallback: s.fallback, compression: s.compression, content: s.content };
    var t;
  }, ee = (s) => {
    return { type: (t = s.type, new nt({ authorityId: t.authorityId, typeId: t.typeId, versionMajor: t.versionMajor, versionMinor: t.versionMinor })), parameters: s.parameters, fallback: s.fallback, compression: s.compression, content: s.content };
    var t;
  }, H = (s) => {
    return { content: Ce((t = s.content, { type: (e = t.type, new nt({ authorityId: e.authorityId, typeId: e.typeId, versionMajor: e.versionMajor, versionMinor: e.versionMinor })), parameters: Object.fromEntries(t.parameters), fallback: t.fallback, compression: t.compression, content: t.content })), convoId: s.convoId, deliveryStatus: s.deliveryStatus, id: s.id, kind: s.kind, senderInboxId: s.senderInboxId, sentAtNs: s.sentAtNs };
    var t, e;
  }, ft = (s) => new se(s.consentStates, s.conversationType, s.createdAfterNs, s.createdBeforeNs, s.includeDuplicateDms ?? !1, s.limit), mt = (s) => {
    return new tt(s.permissions, s.name, s.imageUrlSquare, s.description, s.customPermissionPolicySet && s.permissions === ke.CustomPolicy ? (t = s.customPermissionPolicySet, new G(t.addMemberPolicy, t.removeMemberPolicy, t.addAdminPolicy, t.removeAdminPolicy, t.updateGroupNamePolicy, t.updateGroupDescriptionPolicy, t.updateGroupImageUrlSquarePolicy, t.updateMessageDisappearingPolicy)) : void 0, s.messageDisappearingSettings ? oe(s.messageDisappearingSettings) : void 0);
    var t;
  }, ne = (s) => new vt(s.messageDisappearingSettings ? oe(s.messageDisappearingSettings) : void 0), k = async (s) => {
    const t = s.id, e = s.name, n = s.imageUrl, i = s.description, o = s.permissions, c = s.addedByInboxId, _ = await s.metadata(), a = s.admins, w = s.superAdmins, m = s.createdAtNs, v = o.policyType, F = o.policySet, q = s.isCommitLogForked;
    return { id: t, name: e, imageUrl: n, description: i, permissions: { policyType: v, policySet: { addAdminPolicy: F.addAdminPolicy, addMemberPolicy: F.addMemberPolicy, removeAdminPolicy: F.removeAdminPolicy, removeMemberPolicy: F.removeMemberPolicy, updateGroupDescriptionPolicy: F.updateGroupDescriptionPolicy, updateGroupImageUrlSquarePolicy: F.updateGroupImageUrlSquarePolicy, updateGroupNamePolicy: F.updateGroupNamePolicy, updateMessageDisappearingPolicy: F.updateMessageDisappearingPolicy } }, addedByInboxId: c, metadata: _, admins: a, superAdmins: w, createdAtNs: m, isCommitLogForked: q };
  }, Oe = (s) => ({ bytes: s.bytes, clientTimestampNs: s.clientTimestampNs, id: s.id }), yt = (s) => ({ identifiers: s.accountIdentifiers, inboxId: s.inboxId, installations: s.installations.map(Oe), recoveryIdentifier: s.recoveryIdentifier }), Ue = (s) => ({ entity: s.entity, entityType: s.entityType, state: s.state }), je = (s) => new et(s.entityType, s.state, s.entity), Ge = (s) => ({ key: s.key, epoch: s.epoch }), oe = (s) => new M(s.fromNs, s.inNs), Le = (s) => ({ lifetime: s.lifetime ? { notBefore: s.lifetime.not_before, notAfter: s.lifetime.not_after } : void 0, validationError: s.validationError });
  class Ee extends Error {
    constructor() {
      super("Client not initialized, use Client.create or Client.build to create a client");
    }
  }
  class We extends Error {
    constructor(t) {
      super(`Group "${t}" not found`);
    }
  }
  class Ke extends Error {
    constructor(t) {
      super(`Stream "${t}" not found`);
    }
  }
  const He = { local: "http://localhost:5555", dev: "https://dev.xmtp.network", production: "https://production.xmtp.network" }, ae = { local: "http://localhost:5558", dev: "https://message-history.dev.ephemera.network", production: "https://message-history.production.ephemera.network" };
  class x {
    #e;
    #t;
    #n;
    constructor(t, e, n) {
      this.#e = t, this.#t = e, this.#n = n;
    }
    get id() {
      return this.#t.id();
    }
    get name() {
      return this.#t.groupName();
    }
    async updateName(t) {
      return this.#t.updateGroupName(t);
    }
    get imageUrl() {
      return this.#t.groupImageUrlSquare();
    }
    async updateImageUrl(t) {
      return this.#t.updateGroupImageUrlSquare(t);
    }
    get description() {
      return this.#t.groupDescription();
    }
    async updateDescription(t) {
      return this.#t.updateGroupDescription(t);
    }
    get isActive() {
      return this.#t.isActive();
    }
    get isCommitLogForked() {
      return this.#n;
    }
    get addedByInboxId() {
      return this.#t.addedByInboxId();
    }
    get createdAtNs() {
      return this.#t.createdAtNs();
    }
    async lastMessage() {
      const t = await this.messages({ limit: 1n, direction: xe.Descending });
      if (t.length > 0) return t[0];
    }
    async metadata() {
      const t = await this.#t.groupMetadata();
      return { creatorInboxId: t.creatorInboxId(), conversationType: t.conversationType() };
    }
    async members() {
      return (await this.#t.listMembers()).map(((t) => ((e) => ({ accountIdentifiers: e.accountIdentifiers, consentState: e.consentState, inboxId: e.inboxId, installationIds: e.installationIds, permissionLevel: e.permissionLevel }))(t)));
    }
    get admins() {
      return this.#t.adminList();
    }
    get superAdmins() {
      return this.#t.superAdminList();
    }
    get permissions() {
      const t = this.#t.groupPermissions();
      return { policyType: t.policyType(), policySet: t.policySet() };
    }
    async updatePermission(t, e, n) {
      return this.#t.updatePermissionPolicy(t, e, n);
    }
    isAdmin(t) {
      return this.#t.isAdmin(t);
    }
    isSuperAdmin(t) {
      return this.#t.isSuperAdmin(t);
    }
    async sync() {
      return this.#t.sync();
    }
    async addMembersByIdentifiers(t) {
      return this.#t.addMembers(t);
    }
    async addMembers(t) {
      return this.#t.addMembersByInboxId(t);
    }
    async removeMembersByIdentifiers(t) {
      return this.#t.removeMembers(t);
    }
    async removeMembers(t) {
      return this.#t.removeMembersByInboxId(t);
    }
    async addAdmin(t) {
      return this.#t.addAdmin(t);
    }
    async removeAdmin(t) {
      return this.#t.removeAdmin(t);
    }
    async addSuperAdmin(t) {
      return this.#t.addSuperAdmin(t);
    }
    async removeSuperAdmin(t) {
      return this.#t.removeSuperAdmin(t);
    }
    async publishMessages() {
      return this.#t.publishMessages();
    }
    sendOptimistic(t) {
      return this.#t.sendOptimistic(t);
    }
    async send(t) {
      return this.#t.send(t);
    }
    async messages(t) {
      return this.#t.findMessages(t ? ((e) => new It(e.sentBeforeNs, e.sentAfterNs, e.limit, e.deliveryStatus, e.direction, e.contentTypes))(t) : void 0);
    }
    get consentState() {
      return this.#t.consentState();
    }
    updateConsentState(t) {
      this.#t.updateConsentState(t);
    }
    dmPeerInboxId() {
      return this.#t.dmPeerInboxId();
    }
    messageDisappearingSettings() {
      return this.#t.messageDisappearingSettings();
    }
    async updateMessageDisappearingSettings(t, e) {
      const n = new M(t, e);
      return this.#t.updateMessageDisappearingSettings(n);
    }
    async removeMessageDisappearingSettings() {
      return this.#t.removeMessageDisappearingSettings();
    }
    isMessageDisappearingEnabled() {
      return this.#t.isMessageDisappearingEnabled();
    }
    stream(t, e) {
      return this.#t.stream({ on_message: (n) => {
        t(null, n);
      }, on_error: (n) => {
        t(n, void 0);
      }, on_close: () => {
        e();
      } });
    }
    pausedForVersion() {
      return this.#t.pausedForVersion();
    }
    getHmacKeys() {
      return this.#t.getHmacKeys();
    }
    async debugInfo() {
      return await this.#t.getDebugInfo();
    }
    async getDuplicateDms() {
      return (await this.#t.findDuplicateDms()).map(((t) => new x(this.#e, t)));
    }
  }
  class Ve {
    #e;
    #t;
    constructor(t, e) {
      this.#e = t, this.#t = e;
    }
    async sync() {
      return this.#t.sync();
    }
    async syncAll(t) {
      return this.#t.syncAllConversations(t);
    }
    getConversationById(t) {
      try {
        const e = this.#t.findGroupById(t);
        return new x(this.#e, e);
      } catch {
        return;
      }
    }
    getMessageById(t) {
      try {
        return this.#t.findMessageById(t);
      } catch {
        return;
      }
    }
    getDmByInboxId(t) {
      try {
        const e = this.#t.findDmByTargetInboxId(t);
        return new x(this.#e, e);
      } catch {
        return;
      }
    }
    list(t) {
      return this.#t.list(t ? ft(t) : void 0).map(((e) => new x(this.#e, e.conversation, e.isCommitLogForked)));
    }
    listGroups(t) {
      return this.#t.list(ft({ ...t ?? {}, conversationType: X.Group })).map(((e) => new x(this.#e, e.conversation, e.isCommitLogForked)));
    }
    listDms(t) {
      return this.#t.list(ft({ ...t ?? {}, conversationType: X.Dm })).map(((e) => new x(this.#e, e.conversation, e.isCommitLogForked)));
    }
    newGroupOptimistic(t) {
      const e = this.#t.createGroupOptimistic(t ? mt(t) : void 0);
      return new x(this.#e, e);
    }
    async newGroupWithIdentifiers(t, e) {
      const n = await this.#t.createGroup(t, e ? mt(e) : void 0);
      return new x(this.#e, n);
    }
    async newGroup(t, e) {
      const n = await this.#t.createGroupByInboxIds(t, e ? mt(e) : void 0);
      return new x(this.#e, n);
    }
    async newDmWithIdentifier(t, e) {
      const n = await this.#t.createDm(t, e ? ne(e) : void 0);
      return new x(this.#e, n);
    }
    async newDm(t, e) {
      const n = await this.#t.createDmByInboxId(t, e ? ne(e) : void 0);
      return new x(this.#e, n);
    }
    getHmacKeys() {
      return this.#t.getHmacKeys();
    }
    stream(t, e, n) {
      return this.#t.stream({ on_conversation: (i) => {
        t(null, i);
      }, on_error: (i) => {
        t(i, void 0);
      }, on_close: () => {
        e();
      } }, n);
    }
    streamGroups(t, e) {
      return this.stream(t, e, X.Group);
    }
    streamDms(t, e) {
      return this.stream(t, e, X.Dm);
    }
    streamAllMessages(t, e, n, i) {
      return this.#t.streamAllMessages({ on_message: (o) => {
        t(null, o);
      }, on_error: (o) => {
        t(o, void 0);
      }, on_close: () => {
        e();
      } }, n, i);
    }
  }
  class $e {
    #e;
    #t;
    constructor(t, e) {
      this.#e = t, this.#t = e;
    }
    apiStatistics() {
      return this.#e.apiStatistics();
    }
    apiIdentityStatistics() {
      return this.#e.apiIdentityStatistics();
    }
    apiAggregateStatistics() {
      return this.#e.apiAggregateStatistics();
    }
    clearAllStatistics() {
      this.#e.clearAllStatistics();
    }
    uploadDebugArchive(t) {
      const e = this.#t?.env || "dev", n = this.#t?.historySyncUrl || ae[e];
      return this.#e.uploadDebugArchive(t || n);
    }
  }
  class Je {
    #e;
    #t;
    constructor(t, e) {
      this.#e = t, this.#t = e;
    }
    sync() {
      return this.#e.syncPreferences();
    }
    async inboxState(t) {
      return this.#e.inboxState(t);
    }
    async inboxStateFromInboxIds(t, e) {
      return this.#e.inboxStateFromInboxIds(t, e ?? !1);
    }
    async getLatestInboxState(t) {
      return this.#e.getLatestInboxState(t);
    }
    async setConsentStates(t) {
      return this.#e.setConsentStates(t.map(je));
    }
    async getConsentState(t, e) {
      return this.#e.getConsentState(t, e);
    }
    streamConsent(t, e) {
      return this.#t.streamConsent({ on_consent_update: (n) => {
        t(null, n);
      }, on_error: (n) => {
        t(n, void 0);
      }, on_close: () => {
        e();
      } });
    }
    streamPreferences(t, e) {
      return this.#t.streamPreferences({ on_user_preference_update: (n) => {
        t(null, n);
      }, on_error: (n) => {
        t(n, void 0);
      }, on_close: () => {
        e();
      } });
    }
  }
  class Tt {
    #e;
    #t;
    #n;
    #r;
    constructor(t, e) {
      this.#e = t;
      const n = t.conversations();
      this.#t = new Ve(this, n), this.#n = new $e(t, e), this.#r = new Je(t, n);
    }
    static async create(t, e) {
      const n = await (async (i, o) => {
        const c = o?.env || "dev", _ = o?.apiUrl || He[c], a = await me(_, i) || ye(i), w = o?.dbPath === void 0 ? `xmtp-${c}-${a}.db3` : o.dbPath, m = o && (o.loggingLevel !== void 0 || o.structuredLogging || o.performanceLogging), v = o?.historySyncUrl === void 0 ? ae[c] : o.historySyncUrl, F = o?.disableDeviceSync ? "disabled" : "enabled";
        return fe(_, a, i, w, o?.dbEncryptionKey, v, F, m ? new ie(o.structuredLogging ?? !1, o.performanceLogging ?? !1, o.loggingLevel) : void 0, void 0, o?.debugEventsEnabled, o?.appVersion);
      })(t, e);
      return new Tt(n, e);
    }
    get accountIdentifier() {
      return this.#e.accountIdentifier;
    }
    get inboxId() {
      return this.#e.inboxId;
    }
    get installationId() {
      return this.#e.installationId;
    }
    get installationIdBytes() {
      return this.#e.installationIdBytes;
    }
    get isRegistered() {
      return this.#e.isRegistered;
    }
    get conversations() {
      return this.#t;
    }
    get debugInformation() {
      return this.#n;
    }
    get preferences() {
      return this.#r;
    }
    async canMessage(t) {
      return this.#e.canMessage(t);
    }
    async addSignature(t, e) {
      switch (e.type) {
        case "SCW":
          await t.addScwSignature(e.identifier, e.signature, e.chainId, e.blockNumber);
          break;
        case "EOA":
          await t.addEcdsaSignature(e.signature);
      }
    }
    async applySignatureRequest(t) {
      return this.#e.applySignatureRequest(t);
    }
    async processSignatureRequest(t, e) {
      await this.addSignature(e, t), await this.applySignatureRequest(e);
    }
    createInboxSignatureRequest() {
      return this.#e.createInboxSignatureRequest();
    }
    async addAccountSignatureRequest(t) {
      return this.#e.addWalletSignatureRequest(t);
    }
    async removeAccountSignatureRequest(t) {
      return this.#e.revokeWalletSignatureRequest(t);
    }
    async revokeAllOtherInstallationsSignatureRequest() {
      return this.#e.revokeAllOtherInstallationsSignatureRequest();
    }
    async revokeInstallationsSignatureRequest(t) {
      return this.#e.revokeInstallationsSignatureRequest(t);
    }
    async changeRecoveryIdentifierSignatureRequest(t) {
      return this.#e.changeRecoveryIdentifierSignatureRequest(t);
    }
    async registerIdentity(t, e) {
      await this.addSignature(e, t), await this.#e.registerIdentity(e);
    }
    async findInboxIdByIdentifier(t) {
      return this.#e.findInboxIdByIdentifier(t);
    }
    signWithInstallationKey(t) {
      return this.#e.signWithInstallationKey(t);
    }
    verifySignedWithInstallationKey(t, e) {
      try {
        return this.#e.verifySignedWithInstallationKey(t, e), !0;
      } catch {
        return !1;
      }
    }
    verifySignedWithPublicKey(t, e, n) {
      try {
        return he(t, e, n), !0;
      } catch {
        return !1;
      }
    }
    async getKeyPackageStatusesForInstallationIds(t) {
      return this.#e.getKeyPackageStatusesForInstallationIds(t);
    }
  }
  let O, re = !1;
  const A = /* @__PURE__ */ new Map(), I = /* @__PURE__ */ new Map(), d = (s) => {
    self.postMessage(s);
  }, D = (s) => {
    self.postMessage(s);
  }, L = (s) => {
    self.postMessage(s);
  };
  self.onmessage = async (s) => {
    const { action: t, id: e, data: n } = s.data;
    re && console.log("client worker received event data", s.data), await _e();
    try {
      if (t === "client.init" && !O) return O = await Tt.create(n.identifier, n.options), re = n.options?.loggingLevel !== void 0 && n.options.loggingLevel !== "off", void d({ id: e, action: t, result: { inboxId: O.inboxId, installationId: O.installationId, installationIdBytes: O.installationIdBytes } });
      if (!O) throw new Ee();
      const o = O, c = (_) => {
        const a = o.conversations.getConversationById(_);
        if (!a) throw new We(_);
        return a;
      };
      switch (t) {
        case "endStream": {
          const _ = A.get(n.streamId);
          if (!_) throw new Ke(n.streamId);
          _.end(), A.delete(n.streamId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "client.applySignatureRequest": {
          const _ = I.get(n.signatureRequestId);
          if (!_) throw new Error("Signature request not found");
          await o.processSignatureRequest(n.signer, _), I.delete(n.signatureRequestId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "client.createInboxSignatureText": {
          const _ = { signatureText: void 0, signatureRequestId: void 0 };
          try {
            const a = o.createInboxSignatureRequest();
            a && (_.signatureText = await a.signatureText(), _.signatureRequestId = n.signatureRequestId, I.set(n.signatureRequestId, a));
          } finally {
            d({ id: e, action: t, result: _ });
          }
          break;
        }
        case "client.addAccountSignatureText": {
          const _ = await o.addAccountSignatureRequest(n.newIdentifier), a = { signatureText: await _.signatureText(), signatureRequestId: n.signatureRequestId };
          I.set(n.signatureRequestId, _), d({ id: e, action: t, result: a });
          break;
        }
        case "client.removeAccountSignatureText": {
          const _ = await o.removeAccountSignatureRequest(n.identifier), a = { signatureText: await _.signatureText(), signatureRequestId: n.signatureRequestId };
          I.set(n.signatureRequestId, _), d({ id: e, action: t, result: a });
          break;
        }
        case "client.revokeAllOtherInstallationsSignatureText": {
          const _ = await o.revokeAllOtherInstallationsSignatureRequest(), a = { signatureText: await _.signatureText(), signatureRequestId: n.signatureRequestId };
          I.set(n.signatureRequestId, _), d({ id: e, action: t, result: a });
          break;
        }
        case "client.revokeInstallationsSignatureText": {
          const _ = await o.revokeInstallationsSignatureRequest(n.installationIds), a = { signatureText: await _.signatureText(), signatureRequestId: n.signatureRequestId };
          I.set(n.signatureRequestId, _), d({ id: e, action: t, result: a });
          break;
        }
        case "client.changeRecoveryIdentifierSignatureText": {
          const _ = await o.changeRecoveryIdentifierSignatureRequest(n.identifier), a = { signatureText: await _.signatureText(), signatureRequestId: n.signatureRequestId };
          I.set(n.signatureRequestId, _), d({ id: e, action: t, result: a });
          break;
        }
        case "client.registerIdentity": {
          const _ = I.get(n.signatureRequestId);
          if (!_) throw new Error("Signature request not found");
          await o.registerIdentity(n.signer, _), I.delete(n.signatureRequestId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "client.addAccount": {
          const _ = I.get(n.signatureRequestId);
          if (!_) throw new Error("Signature request not found");
          await o.processSignatureRequest(n.signer, _), I.delete(n.signatureRequestId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "client.removeAccount": {
          const _ = I.get(n.signatureRequestId);
          if (!_) throw new Error("Signature request not found");
          await o.processSignatureRequest(n.signer, _), I.delete(n.signatureRequestId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "client.revokeAllOtherInstallations": {
          const _ = I.get(n.signatureRequestId);
          if (!_) throw new Error("Signature request not found");
          await o.processSignatureRequest(n.signer, _), I.delete(n.signatureRequestId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "client.revokeInstallations": {
          const _ = I.get(n.signatureRequestId);
          if (!_) throw new Error("Signature request not found");
          await o.processSignatureRequest(n.signer, _), I.delete(n.signatureRequestId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "client.changeRecoveryIdentifier": {
          const _ = I.get(n.signatureRequestId);
          if (!_) throw new Error("Signature request not found");
          await o.processSignatureRequest(n.signer, _), I.delete(n.signatureRequestId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "client.isRegistered": {
          const _ = o.isRegistered;
          d({ id: e, action: t, result: _ });
          break;
        }
        case "client.canMessage": {
          const _ = await o.canMessage(n.identifiers);
          d({ id: e, action: t, result: _ });
          break;
        }
        case "client.findInboxIdByIdentifier": {
          const _ = await o.findInboxIdByIdentifier(n.identifier);
          d({ id: e, action: t, result: _ });
          break;
        }
        case "client.signWithInstallationKey": {
          const _ = o.signWithInstallationKey(n.signatureText);
          d({ id: e, action: t, result: _ });
          break;
        }
        case "client.verifySignedWithInstallationKey": {
          const _ = o.verifySignedWithInstallationKey(n.signatureText, n.signatureBytes);
          d({ id: e, action: t, result: _ });
          break;
        }
        case "client.verifySignedWithPublicKey": {
          const _ = o.verifySignedWithPublicKey(n.signatureText, n.signatureBytes, n.publicKey);
          d({ id: e, action: t, result: _ });
          break;
        }
        case "client.getKeyPackageStatusesForInstallationIds": {
          const _ = await o.getKeyPackageStatusesForInstallationIds(n.installationIds), a = new Map(Array.from(_.entries()).map((([w, m]) => [w, Le(m)])));
          d({ id: e, action: t, result: a });
          break;
        }
        case "debugInformation.apiStatistics": {
          const _ = o.debugInformation.apiStatistics(), a = { uploadKeyPackage: (i = _).upload_key_package, fetchKeyPackage: i.fetch_key_package, sendGroupMessages: i.send_group_messages, sendWelcomeMessages: i.send_welcome_messages, queryGroupMessages: i.query_group_messages, queryWelcomeMessages: i.query_welcome_messages, subscribeMessages: i.subscribe_messages, subscribeWelcomes: i.subscribe_welcomes };
          d({ id: e, action: t, result: a });
          break;
        }
        case "debugInformation.apiIdentityStatistics": {
          const _ = ((a) => ({ getIdentityUpdatesV2: a.get_identity_updates_v2, getInboxIds: a.get_inbox_ids, publishIdentityUpdate: a.publish_identity_update, verifySmartContractWalletSignature: a.verify_smart_contract_wallet_signature }))(o.debugInformation.apiIdentityStatistics());
          d({ id: e, action: t, result: _ });
          break;
        }
        case "debugInformation.apiAggregateStatistics": {
          const _ = o.debugInformation.apiAggregateStatistics();
          d({ id: e, action: t, result: _ });
          break;
        }
        case "debugInformation.clearAllStatistics":
          o.debugInformation.clearAllStatistics(), d({ id: e, action: t, result: void 0 });
          break;
        case "debugInformation.uploadDebugArchive": {
          const _ = await o.debugInformation.uploadDebugArchive(n.serverUrl);
          d({ id: e, action: t, result: _ });
          break;
        }
        case "preferences.inboxState": {
          const _ = await o.preferences.inboxState(n.refreshFromNetwork), a = yt(_);
          d({ id: e, action: t, result: a });
          break;
        }
        case "preferences.inboxStateFromInboxIds": {
          const _ = (await o.preferences.inboxStateFromInboxIds(n.inboxIds, n.refreshFromNetwork)).map(yt);
          d({ id: e, action: t, result: _ });
          break;
        }
        case "preferences.getLatestInboxState": {
          const _ = await o.preferences.getLatestInboxState(n.inboxId), a = yt(_);
          d({ id: e, action: t, result: a });
          break;
        }
        case "preferences.setConsentStates":
          await o.preferences.setConsentStates(n.records), d({ id: e, action: t, result: void 0 });
          break;
        case "preferences.getConsentState": {
          const _ = await o.preferences.getConsentState(n.entityType, n.entity);
          d({ id: e, action: t, result: _ });
          break;
        }
        case "preferences.sync": {
          const _ = await o.preferences.sync();
          d({ id: e, action: t, result: _ });
          break;
        }
        case "preferences.streamConsent": {
          const _ = (w, m) => {
            w ? L({ action: "stream.consent", streamId: n.streamId, error: w }) : D({ action: "stream.consent", streamId: n.streamId, result: m?.map(Ue) ?? [] });
          }, a = o.preferences.streamConsent(_, (() => {
            A.delete(n.streamId), D({ action: "stream.fail", streamId: n.streamId, result: void 0 });
          }));
          A.set(n.streamId, a), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "preferences.streamPreferences": {
          const _ = (w, m) => {
            w ? L({ action: "stream.preferences", streamId: n.streamId, error: w }) : D({ action: "stream.preferences", streamId: n.streamId, result: m ?? void 0 });
          }, a = o.preferences.streamPreferences(_, (() => {
            A.delete(n.streamId), D({ action: "stream.fail", streamId: n.streamId, result: void 0 });
          }));
          A.set(n.streamId, a), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "conversations.stream": {
          const _ = (w, m) => {
            w ? L({ action: "stream.conversation", streamId: n.streamId, error: w }) : m ? k(new x(o, m)).then(((v) => {
              D({ action: "stream.conversation", streamId: n.streamId, result: v });
            })).catch(((v) => {
              L({ action: "stream.conversation", streamId: n.streamId, error: v });
            })) : D({ action: "stream.conversation", streamId: n.streamId, result: void 0 });
          }, a = o.conversations.stream(_, (() => {
            A.delete(n.streamId), D({ action: "stream.fail", streamId: n.streamId, result: void 0 });
          }), n.conversationType);
          A.set(n.streamId, a), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "conversations.streamAllMessages": {
          const _ = (w, m) => {
            w ? L({ action: "stream.message", streamId: n.streamId, error: w }) : D({ action: "stream.message", streamId: n.streamId, result: m ? H(m) : void 0 });
          }, a = o.conversations.streamAllMessages(_, (() => {
            A.delete(n.streamId), D({ action: "stream.fail", streamId: n.streamId, result: void 0 });
          }), n.conversationType, n.consentStates);
          A.set(n.streamId, a), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "conversations.list": {
          const _ = o.conversations.list(n.options), a = await Promise.all(_.map(((w) => k(w))));
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.listGroups": {
          const _ = o.conversations.listGroups(n.options), a = await Promise.all(_.map(((w) => k(w))));
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.listDms": {
          const _ = o.conversations.listDms(n.options), a = await Promise.all(_.map(((w) => k(w))));
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.newGroupOptimistic": {
          const _ = o.conversations.newGroupOptimistic(n.options), a = await k(_);
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.newGroupWithIdentifiers": {
          const _ = await o.conversations.newGroupWithIdentifiers(n.identifiers, n.options), a = await k(_);
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.newGroup": {
          const _ = await o.conversations.newGroup(n.inboxIds, n.options), a = await k(_);
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.newDmWithIdentifier": {
          const _ = await o.conversations.newDmWithIdentifier(n.identifier, n.options), a = await k(_);
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.newDm": {
          const _ = await o.conversations.newDm(n.inboxId, n.options), a = await k(_);
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.sync":
          await o.conversations.sync(), d({ id: e, action: t, result: void 0 });
          break;
        case "conversations.syncAll":
          await o.conversations.syncAll(n.consentStates), d({ id: e, action: t, result: void 0 });
          break;
        case "conversations.getConversationById": {
          const _ = o.conversations.getConversationById(n.id), a = _ ? await k(_) : void 0;
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.getMessageById": {
          const _ = o.conversations.getMessageById(n.id), a = _ ? H(_) : void 0;
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.getDmByInboxId": {
          const _ = o.conversations.getDmByInboxId(n.inboxId), a = _ ? await k(_) : void 0;
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversations.getHmacKeys": {
          const _ = o.conversations.getHmacKeys(), a = Object.fromEntries(Array.from(_.entries()).map((([w, m]) => [w, m.map(Ge)])));
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversation.sync": {
          const _ = c(n.id);
          await _.sync();
          const a = await k(_);
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversation.lastMessage": {
          const _ = c(n.id), a = await _.lastMessage();
          d({ id: e, action: t, result: a ? H(a) : void 0 });
          break;
        }
        case "conversation.isActive": {
          const _ = c(n.id).isActive;
          d({ id: e, action: t, result: _ });
          break;
        }
        case "conversation.consentState": {
          const _ = c(n.id).consentState;
          d({ id: e, action: t, result: _ });
          break;
        }
        case "conversation.updateConsentState":
          c(n.id).updateConsentState(n.state), d({ id: e, action: t, result: void 0 });
          break;
        case "group.updateName": {
          await c(n.id).updateName(n.name), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.updateDescription": {
          await c(n.id).updateDescription(n.description), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.updateImageUrl": {
          await c(n.id).updateImageUrl(n.imageUrl), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "conversation.send": {
          const _ = c(n.id), a = await _.send(te(ee(n.content)));
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversation.sendOptimistic": {
          const _ = c(n.id).sendOptimistic(te(ee(n.content)));
          d({ id: e, action: t, result: _ });
          break;
        }
        case "conversation.publishMessages": {
          await c(n.id).publishMessages(), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "conversation.messages": {
          const _ = c(n.id), a = (await _.messages(n.options)).map(((w) => H(w)));
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversation.members": {
          const _ = c(n.id), a = await _.members();
          d({ id: e, action: t, result: a });
          break;
        }
        case "group.listAdmins": {
          const _ = c(n.id).admins;
          d({ id: e, action: t, result: _ });
          break;
        }
        case "group.listSuperAdmins": {
          const _ = c(n.id).superAdmins;
          d({ id: e, action: t, result: _ });
          break;
        }
        case "group.addAdmin": {
          await c(n.id).addAdmin(n.inboxId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.removeAdmin": {
          await c(n.id).removeAdmin(n.inboxId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.addSuperAdmin": {
          await c(n.id).addSuperAdmin(n.inboxId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.removeSuperAdmin": {
          await c(n.id).removeSuperAdmin(n.inboxId), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.addMembersByIdentifiers": {
          await c(n.id).addMembersByIdentifiers(n.identifiers), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.removeMembersByIdentifiers": {
          await c(n.id).removeMembersByIdentifiers(n.identifiers), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.addMembers": {
          await c(n.id).addMembers(n.inboxIds), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.removeMembers": {
          await c(n.id).removeMembers(n.inboxIds), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.isAdmin": {
          const _ = c(n.id).isAdmin(n.inboxId);
          d({ id: e, action: t, result: _ });
          break;
        }
        case "group.isSuperAdmin": {
          const _ = c(n.id).isSuperAdmin(n.inboxId);
          d({ id: e, action: t, result: _ });
          break;
        }
        case "dm.peerInboxId": {
          const _ = c(n.id).dmPeerInboxId();
          d({ id: e, action: t, result: _ });
          break;
        }
        case "group.updatePermission": {
          await c(n.id).updatePermission(n.permissionType, n.policy, n.metadataField), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "group.permissions": {
          const _ = c(n.id), a = (await k(_)).permissions;
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversation.messageDisappearingSettings": {
          const _ = c(n.id).messageDisappearingSettings(), a = _ ? ((w) => ({ fromNs: w.fromNs, inNs: w.inNs }))(_) : void 0;
          d({ id: e, action: t, result: a });
          break;
        }
        case "conversation.updateMessageDisappearingSettings": {
          await c(n.id).updateMessageDisappearingSettings(n.fromNs, n.inNs), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "conversation.removeMessageDisappearingSettings": {
          await c(n.id).removeMessageDisappearingSettings(), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "conversation.isMessageDisappearingEnabled": {
          const _ = c(n.id).isMessageDisappearingEnabled();
          d({ id: e, action: t, result: _ });
          break;
        }
        case "conversation.stream": {
          const _ = c(n.groupId), a = (m, v) => {
            m ? L({ action: "stream.message", streamId: n.streamId, error: m }) : D({ action: "stream.message", streamId: n.streamId, result: v ? H(v) : void 0 });
          }, w = _.stream(a, (() => {
            A.delete(n.streamId), D({ action: "stream.fail", streamId: n.streamId, result: void 0 });
          }));
          A.set(n.streamId, w), d({ id: e, action: t, result: void 0 });
          break;
        }
        case "conversation.pausedForVersion": {
          const _ = c(n.id).pausedForVersion();
          d({ id: e, action: t, result: _ });
          break;
        }
        case "conversation.getHmacKeys": {
          const _ = c(n.id).getHmacKeys();
          d({ id: e, action: t, result: _ });
          break;
        }
        case "dm.getDuplicateDms": {
          const _ = c(n.id), a = await _.getDuplicateDms(), w = await Promise.all(a.map(((m) => k(m))));
          d({ id: e, action: t, result: w });
          break;
        }
        case "conversation.debugInfo": {
          const _ = c(n.id), a = ((w) => ({ epoch: w.epoch, maybeForked: w.maybeForked, forkDetails: w.forkDetails, isCommitLogForked: w.isCommitLogForked, localCommitLog: w.localCommitLog, remoteCommitLog: w.remoteCommitLog, cursor: w.cursor }))(await _.debugInfo());
          d({ id: e, action: t, result: a });
          break;
        }
      }
    } catch (o) {
      ((c) => {
        self.postMessage(c);
      })({ id: e, action: t, error: o });
    }
    var i;
  };
});
export default Ye();
