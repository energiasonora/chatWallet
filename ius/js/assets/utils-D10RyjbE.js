var Lt = (r, t) => () => (t || r((t = { exports: {} }).exports, t), t.exports);
var we = Lt((de, jt) => {
  class pt {
    static toI8Slice(t, e, _, s) {
      new Int8Array(t.buffer, _, s).set(e, 0);
    }
    static toI8Array(t, e, _, s) {
      const i = new Int8Array(t.buffer, e, _);
      s.set(i, 0);
    }
    static toI16Slice(t, e, _, s) {
      new Int16Array(t.buffer, _, s).set(e, 0);
    }
    static toI16Array(t, e, _, s) {
      const i = new Int16Array(t.buffer, e, _);
      s.set(i, 0);
    }
    static toI32Slice(t, e, _, s) {
      new Int32Array(t.buffer, _, s).set(e, 0);
    }
    static toI32Array(t, e, _, s) {
      const i = new Int32Array(t.buffer, e, _);
      s.set(i, 0);
    }
    static toU8Slice(t, e, _, s) {
      new Uint8Array(t.buffer, _, s).set(e, 0);
    }
    static toU8Array(t, e, _, s) {
      const i = new Uint8Array(t.buffer, e, _);
      s.set(i, 0);
    }
    static toU8CSlice(t, e, _, s) {
      new Uint8ClampedArray(t.buffer, _, s).set(e, 0);
    }
    static toU8CArray(t, e, _, s) {
      const i = new Uint8ClampedArray(t.buffer, e, _);
      s.set(i, 0);
    }
    static toU16Slice(t, e, _, s) {
      new Uint16Array(t.buffer, _, s).set(e, 0);
    }
    static toU16Array(t, e, _, s) {
      const i = new Uint16Array(t.buffer, e, _);
      s.set(i, 0);
    }
    static toU32Slice(t, e, _, s) {
      new Uint32Array(t.buffer, _, s).set(e, 0);
    }
    static toU32Array(t, e, _, s) {
      const i = new Uint32Array(t.buffer, e, _);
      s.set(i, 0);
    }
    static toF32Slice(t, e, _, s) {
      new Float32Array(t.buffer, _, s).set(e, 0);
    }
    static toF32Array(t, e, _, s) {
      const i = new Float32Array(t.buffer, e, _);
      s.set(i, 0);
    }
    static toF64Slice(t, e, _, s) {
      new Float64Array(t.buffer, _, s).set(e, 0);
    }
    static toF64Array(t, e, _, s) {
      const i = new Float64Array(t.buffer, e, _);
      s.set(i, 0);
    }
    static toBigInt64Slice(t, e, _, s) {
      new BigInt64Array(t.buffer, _, s).set(e, 0);
    }
    static toBigInt64Array(t, e, _, s) {
      const i = new BigInt64Array(t.buffer, e, _);
      s.set(i, 0);
    }
    static toBigUint64Slice(t, e, _, s) {
      new BigUint64Array(t.buffer, _, s).set(e, 0);
    }
    static toBigUint64Array(t, e, _, s) {
      const i = new BigUint64Array(t.buffer, e, _);
      s.set(i, 0);
    }
  }
  let n, j = null;
  function C() {
    return (j === null || j.byteLength === 0) && (j = new Uint8Array(n.memory.buffer)), j;
  }
  let G = typeof TextDecoder < "u" ? new TextDecoder("utf-8", { ignoreBOM: !0, fatal: !0 }) : { decode: () => {
    throw Error("TextDecoder not available");
  } };
  typeof TextDecoder < "u" && G.decode();
  const Wt = 2146435072;
  let V = 0;
  function Gt(r, t) {
    return V += t, V >= Wt && (G = typeof TextDecoder < "u" ? new TextDecoder("utf-8", { ignoreBOM: !0, fatal: !0 }) : { decode: () => {
      throw Error("TextDecoder not available");
    } }, G.decode(), V = t), G.decode(C().subarray(r, r + t));
  }
  function b(r, t) {
    return r = r >>> 0, Gt(r, t);
  }
  let c = 0;
  const H = typeof TextEncoder < "u" ? new TextEncoder("utf-8") : { encode: () => {
    throw Error("TextEncoder not available");
  } }, Ht = typeof H.encodeInto == "function" ? function(r, t) {
    return H.encodeInto(r, t);
  } : function(r, t) {
    const e = H.encode(r);
    return t.set(e), {
      read: r.length,
      written: e.length
    };
  };
  function g(r, t, e) {
    if (e === void 0) {
      const w = H.encode(r), f = t(w.length, 1) >>> 0;
      return C().subarray(f, f + w.length).set(w), c = w.length, f;
    }
    let _ = r.length, s = t(_, 1) >>> 0;
    const i = C();
    let a = 0;
    for (; a < _; a++) {
      const w = r.charCodeAt(a);
      if (w > 127) break;
      i[s + a] = w;
    }
    if (a !== _) {
      a !== 0 && (r = r.slice(a)), s = e(s, _, _ = a + r.length * 3, 1) >>> 0;
      const w = C().subarray(s + a, s + _), f = Ht(r, w);
      a += f.written, s = e(s, _, a, 1) >>> 0;
    }
    return c = a, s;
  }
  let A = null;
  function y() {
    return (A === null || A.buffer.detached === !0 || A.buffer.detached === void 0 && A.buffer !== n.memory.buffer) && (A = new DataView(n.memory.buffer)), A;
  }
  function S(r) {
    const t = n.__externref_table_alloc();
    return n.__wbindgen_export_4.set(t, r), t;
  }
  function u(r, t) {
    try {
      return r.apply(this, t);
    } catch (e) {
      const _ = S(e);
      n.__wbindgen_exn_store(_);
    }
  }
  function o(r) {
    return r == null;
  }
  function N(r, t) {
    return r = r >>> 0, C().subarray(r / 1, r / 1 + t);
  }
  function R(r, t) {
    r = r >>> 0;
    const e = y(), _ = [];
    for (let s = r; s < r + 4 * t; s += 4)
      _.push(n.__wbindgen_export_4.get(e.getUint32(s, !0)));
    return n.__externref_drop_slice(r, t), _;
  }
  const yt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => {
    n.__wbindgen_export_7.get(r.dtor)(r.a, r.b);
  });
  function K(r, t, e, _) {
    const s = { a: r, b: t, cnt: 1, dtor: e }, i = (...a) => {
      s.cnt++;
      const w = s.a;
      s.a = 0;
      try {
        return _(w, s.b, ...a);
      } finally {
        --s.cnt === 0 ? (n.__wbindgen_export_7.get(s.dtor)(w, s.b), yt.unregister(s)) : s.a = w;
      }
    };
    return i.original = s, yt.register(i, s, s), i;
  }
  function st(r) {
    const t = typeof r;
    if (t == "number" || t == "boolean" || r == null)
      return `${r}`;
    if (t == "string")
      return `"${r}"`;
    if (t == "symbol") {
      const s = r.description;
      return s == null ? "Symbol" : `Symbol(${s})`;
    }
    if (t == "function") {
      const s = r.name;
      return typeof s == "string" && s.length > 0 ? `Function(${s})` : "Function";
    }
    if (Array.isArray(r)) {
      const s = r.length;
      let i = "[";
      s > 0 && (i += st(r[0]));
      for (let a = 1; a < s; a++)
        i += ", " + st(r[a]);
      return i += "]", i;
    }
    const e = /\[object ([^\]]+)\]/.exec(toString.call(r));
    let _;
    if (e && e.length > 1)
      _ = e[1];
    else
      return toString.call(r);
    if (_ == "Object")
      try {
        return "Object(" + JSON.stringify(r) + ")";
      } catch {
        return "Object";
      }
    return r instanceof Error ? `${r.name}: ${r.message}
${r.stack}` : _;
  }
  function l(r, t) {
    if (!(r instanceof t))
      throw new Error(`expected instance of ${t.name}`);
  }
  function p(r, t) {
    const e = t(r.length * 4, 4) >>> 0;
    for (let _ = 0; _ < r.length; _++) {
      const s = S(r[_]);
      y().setUint32(e + 4 * _, s, !0);
    }
    return c = r.length, e;
  }
  function d(r) {
    const t = n.__wbindgen_export_4.get(r);
    return n.__externref_table_dealloc(r), t;
  }
  function Vt(r, t) {
    const e = g(r, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
    return n.getInboxIdForIdentifier(e, _, t);
  }
  function Kt(r) {
    let t, e;
    try {
      const i = n.generateInboxId(r);
      var _ = i[0], s = i[1];
      if (i[3])
        throw _ = 0, s = 0, d(i[2]);
      return t = _, e = s, b(_, s);
    } finally {
      n.__wbindgen_free(t, e, 1);
    }
  }
  function $t(r, t) {
    const e = g(r, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c, s = p(t, n.__wbindgen_malloc), i = c;
    return n.inboxStateFromInboxIds(e, _, s, i);
  }
  function Jt(r, t, e, _) {
    const s = g(r, n.__wbindgen_malloc, n.__wbindgen_realloc), i = c, a = g(e, n.__wbindgen_malloc, n.__wbindgen_realloc), w = c, f = p(_, n.__wbindgen_malloc), h = c;
    return n.revokeInstallationsSignatureRequest(s, i, t, a, w, f, h);
  }
  function Yt(r, t) {
    const e = g(r, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
    return l(t, D), n.applySignatureRequest(e, _, t.__wbg_ptr);
  }
  function Xt(r, t) {
    n.wasm_bindgen__convert__closures_____invoke__h231d11d7d151a506(r, t);
  }
  function Qt(r, t) {
    n.wasm_bindgen__convert__closures_____invoke__hfa5440517c90e88d(r, t);
  }
  function Zt(r, t, e) {
    n.closure5289_externref_shim(r, t, e);
  }
  function te(r, t, e, _) {
    n.closure6231_externref_shim(r, t, e, _);
  }
  const ee = ["default", "no-store", "reload", "no-cache", "force-cache", "only-if-cached"], ne = ["omit", "same-origin", "include"], _e = ["same-origin", "no-cors", "cors", "navigate"], ht = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_apistats_free(r >>> 0, 1));
  class it {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(it.prototype);
      return e.__wbg_ptr = t, ht.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, ht.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_apistats_free(t, 0);
    }
    /**
     * @returns {bigint}
     */
    get upload_key_package() {
      const t = n.__wbg_get_apistats_upload_key_package(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set upload_key_package(t) {
      n.__wbg_set_apistats_upload_key_package(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get fetch_key_package() {
      const t = n.__wbg_get_apistats_fetch_key_package(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set fetch_key_package(t) {
      n.__wbg_set_apistats_fetch_key_package(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get send_group_messages() {
      const t = n.__wbg_get_apistats_send_group_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set send_group_messages(t) {
      n.__wbg_set_apistats_send_group_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get send_welcome_messages() {
      const t = n.__wbg_get_apistats_send_welcome_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set send_welcome_messages(t) {
      n.__wbg_set_apistats_send_welcome_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get query_group_messages() {
      const t = n.__wbg_get_apistats_query_group_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set query_group_messages(t) {
      n.__wbg_set_apistats_query_group_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get query_welcome_messages() {
      const t = n.__wbg_get_apistats_query_welcome_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set query_welcome_messages(t) {
      n.__wbg_set_apistats_query_welcome_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get subscribe_messages() {
      const t = n.__wbg_get_apistats_subscribe_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set subscribe_messages(t) {
      n.__wbg_set_apistats_subscribe_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get subscribe_welcomes() {
      const t = n.__wbg_get_apistats_subscribe_welcomes(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set subscribe_welcomes(t) {
      n.__wbg_set_apistats_subscribe_welcomes(this.__wbg_ptr, t);
    }
  }
  const mt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_client_free(r >>> 0, 1));
  class ot {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(ot.prototype);
      return e.__wbg_ptr = t, mt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, mt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_client_free(t, 0);
    }
    /**
     * @returns {Identifier}
     */
    get accountIdentifier() {
      return n.client_accountIdentifier(this.__wbg_ptr);
    }
    /**
     * @returns {string}
     */
    get inboxId() {
      let t, e;
      try {
        const _ = n.client_inboxId(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @returns {boolean}
     */
    get isRegistered() {
      return n.client_isRegistered(this.__wbg_ptr) !== 0;
    }
    /**
     * @returns {string}
     */
    get installationId() {
      let t, e;
      try {
        const _ = n.client_installationId(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @returns {Uint8Array}
     */
    get installationIdBytes() {
      return n.client_installationIdBytes(this.__wbg_ptr);
    }
    /**
     * @returns {string}
     */
    get appVersion() {
      let t, e;
      try {
        const _ = n.client_appVersion(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @returns {string}
     */
    get libxmtpVersion() {
      let t, e;
      try {
        const _ = n.client_libxmtpVersion(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * Output booleans should be zipped with the index of input identifiers
     * @param {Identifier[]} account_identifiers
     * @returns {Promise<any>}
     */
    canMessage(t) {
      const e = p(t, n.__wbindgen_malloc), _ = c;
      return n.client_canMessage(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {Promise<void>}
     */
    sendSyncRequest() {
      return n.client_sendSyncRequest(this.__wbg_ptr);
    }
    /**
     * @param {Identifier} identifier
     * @returns {Promise<string | undefined>}
     */
    findInboxIdByIdentifier(t) {
      return n.client_findInboxIdByIdentifier(this.__wbg_ptr, t);
    }
    /**
     * @param {string[]} inbox_ids
     * @param {boolean} refresh_from_network
     * @returns {Promise<InboxState[]>}
     */
    inboxStateFromInboxIds(t, e) {
      const _ = p(t, n.__wbindgen_malloc), s = c;
      return n.client_inboxStateFromInboxIds(this.__wbg_ptr, _, s, e);
    }
    /**
     * @returns {Conversations}
     */
    conversations() {
      const t = n.client_conversations(this.__wbg_ptr);
      return gt.__wrap(t);
    }
    /**
     * @returns {Promise<number>}
     */
    syncPreferences() {
      return n.client_syncPreferences(this.__wbg_ptr);
    }
    /**
     * @returns {ApiStats}
     */
    apiStatistics() {
      const t = n.client_apiStatistics(this.__wbg_ptr);
      return it.__wrap(t);
    }
    /**
     * @returns {IdentityStats}
     */
    apiIdentityStatistics() {
      const t = n.client_apiIdentityStatistics(this.__wbg_ptr);
      return ut.__wrap(t);
    }
    /**
     * @returns {string}
     */
    apiAggregateStatistics() {
      let t, e;
      try {
        const _ = n.client_apiAggregateStatistics(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    clearAllStatistics() {
      n.client_clearAllStatistics(this.__wbg_ptr);
    }
    /**
     * @param {string} server_url
     * @returns {Promise<string>}
     */
    uploadDebugArchive(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      return n.client_uploadDebugArchive(this.__wbg_ptr, e, _);
    }
    /**
     * @param {Consent[]} records
     * @returns {Promise<void>}
     */
    setConsentStates(t) {
      const e = p(t, n.__wbindgen_malloc), _ = c;
      return n.client_setConsentStates(this.__wbg_ptr, e, _);
    }
    /**
     * @param {ConsentEntityType} entity_type
     * @param {string} entity
     * @returns {Promise<ConsentState>}
     */
    getConsentState(t, e) {
      const _ = g(e, n.__wbindgen_malloc, n.__wbindgen_realloc), s = c;
      return n.client_getConsentState(this.__wbg_ptr, t, _, s);
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
      return n.client_inboxState(this.__wbg_ptr, t);
    }
    /**
     * @param {string} inbox_id
     * @returns {Promise<InboxState>}
     */
    getLatestInboxState(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      return n.client_getLatestInboxState(this.__wbg_ptr, e, _);
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
      const e = p(t, n.__wbindgen_malloc), _ = c;
      return n.client_getKeyPackageStatusesForInstallationIds(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {SignatureRequestHandle | undefined}
     */
    createInboxSignatureRequest() {
      const t = n.client_createInboxSignatureRequest(this.__wbg_ptr);
      if (t[2])
        throw d(t[1]);
      return t[0] === 0 ? void 0 : D.__wrap(t[0]);
    }
    /**
     * @param {Identifier} new_identifier
     * @returns {Promise<SignatureRequestHandle>}
     */
    addWalletSignatureRequest(t) {
      return n.client_addWalletSignatureRequest(this.__wbg_ptr, t);
    }
    /**
     * @param {Identifier} identifier
     * @returns {Promise<SignatureRequestHandle>}
     */
    revokeWalletSignatureRequest(t) {
      return n.client_revokeWalletSignatureRequest(this.__wbg_ptr, t);
    }
    /**
     * @returns {Promise<SignatureRequestHandle>}
     */
    revokeAllOtherInstallationsSignatureRequest() {
      return n.client_revokeAllOtherInstallationsSignatureRequest(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array[]} installation_ids
     * @returns {Promise<SignatureRequestHandle>}
     */
    revokeInstallationsSignatureRequest(t) {
      const e = p(t, n.__wbindgen_malloc), _ = c;
      return n.client_revokeInstallationsSignatureRequest(this.__wbg_ptr, e, _);
    }
    /**
     * @param {Identifier} new_recovery_identifier
     * @returns {Promise<SignatureRequestHandle>}
     */
    changeRecoveryIdentifierSignatureRequest(t) {
      return n.client_changeRecoveryIdentifierSignatureRequest(this.__wbg_ptr, t);
    }
    /**
     * @param {SignatureRequestHandle} signature_request
     * @returns {Promise<void>}
     */
    applySignatureRequest(t) {
      return l(t, D), n.client_applySignatureRequest(this.__wbg_ptr, t.__wbg_ptr);
    }
    /**
     * @param {SignatureRequestHandle} signature_request
     * @returns {Promise<void>}
     */
    registerIdentity(t) {
      l(t, D);
      var e = t.__destroy_into_raw();
      return n.client_registerIdentity(this.__wbg_ptr, e);
    }
    /**
     * @param {string} signature_text
     * @returns {Uint8Array}
     */
    signWithInstallationKey(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c, s = n.client_signWithInstallationKey(this.__wbg_ptr, e, _);
      if (s[2])
        throw d(s[1]);
      return d(s[0]);
    }
    /**
     * @param {string} signature_text
     * @param {Uint8Array} signature_bytes
     */
    verifySignedWithInstallationKey(t, e) {
      const _ = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), s = c, i = n.client_verifySignedWithInstallationKey(this.__wbg_ptr, _, s, e);
      if (i[1])
        throw d(i[0]);
    }
  }
  const vt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_consent_free(r >>> 0, 1));
  class ct {
    static __unwrap(t) {
      return t instanceof ct ? t.__destroy_into_raw() : 0;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, vt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_consent_free(t, 0);
    }
    /**
     * @returns {ConsentEntityType}
     */
    get entityType() {
      return n.__wbg_get_consent_entityType(this.__wbg_ptr);
    }
    /**
     * @param {ConsentEntityType} arg0
     */
    set entityType(t) {
      n.__wbg_set_consent_entityType(this.__wbg_ptr, t);
    }
    /**
     * @returns {ConsentState}
     */
    get state() {
      return n.__wbg_get_consent_state(this.__wbg_ptr);
    }
    /**
     * @param {ConsentState} arg0
     */
    set state(t) {
      n.__wbg_set_consent_state(this.__wbg_ptr, t);
    }
    /**
     * @returns {string}
     */
    get entity() {
      let t, e;
      try {
        const _ = n.__wbg_get_consent_entity(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set entity(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_consent_entity(this.__wbg_ptr, e, _);
    }
    /**
     * @param {ConsentEntityType} entity_type
     * @param {ConsentState} state
     * @param {string} entity
     */
    constructor(t, e, _) {
      const s = g(_, n.__wbindgen_malloc, n.__wbindgen_realloc), i = c, a = n.consent_new(t, e, s, i);
      return this.__wbg_ptr = a >>> 0, vt.register(this, this.__wbg_ptr, this), this;
    }
  }
  const $ = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_contenttypeid_free(r >>> 0, 1));
  class E {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(E.prototype);
      return e.__wbg_ptr = t, $.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, $.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_contenttypeid_free(t, 0);
    }
    /**
     * @returns {string}
     */
    get authorityId() {
      let t, e;
      try {
        const _ = n.__wbg_get_contenttypeid_authorityId(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set authorityId(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_consent_entity(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {string}
     */
    get typeId() {
      let t, e;
      try {
        const _ = n.__wbg_get_contenttypeid_typeId(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set typeId(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_contenttypeid_typeId(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {number}
     */
    get versionMajor() {
      return n.__wbg_get_contenttypeid_versionMajor(this.__wbg_ptr) >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set versionMajor(t) {
      n.__wbg_set_contenttypeid_versionMajor(this.__wbg_ptr, t);
    }
    /**
     * @returns {number}
     */
    get versionMinor() {
      return n.__wbg_get_contenttypeid_versionMinor(this.__wbg_ptr) >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set versionMinor(t) {
      n.__wbg_set_contenttypeid_versionMinor(this.__wbg_ptr, t);
    }
    /**
     * @param {string} authority_id
     * @param {string} type_id
     * @param {number} version_major
     * @param {number} version_minor
     */
    constructor(t, e, _, s) {
      const i = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), a = c, w = g(e, n.__wbindgen_malloc, n.__wbindgen_realloc), f = c, h = n.contenttypeid_new(i, a, w, f, _, s);
      return this.__wbg_ptr = h >>> 0, $.register(this, this.__wbg_ptr, this), this;
    }
  }
  const It = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_conversation_free(r >>> 0, 1));
  class I {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(I.prototype);
      return e.__wbg_ptr = t, It.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, It.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_conversation_free(t, 0);
    }
    /**
     * @returns {ConsentState}
     */
    consentState() {
      const t = n.conversation_consentState(this.__wbg_ptr);
      if (t[2])
        throw d(t[1]);
      return t[0];
    }
    /**
     * @param {ConsentState} state
     */
    updateConsentState(t) {
      const e = n.conversation_updateConsentState(this.__wbg_ptr, t);
      if (e[1])
        throw d(e[0]);
    }
    /**
     * @returns {string}
     */
    id() {
      let t, e;
      try {
        const _ = n.conversation_id(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {EncodedContent} encoded_content
     * @returns {Promise<string>}
     */
    send(t) {
      l(t, k);
      var e = t.__destroy_into_raw();
      return n.conversation_send(this.__wbg_ptr, e);
    }
    /**
     * send a message without immediately publishing to the delivery service.
     * @param {EncodedContent} encoded_content
     * @returns {string}
     */
    sendOptimistic(t) {
      let e, _;
      try {
        l(t, k);
        var s = t.__destroy_into_raw();
        const w = n.conversation_sendOptimistic(this.__wbg_ptr, s);
        var i = w[0], a = w[1];
        if (w[3])
          throw i = 0, a = 0, d(w[2]);
        return e = i, _ = a, b(i, a);
      } finally {
        n.__wbindgen_free(e, _, 1);
      }
    }
    /**
     * Publish all unpublished messages
     * @returns {Promise<void>}
     */
    publishMessages() {
      return n.conversation_publishMessages(this.__wbg_ptr);
    }
    /**
     * @returns {Promise<void>}
     */
    sync() {
      return n.conversation_sync(this.__wbg_ptr);
    }
    /**
     * @param {ListMessagesOptions | null} [opts]
     * @returns {Promise<Message[]>}
     */
    findMessages(t) {
      let e = 0;
      return o(t) || (l(t, Bt), e = t.__destroy_into_raw()), n.conversation_findMessages(this.__wbg_ptr, e);
    }
    /**
     * @param {ListMessagesOptions | null} [opts]
     * @returns {Promise<MessageWithReactions[]>}
     */
    findMessagesWithReactions(t) {
      let e = 0;
      return o(t) || (l(t, Bt), e = t.__destroy_into_raw()), n.conversation_findMessagesWithReactions(this.__wbg_ptr, e);
    }
    /**
     * @returns {Promise<any>}
     */
    listMembers() {
      return n.conversation_listMembers(this.__wbg_ptr);
    }
    /**
     * @returns {string[]}
     */
    adminList() {
      const t = n.conversation_adminList(this.__wbg_ptr);
      if (t[3])
        throw d(t[2]);
      var e = R(t[0], t[1]).slice();
      return n.__wbindgen_free(t[0], t[1] * 4, 4), e;
    }
    /**
     * @returns {string[]}
     */
    superAdminList() {
      const t = n.conversation_superAdminList(this.__wbg_ptr);
      if (t[3])
        throw d(t[2]);
      var e = R(t[0], t[1]).slice();
      return n.__wbindgen_free(t[0], t[1] * 4, 4), e;
    }
    /**
     * @param {string} inbox_id
     * @returns {boolean}
     */
    isAdmin(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c, s = n.conversation_isAdmin(this.__wbg_ptr, e, _);
      if (s[2])
        throw d(s[1]);
      return s[0] !== 0;
    }
    /**
     * @param {string} inbox_id
     * @returns {boolean}
     */
    isSuperAdmin(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c, s = n.conversation_isSuperAdmin(this.__wbg_ptr, e, _);
      if (s[2])
        throw d(s[1]);
      return s[0] !== 0;
    }
    /**
     * @param {Identifier[]} account_identifiers
     * @returns {Promise<void>}
     */
    addMembers(t) {
      const e = p(t, n.__wbindgen_malloc), _ = c;
      return n.conversation_addMembers(this.__wbg_ptr, e, _);
    }
    /**
     * @param {string} inbox_id
     * @returns {Promise<void>}
     */
    addAdmin(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      return n.conversation_addAdmin(this.__wbg_ptr, e, _);
    }
    /**
     * @param {string} inbox_id
     * @returns {Promise<void>}
     */
    removeAdmin(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      return n.conversation_removeAdmin(this.__wbg_ptr, e, _);
    }
    /**
     * @param {string} inbox_id
     * @returns {Promise<void>}
     */
    addSuperAdmin(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      return n.conversation_addSuperAdmin(this.__wbg_ptr, e, _);
    }
    /**
     * @param {string} inbox_id
     * @returns {Promise<void>}
     */
    removeSuperAdmin(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      return n.conversation_removeSuperAdmin(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {GroupPermissions}
     */
    groupPermissions() {
      const t = n.conversation_groupPermissions(this.__wbg_ptr);
      if (t[2])
        throw d(t[1]);
      return wt.__wrap(t[0]);
    }
    /**
     * @param {string[]} inbox_ids
     * @returns {Promise<void>}
     */
    addMembersByInboxId(t) {
      const e = p(t, n.__wbindgen_malloc), _ = c;
      return n.conversation_addMembersByInboxId(this.__wbg_ptr, e, _);
    }
    /**
     * @param {Identifier[]} account_identifiers
     * @returns {Promise<void>}
     */
    removeMembers(t) {
      const e = p(t, n.__wbindgen_malloc), _ = c;
      return n.conversation_removeMembers(this.__wbg_ptr, e, _);
    }
    /**
     * @param {string[]} inbox_ids
     * @returns {Promise<void>}
     */
    removeMembersByInboxId(t) {
      const e = p(t, n.__wbindgen_malloc), _ = c;
      return n.conversation_removeMembersByInboxId(this.__wbg_ptr, e, _);
    }
    /**
     * @param {string} group_name
     * @returns {Promise<void>}
     */
    updateGroupName(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      return n.conversation_updateGroupName(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {string}
     */
    groupName() {
      let t, e;
      try {
        const i = n.conversation_groupName(this.__wbg_ptr);
        var _ = i[0], s = i[1];
        if (i[3])
          throw _ = 0, s = 0, d(i[2]);
        return t = _, e = s, b(_, s);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} group_image_url_square
     * @returns {Promise<void>}
     */
    updateGroupImageUrlSquare(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      return n.conversation_updateGroupImageUrlSquare(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {string}
     */
    groupImageUrlSquare() {
      let t, e;
      try {
        const i = n.conversation_groupImageUrlSquare(this.__wbg_ptr);
        var _ = i[0], s = i[1];
        if (i[3])
          throw _ = 0, s = 0, d(i[2]);
        return t = _, e = s, b(_, s);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} group_description
     * @returns {Promise<void>}
     */
    updateGroupDescription(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      return n.conversation_updateGroupDescription(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {string}
     */
    groupDescription() {
      let t, e;
      try {
        const i = n.conversation_groupDescription(this.__wbg_ptr);
        var _ = i[0], s = i[1];
        if (i[3])
          throw _ = 0, s = 0, d(i[2]);
        return t = _, e = s, b(_, s);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {any} callback
     * @returns {StreamCloser}
     */
    stream(t) {
      const e = n.conversation_stream(this.__wbg_ptr, t);
      if (e[2])
        throw d(e[1]);
      return z.__wrap(e[0]);
    }
    /**
     * @returns {bigint}
     */
    createdAtNs() {
      return n.conversation_createdAtNs(this.__wbg_ptr);
    }
    /**
     * @returns {boolean}
     */
    isActive() {
      const t = n.conversation_isActive(this.__wbg_ptr);
      if (t[2])
        throw d(t[1]);
      return t[0] !== 0;
    }
    /**
     * @returns {string | undefined}
     */
    pausedForVersion() {
      const t = n.conversation_pausedForVersion(this.__wbg_ptr);
      if (t[3])
        throw d(t[2]);
      let e;
      return t[0] !== 0 && (e = b(t[0], t[1]).slice(), n.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @returns {string}
     */
    addedByInboxId() {
      let t, e;
      try {
        const i = n.conversation_addedByInboxId(this.__wbg_ptr);
        var _ = i[0], s = i[1];
        if (i[3])
          throw _ = 0, s = 0, d(i[2]);
        return t = _, e = s, b(_, s);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @returns {Promise<GroupMetadata>}
     */
    groupMetadata() {
      return n.conversation_groupMetadata(this.__wbg_ptr);
    }
    /**
     * @returns {string}
     */
    dmPeerInboxId() {
      let t, e;
      try {
        const i = n.conversation_dmPeerInboxId(this.__wbg_ptr);
        var _ = i[0], s = i[1];
        if (i[3])
          throw _ = 0, s = 0, d(i[2]);
        return t = _, e = s, b(_, s);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {PermissionUpdateType} permission_update_type
     * @param {PermissionPolicy} permission_policy_option
     * @param {MetadataField | null} [metadata_field]
     * @returns {Promise<void>}
     */
    updatePermissionPolicy(t, e, _) {
      return n.conversation_updatePermissionPolicy(this.__wbg_ptr, t, e, o(_) ? 5 : _);
    }
    /**
     * @param {MessageDisappearingSettings} settings
     * @returns {Promise<void>}
     */
    updateMessageDisappearingSettings(t) {
      l(t, F);
      var e = t.__destroy_into_raw();
      return n.conversation_updateMessageDisappearingSettings(this.__wbg_ptr, e);
    }
    /**
     * @returns {Promise<void>}
     */
    removeMessageDisappearingSettings() {
      return n.conversation_removeMessageDisappearingSettings(this.__wbg_ptr);
    }
    /**
     * @returns {MessageDisappearingSettings | undefined}
     */
    messageDisappearingSettings() {
      const t = n.conversation_messageDisappearingSettings(this.__wbg_ptr);
      if (t[2])
        throw d(t[1]);
      return t[0] === 0 ? void 0 : F.__wrap(t[0]);
    }
    /**
     * @returns {boolean}
     */
    isMessageDisappearingEnabled() {
      const t = n.conversation_isMessageDisappearingEnabled(this.__wbg_ptr);
      if (t[2])
        throw d(t[1]);
      return t[0] !== 0;
    }
    /**
     * @returns {any}
     */
    getHmacKeys() {
      const t = n.conversation_getHmacKeys(this.__wbg_ptr);
      if (t[2])
        throw d(t[1]);
      return d(t[0]);
    }
    /**
     * @returns {Promise<any>}
     */
    getDebugInfo() {
      return n.conversation_getDebugInfo(this.__wbg_ptr);
    }
    /**
     * @returns {Promise<Conversation[]>}
     */
    findDuplicateDms() {
      return n.conversation_findDuplicateDms(this.__wbg_ptr);
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_conversationdebuginfo_free(r >>> 0, 1));
  const J = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_conversationlistitem_free(r >>> 0, 1));
  class at {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(at.prototype);
      return e.__wbg_ptr = t, J.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, J.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_conversationlistitem_free(t, 0);
    }
    /**
     * @returns {Conversation}
     */
    get conversation() {
      const t = n.__wbg_get_conversationlistitem_conversation(this.__wbg_ptr);
      return I.__wrap(t);
    }
    /**
     * @param {Conversation} arg0
     */
    set conversation(t) {
      l(t, I);
      var e = t.__destroy_into_raw();
      n.__wbg_set_conversationlistitem_conversation(this.__wbg_ptr, e);
    }
    /**
     * @returns {Message | undefined}
     */
    get lastMessage() {
      const t = n.__wbg_get_conversationlistitem_lastMessage(this.__wbg_ptr);
      return t === 0 ? void 0 : m.__wrap(t);
    }
    /**
     * @param {Message | null} [arg0]
     */
    set lastMessage(t) {
      let e = 0;
      o(t) || (l(t, m), e = t.__destroy_into_raw()), n.__wbg_set_conversationlistitem_lastMessage(this.__wbg_ptr, e);
    }
    /**
     * @returns {boolean | undefined}
     */
    get isCommitLogForked() {
      const t = n.__wbg_get_conversationlistitem_isCommitLogForked(this.__wbg_ptr);
      return t === 16777215 ? void 0 : t !== 0;
    }
    /**
     * @param {boolean | null} [arg0]
     */
    set isCommitLogForked(t) {
      n.__wbg_set_conversationlistitem_isCommitLogForked(this.__wbg_ptr, o(t) ? 16777215 : t ? 1 : 0);
    }
    /**
     * @param {Conversation} conversation
     * @param {Message | null} [last_message]
     * @param {boolean | null} [is_commit_log_forked]
     */
    constructor(t, e, _) {
      l(t, I);
      var s = t.__destroy_into_raw();
      let i = 0;
      o(e) || (l(e, m), i = e.__destroy_into_raw());
      const a = n.conversationlistitem_new(s, i, o(_) ? 16777215 : _ ? 1 : 0);
      return this.__wbg_ptr = a >>> 0, J.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Ft = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_conversations_free(r >>> 0, 1));
  class gt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(gt.prototype);
      return e.__wbg_ptr = t, Ft.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Ft.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_conversations_free(t, 0);
    }
    /**
     * @param {CreateGroupOptions | null} [options]
     * @returns {Conversation}
     */
    createGroupOptimistic(t) {
      let e = 0;
      o(t) || (l(t, Y), e = t.__destroy_into_raw());
      const _ = n.conversations_createGroupOptimistic(this.__wbg_ptr, e);
      if (_[2])
        throw d(_[1]);
      return I.__wrap(_[0]);
    }
    /**
     * @param {Identifier[]} account_identifiers
     * @param {CreateGroupOptions | null} [options]
     * @returns {Promise<Conversation>}
     */
    createGroup(t, e) {
      const _ = p(t, n.__wbindgen_malloc), s = c;
      let i = 0;
      return o(e) || (l(e, Y), i = e.__destroy_into_raw()), n.conversations_createGroup(this.__wbg_ptr, _, s, i);
    }
    /**
     * @param {string[]} inbox_ids
     * @param {CreateGroupOptions | null} [options]
     * @returns {Promise<Conversation>}
     */
    createGroupByInboxIds(t, e) {
      const _ = p(t, n.__wbindgen_malloc), s = c;
      let i = 0;
      return o(e) || (l(e, Y), i = e.__destroy_into_raw()), n.conversations_createGroupByInboxIds(this.__wbg_ptr, _, s, i);
    }
    /**
     * @param {Identifier} account_identifier
     * @param {CreateDMOptions | null} [options]
     * @returns {Promise<Conversation>}
     */
    createDm(t, e) {
      let _ = 0;
      return o(e) || (l(e, Rt), _ = e.__destroy_into_raw()), n.conversations_createDm(this.__wbg_ptr, t, _);
    }
    /**
     * @param {string} inbox_id
     * @param {CreateDMOptions | null} [options]
     * @returns {Promise<Conversation>}
     */
    createDmByInboxId(t, e) {
      const _ = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), s = c;
      let i = 0;
      return o(e) || (l(e, Rt), i = e.__destroy_into_raw()), n.conversations_createDmByInboxId(this.__wbg_ptr, _, s, i);
    }
    /**
     * @param {string} group_id
     * @returns {Conversation}
     */
    findGroupById(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c, s = n.conversations_findGroupById(this.__wbg_ptr, e, _);
      if (s[2])
        throw d(s[1]);
      return I.__wrap(s[0]);
    }
    /**
     * @param {string} target_inbox_id
     * @returns {Conversation}
     */
    findDmByTargetInboxId(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c, s = n.conversations_findDmByTargetInboxId(this.__wbg_ptr, e, _);
      if (s[2])
        throw d(s[1]);
      return I.__wrap(s[0]);
    }
    /**
     * @param {string} message_id
     * @returns {Message}
     */
    findMessageById(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c, s = n.conversations_findMessageById(this.__wbg_ptr, e, _);
      if (s[2])
        throw d(s[1]);
      return m.__wrap(s[0]);
    }
    /**
     * @returns {Promise<void>}
     */
    sync() {
      return n.conversations_sync(this.__wbg_ptr);
    }
    /**
     * @param {any[] | null} [consent_states]
     * @returns {Promise<number>}
     */
    syncAllConversations(t) {
      var e = o(t) ? 0 : p(t, n.__wbindgen_malloc), _ = c;
      return n.conversations_syncAllConversations(this.__wbg_ptr, e, _);
    }
    /**
     * @param {ListConversationsOptions | null} [opts]
     * @returns {Array<any>}
     */
    list(t) {
      let e = 0;
      o(t) || (l(t, re), e = t.__destroy_into_raw());
      const _ = n.conversations_list(this.__wbg_ptr, e);
      if (_[2])
        throw d(_[1]);
      return d(_[0]);
    }
    /**
     * @returns {any}
     */
    getHmacKeys() {
      const t = n.conversations_getHmacKeys(this.__wbg_ptr);
      if (t[2])
        throw d(t[1]);
      return d(t[0]);
    }
    /**
     * Returns a 'ReadableStream' of Conversations
     * @param {ConversationType | null} [conversation_type]
     * @returns {Promise<ReadableStream>}
     */
    streamLocal(t) {
      return n.conversations_streamLocal(this.__wbg_ptr, o(t) ? 4 : t);
    }
    /**
     * @param {any} callback
     * @param {ConversationType | null} [conversation_type]
     * @returns {StreamCloser}
     */
    stream(t, e) {
      const _ = n.conversations_stream(this.__wbg_ptr, t, o(e) ? 4 : e);
      if (_[2])
        throw d(_[1]);
      return z.__wrap(_[0]);
    }
    /**
     * @param {any} callback
     * @param {ConversationType | null} [conversation_type]
     * @param {any[] | null} [consent_states]
     * @returns {StreamCloser}
     */
    streamAllMessages(t, e, _) {
      var s = o(_) ? 0 : p(_, n.__wbindgen_malloc), i = c;
      const a = n.conversations_streamAllMessages(this.__wbg_ptr, t, o(e) ? 4 : e, s, i);
      if (a[2])
        throw d(a[1]);
      return z.__wrap(a[0]);
    }
    /**
     * @param {any} callback
     * @returns {StreamCloser}
     */
    streamConsent(t) {
      const e = n.conversations_streamConsent(this.__wbg_ptr, t);
      if (e[2])
        throw d(e[1]);
      return z.__wrap(e[0]);
    }
    /**
     * @param {any} callback
     * @returns {StreamCloser}
     */
    streamPreferences(t) {
      const e = n.conversations_streamPreferences(this.__wbg_ptr, t);
      if (e[2])
        throw d(e[1]);
      return z.__wrap(e[0]);
    }
  }
  const St = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_createdmoptions_free(r >>> 0, 1));
  class Rt {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, St.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_createdmoptions_free(t, 0);
    }
    /**
     * @returns {MessageDisappearingSettings | undefined}
     */
    get messageDisappearingSettings() {
      const t = n.__wbg_get_createdmoptions_messageDisappearingSettings(this.__wbg_ptr);
      return t === 0 ? void 0 : F.__wrap(t);
    }
    /**
     * @param {MessageDisappearingSettings | null} [arg0]
     */
    set messageDisappearingSettings(t) {
      let e = 0;
      o(t) || (l(t, F), e = t.__destroy_into_raw()), n.__wbg_set_createdmoptions_messageDisappearingSettings(this.__wbg_ptr, e);
    }
    /**
     * @param {MessageDisappearingSettings | null} [message_disappearing_settings]
     */
    constructor(t) {
      let e = 0;
      o(t) || (l(t, F), e = t.__destroy_into_raw());
      const _ = n.createdmoptions_new(e);
      return this.__wbg_ptr = _ >>> 0, St.register(this, this.__wbg_ptr, this), this;
    }
  }
  const xt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_creategroupoptions_free(r >>> 0, 1));
  class Y {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, xt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_creategroupoptions_free(t, 0);
    }
    /**
     * @returns {GroupPermissionsOptions | undefined}
     */
    get permissions() {
      const t = n.__wbg_get_creategroupoptions_permissions(this.__wbg_ptr);
      return t === 3 ? void 0 : t;
    }
    /**
     * @param {GroupPermissionsOptions | null} [arg0]
     */
    set permissions(t) {
      n.__wbg_set_creategroupoptions_permissions(this.__wbg_ptr, o(t) ? 3 : t);
    }
    /**
     * @returns {string | undefined}
     */
    get groupName() {
      const t = n.__wbg_get_creategroupoptions_groupName(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = b(t[0], t[1]).slice(), n.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @param {string | null} [arg0]
     */
    set groupName(t) {
      var e = o(t) ? 0 : g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_creategroupoptions_groupName(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {string | undefined}
     */
    get groupImageUrlSquare() {
      const t = n.__wbg_get_creategroupoptions_groupImageUrlSquare(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = b(t[0], t[1]).slice(), n.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @param {string | null} [arg0]
     */
    set groupImageUrlSquare(t) {
      var e = o(t) ? 0 : g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_creategroupoptions_groupImageUrlSquare(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {string | undefined}
     */
    get groupDescription() {
      const t = n.__wbg_get_creategroupoptions_groupDescription(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = b(t[0], t[1]).slice(), n.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @param {string | null} [arg0]
     */
    set groupDescription(t) {
      var e = o(t) ? 0 : g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_creategroupoptions_groupDescription(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {PermissionPolicySet | undefined}
     */
    get customPermissionPolicySet() {
      const t = n.__wbg_get_creategroupoptions_customPermissionPolicySet(this.__wbg_ptr);
      return t === 0 ? void 0 : U.__wrap(t);
    }
    /**
     * @param {PermissionPolicySet | null} [arg0]
     */
    set customPermissionPolicySet(t) {
      let e = 0;
      o(t) || (l(t, U), e = t.__destroy_into_raw()), n.__wbg_set_creategroupoptions_customPermissionPolicySet(this.__wbg_ptr, e);
    }
    /**
     * @returns {MessageDisappearingSettings | undefined}
     */
    get messageDisappearingSettings() {
      const t = n.__wbg_get_createdmoptions_messageDisappearingSettings(this.__wbg_ptr);
      return t === 0 ? void 0 : F.__wrap(t);
    }
    /**
     * @param {MessageDisappearingSettings | null} [arg0]
     */
    set messageDisappearingSettings(t) {
      let e = 0;
      o(t) || (l(t, F), e = t.__destroy_into_raw()), n.__wbg_set_createdmoptions_messageDisappearingSettings(this.__wbg_ptr, e);
    }
    /**
     * @param {GroupPermissionsOptions | null} [permissions]
     * @param {string | null} [group_name]
     * @param {string | null} [group_image_url_square]
     * @param {string | null} [group_description]
     * @param {PermissionPolicySet | null} [custom_permission_policy_set]
     * @param {MessageDisappearingSettings | null} [message_disappearing_settings]
     */
    constructor(t, e, _, s, i, a) {
      var w = o(e) ? 0 : g(e, n.__wbindgen_malloc, n.__wbindgen_realloc), f = c, h = o(_) ? 0 : g(_, n.__wbindgen_malloc, n.__wbindgen_realloc), v = c, x = o(s) ? 0 : g(s, n.__wbindgen_malloc, n.__wbindgen_realloc), P = c;
      let M = 0;
      o(i) || (l(i, U), M = i.__destroy_into_raw());
      let T = 0;
      o(a) || (l(a, F), T = a.__destroy_into_raw());
      const q = n.creategroupoptions_new(o(t) ? 3 : t, w, f, h, v, x, P, M, T);
      return this.__wbg_ptr = q >>> 0, xt.register(this, this.__wbg_ptr, this), this;
    }
  }
  const X = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_encodedcontent_free(r >>> 0, 1));
  class k {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(k.prototype);
      return e.__wbg_ptr = t, X.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, X.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_encodedcontent_free(t, 0);
    }
    /**
     * @returns {ContentTypeId | undefined}
     */
    get type() {
      const t = n.__wbg_get_encodedcontent_type(this.__wbg_ptr);
      return t === 0 ? void 0 : E.__wrap(t);
    }
    /**
     * @param {ContentTypeId | null} [arg0]
     */
    set type(t) {
      let e = 0;
      o(t) || (l(t, E), e = t.__destroy_into_raw()), n.__wbg_set_encodedcontent_type(this.__wbg_ptr, e);
    }
    /**
     * @returns {any}
     */
    get parameters() {
      return n.__wbg_get_encodedcontent_parameters(this.__wbg_ptr);
    }
    /**
     * @param {any} arg0
     */
    set parameters(t) {
      n.__wbg_set_encodedcontent_parameters(this.__wbg_ptr, t);
    }
    /**
     * @returns {string | undefined}
     */
    get fallback() {
      const t = n.__wbg_get_encodedcontent_fallback(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = b(t[0], t[1]).slice(), n.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @param {string | null} [arg0]
     */
    set fallback(t) {
      var e = o(t) ? 0 : g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_encodedcontent_fallback(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {number | undefined}
     */
    get compression() {
      const t = n.__wbg_get_encodedcontent_compression(this.__wbg_ptr);
      return t === 4294967297 ? void 0 : t;
    }
    /**
     * @param {number | null} [arg0]
     */
    set compression(t) {
      n.__wbg_set_encodedcontent_compression(this.__wbg_ptr, o(t) ? 4294967297 : t >> 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get content() {
      return n.__wbg_get_encodedcontent_content(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set content(t) {
      n.__wbg_set_encodedcontent_content(this.__wbg_ptr, t);
    }
    /**
     * @param {ContentTypeId | null | undefined} type
     * @param {any} parameters
     * @param {string | null | undefined} fallback
     * @param {number | null | undefined} compression
     * @param {Uint8Array} content
     */
    constructor(t, e, _, s, i) {
      let a = 0;
      o(t) || (l(t, E), a = t.__destroy_into_raw());
      var w = o(_) ? 0 : g(_, n.__wbindgen_malloc, n.__wbindgen_realloc), f = c;
      const h = n.encodedcontent_new(a, e, w, f, o(s) ? 4294967297 : s >> 0, i);
      return this.__wbg_ptr = h >>> 0, X.register(this, this.__wbg_ptr, this), this;
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_groupmember_free(r >>> 0, 1));
  const At = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_groupmetadata_free(r >>> 0, 1));
  class bt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(bt.prototype);
      return e.__wbg_ptr = t, At.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, At.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_groupmetadata_free(t, 0);
    }
    /**
     * @returns {string}
     */
    creatorInboxId() {
      let t, e;
      try {
        const _ = n.groupmetadata_creatorInboxId(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @returns {string}
     */
    conversationType() {
      let t, e;
      try {
        const _ = n.groupmetadata_conversationType(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
  }
  const zt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_grouppermissions_free(r >>> 0, 1));
  class wt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(wt.prototype);
      return e.__wbg_ptr = t, zt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, zt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_grouppermissions_free(t, 0);
    }
    /**
     * @returns {GroupPermissionsOptions}
     */
    policyType() {
      const t = n.grouppermissions_policyType(this.__wbg_ptr);
      if (t[2])
        throw d(t[1]);
      return t[0];
    }
    /**
     * @returns {PermissionPolicySet}
     */
    policySet() {
      const t = n.grouppermissions_policySet(this.__wbg_ptr);
      if (t[2])
        throw d(t[1]);
      return U.__wrap(t[0]);
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_hmackey_free(r >>> 0, 1));
  const kt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_identitystats_free(r >>> 0, 1));
  class ut {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(ut.prototype);
      return e.__wbg_ptr = t, kt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, kt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_identitystats_free(t, 0);
    }
    /**
     * @returns {bigint}
     */
    get publish_identity_update() {
      const t = n.__wbg_get_apistats_upload_key_package(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set publish_identity_update(t) {
      n.__wbg_set_apistats_upload_key_package(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get get_identity_updates_v2() {
      const t = n.__wbg_get_apistats_fetch_key_package(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set get_identity_updates_v2(t) {
      n.__wbg_set_apistats_fetch_key_package(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get get_inbox_ids() {
      const t = n.__wbg_get_apistats_send_group_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set get_inbox_ids(t) {
      n.__wbg_set_apistats_send_group_messages(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get verify_smart_contract_wallet_signature() {
      const t = n.__wbg_get_apistats_send_welcome_messages(this.__wbg_ptr);
      return BigInt.asUintN(64, t);
    }
    /**
     * @param {bigint} arg0
     */
    set verify_smart_contract_wallet_signature(t) {
      n.__wbg_set_apistats_send_welcome_messages(this.__wbg_ptr, t);
    }
  }
  const Q = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_inboxstate_free(r >>> 0, 1));
  class dt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(dt.prototype);
      return e.__wbg_ptr = t, Q.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Q.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_inboxstate_free(t, 0);
    }
    /**
     * @returns {string}
     */
    get inboxId() {
      let t, e;
      try {
        const _ = n.__wbg_get_inboxstate_inboxId(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set inboxId(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_consent_entity(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {Identifier}
     */
    get recoveryIdentifier() {
      return n.__wbg_get_inboxstate_recoveryIdentifier(this.__wbg_ptr);
    }
    /**
     * @param {Identifier} arg0
     */
    set recoveryIdentifier(t) {
      n.__wbg_set_inboxstate_recoveryIdentifier(this.__wbg_ptr, t);
    }
    /**
     * @returns {Installation[]}
     */
    get installations() {
      const t = n.__wbg_get_inboxstate_installations(this.__wbg_ptr);
      var e = R(t[0], t[1]).slice();
      return n.__wbindgen_free(t[0], t[1] * 4, 4), e;
    }
    /**
     * @param {Installation[]} arg0
     */
    set installations(t) {
      const e = p(t, n.__wbindgen_malloc), _ = c;
      n.__wbg_set_inboxstate_installations(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {Identifier[]}
     */
    get accountIdentifiers() {
      const t = n.__wbg_get_inboxstate_accountIdentifiers(this.__wbg_ptr);
      var e = R(t[0], t[1]).slice();
      return n.__wbindgen_free(t[0], t[1] * 4, 4), e;
    }
    /**
     * @param {Identifier[]} arg0
     */
    set accountIdentifiers(t) {
      const e = p(t, n.__wbindgen_malloc), _ = c;
      n.__wbg_set_inboxstate_accountIdentifiers(this.__wbg_ptr, e, _);
    }
    /**
     * @param {string} inbox_id
     * @param {Identifier} recovery_identifier
     * @param {Installation[]} installations
     * @param {Identifier[]} account_identifiers
     */
    constructor(t, e, _, s) {
      const i = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), a = c, w = p(_, n.__wbindgen_malloc), f = c, h = p(s, n.__wbindgen_malloc), v = c, x = n.inboxstate_new(i, a, e, w, f, h, v);
      return this.__wbg_ptr = x >>> 0, Q.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Z = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_installation_free(r >>> 0, 1));
  class L {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(L.prototype);
      return e.__wbg_ptr = t, Z.register(e, e.__wbg_ptr, e), e;
    }
    static __unwrap(t) {
      return t instanceof L ? t.__destroy_into_raw() : 0;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Z.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_installation_free(t, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get bytes() {
      return n.__wbg_get_installation_bytes(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set bytes(t) {
      n.__wbg_set_installation_bytes(this.__wbg_ptr, t);
    }
    /**
     * @returns {string}
     */
    get id() {
      let t, e;
      try {
        const _ = n.__wbg_get_installation_id(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set id(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_conversationdebuginfo_forkDetails(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {bigint | undefined}
     */
    get clientTimestampNs() {
      const t = n.__wbg_get_installation_clientTimestampNs(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : BigInt.asUintN(64, t[1]);
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set clientTimestampNs(t) {
      n.__wbg_set_installation_clientTimestampNs(this.__wbg_ptr, !o(t), o(t) ? BigInt(0) : t);
    }
    /**
     * @param {Uint8Array} bytes
     * @param {string} id
     * @param {bigint | null} [client_timestamp_ns]
     */
    constructor(t, e, _) {
      const s = g(e, n.__wbindgen_malloc, n.__wbindgen_realloc), i = c, a = n.installation_new(t, s, i, !o(_), o(_) ? BigInt(0) : _);
      return this.__wbg_ptr = a >>> 0, Z.register(this, this.__wbg_ptr, this), this;
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_intounderlyingbytesource_free(r >>> 0, 1));
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_intounderlyingsink_free(r >>> 0, 1));
  const Dt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_intounderlyingsource_free(r >>> 0, 1));
  class lt {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(lt.prototype);
      return e.__wbg_ptr = t, Dt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Dt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_intounderlyingsource_free(t, 0);
    }
    /**
     * @param {ReadableStreamDefaultController} controller
     * @returns {Promise<any>}
     */
    pull(t) {
      return n.intounderlyingsource_pull(this.__wbg_ptr, t);
    }
    cancel() {
      const t = this.__destroy_into_raw();
      n.intounderlyingsource_cancel(t);
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_keypackagestatus_free(r >>> 0, 1));
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_lifetime_free(r >>> 0, 1));
  const Mt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_listconversationsoptions_free(r >>> 0, 1));
  class re {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Mt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_listconversationsoptions_free(t, 0);
    }
    /**
     * @returns {any[] | undefined}
     */
    get consentStates() {
      const t = n.__wbg_get_listconversationsoptions_consentStates(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = R(t[0], t[1]).slice(), n.__wbindgen_free(t[0], t[1] * 4, 4)), e;
    }
    /**
     * @param {any[] | null} [arg0]
     */
    set consentStates(t) {
      var e = o(t) ? 0 : p(t, n.__wbindgen_malloc), _ = c;
      n.__wbg_set_listconversationsoptions_consentStates(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {ConversationType | undefined}
     */
    get conversationType() {
      const t = n.__wbg_get_listconversationsoptions_conversationType(this.__wbg_ptr);
      return t === 4 ? void 0 : t;
    }
    /**
     * @param {ConversationType | null} [arg0]
     */
    set conversationType(t) {
      n.__wbg_set_listconversationsoptions_conversationType(this.__wbg_ptr, o(t) ? 4 : t);
    }
    /**
     * @returns {bigint | undefined}
     */
    get createdAfterNs() {
      const t = n.__wbg_get_listconversationsoptions_createdAfterNs(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set createdAfterNs(t) {
      n.__wbg_set_installation_clientTimestampNs(this.__wbg_ptr, !o(t), o(t) ? BigInt(0) : t);
    }
    /**
     * @returns {bigint | undefined}
     */
    get createdBeforeNs() {
      const t = n.__wbg_get_listconversationsoptions_createdBeforeNs(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set createdBeforeNs(t) {
      n.__wbg_set_listconversationsoptions_createdBeforeNs(this.__wbg_ptr, !o(t), o(t) ? BigInt(0) : t);
    }
    /**
     * @returns {boolean | undefined}
     */
    get includeDuplicateDms() {
      const t = n.__wbg_get_listconversationsoptions_includeDuplicateDms(this.__wbg_ptr);
      return t === 16777215 ? void 0 : t !== 0;
    }
    /**
     * @param {boolean | null} [arg0]
     */
    set includeDuplicateDms(t) {
      n.__wbg_set_listconversationsoptions_includeDuplicateDms(this.__wbg_ptr, o(t) ? 16777215 : t ? 1 : 0);
    }
    /**
     * @returns {bigint | undefined}
     */
    get limit() {
      const t = n.__wbg_get_listconversationsoptions_limit(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set limit(t) {
      n.__wbg_set_listconversationsoptions_limit(this.__wbg_ptr, !o(t), o(t) ? BigInt(0) : t);
    }
    /**
     * @param {any[] | null} [consent_states]
     * @param {ConversationType | null} [conversation_type]
     * @param {bigint | null} [created_after_ns]
     * @param {bigint | null} [created_before_ns]
     * @param {boolean | null} [include_duplicate_dms]
     * @param {bigint | null} [limit]
     */
    constructor(t, e, _, s, i, a) {
      var w = o(t) ? 0 : p(t, n.__wbindgen_malloc), f = c;
      const h = n.listconversationsoptions_new(w, f, o(e) ? 4 : e, !o(_), o(_) ? BigInt(0) : _, !o(s), o(s) ? BigInt(0) : s, o(i) ? 16777215 : i ? 1 : 0, !o(a), o(a) ? BigInt(0) : a);
      return this.__wbg_ptr = h >>> 0, Mt.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Tt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_listmessagesoptions_free(r >>> 0, 1));
  class Bt {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Tt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_listmessagesoptions_free(t, 0);
    }
    /**
     * @returns {any[] | undefined}
     */
    get contentTypes() {
      const t = n.__wbg_get_listmessagesoptions_contentTypes(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = R(t[0], t[1]).slice(), n.__wbindgen_free(t[0], t[1] * 4, 4)), e;
    }
    /**
     * @param {any[] | null} [arg0]
     */
    set contentTypes(t) {
      var e = o(t) ? 0 : p(t, n.__wbindgen_malloc), _ = c;
      n.__wbg_set_listmessagesoptions_contentTypes(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {bigint | undefined}
     */
    get sentBeforeNs() {
      const t = n.__wbg_get_listmessagesoptions_sentBeforeNs(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set sentBeforeNs(t) {
      n.__wbg_set_installation_clientTimestampNs(this.__wbg_ptr, !o(t), o(t) ? BigInt(0) : t);
    }
    /**
     * @returns {bigint | undefined}
     */
    get sentAfterNs() {
      const t = n.__wbg_get_listmessagesoptions_sentAfterNs(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set sentAfterNs(t) {
      n.__wbg_set_listconversationsoptions_createdBeforeNs(this.__wbg_ptr, !o(t), o(t) ? BigInt(0) : t);
    }
    /**
     * @returns {bigint | undefined}
     */
    get limit() {
      const t = n.__wbg_get_listmessagesoptions_limit(this.__wbg_ptr);
      return t[0] === 0 ? void 0 : t[1];
    }
    /**
     * @param {bigint | null} [arg0]
     */
    set limit(t) {
      n.__wbg_set_listconversationsoptions_limit(this.__wbg_ptr, !o(t), o(t) ? BigInt(0) : t);
    }
    /**
     * @returns {DeliveryStatus | undefined}
     */
    get deliveryStatus() {
      const t = n.__wbg_get_listmessagesoptions_deliveryStatus(this.__wbg_ptr);
      return t === 3 ? void 0 : t;
    }
    /**
     * @param {DeliveryStatus | null} [arg0]
     */
    set deliveryStatus(t) {
      n.__wbg_set_listmessagesoptions_deliveryStatus(this.__wbg_ptr, o(t) ? 3 : t);
    }
    /**
     * @returns {SortDirection | undefined}
     */
    get direction() {
      const t = n.__wbg_get_listmessagesoptions_direction(this.__wbg_ptr);
      return t === 2 ? void 0 : t;
    }
    /**
     * @param {SortDirection | null} [arg0]
     */
    set direction(t) {
      n.__wbg_set_listmessagesoptions_direction(this.__wbg_ptr, o(t) ? 2 : t);
    }
    /**
     * @returns {GroupMessageKind | undefined}
     */
    get kind() {
      const t = n.__wbg_get_listmessagesoptions_kind(this.__wbg_ptr);
      return t === 2 ? void 0 : t;
    }
    /**
     * @param {GroupMessageKind | null} [arg0]
     */
    set kind(t) {
      n.__wbg_set_listmessagesoptions_kind(this.__wbg_ptr, o(t) ? 2 : t);
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
    constructor(t, e, _, s, i, a, w) {
      var f = o(a) ? 0 : p(a, n.__wbindgen_malloc), h = c;
      const v = n.listmessagesoptions_new(!o(t), o(t) ? BigInt(0) : t, !o(e), o(e) ? BigInt(0) : e, !o(_), o(_) ? BigInt(0) : _, o(s) ? 3 : s, o(i) ? 2 : i, f, h, o(w) ? 2 : w);
      return this.__wbg_ptr = v >>> 0, Tt.register(this, this.__wbg_ptr, this), this;
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_logoptions_free(r >>> 0, 1));
  const tt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_message_free(r >>> 0, 1));
  class m {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(m.prototype);
      return e.__wbg_ptr = t, tt.register(e, e.__wbg_ptr, e), e;
    }
    static __unwrap(t) {
      return t instanceof m ? t.__destroy_into_raw() : 0;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, tt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_message_free(t, 0);
    }
    /**
     * @returns {string}
     */
    get id() {
      let t, e;
      try {
        const _ = n.__wbg_get_message_id(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set id(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_message_id(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {bigint}
     */
    get sentAtNs() {
      return n.__wbg_get_conversationdebuginfo_epoch(this.__wbg_ptr);
    }
    /**
     * @param {bigint} arg0
     */
    set sentAtNs(t) {
      n.__wbg_set_conversationdebuginfo_epoch(this.__wbg_ptr, t);
    }
    /**
     * @returns {string}
     */
    get convoId() {
      let t, e;
      try {
        const _ = n.__wbg_get_message_convoId(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set convoId(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_message_convoId(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {string}
     */
    get senderInboxId() {
      let t, e;
      try {
        const _ = n.__wbg_get_message_senderInboxId(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set senderInboxId(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_message_senderInboxId(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {EncodedContent}
     */
    get content() {
      const t = n.__wbg_get_message_content(this.__wbg_ptr);
      return k.__wrap(t);
    }
    /**
     * @param {EncodedContent} arg0
     */
    set content(t) {
      l(t, k);
      var e = t.__destroy_into_raw();
      n.__wbg_set_message_content(this.__wbg_ptr, e);
    }
    /**
     * @returns {GroupMessageKind}
     */
    get kind() {
      return n.__wbg_get_message_kind(this.__wbg_ptr);
    }
    /**
     * @param {GroupMessageKind} arg0
     */
    set kind(t) {
      n.__wbg_set_message_kind(this.__wbg_ptr, t);
    }
    /**
     * @returns {DeliveryStatus}
     */
    get deliveryStatus() {
      return n.__wbg_get_message_deliveryStatus(this.__wbg_ptr);
    }
    /**
     * @param {DeliveryStatus} arg0
     */
    set deliveryStatus(t) {
      n.__wbg_set_message_deliveryStatus(this.__wbg_ptr, t);
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
    constructor(t, e, _, s, i, a, w) {
      const f = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), h = c, v = g(_, n.__wbindgen_malloc, n.__wbindgen_realloc), x = c, P = g(s, n.__wbindgen_malloc, n.__wbindgen_realloc), M = c;
      l(i, k);
      var T = i.__destroy_into_raw();
      const q = n.message_new(f, h, e, v, x, P, M, T, a, w);
      return this.__wbg_ptr = q >>> 0, tt.register(this, this.__wbg_ptr, this), this;
    }
  }
  const et = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_messagedisappearingsettings_free(r >>> 0, 1));
  class F {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(F.prototype);
      return e.__wbg_ptr = t, et.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, et.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_messagedisappearingsettings_free(t, 0);
    }
    /**
     * @returns {bigint}
     */
    get fromNs() {
      return n.__wbg_get_conversationdebuginfo_epoch(this.__wbg_ptr);
    }
    /**
     * @param {bigint} arg0
     */
    set fromNs(t) {
      n.__wbg_set_conversationdebuginfo_epoch(this.__wbg_ptr, t);
    }
    /**
     * @returns {bigint}
     */
    get inNs() {
      return n.__wbg_get_conversationdebuginfo_cursor(this.__wbg_ptr);
    }
    /**
     * @param {bigint} arg0
     */
    set inNs(t) {
      n.__wbg_set_conversationdebuginfo_cursor(this.__wbg_ptr, t);
    }
    /**
     * @param {bigint} from_ns
     * @param {bigint} in_ns
     */
    constructor(t, e) {
      const _ = n.messagedisappearingsettings_new(t, e);
      return this.__wbg_ptr = _ >>> 0, et.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Ut = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_messagewithreactions_free(r >>> 0, 1));
  class ft {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(ft.prototype);
      return e.__wbg_ptr = t, Ut.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Ut.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_messagewithreactions_free(t, 0);
    }
    /**
     * @returns {Message}
     */
    get message() {
      const t = n.__wbg_get_messagewithreactions_message(this.__wbg_ptr);
      return m.__wrap(t);
    }
    /**
     * @param {Message} arg0
     */
    set message(t) {
      l(t, m);
      var e = t.__destroy_into_raw();
      n.__wbg_set_messagewithreactions_message(this.__wbg_ptr, e);
    }
    /**
     * @returns {Message[]}
     */
    get reactions() {
      const t = n.__wbg_get_messagewithreactions_reactions(this.__wbg_ptr);
      var e = R(t[0], t[1]).slice();
      return n.__wbindgen_free(t[0], t[1] * 4, 4), e;
    }
    /**
     * @param {Message[]} arg0
     */
    set reactions(t) {
      const e = p(t, n.__wbindgen_malloc), _ = c;
      n.__wbg_set_messagewithreactions_reactions(this.__wbg_ptr, e, _);
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_multiremoteattachment_free(r >>> 0, 1));
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_opfs_free(r >>> 0, 1));
  const se = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_passkeysignature_free(r >>> 0, 1));
  class ie {
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, se.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_passkeysignature_free(t, 0);
    }
  }
  const nt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_permissionpolicyset_free(r >>> 0, 1));
  class U {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(U.prototype);
      return e.__wbg_ptr = t, nt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, nt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_permissionpolicyset_free(t, 0);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get addMemberPolicy() {
      return n.__wbg_get_permissionpolicyset_addMemberPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set addMemberPolicy(t) {
      n.__wbg_set_permissionpolicyset_addMemberPolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get removeMemberPolicy() {
      return n.__wbg_get_permissionpolicyset_removeMemberPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set removeMemberPolicy(t) {
      n.__wbg_set_permissionpolicyset_removeMemberPolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get addAdminPolicy() {
      return n.__wbg_get_permissionpolicyset_addAdminPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set addAdminPolicy(t) {
      n.__wbg_set_permissionpolicyset_addAdminPolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get removeAdminPolicy() {
      return n.__wbg_get_permissionpolicyset_removeAdminPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set removeAdminPolicy(t) {
      n.__wbg_set_permissionpolicyset_removeAdminPolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get updateGroupNamePolicy() {
      return n.__wbg_get_permissionpolicyset_updateGroupNamePolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set updateGroupNamePolicy(t) {
      n.__wbg_set_permissionpolicyset_updateGroupNamePolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get updateGroupDescriptionPolicy() {
      return n.__wbg_get_permissionpolicyset_updateGroupDescriptionPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set updateGroupDescriptionPolicy(t) {
      n.__wbg_set_permissionpolicyset_updateGroupDescriptionPolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get updateGroupImageUrlSquarePolicy() {
      return n.__wbg_get_permissionpolicyset_updateGroupImageUrlSquarePolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set updateGroupImageUrlSquarePolicy(t) {
      n.__wbg_set_permissionpolicyset_updateGroupImageUrlSquarePolicy(this.__wbg_ptr, t);
    }
    /**
     * @returns {PermissionPolicy}
     */
    get updateMessageDisappearingPolicy() {
      return n.__wbg_get_permissionpolicyset_updateMessageDisappearingPolicy(this.__wbg_ptr);
    }
    /**
     * @param {PermissionPolicy} arg0
     */
    set updateMessageDisappearingPolicy(t) {
      n.__wbg_set_permissionpolicyset_updateMessageDisappearingPolicy(this.__wbg_ptr, t);
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
    constructor(t, e, _, s, i, a, w, f) {
      const h = n.permissionpolicyset_new(t, e, _, s, i, a, w, f);
      return this.__wbg_ptr = h >>> 0, nt.register(this, this.__wbg_ptr, this), this;
    }
  }
  typeof FinalizationRegistry > "u" || new FinalizationRegistry((r) => n.__wbg_reaction_free(r >>> 0, 1));
  const _t = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_remoteattachmentinfo_free(r >>> 0, 1));
  class W {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(W.prototype);
      return e.__wbg_ptr = t, _t.register(e, e.__wbg_ptr, e), e;
    }
    static __unwrap(t) {
      return t instanceof W ? t.__destroy_into_raw() : 0;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, _t.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_remoteattachmentinfo_free(t, 0);
    }
    /**
     * @returns {Uint8Array}
     */
    get secret() {
      return n.__wbg_get_remoteattachmentinfo_secret(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set secret(t) {
      n.__wbg_set_remoteattachmentinfo_secret(this.__wbg_ptr, t);
    }
    /**
     * @returns {string}
     */
    get contentDigest() {
      let t, e;
      try {
        const _ = n.__wbg_get_remoteattachmentinfo_contentDigest(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set contentDigest(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_remoteattachmentinfo_contentDigest(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {Uint8Array}
     */
    get nonce() {
      return n.__wbg_get_remoteattachmentinfo_nonce(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set nonce(t) {
      n.__wbg_set_remoteattachmentinfo_nonce(this.__wbg_ptr, t);
    }
    /**
     * @returns {string}
     */
    get scheme() {
      let t, e;
      try {
        const _ = n.__wbg_get_remoteattachmentinfo_scheme(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set scheme(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_remoteattachmentinfo_scheme(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {string}
     */
    get url() {
      let t, e;
      try {
        const _ = n.__wbg_get_remoteattachmentinfo_url(this.__wbg_ptr);
        return t = _[0], e = _[1], b(_[0], _[1]);
      } finally {
        n.__wbindgen_free(t, e, 1);
      }
    }
    /**
     * @param {string} arg0
     */
    set url(t) {
      const e = g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_conversationdebuginfo_localCommitLog(this.__wbg_ptr, e, _);
    }
    /**
     * @returns {Uint8Array}
     */
    get salt() {
      return n.__wbg_get_remoteattachmentinfo_salt(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} arg0
     */
    set salt(t) {
      n.__wbg_set_remoteattachmentinfo_salt(this.__wbg_ptr, t);
    }
    /**
     * @returns {number | undefined}
     */
    get contentLength() {
      const t = n.__wbg_get_remoteattachmentinfo_contentLength(this.__wbg_ptr);
      return t === 4294967297 ? void 0 : t;
    }
    /**
     * @param {number | null} [arg0]
     */
    set contentLength(t) {
      n.__wbg_set_remoteattachmentinfo_contentLength(this.__wbg_ptr, o(t) ? 4294967297 : t >>> 0);
    }
    /**
     * @returns {string | undefined}
     */
    get filename() {
      const t = n.__wbg_get_remoteattachmentinfo_filename(this.__wbg_ptr);
      let e;
      return t[0] !== 0 && (e = b(t[0], t[1]).slice(), n.__wbindgen_free(t[0], t[1] * 1, 1)), e;
    }
    /**
     * @param {string | null} [arg0]
     */
    set filename(t) {
      var e = o(t) ? 0 : g(t, n.__wbindgen_malloc, n.__wbindgen_realloc), _ = c;
      n.__wbg_set_remoteattachmentinfo_filename(this.__wbg_ptr, e, _);
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
    constructor(t, e, _, s, i, a, w, f) {
      const h = g(e, n.__wbindgen_malloc, n.__wbindgen_realloc), v = c, x = g(s, n.__wbindgen_malloc, n.__wbindgen_realloc), P = c, M = g(i, n.__wbindgen_malloc, n.__wbindgen_realloc), T = c;
      var q = o(f) ? 0 : g(f, n.__wbindgen_malloc, n.__wbindgen_realloc), Ct = c;
      const Et = n.remoteattachmentinfo_new(t, h, v, _, x, P, M, T, a, o(w) ? 4294967297 : w >>> 0, q, Ct);
      return this.__wbg_ptr = Et >>> 0, _t.register(this, this.__wbg_ptr, this), this;
    }
  }
  const Pt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_signaturerequesthandle_free(r >>> 0, 1));
  class D {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(D.prototype);
      return e.__wbg_ptr = t, Pt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, Pt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_signaturerequesthandle_free(t, 0);
    }
    /**
     * @returns {Promise<string>}
     */
    signatureText() {
      return n.signaturerequesthandle_signatureText(this.__wbg_ptr);
    }
    /**
     * @param {Uint8Array} signature_bytes
     * @returns {Promise<void>}
     */
    addEcdsaSignature(t) {
      return n.signaturerequesthandle_addEcdsaSignature(this.__wbg_ptr, t);
    }
    /**
     * @param {PasskeySignature} signature
     * @returns {Promise<void>}
     */
    addPasskeySignature(t) {
      l(t, ie);
      var e = t.__destroy_into_raw();
      return n.signaturerequesthandle_addPasskeySignature(this.__wbg_ptr, e);
    }
    /**
     * @param {Identifier} account_identifier
     * @param {Uint8Array} signature_bytes
     * @param {bigint} chain_id
     * @param {bigint | null} [block_number]
     * @returns {Promise<void>}
     */
    addScwSignature(t, e, _, s) {
      return n.signaturerequesthandle_addScwSignature(this.__wbg_ptr, t, e, _, !o(s), o(s) ? BigInt(0) : s);
    }
  }
  const qt = typeof FinalizationRegistry > "u" ? { register: () => {
  }, unregister: () => {
  } } : new FinalizationRegistry((r) => n.__wbg_streamcloser_free(r >>> 0, 1));
  class z {
    static __wrap(t) {
      t = t >>> 0;
      const e = Object.create(z.prototype);
      return e.__wbg_ptr = t, qt.register(e, e.__wbg_ptr, e), e;
    }
    __destroy_into_raw() {
      const t = this.__wbg_ptr;
      return this.__wbg_ptr = 0, qt.unregister(this), t;
    }
    free() {
      const t = this.__destroy_into_raw();
      n.__wbg_streamcloser_free(t, 0);
    }
    /**
     * Signal the stream to end
     * Does not wait for the stream to end.
     */
    end() {
      n.streamcloser_end(this.__wbg_ptr);
    }
    /**
     * End the stream and `await` for it to shutdown
     * Returns the `Result` of the task.
     * End the stream and asynchronously wait for it to shutdown
     * @returns {Promise<void>}
     */
    endAndWait() {
      return n.streamcloser_endAndWait(this.__wbg_ptr);
    }
    /**
     * @returns {Promise<void>}
     */
    waitForReady() {
      return n.streamcloser_waitForReady(this.__wbg_ptr);
    }
    /**
     * Checks if this stream is closed
     * @returns {boolean}
     */
    isClosed() {
      return n.streamcloser_isClosed(this.__wbg_ptr) !== 0;
    }
  }
  const oe = /* @__PURE__ */ new Set(["basic", "cors", "default"]);
  async function ce(r, t) {
    if (typeof Response == "function" && r instanceof Response) {
      if (typeof WebAssembly.instantiateStreaming == "function")
        try {
          return await WebAssembly.instantiateStreaming(r, t);
        } catch (_) {
          if (r.ok && oe.has(r.type) && r.headers.get("Content-Type") !== "application/wasm")
            console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", _);
          else
            throw _;
        }
      const e = await r.arrayBuffer();
      return await WebAssembly.instantiate(e, t);
    } else {
      const e = await WebAssembly.instantiate(r, t);
      return e instanceof WebAssembly.Instance ? { instance: e, module: r } : e;
    }
  }
  function ae() {
    const r = {};
    return r.wbg = {}, r.wbg.__wbg_Error_0497d5bdba9362e5 = function(t, e) {
      return Error(b(t, e));
    }, r.wbg.__wbg_String_8f0eb39a4a4c2f66 = function(t, e) {
      const _ = String(e), s = g(_, n.__wbindgen_malloc, n.__wbindgen_realloc), i = c;
      y().setInt32(t + 4, i, !0), y().setInt32(t + 0, s, !0);
    }, r.wbg.__wbg_abort_18ba44d46e13d7fe = function(t) {
      t.abort();
    }, r.wbg.__wbg_abort_4198a1129c47f21a = function(t, e) {
      t.abort(e);
    }, r.wbg.__wbg_add_dd833f9f523abe36 = function(t, e) {
      return t.add(e);
    }, r.wbg.__wbg_append_0342728346e47425 = function() {
      return u(function(t, e, _, s, i) {
        t.append(b(e, _), b(s, i));
      }, arguments);
    }, r.wbg.__wbg_arrayBuffer_d58b858456021d7f = function() {
      return u(function(t) {
        return t.arrayBuffer();
      }, arguments);
    }, r.wbg.__wbg_body_e1e045c770257634 = function(t) {
      const e = t.body;
      return o(e) ? 0 : S(e);
    }, r.wbg.__wbg_buffer_a1a27a0dfa70165d = function(t) {
      return t.buffer;
    }, r.wbg.__wbg_buffer_e495ba54cee589cc = function(t) {
      return t.buffer;
    }, r.wbg.__wbg_byobRequest_56aa768ee4dfed17 = function(t) {
      const e = t.byobRequest;
      return o(e) ? 0 : S(e);
    }, r.wbg.__wbg_byteLength_937f8a52f9697148 = function(t) {
      return t.byteLength;
    }, r.wbg.__wbg_byteOffset_4d94b7170e641898 = function(t) {
      return t.byteOffset;
    }, r.wbg.__wbg_call_f2db6205e5c51dc8 = function() {
      return u(function(t, e, _) {
        return t.call(e, _);
      }, arguments);
    }, r.wbg.__wbg_call_fbe8be8bf6436ce5 = function() {
      return u(function(t, e) {
        return t.call(e);
      }, arguments);
    }, r.wbg.__wbg_cancel_4d78160f447bbbeb = function(t) {
      return t.cancel();
    }, r.wbg.__wbg_catch_b51fce253ee18ec3 = function(t, e) {
      return t.catch(e);
    }, r.wbg.__wbg_clearInterval_dd1e598f425db353 = function(t) {
      return clearInterval(t);
    }, r.wbg.__wbg_clearTimeout_5a54f8841c30079a = function(t) {
      return clearTimeout(t);
    }, r.wbg.__wbg_clearTimeout_6222fede17abcb1a = function(t) {
      return clearTimeout(t);
    }, r.wbg.__wbg_clear_1657d083d00a480f = function(t) {
      t.clear();
    }, r.wbg.__wbg_clear_1da67706bfcd76cf = function(t) {
      t.clear();
    }, r.wbg.__wbg_client_new = function(t) {
      return ot.__wrap(t);
    }, r.wbg.__wbg_close_290fb040af98d3ac = function() {
      return u(function(t) {
        t.close();
      }, arguments);
    }, r.wbg.__wbg_close_8d9e72339b45f6f5 = function(t) {
      t.close();
    }, r.wbg.__wbg_close_b2641ef0870e518c = function() {
      return u(function(t) {
        t.close();
      }, arguments);
    }, r.wbg.__wbg_code_5e459ca721f994f5 = function(t) {
      return t.code;
    }, r.wbg.__wbg_consent_unwrap = function(t) {
      return ct.__unwrap(t);
    }, r.wbg.__wbg_conversation_new = function(t) {
      return I.__wrap(t);
    }, r.wbg.__wbg_conversationlistitem_new = function(t) {
      return at.__wrap(t);
    }, r.wbg.__wbg_createSyncAccessHandle_05df52d90910c9ce = function(t) {
      return t.createSyncAccessHandle();
    }, r.wbg.__wbg_create_f3f7c1f0898ceb7c = function(t) {
      return Object.create(t);
    }, r.wbg.__wbg_crypto_574e78ad8b13b65f = function(t) {
      return t.crypto;
    }, r.wbg.__wbg_debug_103948ed4c500577 = function(t, e, _, s) {
      console.debug(t, e, _, s);
    }, r.wbg.__wbg_debug_58d16ea352cfbca1 = function(t) {
      console.debug(t);
    }, r.wbg.__wbg_delete_8f0ad80b15b2a784 = function(t, e) {
      return t.delete(e);
    }, r.wbg.__wbg_delete_aca203d8b0528d61 = function(t, e) {
      return t.delete(e);
    }, r.wbg.__wbg_done_4d01f352bade43b7 = function(t) {
      return t.done;
    }, r.wbg.__wbg_enqueue_a62faa171c4fd287 = function() {
      return u(function(t, e) {
        t.enqueue(e);
      }, arguments);
    }, r.wbg.__wbg_entries_14bb5b0fa29e7393 = function(t) {
      return t.entries();
    }, r.wbg.__wbg_entries_41651c850143b957 = function(t) {
      return Object.entries(t);
    }, r.wbg.__wbg_error_51ecdd39ec054205 = function(t) {
      console.error(t);
    }, r.wbg.__wbg_error_624160881466fd69 = function(t, e, _, s) {
      console.error(t, e, _, s);
    }, r.wbg.__wbg_error_7534b8e9a36f1ab4 = function(t, e) {
      let _, s;
      try {
        _ = t, s = e, console.error(b(t, e));
      } finally {
        n.__wbindgen_free(_, s, 1);
      }
    }, r.wbg.__wbg_error_e98c298703cffa97 = function(t, e) {
      console.error(b(t, e));
    }, r.wbg.__wbg_fetch_a8e43a4e138dfc93 = function(t, e) {
      return t.fetch(e);
    }, r.wbg.__wbg_fetch_f156d10be9a5c88a = function(t) {
      return fetch(t);
    }, r.wbg.__wbg_fill_45ebe6f76c6747c9 = function(t, e, _, s) {
      return t.fill(e, _ >>> 0, s >>> 0);
    }, r.wbg.__wbg_flush_f0630e40db922730 = function() {
      return u(function(t) {
        t.flush();
      }, arguments);
    }, r.wbg.__wbg_from_12ff8e47307bd4c7 = function(t) {
      return Array.from(t);
    }, r.wbg.__wbg_getDate_18ccd9a4e925d3ec = function(t) {
      return t.getDate();
    }, r.wbg.__wbg_getDay_17f53c92a7986053 = function(t) {
      return t.getDay();
    }, r.wbg.__wbg_getDirectoryHandle_812e88ca933e7f14 = function(t, e, _, s) {
      return t.getDirectoryHandle(b(e, _), s);
    }, r.wbg.__wbg_getDirectory_d1926c6af50076e5 = function(t) {
      return t.getDirectory();
    }, r.wbg.__wbg_getFileHandle_1cc9e8420629773c = function(t, e, _, s) {
      return t.getFileHandle(b(e, _), s);
    }, r.wbg.__wbg_getFullYear_1383a5751fab658e = function(t) {
      return t.getFullYear();
    }, r.wbg.__wbg_getHours_94bc6bb5540c2b71 = function(t) {
      return t.getHours();
    }, r.wbg.__wbg_getMinutes_92b2aadc8feb898e = function(t) {
      return t.getMinutes();
    }, r.wbg.__wbg_getMonth_f83b359dffd5f2aa = function(t) {
      return t.getMonth();
    }, r.wbg.__wbg_getRandomValues_3c9c0d586e575a16 = function() {
      return u(function(t, e) {
        globalThis.crypto.getRandomValues(N(t, e));
      }, arguments);
    }, r.wbg.__wbg_getRandomValues_8e6341dd77432a34 = function() {
      return u(function(t, e) {
        globalThis.crypto.getRandomValues(N(t, e));
      }, arguments);
    }, r.wbg.__wbg_getRandomValues_b8f5dbd5f3995a9e = function() {
      return u(function(t, e) {
        t.getRandomValues(e);
      }, arguments);
    }, r.wbg.__wbg_getReader_48e00749fe3f6089 = function() {
      return u(function(t) {
        return t.getReader();
      }, arguments);
    }, r.wbg.__wbg_getSeconds_5bedd376f55ef40c = function(t) {
      return t.getSeconds();
    }, r.wbg.__wbg_getSize_a77eeeffdb4f3fc1 = function() {
      return u(function(t) {
        return t.getSize();
      }, arguments);
    }, r.wbg.__wbg_getTime_2afe67905d873e92 = function(t) {
      return t.getTime();
    }, r.wbg.__wbg_getTimezoneOffset_31f33c0868da345e = function(t) {
      return t.getTimezoneOffset();
    }, r.wbg.__wbg_getUint32_b1236319485e7707 = function(t, e) {
      return t.getUint32(e >>> 0);
    }, r.wbg.__wbg_get_6dd1850282dd8588 = function(t, e) {
      return t.get(e);
    }, r.wbg.__wbg_get_92470be87867c2e5 = function() {
      return u(function(t, e) {
        return Reflect.get(t, e);
      }, arguments);
    }, r.wbg.__wbg_get_a131a44bd1eb6979 = function(t, e) {
      return t[e >>> 0];
    }, r.wbg.__wbg_getdone_8355ddb2bc75c731 = function(t) {
      const e = t.done;
      return o(e) ? 16777215 : e ? 1 : 0;
    }, r.wbg.__wbg_getindex_ba5b3525ad80a881 = function(t, e) {
      return t[e >>> 0];
    }, r.wbg.__wbg_getvalue_c1890a401d13f00b = function(t) {
      return t.value;
    }, r.wbg.__wbg_getwithrefkey_1dc361bd10053bfe = function(t, e) {
      return t[e];
    }, r.wbg.__wbg_groupmetadata_new = function(t) {
      return bt.__wrap(t);
    }, r.wbg.__wbg_has_2dc42f1e8cb156db = function(t, e) {
      return t.has(e);
    }, r.wbg.__wbg_has_809e438ee9d787a7 = function() {
      return u(function(t, e) {
        return Reflect.has(t, e);
      }, arguments);
    }, r.wbg.__wbg_headers_0f0cbdc6290b6780 = function(t) {
      return t.headers;
    }, r.wbg.__wbg_inboxstate_new = function(t) {
      return dt.__wrap(t);
    }, r.wbg.__wbg_info_a1cc312ecc877319 = function(t, e, _, s) {
      console.info(t, e, _, s);
    }, r.wbg.__wbg_info_e56933705c348038 = function(t) {
      console.info(t);
    }, r.wbg.__wbg_installation_new = function(t) {
      return L.__wrap(t);
    }, r.wbg.__wbg_installation_unwrap = function(t) {
      return L.__unwrap(t);
    }, r.wbg.__wbg_instanceof_ArrayBuffer_a8b6f580b363f2bc = function(t) {
      let e;
      try {
        e = t instanceof ArrayBuffer;
      } catch {
        e = !1;
      }
      return e;
    }, r.wbg.__wbg_instanceof_DomException_77720ed8752d7409 = function(t) {
      let e;
      try {
        e = t instanceof DOMException;
      } catch {
        e = !1;
      }
      return e;
    }, r.wbg.__wbg_instanceof_Performance_7c58d8187744b0a5 = function(t) {
      let e;
      try {
        e = t instanceof Performance;
      } catch {
        e = !1;
      }
      return e;
    }, r.wbg.__wbg_instanceof_Response_e80ce8b7a2b968d2 = function(t) {
      let e;
      try {
        e = t instanceof Response;
      } catch {
        e = !1;
      }
      return e;
    }, r.wbg.__wbg_instanceof_Uint8Array_ca460677bc155827 = function(t) {
      let e;
      try {
        e = t instanceof Uint8Array;
      } catch {
        e = !1;
      }
      return e;
    }, r.wbg.__wbg_instanceof_WorkerGlobalScope_11f8a14c11024785 = function(t) {
      let e;
      try {
        e = t instanceof WorkerGlobalScope;
      } catch {
        e = !1;
      }
      return e;
    }, r.wbg.__wbg_iterator_4068add5b2aef7a6 = function() {
      return Symbol.iterator;
    }, r.wbg.__wbg_keys_1abdc63a39dab939 = function(t) {
      return t.keys();
    }, r.wbg.__wbg_keys_a89709494b6fd863 = function(t) {
      return t.keys();
    }, r.wbg.__wbg_length_0ca5b4c83d5d9721 = function(t) {
      return t.length;
    }, r.wbg.__wbg_length_ab6d22b5ead75c72 = function(t) {
      return t.length;
    }, r.wbg.__wbg_length_f00ec12454a5d9fd = function(t) {
      return t.length;
    }, r.wbg.__wbg_mark_05056c522bddc362 = function() {
      return u(function(t, e, _) {
        t.mark(b(e, _));
      }, arguments);
    }, r.wbg.__wbg_mark_24a1a597f4f00679 = function() {
      return u(function(t, e, _, s) {
        t.mark(b(e, _), s);
      }, arguments);
    }, r.wbg.__wbg_measure_0b7379f5cfacac6d = function() {
      return u(function(t, e, _, s, i, a, w) {
        t.measure(b(e, _), b(s, i), b(a, w));
      }, arguments);
    }, r.wbg.__wbg_measure_7728846525e2cced = function() {
      return u(function(t, e, _, s) {
        t.measure(b(e, _), s);
      }, arguments);
    }, r.wbg.__wbg_message_2d95ea5aff0d63b9 = function(t, e) {
      const _ = e.message, s = g(_, n.__wbindgen_malloc, n.__wbindgen_realloc), i = c;
      y().setInt32(t + 4, i, !0), y().setInt32(t + 0, s, !0);
    }, r.wbg.__wbg_message_new = function(t) {
      return m.__wrap(t);
    }, r.wbg.__wbg_message_unwrap = function(t) {
      return m.__unwrap(t);
    }, r.wbg.__wbg_messagewithreactions_new = function(t) {
      return ft.__wrap(t);
    }, r.wbg.__wbg_msCrypto_a61aeb35a24c1329 = function(t) {
      return t.msCrypto;
    }, r.wbg.__wbg_name_2acff1e83d9735f9 = function(t, e) {
      const _ = e.name, s = g(_, n.__wbindgen_malloc, n.__wbindgen_realloc), i = c;
      y().setInt32(t + 4, i, !0), y().setInt32(t + 0, s, !0);
    }, r.wbg.__wbg_navigator_6db993f5ffeb46be = function(t) {
      return t.navigator;
    }, r.wbg.__wbg_new0_97314565408dea38 = function() {
      return /* @__PURE__ */ new Date();
    }, r.wbg.__wbg_new_07b483f72211fd66 = function() {
      return new Object();
    }, r.wbg.__wbg_new_186abcfdff244e42 = function() {
      return u(function() {
        return new AbortController();
      }, arguments);
    }, r.wbg.__wbg_new_476169e6d59f23ae = function(t, e) {
      return new Error(b(t, e));
    }, r.wbg.__wbg_new_4796e1cd2eb9ea6d = function() {
      return u(function() {
        return new Headers();
      }, arguments);
    }, r.wbg.__wbg_new_5069c49f18141a33 = function(t, e, _) {
      return new DataView(t, e >>> 0, _ >>> 0);
    }, r.wbg.__wbg_new_58353953ad2097cc = function() {
      return new Array();
    }, r.wbg.__wbg_new_8a6f238a6ece86ea = function() {
      return new Error();
    }, r.wbg.__wbg_new_a2957aa5684de228 = function(t) {
      return new Date(t);
    }, r.wbg.__wbg_new_a979b4b45bd55c7f = function() {
      return /* @__PURE__ */ new Map();
    }, r.wbg.__wbg_new_db7d9b0ee94df522 = function(t) {
      return new Set(t);
    }, r.wbg.__wbg_new_e30c39c06edaabf2 = function(t, e) {
      try {
        var _ = { a: t, b: e }, s = (a, w) => {
          const f = _.a;
          _.a = 0;
          try {
            return te(f, _.b, a, w);
          } finally {
            _.a = f;
          }
        };
        return new Promise(s);
      } finally {
        _.a = _.b = 0;
      }
    }, r.wbg.__wbg_new_e52b3efaaa774f96 = function(t) {
      return new Uint8Array(t);
    }, r.wbg.__wbg_newfromslice_7c05ab1297cb2d88 = function(t, e) {
      return new Uint8Array(N(t, e));
    }, r.wbg.__wbg_newnoargs_ff528e72d35de39a = function(t, e) {
      return new Function(b(t, e));
    }, r.wbg.__wbg_newwithbyteoffsetandlength_3b01ecda099177e8 = function(t, e, _) {
      return new Uint8Array(t, e >>> 0, _ >>> 0);
    }, r.wbg.__wbg_newwithintounderlyingsource_b47f6a6a596a7f24 = function(t, e) {
      return new ReadableStream(lt.__wrap(t), e);
    }, r.wbg.__wbg_newwithlength_08f872dc1e3ada2e = function(t) {
      return new Uint8Array(t >>> 0);
    }, r.wbg.__wbg_newwithstrandinit_f8a9dbe009d6be37 = function() {
      return u(function(t, e, _) {
        return new Request(b(t, e), _);
      }, arguments);
    }, r.wbg.__wbg_newwithyearmonthday_eb1c560e7c1fb22a = function(t, e, _) {
      return new Date(t >>> 0, e, _);
    }, r.wbg.__wbg_next_8bb824d217961b5d = function(t) {
      return t.next;
    }, r.wbg.__wbg_next_9eb6fe77da3db3a2 = function() {
      return u(function(t) {
        return t.next();
      }, arguments);
    }, r.wbg.__wbg_next_e2da48d8fff7439a = function() {
      return u(function(t) {
        return t.next();
      }, arguments);
    }, r.wbg.__wbg_node_905d3e251edff8a2 = function(t) {
      return t.node;
    }, r.wbg.__wbg_now_2c95c9de01293173 = function(t) {
      return t.now();
    }, r.wbg.__wbg_now_2f0bbf3fd348701f = function(t) {
      const e = globalThis.performance.now();
      y().setFloat64(t + 8, o(e) ? 0 : e, !0), y().setInt32(t + 0, !o(e), !0);
    }, r.wbg.__wbg_now_7ab37f05ab2d0b81 = function(t) {
      return t.now();
    }, r.wbg.__wbg_now_eb0821f3bd9f6529 = function() {
      return Date.now();
    }, r.wbg.__wbg_onclose_fc9ecf0f4698d22b = function(t) {
      t.on_close();
    }, r.wbg.__wbg_onconsentupdate_fcb6000671002c88 = function(t, e) {
      t.on_consent_update(e);
    }, r.wbg.__wbg_onconversation_d35f29b8b01106b4 = function(t, e) {
      t.on_conversation(I.__wrap(e));
    }, r.wbg.__wbg_onerror_30f14bdbe9fb242d = function(t, e) {
      t.on_error(e);
    }, r.wbg.__wbg_onmessage_9df605f3979a0f9b = function(t, e) {
      t.on_message(m.__wrap(e));
    }, r.wbg.__wbg_onuserpreferenceupdate_9bf50ba273851047 = function(t, e, _) {
      var s = R(e, _).slice();
      n.__wbindgen_free(e, _ * 4, 4), t.on_user_preference_update(s);
    }, r.wbg.__wbg_performance_121b9855d716e029 = function() {
      return globalThis.performance;
    }, r.wbg.__wbg_performance_7a3ffd0b17f663ad = function(t) {
      return t.performance;
    }, r.wbg.__wbg_postMessage_54ce7f4b41ac732e = function() {
      return u(function(t, e) {
        t.postMessage(e);
      }, arguments);
    }, r.wbg.__wbg_process_dc0fbacc7c1c06f7 = function(t) {
      return t.process;
    }, r.wbg.__wbg_push_73fd7b5550ebf707 = function(t, e) {
      return t.push(e);
    }, r.wbg.__wbg_queueMicrotask_46c1df247678729f = function(t) {
      queueMicrotask(t);
    }, r.wbg.__wbg_queueMicrotask_8acf3ccb75ed8d11 = function(t) {
      return t.queueMicrotask;
    }, r.wbg.__wbg_randomFillSync_ac0988aba3254290 = function() {
      return u(function(t, e) {
        t.randomFillSync(e);
      }, arguments);
    }, r.wbg.__wbg_random_210bb7fbfa33591d = function() {
      return Math.random();
    }, r.wbg.__wbg_read_4dbc5a78288c4eed = function() {
      return u(function(t, e, _, s) {
        return t.read(N(e, _), s);
      }, arguments);
    }, r.wbg.__wbg_read_8eb30fc4016403e0 = function() {
      return u(function(t, e, _) {
        return t.read(e, _);
      }, arguments);
    }, r.wbg.__wbg_read_f4b89f69cc51efc7 = function(t) {
      return t.read();
    }, r.wbg.__wbg_releaseLock_c589dd51c0812aca = function(t) {
      t.releaseLock();
    }, r.wbg.__wbg_remoteattachmentinfo_new = function(t) {
      return W.__wrap(t);
    }, r.wbg.__wbg_remoteattachmentinfo_unwrap = function(t) {
      return W.__unwrap(t);
    }, r.wbg.__wbg_removeEntry_ddd726e5b0218482 = function(t, e, _) {
      return t.removeEntry(b(e, _));
    }, r.wbg.__wbg_require_60cc747a6bc5215a = function() {
      return u(function() {
        return jt.require;
      }, arguments);
    }, r.wbg.__wbg_resolve_0dac8c580ffd4678 = function(t) {
      return Promise.resolve(t);
    }, r.wbg.__wbg_respond_b227f1c3be2bb879 = function() {
      return u(function(t, e) {
        t.respond(e >>> 0);
      }, arguments);
    }, r.wbg.__wbg_setInterval_ed3b5e3c3ebb8a6d = function() {
      return u(function(t, e) {
        return setInterval(t, e);
      }, arguments);
    }, r.wbg.__wbg_setTimeout_2b339866a2aa3789 = function(t, e) {
      return setTimeout(t, e);
    }, r.wbg.__wbg_setTimeout_8f06012fba12034e = function(t, e) {
      globalThis.setTimeout(t, e);
    }, r.wbg.__wbg_setTimeout_db2dbaeefb6f39c7 = function() {
      return u(function(t, e) {
        return setTimeout(t, e);
      }, arguments);
    }, r.wbg.__wbg_setUint32_909f117d6d6c4344 = function(t, e, _) {
      t.setUint32(e >>> 0, _ >>> 0);
    }, r.wbg.__wbg_set_3f1d0b984ed272ed = function(t, e, _) {
      t[e] = _;
    }, r.wbg.__wbg_set_7422acbe992d64ab = function(t, e, _) {
      t[e >>> 0] = _;
    }, r.wbg.__wbg_set_c43293f93a35998a = function() {
      return u(function(t, e, _) {
        return Reflect.set(t, e, _);
      }, arguments);
    }, r.wbg.__wbg_set_d6bdfd275fb8a4ce = function(t, e, _) {
      return t.set(e, _);
    }, r.wbg.__wbg_set_fe4e79d1ed3b0e9b = function(t, e, _) {
      t.set(e, _ >>> 0);
    }, r.wbg.__wbg_setat_2d0d9be3db4207a9 = function(t, e) {
      t.at = e;
    }, r.wbg.__wbg_setbody_971ec015fc13d6b4 = function(t, e) {
      t.body = e;
    }, r.wbg.__wbg_setcache_a94cd14dc0cc72a2 = function(t, e) {
      t.cache = ee[e];
    }, r.wbg.__wbg_setcreate_62b7d997a9936969 = function(t, e) {
      t.create = e !== 0;
    }, r.wbg.__wbg_setcreate_dcf97058ed33f8f0 = function(t, e) {
      t.create = e !== 0;
    }, r.wbg.__wbg_setcredentials_920d91fb5984c94a = function(t, e) {
      t.credentials = ne[e];
    }, r.wbg.__wbg_setheaders_65a4eb4c0443ae61 = function(t, e) {
      t.headers = e;
    }, r.wbg.__wbg_sethighwatermark_3017ad772d071dcb = function(t, e) {
      t.highWaterMark = e;
    }, r.wbg.__wbg_setmethod_8ce1be0b4d701b7c = function(t, e, _) {
      t.method = b(e, _);
    }, r.wbg.__wbg_setmode_bd35f026f55b6247 = function(t, e) {
      t.mode = _e[e];
    }, r.wbg.__wbg_setsignal_8e72abfe7ee03c97 = function(t, e) {
      t.signal = e;
    }, r.wbg.__wbg_signal_b96223519a041faa = function(t) {
      return t.signal;
    }, r.wbg.__wbg_signaturerequesthandle_new = function(t) {
      return D.__wrap(t);
    }, r.wbg.__wbg_size_e6e036b6b1285ed9 = function(t) {
      return t.size;
    }, r.wbg.__wbg_slice_3b17e1df768365f2 = function(t, e, _) {
      return t.slice(e >>> 0, _ >>> 0);
    }, r.wbg.__wbg_stack_0ed75d68575b0f3c = function(t, e) {
      const _ = e.stack, s = g(_, n.__wbindgen_malloc, n.__wbindgen_realloc), i = c;
      y().setInt32(t + 4, i, !0), y().setInt32(t + 0, s, !0);
    }, r.wbg.__wbg_static_accessor_GLOBAL_487c52c58d65314d = function() {
      const t = typeof global > "u" ? null : global;
      return o(t) ? 0 : S(t);
    }, r.wbg.__wbg_static_accessor_GLOBAL_THIS_ee9704f328b6b291 = function() {
      const t = typeof globalThis > "u" ? null : globalThis;
      return o(t) ? 0 : S(t);
    }, r.wbg.__wbg_static_accessor_SELF_78c9e3071b912620 = function() {
      const t = typeof self > "u" ? null : self;
      return o(t) ? 0 : S(t);
    }, r.wbg.__wbg_static_accessor_WINDOW_a093d21393777366 = function() {
      const t = (() => {
        const e = typeof window < "u" ? window : typeof self < "u" ? self : null;
        return console.log("[XMTP-WASM] WINDOW=", e?.constructor?.name ?? "null", "navigator.storage=", e?.navigator?.storage), e;
      })();
      return o(t) ? 0 : S(t);
    }, r.wbg.__wbg_status_a54682bbe52f9058 = function(t) {
      return t.status;
    }, r.wbg.__wbg_storage_52b923037fa3d04c = function(t) {
      return t.storage;
    }, r.wbg.__wbg_stringify_c242842b97f054cc = function() {
      return u(function(t) {
        return JSON.stringify(t);
      }, arguments);
    }, r.wbg.__wbg_subarray_dd4ade7d53bd8e26 = function(t, e, _) {
      return t.subarray(e >>> 0, _ >>> 0);
    }, r.wbg.__wbg_text_ec0e22f60e30dd2f = function() {
      return u(function(t) {
        return t.text();
      }, arguments);
    }, r.wbg.__wbg_then_82ab9fb4080f1707 = function(t, e, _) {
      return t.then(e, _);
    }, r.wbg.__wbg_then_db882932c0c714c6 = function(t, e) {
      return t.then(e);
    }, r.wbg.__wbg_toString_e2fd3ab0d7a3919b = function() {
      return u(function(t, e) {
        return t.toString(e);
      }, arguments);
    }, r.wbg.__wbg_toU8Array_7fa7fb3ae8554ad0 = function(t, e, _, s) {
      pt.toU8Array(t, e >>> 0, _ >>> 0, s);
    }, r.wbg.__wbg_toU8Slice_11519abfa5176ae4 = function(t, e, _, s) {
      pt.toU8Slice(t, e, _ >>> 0, s >>> 0);
    }, r.wbg.__wbg_truncate_015f5d17c33dc013 = function() {
      return u(function(t, e) {
        t.truncate(e);
      }, arguments);
    }, r.wbg.__wbg_truncate_1b4fd52305f619d7 = function() {
      return u(function(t, e) {
        t.truncate(e >>> 0);
      }, arguments);
    }, r.wbg.__wbg_url_e6ed869ea05b7a71 = function(t, e) {
      const _ = e.url, s = g(_, n.__wbindgen_malloc, n.__wbindgen_realloc), i = c;
      y().setInt32(t + 4, i, !0), y().setInt32(t + 0, s, !0);
    }, r.wbg.__wbg_value_17b896954e14f896 = function(t) {
      return t.value;
    }, r.wbg.__wbg_versions_c01dfd4722a88165 = function(t) {
      return t.versions;
    }, r.wbg.__wbg_view_a9ad80dcbad7cf1c = function(t) {
      const e = t.view;
      return o(e) ? 0 : S(e);
    }, r.wbg.__wbg_warn_90607373221a6b1c = function(t, e, _, s) {
      console.warn(t, e, _, s);
    }, r.wbg.__wbg_warn_d89f6637da554c8d = function(t) {
      console.warn(t);
    }, r.wbg.__wbg_write_0afe3c9463f48fc5 = function() {
      return u(function(t, e, _) {
        return t.write(e, _);
      }, arguments);
    }, r.wbg.__wbg_write_20973b686f7a7721 = function() {
      return u(function(t, e, _, s) {
        return t.write(N(e, _), s);
      }, arguments);
    }, r.wbg.__wbindgen_array_new = function() {
      return [];
    }, r.wbg.__wbindgen_array_push = function(t, e) {
      t.push(e);
    }, r.wbg.__wbindgen_bigint_from_i64 = function(t) {
      return t;
    }, r.wbg.__wbindgen_bigint_from_u64 = function(t) {
      return BigInt.asUintN(64, t);
    }, r.wbg.__wbindgen_boolean_get = function(t) {
      const e = t;
      return typeof e == "boolean" ? e ? 1 : 0 : 2;
    }, r.wbg.__wbindgen_cb_drop = function(t) {
      const e = t.original;
      return e.cnt-- == 1 ? (e.a = 0, !0) : !1;
    }, r.wbg.__wbindgen_closure_wrapper20664 = function(t, e, _) {
      return K(t, e, 5008, Xt);
    }, r.wbg.__wbindgen_closure_wrapper22834 = function(t, e, _) {
      return K(t, e, 5275, Qt);
    }, r.wbg.__wbindgen_closure_wrapper23463 = function(t, e, _) {
      return K(t, e, 5288, Zt);
    }, r.wbg.__wbindgen_debug_string = function(t, e) {
      const _ = st(e), s = g(_, n.__wbindgen_malloc, n.__wbindgen_realloc), i = c;
      y().setInt32(t + 4, i, !0), y().setInt32(t + 0, s, !0);
    }, r.wbg.__wbindgen_in = function(t, e) {
      return t in e;
    }, r.wbg.__wbindgen_init_externref_table = function() {
      const t = n.__wbindgen_export_4, e = t.grow(4);
      t.set(0, void 0), t.set(e + 0, void 0), t.set(e + 1, null), t.set(e + 2, !0), t.set(e + 3, !1);
    }, r.wbg.__wbindgen_is_function = function(t) {
      return typeof t == "function";
    }, r.wbg.__wbindgen_is_object = function(t) {
      const e = t;
      return typeof e == "object" && e !== null;
    }, r.wbg.__wbindgen_is_string = function(t) {
      return typeof t == "string";
    }, r.wbg.__wbindgen_is_undefined = function(t) {
      return t === void 0;
    }, r.wbg.__wbindgen_jsval_loose_eq = function(t, e) {
      return t == e;
    }, r.wbg.__wbindgen_memory = function() {
      return n.memory;
    }, r.wbg.__wbindgen_number_get = function(t, e) {
      const _ = e, s = typeof _ == "number" ? _ : void 0;
      y().setFloat64(t + 8, o(s) ? 0 : s, !0), y().setInt32(t + 0, !o(s), !0);
    }, r.wbg.__wbindgen_number_new = function(t) {
      return t;
    }, r.wbg.__wbindgen_string_get = function(t, e) {
      const _ = e, s = typeof _ == "string" ? _ : void 0;
      var i = o(s) ? 0 : g(s, n.__wbindgen_malloc, n.__wbindgen_realloc), a = c;
      y().setInt32(t + 4, a, !0), y().setInt32(t + 0, i, !0);
    }, r.wbg.__wbindgen_string_new = function(t, e) {
      return b(t, e);
    }, r.wbg.__wbindgen_throw = function(t, e) {
      throw new Error(b(t, e));
    }, r.wbg.__wbindgen_try_into_number = function(t) {
      let e;
      try {
        e = +t;
      } catch (s) {
        e = s;
      }
      return e;
    }, r;
  }
  function ge(r, t) {
    return n = r.exports, Ot.__wbindgen_wasm_module = t, A = null, j = null, n.__wbindgen_start(), n;
  }
  async function Ot(r) {
    if (n !== void 0) return n;
    typeof r < "u" && (Object.getPrototypeOf(r) === Object.prototype ? { module_or_path: r } = r : console.warn("using deprecated parameters for the initialization function; pass a single object instead")), typeof r > "u" && (r = new URL("/js/assets/bindings_wasm_bg.wasm", self.location.href));
    const t = ae();
    (typeof r == "string" || typeof Request == "function" && r instanceof Request || typeof URL == "function" && r instanceof URL) && (r = fetch(r));
    const { instance: e, module: _ } = await ce(await r, t);
    return ge(e, _);
  }
  const O = { local: "http://localhost:5555", dev: "https://dev.xmtp.network", production: "https://production.xmtp.network" }, be = (r) => ({ bytes: r.bytes, clientTimestampNs: r.clientTimestampNs, id: r.id }), rt = /* @__PURE__ */ new Map(), B = (r) => {
    self.postMessage(r);
  };
  let Nt = !1;
  self.onmessage = async (r) => {
    const { action: t, id: e, data: _ } = r.data;
    Nt && console.log("utils worker received event data", r.data), await Ot();
    try {
      switch (t) {
        case "utils.init":
          Nt = _.enableLogging, B({ id: e, action: t, result: void 0 });
          break;
        case "utils.generateInboxId": {
          const s = Kt(_.identifier);
          B({ id: e, action: t, result: s });
          break;
        }
        case "utils.getInboxIdForIdentifier": {
          const s = await (async (i, a) => Vt(a ? O[a] : O.dev, i))(_.identifier, _.env);
          B({ id: e, action: t, result: s });
          break;
        }
        case "utils.revokeInstallationsSignatureText": {
          const s = O[_.env ?? "dev"], i = await Jt(s, _.identifier, _.inboxId, _.installationIds), a = await i.signatureText();
          rt.set(_.signatureRequestId, i);
          const w = { signatureText: a, signatureRequestId: _.signatureRequestId };
          B({ id: e, action: t, result: w });
          break;
        }
        case "utils.revokeInstallations": {
          const s = O[_.env ?? "dev"], i = rt.get(_.signatureRequestId);
          if (!i) throw new Error("Signature request not found");
          switch (_.signer.type) {
            case "EOA":
              await i.addEcdsaSignature(_.signer.signature);
              break;
            case "SCW":
              await i.addScwSignature(_.signer.identifier, _.signer.signature, _.signer.chainId, _.signer.blockNumber);
          }
          await Yt(s, i), rt.delete(_.signatureRequestId), B({ id: e, action: t, result: void 0 });
          break;
        }
        case "utils.inboxStateFromInboxIds": {
          const s = O[_.env ?? "dev"];
          try {
            const i = (await $t(s, _.inboxIds)).map(((a) => ((w) => ({ identifiers: w.accountIdentifiers, inboxId: w.inboxId, installations: w.installations.map(be), recoveryIdentifier: w.recoveryIdentifier }))(a)));
            B({ id: e, action: t, result: i });
          } catch (i) {
            console.error("utils received error", i);
          }
          break;
        }
      }
    } catch (s) {
      ((i) => {
        self.postMessage(i);
      })({ id: e, action: t, error: s });
    }
  };
});
export default we();
