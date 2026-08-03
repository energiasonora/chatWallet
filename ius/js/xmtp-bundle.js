let tn = class Yt {
  authorityId;
  typeId;
  versionMajor;
  versionMinor;
  constructor(e) {
    this.authorityId = e.authorityId, this.typeId = e.typeId, this.versionMajor = e.versionMajor, this.versionMinor = e.versionMinor;
  }
  toString() {
    return `${this.authorityId}/${this.typeId}:${this.versionMajor}.${this.versionMinor}`;
  }
  static fromString(e) {
    const [n, o] = e.split(":"), [r, i] = n.split("/"), [s, a] = o.split(".");
    return new Yt({ authorityId: r, typeId: i, versionMajor: Number(s), versionMinor: Number(a) });
  }
  sameAs(e) {
    return this.authorityId === e.authorityId && this.typeId === e.typeId;
  }
};
const nn = new Array(64), rn = new Array(123);
for (let t = 0; t < 64; )
  rn[nn[t] = t < 26 ? t + 65 : t < 52 ? t + 71 : t < 62 ? t - 4 : t - 59 | 43] = t++;
var Se;
(function(t) {
  t.SORT_DIRECTION_UNSPECIFIED = "SORT_DIRECTION_UNSPECIFIED", t.SORT_DIRECTION_ASCENDING = "SORT_DIRECTION_ASCENDING", t.SORT_DIRECTION_DESCENDING = "SORT_DIRECTION_DESCENDING";
})(Se || (Se = {}));
var D = null;
try {
  D = new WebAssembly.Instance(
    new WebAssembly.Module(
      new Uint8Array([
        // \0asm
        0,
        97,
        115,
        109,
        // version 1
        1,
        0,
        0,
        0,
        // section "type"
        1,
        13,
        2,
        // 0, () => i32
        96,
        0,
        1,
        127,
        // 1, (i32, i32, i32, i32) => i32
        96,
        4,
        127,
        127,
        127,
        127,
        1,
        127,
        // section "function"
        3,
        7,
        6,
        // 0, type 0
        0,
        // 1, type 1
        1,
        // 2, type 1
        1,
        // 3, type 1
        1,
        // 4, type 1
        1,
        // 5, type 1
        1,
        // section "global"
        6,
        6,
        1,
        // 0, "high", mutable i32
        127,
        1,
        65,
        0,
        11,
        // section "export"
        7,
        50,
        6,
        // 0, "mul"
        3,
        109,
        117,
        108,
        0,
        1,
        // 1, "div_s"
        5,
        100,
        105,
        118,
        95,
        115,
        0,
        2,
        // 2, "div_u"
        5,
        100,
        105,
        118,
        95,
        117,
        0,
        3,
        // 3, "rem_s"
        5,
        114,
        101,
        109,
        95,
        115,
        0,
        4,
        // 4, "rem_u"
        5,
        114,
        101,
        109,
        95,
        117,
        0,
        5,
        // 5, "get_high"
        8,
        103,
        101,
        116,
        95,
        104,
        105,
        103,
        104,
        0,
        0,
        // section "code"
        10,
        191,
        1,
        6,
        // 0, "get_high"
        4,
        0,
        35,
        0,
        11,
        // 1, "mul"
        36,
        1,
        1,
        126,
        32,
        0,
        173,
        32,
        1,
        173,
        66,
        32,
        134,
        132,
        32,
        2,
        173,
        32,
        3,
        173,
        66,
        32,
        134,
        132,
        126,
        34,
        4,
        66,
        32,
        135,
        167,
        36,
        0,
        32,
        4,
        167,
        11,
        // 2, "div_s"
        36,
        1,
        1,
        126,
        32,
        0,
        173,
        32,
        1,
        173,
        66,
        32,
        134,
        132,
        32,
        2,
        173,
        32,
        3,
        173,
        66,
        32,
        134,
        132,
        127,
        34,
        4,
        66,
        32,
        135,
        167,
        36,
        0,
        32,
        4,
        167,
        11,
        // 3, "div_u"
        36,
        1,
        1,
        126,
        32,
        0,
        173,
        32,
        1,
        173,
        66,
        32,
        134,
        132,
        32,
        2,
        173,
        32,
        3,
        173,
        66,
        32,
        134,
        132,
        128,
        34,
        4,
        66,
        32,
        135,
        167,
        36,
        0,
        32,
        4,
        167,
        11,
        // 4, "rem_s"
        36,
        1,
        1,
        126,
        32,
        0,
        173,
        32,
        1,
        173,
        66,
        32,
        134,
        132,
        32,
        2,
        173,
        32,
        3,
        173,
        66,
        32,
        134,
        132,
        129,
        34,
        4,
        66,
        32,
        135,
        167,
        36,
        0,
        32,
        4,
        167,
        11,
        // 5, "rem_u"
        36,
        1,
        1,
        126,
        32,
        0,
        173,
        32,
        1,
        173,
        66,
        32,
        134,
        132,
        32,
        2,
        173,
        32,
        3,
        173,
        66,
        32,
        134,
        132,
        130,
        34,
        4,
        66,
        32,
        135,
        167,
        36,
        0,
        32,
        4,
        167,
        11
      ])
    ),
    {}
  ).exports;
} catch {
}
function p(t, e, n) {
  this.low = t | 0, this.high = e | 0, this.unsigned = !!n;
}
p.prototype.__isLong__;
Object.defineProperty(p.prototype, "__isLong__", { value: !0 });
function S(t) {
  return (t && t.__isLong__) === !0;
}
function Me(t) {
  var e = Math.clz32(t & -t);
  return t ? 31 - e : e;
}
p.isLong = S;
var Oe = {}, De = {};
function B(t, e) {
  var n, o, r;
  return e ? (t >>>= 0, (r = 0 <= t && t < 256) && (o = De[t], o) ? o : (n = v(t, 0, !0), r && (De[t] = n), n)) : (t |= 0, (r = -128 <= t && t < 128) && (o = Oe[t], o) ? o : (n = v(t, t < 0 ? -1 : 0, !1), r && (Oe[t] = n), n));
}
p.fromInt = B;
function x(t, e) {
  if (isNaN(t)) return e ? L : A;
  if (e) {
    if (t < 0) return L;
    if (t >= Vt) return Zt;
  } else {
    if (t <= -Te) return O;
    if (t + 1 >= Te) return Gt;
  }
  return t < 0 ? x(-t, e).neg() : v(
    t % V | 0,
    t / V | 0,
    e
  );
}
p.fromNumber = x;
function v(t, e, n) {
  return new p(t, e, n);
}
p.fromBits = v;
var K = Math.pow;
function Re(t, e, n) {
  if (t.length === 0) throw Error("empty string");
  if (typeof e == "number" ? (n = e, e = !1) : e = !!e, t === "NaN" || t === "Infinity" || t === "+Infinity" || t === "-Infinity")
    return e ? L : A;
  if (n = n || 10, n < 2 || 36 < n) throw RangeError("radix");
  var o;
  if ((o = t.indexOf("-")) > 0) throw Error("interior hyphen");
  if (o === 0)
    return Re(t.substring(1), e, n).neg();
  for (var r = x(K(n, 8)), i = A, s = 0; s < t.length; s += 8) {
    var a = Math.min(8, t.length - s), u = parseInt(t.substring(s, s + a), n);
    if (a < 8) {
      var d = x(K(n, a));
      i = i.mul(d).add(x(u));
    } else
      i = i.mul(r), i = i.add(x(u));
  }
  return i.unsigned = e, i;
}
p.fromString = Re;
function T(t, e) {
  return typeof t == "number" ? x(t, e) : typeof t == "string" ? Re(t, e) : v(
    t.low,
    t.high,
    typeof e == "boolean" ? e : t.unsigned
  );
}
p.fromValue = T;
var xe = 65536, sn = 1 << 24, V = xe * xe, Vt = V * V, Te = Vt / 2, Ae = B(sn), A = B(0);
p.ZERO = A;
var L = B(0, !0);
p.UZERO = L;
var Y = B(1);
p.ONE = Y;
var jt = B(1, !0);
p.UONE = jt;
var me = B(-1);
p.NEG_ONE = me;
var Gt = v(-1, 2147483647, !1);
p.MAX_VALUE = Gt;
var Zt = v(-1, -1, !0);
p.MAX_UNSIGNED_VALUE = Zt;
var O = v(0, -2147483648, !1);
p.MIN_VALUE = O;
var _ = p.prototype;
_.toInt = function() {
  return this.unsigned ? this.low >>> 0 : this.low;
};
_.toNumber = function() {
  return this.unsigned ? (this.high >>> 0) * V + (this.low >>> 0) : this.high * V + (this.low >>> 0);
};
_.toString = function(e) {
  if (e = e || 10, e < 2 || 36 < e) throw RangeError("radix");
  if (this.isZero()) return "0";
  if (this.isNegative())
    if (this.eq(O)) {
      var n = x(e), o = this.div(n), r = o.mul(n).sub(this);
      return o.toString(e) + r.toInt().toString(e);
    } else return "-" + this.neg().toString(e);
  for (var i = x(K(e, 6), this.unsigned), s = this, a = ""; ; ) {
    var u = s.div(i), d = s.sub(u.mul(i)).toInt() >>> 0, I = d.toString(e);
    if (s = u, s.isZero()) return I + a;
    for (; I.length < 6; ) I = "0" + I;
    a = "" + I + a;
  }
};
_.getHighBits = function() {
  return this.high;
};
_.getHighBitsUnsigned = function() {
  return this.high >>> 0;
};
_.getLowBits = function() {
  return this.low;
};
_.getLowBitsUnsigned = function() {
  return this.low >>> 0;
};
_.getNumBitsAbs = function() {
  if (this.isNegative())
    return this.eq(O) ? 64 : this.neg().getNumBitsAbs();
  for (var e = this.high != 0 ? this.high : this.low, n = 31; n > 0 && (e & 1 << n) == 0; n--) ;
  return this.high != 0 ? n + 33 : n + 1;
};
_.isSafeInteger = function() {
  var e = this.high >> 21;
  return e ? this.unsigned ? !1 : e === -1 && !(this.low === 0 && this.high === -2097152) : !0;
};
_.isZero = function() {
  return this.high === 0 && this.low === 0;
};
_.eqz = _.isZero;
_.isNegative = function() {
  return !this.unsigned && this.high < 0;
};
_.isPositive = function() {
  return this.unsigned || this.high >= 0;
};
_.isOdd = function() {
  return (this.low & 1) === 1;
};
_.isEven = function() {
  return (this.low & 1) === 0;
};
_.equals = function(e) {
  return S(e) || (e = T(e)), this.unsigned !== e.unsigned && this.high >>> 31 === 1 && e.high >>> 31 === 1 ? !1 : this.high === e.high && this.low === e.low;
};
_.eq = _.equals;
_.notEquals = function(e) {
  return !this.eq(
    /* validates */
    e
  );
};
_.neq = _.notEquals;
_.ne = _.notEquals;
_.lessThan = function(e) {
  return this.comp(
    /* validates */
    e
  ) < 0;
};
_.lt = _.lessThan;
_.lessThanOrEqual = function(e) {
  return this.comp(
    /* validates */
    e
  ) <= 0;
};
_.lte = _.lessThanOrEqual;
_.le = _.lessThanOrEqual;
_.greaterThan = function(e) {
  return this.comp(
    /* validates */
    e
  ) > 0;
};
_.gt = _.greaterThan;
_.greaterThanOrEqual = function(e) {
  return this.comp(
    /* validates */
    e
  ) >= 0;
};
_.gte = _.greaterThanOrEqual;
_.ge = _.greaterThanOrEqual;
_.compare = function(e) {
  if (S(e) || (e = T(e)), this.eq(e)) return 0;
  var n = this.isNegative(), o = e.isNegative();
  return n && !o ? -1 : !n && o ? 1 : this.unsigned ? e.high >>> 0 > this.high >>> 0 || e.high === this.high && e.low >>> 0 > this.low >>> 0 ? -1 : 1 : this.sub(e).isNegative() ? -1 : 1;
};
_.comp = _.compare;
_.negate = function() {
  return !this.unsigned && this.eq(O) ? O : this.not().add(Y);
};
_.neg = _.negate;
_.add = function(e) {
  S(e) || (e = T(e));
  var n = this.high >>> 16, o = this.high & 65535, r = this.low >>> 16, i = this.low & 65535, s = e.high >>> 16, a = e.high & 65535, u = e.low >>> 16, d = e.low & 65535, I = 0, h = 0, f = 0, c = 0;
  return c += i + d, f += c >>> 16, c &= 65535, f += r + u, h += f >>> 16, f &= 65535, h += o + a, I += h >>> 16, h &= 65535, I += n + s, I &= 65535, v(f << 16 | c, I << 16 | h, this.unsigned);
};
_.subtract = function(e) {
  return S(e) || (e = T(e)), this.add(e.neg());
};
_.sub = _.subtract;
_.multiply = function(e) {
  if (this.isZero()) return this;
  if (S(e) || (e = T(e)), D) {
    var n = D.mul(this.low, this.high, e.low, e.high);
    return v(n, D.get_high(), this.unsigned);
  }
  if (e.isZero()) return this.unsigned ? L : A;
  if (this.eq(O)) return e.isOdd() ? O : A;
  if (e.eq(O)) return this.isOdd() ? O : A;
  if (this.isNegative())
    return e.isNegative() ? this.neg().mul(e.neg()) : this.neg().mul(e).neg();
  if (e.isNegative()) return this.mul(e.neg()).neg();
  if (this.lt(Ae) && e.lt(Ae))
    return x(this.toNumber() * e.toNumber(), this.unsigned);
  var o = this.high >>> 16, r = this.high & 65535, i = this.low >>> 16, s = this.low & 65535, a = e.high >>> 16, u = e.high & 65535, d = e.low >>> 16, I = e.low & 65535, h = 0, f = 0, c = 0, l = 0;
  return l += s * I, c += l >>> 16, l &= 65535, c += i * I, f += c >>> 16, c &= 65535, c += s * d, f += c >>> 16, c &= 65535, f += r * I, h += f >>> 16, f &= 65535, f += i * d, h += f >>> 16, f &= 65535, f += s * u, h += f >>> 16, f &= 65535, h += o * I + r * d + i * u + s * a, h &= 65535, v(c << 16 | l, h << 16 | f, this.unsigned);
};
_.mul = _.multiply;
_.divide = function(e) {
  if (S(e) || (e = T(e)), e.isZero()) throw Error("division by zero");
  if (D) {
    if (!this.unsigned && this.high === -2147483648 && e.low === -1 && e.high === -1)
      return this;
    var n = (this.unsigned ? D.div_u : D.div_s)(
      this.low,
      this.high,
      e.low,
      e.high
    );
    return v(n, D.get_high(), this.unsigned);
  }
  if (this.isZero()) return this.unsigned ? L : A;
  var o, r, i;
  if (this.unsigned) {
    if (e.unsigned || (e = e.toUnsigned()), e.gt(this)) return L;
    if (e.gt(this.shru(1)))
      return jt;
    i = L;
  } else {
    if (this.eq(O)) {
      if (e.eq(Y) || e.eq(me))
        return O;
      if (e.eq(O)) return Y;
      var s = this.shr(1);
      return o = s.div(e).shl(1), o.eq(A) ? e.isNegative() ? Y : me : (r = this.sub(e.mul(o)), i = o.add(r.div(e)), i);
    } else if (e.eq(O)) return this.unsigned ? L : A;
    if (this.isNegative())
      return e.isNegative() ? this.neg().div(e.neg()) : this.neg().div(e).neg();
    if (e.isNegative()) return this.div(e.neg()).neg();
    i = A;
  }
  for (r = this; r.gte(e); ) {
    o = Math.max(1, Math.floor(r.toNumber() / e.toNumber()));
    for (var a = Math.ceil(Math.log(o) / Math.LN2), u = a <= 48 ? 1 : K(2, a - 48), d = x(o), I = d.mul(e); I.isNegative() || I.gt(r); )
      o -= u, d = x(o, this.unsigned), I = d.mul(e);
    d.isZero() && (d = Y), i = i.add(d), r = r.sub(I);
  }
  return i;
};
_.div = _.divide;
_.modulo = function(e) {
  if (S(e) || (e = T(e)), D) {
    var n = (this.unsigned ? D.rem_u : D.rem_s)(
      this.low,
      this.high,
      e.low,
      e.high
    );
    return v(n, D.get_high(), this.unsigned);
  }
  return this.sub(this.div(e).mul(e));
};
_.mod = _.modulo;
_.rem = _.modulo;
_.not = function() {
  return v(~this.low, ~this.high, this.unsigned);
};
_.countLeadingZeros = function() {
  return this.high ? Math.clz32(this.high) : Math.clz32(this.low) + 32;
};
_.clz = _.countLeadingZeros;
_.countTrailingZeros = function() {
  return this.low ? Me(this.low) : Me(this.high) + 32;
};
_.ctz = _.countTrailingZeros;
_.and = function(e) {
  return S(e) || (e = T(e)), v(this.low & e.low, this.high & e.high, this.unsigned);
};
_.or = function(e) {
  return S(e) || (e = T(e)), v(this.low | e.low, this.high | e.high, this.unsigned);
};
_.xor = function(e) {
  return S(e) || (e = T(e)), v(this.low ^ e.low, this.high ^ e.high, this.unsigned);
};
_.shiftLeft = function(e) {
  return S(e) && (e = e.toInt()), (e &= 63) === 0 ? this : e < 32 ? v(
    this.low << e,
    this.high << e | this.low >>> 32 - e,
    this.unsigned
  ) : v(0, this.low << e - 32, this.unsigned);
};
_.shl = _.shiftLeft;
_.shiftRight = function(e) {
  return S(e) && (e = e.toInt()), (e &= 63) === 0 ? this : e < 32 ? v(
    this.low >>> e | this.high << 32 - e,
    this.high >> e,
    this.unsigned
  ) : v(
    this.high >> e - 32,
    this.high >= 0 ? 0 : -1,
    this.unsigned
  );
};
_.shr = _.shiftRight;
_.shiftRightUnsigned = function(e) {
  return S(e) && (e = e.toInt()), (e &= 63) === 0 ? this : e < 32 ? v(
    this.low >>> e | this.high << 32 - e,
    this.high >>> e,
    this.unsigned
  ) : e === 32 ? v(this.high, 0, this.unsigned) : v(this.high >>> e - 32, 0, this.unsigned);
};
_.shru = _.shiftRightUnsigned;
_.shr_u = _.shiftRightUnsigned;
_.rotateLeft = function(e) {
  var n;
  return S(e) && (e = e.toInt()), (e &= 63) === 0 ? this : e === 32 ? v(this.high, this.low, this.unsigned) : e < 32 ? (n = 32 - e, v(
    this.low << e | this.high >>> n,
    this.high << e | this.low >>> n,
    this.unsigned
  )) : (e -= 32, n = 32 - e, v(
    this.high << e | this.low >>> n,
    this.low << e | this.high >>> n,
    this.unsigned
  ));
};
_.rotl = _.rotateLeft;
_.rotateRight = function(e) {
  var n;
  return S(e) && (e = e.toInt()), (e &= 63) === 0 ? this : e === 32 ? v(this.high, this.low, this.unsigned) : e < 32 ? (n = 32 - e, v(
    this.high << n | this.low >>> e,
    this.low << n | this.high >>> e,
    this.unsigned
  )) : (e -= 32, n = 32 - e, v(
    this.low << n | this.high >>> e,
    this.high << n | this.low >>> e,
    this.unsigned
  ));
};
_.rotr = _.rotateRight;
_.toSigned = function() {
  return this.unsigned ? v(this.low, this.high, !1) : this;
};
_.toUnsigned = function() {
  return this.unsigned ? this : v(this.low, this.high, !0);
};
_.toBytes = function(e) {
  return e ? this.toBytesLE() : this.toBytesBE();
};
_.toBytesLE = function() {
  var e = this.high, n = this.low;
  return [
    n & 255,
    n >>> 8 & 255,
    n >>> 16 & 255,
    n >>> 24,
    e & 255,
    e >>> 8 & 255,
    e >>> 16 & 255,
    e >>> 24
  ];
};
_.toBytesBE = function() {
  var e = this.high, n = this.low;
  return [
    e >>> 24,
    e >>> 16 & 255,
    e >>> 8 & 255,
    e & 255,
    n >>> 24,
    n >>> 16 & 255,
    n >>> 8 & 255,
    n & 255
  ];
};
p.fromBytes = function(e, n, o) {
  return o ? p.fromBytesLE(e, n) : p.fromBytesBE(e, n);
};
p.fromBytesLE = function(e, n) {
  return new p(
    e[0] | e[1] << 8 | e[2] << 16 | e[3] << 24,
    e[4] | e[5] << 8 | e[6] << 16 | e[7] << 24,
    n
  );
};
p.fromBytesBE = function(e, n) {
  return new p(
    e[4] << 24 | e[5] << 16 | e[6] << 8 | e[7],
    e[0] << 24 | e[1] << 16 | e[2] << 8 | e[3],
    n
  );
};
typeof BigInt == "function" && (p.fromBigInt = function(e, n) {
  var o = Number(BigInt.asIntN(32, e)), r = Number(BigInt.asIntN(32, e >> BigInt(32)));
  return v(o, r, n);
}, p.fromValue = function(e, n) {
  return typeof e == "bigint" ? p.fromBigInt(e, n) : T(e, n);
}, _.toBigInt = function() {
  var e = BigInt(this.low >>> 0), n = BigInt(this.unsigned ? this.high >>> 0 : this.high);
  return n << BigInt(32) | e;
});
var z = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function on(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
var ee = {}, $ = {}, te, Fe;
function an() {
  if (Fe) return te;
  Fe = 1, te = t;
  function t(e, n) {
    for (var o = new Array(arguments.length - 1), r = 0, i = 2, s = !0; i < arguments.length; )
      o[r++] = arguments[i++];
    return new Promise(function(u, d) {
      o[r] = function(h) {
        if (s)
          if (s = !1, h)
            d(h);
          else {
            for (var f = new Array(arguments.length - 1), c = 0; c < f.length; )
              f[c++] = arguments[c];
            u.apply(null, f);
          }
      };
      try {
        e.apply(n || null, o);
      } catch (I) {
        s && (s = !1, d(I));
      }
    });
  }
  return te;
}
var ne = {}, Le;
function un() {
  return Le || (Le = 1, (function(t) {
    var e = t;
    e.length = function(a) {
      var u = a.length;
      if (!u)
        return 0;
      for (var d = 0; --u % 4 > 1 && a.charAt(u) === "="; )
        ++d;
      return Math.ceil(a.length * 3) / 4 - d;
    };
    for (var n = new Array(64), o = new Array(123), r = 0; r < 64; )
      o[n[r] = r < 26 ? r + 65 : r < 52 ? r + 71 : r < 62 ? r - 4 : r - 59 | 43] = r++;
    e.encode = function(a, u, d) {
      for (var I = null, h = [], f = 0, c = 0, l; u < d; ) {
        var b = a[u++];
        switch (c) {
          case 0:
            h[f++] = n[b >> 2], l = (b & 3) << 4, c = 1;
            break;
          case 1:
            h[f++] = n[l | b >> 4], l = (b & 15) << 2, c = 2;
            break;
          case 2:
            h[f++] = n[l | b >> 6], h[f++] = n[b & 63], c = 0;
            break;
        }
        f > 8191 && ((I || (I = [])).push(String.fromCharCode.apply(String, h)), f = 0);
      }
      return c && (h[f++] = n[l], h[f++] = 61, c === 1 && (h[f++] = 61)), I ? (f && I.push(String.fromCharCode.apply(String, h.slice(0, f))), I.join("")) : String.fromCharCode.apply(String, h.slice(0, f));
    };
    var i = "invalid encoding";
    e.decode = function(a, u, d) {
      for (var I = d, h = 0, f, c = 0; c < a.length; ) {
        var l = a.charCodeAt(c++);
        if (l === 61 && h > 1)
          break;
        if ((l = o[l]) === void 0)
          throw Error(i);
        switch (h) {
          case 0:
            f = l, h = 1;
            break;
          case 1:
            u[d++] = f << 2 | (l & 48) >> 4, f = l, h = 2;
            break;
          case 2:
            u[d++] = (f & 15) << 4 | (l & 60) >> 2, f = l, h = 3;
            break;
          case 3:
            u[d++] = (f & 3) << 6 | l, h = 0;
            break;
        }
      }
      if (h === 1)
        throw Error(i);
      return d - I;
    }, e.test = function(a) {
      return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a);
    };
  })(ne)), ne;
}
var ie, Ce;
function fn() {
  if (Ce) return ie;
  Ce = 1, ie = t;
  function t() {
    this._listeners = {};
  }
  return t.prototype.on = function(n, o, r) {
    return (this._listeners[n] || (this._listeners[n] = [])).push({
      fn: o,
      ctx: r || this
    }), this;
  }, t.prototype.off = function(n, o) {
    if (n === void 0)
      this._listeners = {};
    else if (o === void 0)
      this._listeners[n] = [];
    else
      for (var r = this._listeners[n], i = 0; i < r.length; )
        r[i].fn === o ? r.splice(i, 1) : ++i;
    return this;
  }, t.prototype.emit = function(n) {
    var o = this._listeners[n];
    if (o) {
      for (var r = [], i = 1; i < arguments.length; )
        r.push(arguments[i++]);
      for (i = 0; i < o.length; )
        o[i].fn.apply(o[i++].ctx, r);
    }
    return this;
  }, ie;
}
var re, Pe;
function hn() {
  if (Pe) return re;
  Pe = 1, re = t(t);
  function t(i) {
    return typeof Float32Array < "u" ? (function() {
      var s = new Float32Array([-0]), a = new Uint8Array(s.buffer), u = a[3] === 128;
      function d(c, l, b) {
        s[0] = c, l[b] = a[0], l[b + 1] = a[1], l[b + 2] = a[2], l[b + 3] = a[3];
      }
      function I(c, l, b) {
        s[0] = c, l[b] = a[3], l[b + 1] = a[2], l[b + 2] = a[1], l[b + 3] = a[0];
      }
      i.writeFloatLE = u ? d : I, i.writeFloatBE = u ? I : d;
      function h(c, l) {
        return a[0] = c[l], a[1] = c[l + 1], a[2] = c[l + 2], a[3] = c[l + 3], s[0];
      }
      function f(c, l) {
        return a[3] = c[l], a[2] = c[l + 1], a[1] = c[l + 2], a[0] = c[l + 3], s[0];
      }
      i.readFloatLE = u ? h : f, i.readFloatBE = u ? f : h;
    })() : (function() {
      function s(u, d, I, h) {
        var f = d < 0 ? 1 : 0;
        if (f && (d = -d), d === 0)
          u(1 / d > 0 ? (
            /* positive */
            0
          ) : (
            /* negative 0 */
            2147483648
          ), I, h);
        else if (isNaN(d))
          u(2143289344, I, h);
        else if (d > 34028234663852886e22)
          u((f << 31 | 2139095040) >>> 0, I, h);
        else if (d < 11754943508222875e-54)
          u((f << 31 | Math.round(d / 1401298464324817e-60)) >>> 0, I, h);
        else {
          var c = Math.floor(Math.log(d) / Math.LN2), l = Math.round(d * Math.pow(2, -c) * 8388608) & 8388607;
          u((f << 31 | c + 127 << 23 | l) >>> 0, I, h);
        }
      }
      i.writeFloatLE = s.bind(null, e), i.writeFloatBE = s.bind(null, n);
      function a(u, d, I) {
        var h = u(d, I), f = (h >> 31) * 2 + 1, c = h >>> 23 & 255, l = h & 8388607;
        return c === 255 ? l ? NaN : f * (1 / 0) : c === 0 ? f * 1401298464324817e-60 * l : f * Math.pow(2, c - 150) * (l + 8388608);
      }
      i.readFloatLE = a.bind(null, o), i.readFloatBE = a.bind(null, r);
    })(), typeof Float64Array < "u" ? (function() {
      var s = new Float64Array([-0]), a = new Uint8Array(s.buffer), u = a[7] === 128;
      function d(c, l, b) {
        s[0] = c, l[b] = a[0], l[b + 1] = a[1], l[b + 2] = a[2], l[b + 3] = a[3], l[b + 4] = a[4], l[b + 5] = a[5], l[b + 6] = a[6], l[b + 7] = a[7];
      }
      function I(c, l, b) {
        s[0] = c, l[b] = a[7], l[b + 1] = a[6], l[b + 2] = a[5], l[b + 3] = a[4], l[b + 4] = a[3], l[b + 5] = a[2], l[b + 6] = a[1], l[b + 7] = a[0];
      }
      i.writeDoubleLE = u ? d : I, i.writeDoubleBE = u ? I : d;
      function h(c, l) {
        return a[0] = c[l], a[1] = c[l + 1], a[2] = c[l + 2], a[3] = c[l + 3], a[4] = c[l + 4], a[5] = c[l + 5], a[6] = c[l + 6], a[7] = c[l + 7], s[0];
      }
      function f(c, l) {
        return a[7] = c[l], a[6] = c[l + 1], a[5] = c[l + 2], a[4] = c[l + 3], a[3] = c[l + 4], a[2] = c[l + 5], a[1] = c[l + 6], a[0] = c[l + 7], s[0];
      }
      i.readDoubleLE = u ? h : f, i.readDoubleBE = u ? f : h;
    })() : (function() {
      function s(u, d, I, h, f, c) {
        var l = h < 0 ? 1 : 0;
        if (l && (h = -h), h === 0)
          u(0, f, c + d), u(1 / h > 0 ? (
            /* positive */
            0
          ) : (
            /* negative 0 */
            2147483648
          ), f, c + I);
        else if (isNaN(h))
          u(0, f, c + d), u(2146959360, f, c + I);
        else if (h > 17976931348623157e292)
          u(0, f, c + d), u((l << 31 | 2146435072) >>> 0, f, c + I);
        else {
          var b;
          if (h < 22250738585072014e-324)
            b = h / 5e-324, u(b >>> 0, f, c + d), u((l << 31 | b / 4294967296) >>> 0, f, c + I);
          else {
            var w = Math.floor(Math.log(h) / Math.LN2);
            w === 1024 && (w = 1023), b = h * Math.pow(2, -w), u(b * 4503599627370496 >>> 0, f, c + d), u((l << 31 | w + 1023 << 20 | b * 1048576 & 1048575) >>> 0, f, c + I);
          }
        }
      }
      i.writeDoubleLE = s.bind(null, e, 0, 4), i.writeDoubleBE = s.bind(null, n, 4, 0);
      function a(u, d, I, h, f) {
        var c = u(h, f + d), l = u(h, f + I), b = (l >> 31) * 2 + 1, w = l >>> 20 & 2047, y = 4294967296 * (l & 1048575) + c;
        return w === 2047 ? y ? NaN : b * (1 / 0) : w === 0 ? b * 5e-324 * y : b * Math.pow(2, w - 1075) * (y + 4503599627370496);
      }
      i.readDoubleLE = a.bind(null, o, 0, 4), i.readDoubleBE = a.bind(null, r, 4, 0);
    })(), i;
  }
  function e(i, s, a) {
    s[a] = i & 255, s[a + 1] = i >>> 8 & 255, s[a + 2] = i >>> 16 & 255, s[a + 3] = i >>> 24;
  }
  function n(i, s, a) {
    s[a] = i >>> 24, s[a + 1] = i >>> 16 & 255, s[a + 2] = i >>> 8 & 255, s[a + 3] = i & 255;
  }
  function o(i, s) {
    return (i[s] | i[s + 1] << 8 | i[s + 2] << 16 | i[s + 3] << 24) >>> 0;
  }
  function r(i, s) {
    return (i[s] << 24 | i[s + 1] << 16 | i[s + 2] << 8 | i[s + 3]) >>> 0;
  }
  return re;
}
function Ue(t) {
  throw new Error('Could not dynamically require "' + t + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
var se, Be;
function dn() {
  if (Be) return se;
  Be = 1, se = t;
  function t(e) {
    try {
      if (typeof Ue != "function")
        return null;
      var n = Ue(e);
      return n && (n.length || Object.keys(n).length) ? n : null;
    } catch {
      return null;
    }
  }
  return se;
}
var oe = {}, qe;
function ln() {
  return qe || (qe = 1, (function(t) {
    var e = t, n = "�";
    e.length = function(r) {
      for (var i = 0, s = 0, a = 0; a < r.length; ++a)
        s = r.charCodeAt(a), s < 128 ? i += 1 : s < 2048 ? i += 2 : (s & 64512) === 55296 && (r.charCodeAt(a + 1) & 64512) === 56320 ? (++a, i += 4) : i += 3;
      return i;
    }, e.read = function(r, i, s) {
      if (s - i < 1)
        return "";
      for (var a = "", u = i; u < s; ) {
        var d = r[u++];
        if (d <= 127)
          a += String.fromCharCode(d);
        else if (d >= 192 && d < 224) {
          var I = (d & 31) << 6 | r[u++] & 63;
          a += I >= 128 ? String.fromCharCode(I) : n;
        } else if (d >= 224 && d < 240) {
          var h = (d & 15) << 12 | (r[u++] & 63) << 6 | r[u++] & 63;
          a += h >= 2048 ? String.fromCharCode(h) : n;
        } else if (d >= 240) {
          var f = (d & 7) << 18 | (r[u++] & 63) << 12 | (r[u++] & 63) << 6 | r[u++] & 63;
          f < 65536 || f > 1114111 ? a += n : (f -= 65536, a += String.fromCharCode(55296 + (f >> 10)), a += String.fromCharCode(56320 + (f & 1023)));
        }
      }
      return a;
    }, e.write = function(r, i, s) {
      for (var a = s, u, d, I = 0; I < r.length; ++I)
        u = r.charCodeAt(I), u < 128 ? i[s++] = u : u < 2048 ? (i[s++] = u >> 6 | 192, i[s++] = u & 63 | 128) : (u & 64512) === 55296 && ((d = r.charCodeAt(I + 1)) & 64512) === 56320 ? (u = 65536 + ((u & 1023) << 10) + (d & 1023), ++I, i[s++] = u >> 18 | 240, i[s++] = u >> 12 & 63 | 128, i[s++] = u >> 6 & 63 | 128, i[s++] = u & 63 | 128) : (i[s++] = u >> 12 | 224, i[s++] = u >> 6 & 63 | 128, i[s++] = u & 63 | 128);
      return s - a;
    };
  })(oe)), oe;
}
var ae, ze;
function cn() {
  if (ze) return ae;
  ze = 1, ae = t;
  function t(e, n, o) {
    var r = o || 8192, i = r >>> 1, s = null, a = r;
    return function(d) {
      if (d < 1 || d > i)
        return e(d);
      a + d > r && (s = e(r), a = 0);
      var I = n.call(s, a, a += d);
      return a & 7 && (a = (a | 7) + 1), I;
    };
  }
  return ae;
}
var ue, ke;
function gn() {
  if (ke) return ue;
  ke = 1, ue = e;
  var t = q();
  function e(i, s) {
    this.lo = i >>> 0, this.hi = s >>> 0;
  }
  var n = e.zero = new e(0, 0);
  n.toNumber = function() {
    return 0;
  }, n.zzEncode = n.zzDecode = function() {
    return this;
  }, n.length = function() {
    return 1;
  };
  var o = e.zeroHash = "\0\0\0\0\0\0\0\0";
  e.fromNumber = function(s) {
    if (s === 0)
      return n;
    var a = s < 0;
    a && (s = -s);
    var u = s >>> 0, d = (s - u) / 4294967296 >>> 0;
    return a && (d = ~d >>> 0, u = ~u >>> 0, ++u > 4294967295 && (u = 0, ++d > 4294967295 && (d = 0))), new e(u, d);
  }, e.from = function(s) {
    if (typeof s == "number")
      return e.fromNumber(s);
    if (t.isString(s))
      if (t.Long)
        s = t.Long.fromString(s);
      else
        return e.fromNumber(parseInt(s, 10));
    return s.low || s.high ? new e(s.low >>> 0, s.high >>> 0) : n;
  }, e.prototype.toNumber = function(s) {
    if (!s && this.hi >>> 31) {
      var a = ~this.lo + 1 >>> 0, u = ~this.hi >>> 0;
      return a || (u = u + 1 >>> 0), -(a + u * 4294967296);
    }
    return this.lo + this.hi * 4294967296;
  }, e.prototype.toLong = function(s) {
    return t.Long ? new t.Long(this.lo | 0, this.hi | 0, !!s) : { low: this.lo | 0, high: this.hi | 0, unsigned: !!s };
  };
  var r = String.prototype.charCodeAt;
  return e.fromHash = function(s) {
    return s === o ? n : new e(
      (r.call(s, 0) | r.call(s, 1) << 8 | r.call(s, 2) << 16 | r.call(s, 3) << 24) >>> 0,
      (r.call(s, 4) | r.call(s, 5) << 8 | r.call(s, 6) << 16 | r.call(s, 7) << 24) >>> 0
    );
  }, e.prototype.toHash = function() {
    return String.fromCharCode(
      this.lo & 255,
      this.lo >>> 8 & 255,
      this.lo >>> 16 & 255,
      this.lo >>> 24,
      this.hi & 255,
      this.hi >>> 8 & 255,
      this.hi >>> 16 & 255,
      this.hi >>> 24
    );
  }, e.prototype.zzEncode = function() {
    var s = this.hi >> 31;
    return this.hi = ((this.hi << 1 | this.lo >>> 31) ^ s) >>> 0, this.lo = (this.lo << 1 ^ s) >>> 0, this;
  }, e.prototype.zzDecode = function() {
    var s = -(this.lo & 1);
    return this.lo = ((this.lo >>> 1 | this.hi << 31) ^ s) >>> 0, this.hi = (this.hi >>> 1 ^ s) >>> 0, this;
  }, e.prototype.length = function() {
    var s = this.lo, a = (this.lo >>> 28 | this.hi << 4) >>> 0, u = this.hi >>> 24;
    return u === 0 ? a === 0 ? s < 16384 ? s < 128 ? 1 : 2 : s < 2097152 ? 3 : 4 : a < 16384 ? a < 128 ? 5 : 6 : a < 2097152 ? 7 : 8 : u < 128 ? 9 : 10;
  }, ue;
}
var Ye;
function q() {
  return Ye || (Ye = 1, (function(t) {
    var e = t;
    e.asPromise = an(), e.base64 = un(), e.EventEmitter = fn(), e.float = hn(), e.inquire = dn(), e.utf8 = ln(), e.pool = cn(), e.LongBits = gn(), e.isNode = !!(typeof z < "u" && z && z.process && z.process.versions && z.process.versions.node), e.global = e.isNode && z || typeof window < "u" && window || typeof self < "u" && self || $, e.emptyArray = Object.freeze ? Object.freeze([]) : (
      /* istanbul ignore next */
      []
    ), e.emptyObject = Object.freeze ? Object.freeze({}) : (
      /* istanbul ignore next */
      {}
    ), e.isInteger = Number.isInteger || /* istanbul ignore next */
    function(i) {
      return typeof i == "number" && isFinite(i) && Math.floor(i) === i;
    }, e.isString = function(i) {
      return typeof i == "string" || i instanceof String;
    }, e.isObject = function(i) {
      return i && typeof i == "object";
    }, e.isset = /**
     * Checks if a property on a message is considered to be present.
     * @param {Object} obj Plain object or message instance
     * @param {string} prop Property name
     * @returns {boolean} `true` if considered to be present, otherwise `false`
     */
    e.isSet = function(i, s) {
      var a = i[s];
      return a != null && i.hasOwnProperty(s) ? typeof a != "object" || (Array.isArray(a) ? a.length : Object.keys(a).length) > 0 : !1;
    }, e.Buffer = (function() {
      try {
        var r = e.inquire("buffer").Buffer;
        return r.prototype.utf8Write ? r : (
          /* istanbul ignore next */
          null
        );
      } catch {
        return null;
      }
    })(), e._Buffer_from = null, e._Buffer_allocUnsafe = null, e.newBuffer = function(i) {
      return typeof i == "number" ? e.Buffer ? e._Buffer_allocUnsafe(i) : new e.Array(i) : e.Buffer ? e._Buffer_from(i) : typeof Uint8Array > "u" ? i : new Uint8Array(i);
    }, e.Array = typeof Uint8Array < "u" ? Uint8Array : Array, e.Long = /* istanbul ignore next */
    e.global.dcodeIO && /* istanbul ignore next */
    e.global.dcodeIO.Long || /* istanbul ignore next */
    e.global.Long || e.inquire("long"), e.key2Re = /^true|false|0|1$/, e.key32Re = /^-?(?:0|[1-9][0-9]*)$/, e.key64Re = /^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/, e.longToHash = function(i) {
      return i ? e.LongBits.from(i).toHash() : e.LongBits.zeroHash;
    }, e.longFromHash = function(i, s) {
      var a = e.LongBits.fromHash(i);
      return e.Long ? e.Long.fromBits(a.lo, a.hi, s) : a.toNumber(!!s);
    };
    function n(r, i, s) {
      for (var a = Object.keys(i), u = 0; u < a.length; ++u)
        (r[a[u]] === void 0 || !s) && a[u] !== "__proto__" && (r[a[u]] = i[a[u]]);
      return r;
    }
    e.merge = n, e.recursionLimit = 100, e.makeProp = function(i, s) {
      Object.defineProperty(i, s, {
        enumerable: !0,
        configurable: !0,
        writable: !0
      });
    }, e.lcFirst = function(i) {
      return i.charAt(0).toLowerCase() + i.substring(1);
    };
    function o(r) {
      function i(s, a) {
        if (!(this instanceof i))
          return new i(s, a);
        Object.defineProperty(this, "message", { get: function() {
          return s;
        } }), Error.captureStackTrace ? Error.captureStackTrace(this, i) : Object.defineProperty(this, "stack", { value: new Error().stack || "" }), a && n(this, a);
      }
      return i.prototype = Object.create(Error.prototype, {
        constructor: {
          value: i,
          writable: !0,
          enumerable: !1,
          configurable: !0
        },
        name: {
          get: function() {
            return r;
          },
          set: void 0,
          enumerable: !1,
          // configurable: false would accurately preserve the behavior of
          // the original, but I'm guessing that was not intentional.
          // For an actual error subclass, this property would
          // be configurable.
          configurable: !0
        },
        toString: {
          value: function() {
            return this.name + ": " + this.message;
          },
          writable: !0,
          enumerable: !1,
          configurable: !0
        }
      }), i;
    }
    e.newError = o, e.ProtocolError = o("ProtocolError"), e.oneOfGetter = function(i) {
      for (var s = {}, a = 0; a < i.length; ++a)
        s[i[a]] = 1;
      return function() {
        for (var u = Object.keys(this), d = u.length - 1; d > -1; --d)
          if (s[u[d]] === 1 && this[u[d]] !== void 0 && this[u[d]] !== null)
            return u[d];
      };
    }, e.oneOfSetter = function(i) {
      return function(s) {
        for (var a = 0; a < i.length; ++a)
          i[a] !== s && delete this[i[a]];
      };
    }, e.toJSONOptions = {
      longs: String,
      enums: String,
      bytes: String,
      json: !0
    }, e._configure = function() {
      var r = e.Buffer;
      if (!r) {
        e._Buffer_from = e._Buffer_allocUnsafe = null;
        return;
      }
      e._Buffer_from = r.from !== Uint8Array.from && r.from || /* istanbul ignore next */
      function(s, a) {
        return new r(s, a);
      }, e._Buffer_allocUnsafe = r.allocUnsafe || /* istanbul ignore next */
      function(s) {
        return new r(s);
      };
    };
  })($)), $;
}
var fe, Ve;
function Wt() {
  if (Ve) return fe;
  Ve = 1, fe = u;
  var t = q(), e, n = t.LongBits, o = t.base64, r = t.utf8;
  function i(w, y, E) {
    this.fn = w, this.len = y, this.next = void 0, this.val = E;
  }
  function s() {
  }
  function a(w) {
    this.head = w.head, this.tail = w.tail, this.len = w.len, this.next = w.states;
  }
  function u() {
    this.len = 0, this.head = new i(s, 0, 0), this.tail = this.head, this.states = null;
  }
  var d = function() {
    return t.Buffer ? function() {
      return (u.create = function() {
        return new e();
      })();
    } : function() {
      return new u();
    };
  };
  u.create = d(), u.alloc = function(y) {
    return new t.Array(y);
  }, t.Array !== Array && (u.alloc = t.pool(u.alloc, t.Array.prototype.subarray)), u.prototype._push = function(y, E, N) {
    return this.tail = this.tail.next = new i(y, E, N), this.len += E, this;
  };
  function I(w, y, E) {
    y[E] = w & 255;
  }
  function h(w, y, E) {
    for (; w > 127; )
      y[E++] = w & 127 | 128, w >>>= 7;
    y[E] = w;
  }
  function f(w, y) {
    this.len = w, this.next = void 0, this.val = y;
  }
  f.prototype = Object.create(i.prototype), f.prototype.fn = h, u.prototype.uint32 = function(y) {
    return this.len += (this.tail = this.tail.next = new f(
      (y = y >>> 0) < 128 ? 1 : y < 16384 ? 2 : y < 2097152 ? 3 : y < 268435456 ? 4 : 5,
      y
    )).len, this;
  }, u.prototype.int32 = function(y) {
    return y < 0 ? this._push(c, 10, n.fromNumber(y)) : this.uint32(y);
  }, u.prototype.sint32 = function(y) {
    return this.uint32((y << 1 ^ y >> 31) >>> 0);
  };
  function c(w, y, E) {
    for (; w.hi; )
      y[E++] = w.lo & 127 | 128, w.lo = (w.lo >>> 7 | w.hi << 25) >>> 0, w.hi >>>= 7;
    for (; w.lo > 127; )
      y[E++] = w.lo & 127 | 128, w.lo = w.lo >>> 7;
    y[E++] = w.lo;
  }
  u.prototype.uint64 = function(y) {
    var E = n.from(y);
    return this._push(c, E.length(), E);
  }, u.prototype.int64 = u.prototype.uint64, u.prototype.sint64 = function(y) {
    var E = n.from(y).zzEncode();
    return this._push(c, E.length(), E);
  }, u.prototype.bool = function(y) {
    return this._push(I, 1, y ? 1 : 0);
  };
  function l(w, y, E) {
    y[E] = w & 255, y[E + 1] = w >>> 8 & 255, y[E + 2] = w >>> 16 & 255, y[E + 3] = w >>> 24;
  }
  u.prototype.fixed32 = function(y) {
    return this._push(l, 4, y >>> 0);
  }, u.prototype.sfixed32 = u.prototype.fixed32, u.prototype.fixed64 = function(y) {
    var E = n.from(y);
    return this._push(l, 4, E.lo)._push(l, 4, E.hi);
  }, u.prototype.sfixed64 = u.prototype.fixed64, u.prototype.float = function(y) {
    return this._push(t.float.writeFloatLE, 4, y);
  }, u.prototype.double = function(y) {
    return this._push(t.float.writeDoubleLE, 8, y);
  };
  var b = t.Array.prototype.set ? function(y, E, N) {
    E.set(y, N);
  } : function(y, E, N) {
    for (var H = 0; H < y.length; ++H)
      E[N + H] = y[H];
  };
  return u.prototype.bytes = function(y) {
    var E = y.length >>> 0;
    if (!E)
      return this._push(I, 1, 0);
    if (t.isString(y)) {
      var N = u.alloc(E = o.length(y));
      o.decode(y, N, 0), y = N;
    }
    return this.uint32(E)._push(b, E, y);
  }, u.prototype.string = function(y) {
    var E = r.length(y);
    return E ? this.uint32(E)._push(r.write, E, y) : this._push(I, 1, 0);
  }, u.prototype.fork = function() {
    return this.states = new a(this), this.head = this.tail = new i(s, 0, 0), this.len = 0, this;
  }, u.prototype.reset = function() {
    return this.states ? (this.head = this.states.head, this.tail = this.states.tail, this.len = this.states.len, this.states = this.states.next) : (this.head = this.tail = new i(s, 0, 0), this.len = 0), this;
  }, u.prototype.ldelim = function() {
    var y = this.head, E = this.tail, N = this.len;
    return this.reset().uint32(N), N && (this.tail.next = y.next, this.tail = E, this.len += N), this;
  }, u.prototype.finish = function() {
    for (var y = this.head.next, E = this.constructor.alloc(this.len), N = 0; y; )
      y.fn(y.val, E, N), N += y.len, y = y.next;
    return E;
  }, u._configure = function(w) {
    e = w, u.create = d(), e._configure();
  }, fe;
}
var he, je;
function yn() {
  if (je) return he;
  je = 1, he = n;
  var t = Wt();
  (n.prototype = Object.create(t.prototype)).constructor = n;
  var e = q();
  function n() {
    t.call(this);
  }
  n._configure = function() {
    n.alloc = e._Buffer_allocUnsafe, n.writeBytesBuffer = e.Buffer && e.Buffer.prototype instanceof Uint8Array && e.Buffer.prototype.set.name === "set" ? function(i, s, a) {
      s.set(i, a);
    } : function(i, s, a) {
      if (i.copy)
        i.copy(s, a, 0, i.length);
      else for (var u = 0; u < i.length; )
        s[a++] = i[u++];
    };
  }, n.prototype.bytes = function(i) {
    e.isString(i) && (i = e._Buffer_from(i, "base64"));
    var s = i.length >>> 0;
    return this.uint32(s), s && this._push(n.writeBytesBuffer, s, i), this;
  };
  function o(r, i, s) {
    r.length < 40 ? e.utf8.write(r, i, s) : i.utf8Write ? i.utf8Write(r, s) : i.write(r, s);
  }
  return n.prototype.string = function(i) {
    var s = e.Buffer.byteLength(i);
    return this.uint32(s), s && this._push(o, s, i), this;
  }, n._configure(), he;
}
var de, Ge;
function Ht() {
  if (Ge) return de;
  Ge = 1, de = i;
  var t = q(), e, n = t.LongBits, o = t.utf8;
  function r(h, f) {
    return RangeError("index out of range: " + h.pos + " + " + (f || 1) + " > " + h.len);
  }
  function i(h) {
    this.buf = h, this.pos = 0, this.len = h.length;
  }
  var s = typeof Uint8Array < "u" ? function(f) {
    if (f instanceof Uint8Array || Array.isArray(f))
      return new i(f);
    throw Error("illegal buffer");
  } : function(f) {
    if (Array.isArray(f))
      return new i(f);
    throw Error("illegal buffer");
  }, a = function() {
    return t.Buffer ? function(c) {
      return (i.create = function(b) {
        return t.Buffer.isBuffer(b) ? new e(b) : s(b);
      })(c);
    } : s;
  };
  i.create = a(), i.prototype._slice = t.Array.prototype.subarray || /* istanbul ignore next */
  t.Array.prototype.slice, i.prototype.uint32 = /* @__PURE__ */ (function() {
    var f = 4294967295;
    return function() {
      if (f = (this.buf[this.pos] & 127) >>> 0, this.buf[this.pos++] < 128 || (f = (f | (this.buf[this.pos] & 127) << 7) >>> 0, this.buf[this.pos++] < 128) || (f = (f | (this.buf[this.pos] & 127) << 14) >>> 0, this.buf[this.pos++] < 128) || (f = (f | (this.buf[this.pos] & 127) << 21) >>> 0, this.buf[this.pos++] < 128) || (f = (f | (this.buf[this.pos] & 15) << 28) >>> 0, this.buf[this.pos++] < 128)) return f;
      if ((this.pos += 5) > this.len)
        throw this.pos = this.len, r(this, 10);
      return f;
    };
  })(), i.prototype.int32 = function() {
    return this.uint32() | 0;
  }, i.prototype.sint32 = function() {
    var f = this.uint32();
    return f >>> 1 ^ -(f & 1) | 0;
  };
  function u() {
    var h = new n(0, 0), f = 0;
    if (this.len - this.pos > 4) {
      for (; f < 4; ++f)
        if (h.lo = (h.lo | (this.buf[this.pos] & 127) << f * 7) >>> 0, this.buf[this.pos++] < 128)
          return h;
      if (h.lo = (h.lo | (this.buf[this.pos] & 127) << 28) >>> 0, h.hi = (h.hi | (this.buf[this.pos] & 127) >> 4) >>> 0, this.buf[this.pos++] < 128)
        return h;
      f = 0;
    } else {
      for (; f < 3; ++f) {
        if (this.pos >= this.len)
          throw r(this);
        if (h.lo = (h.lo | (this.buf[this.pos] & 127) << f * 7) >>> 0, this.buf[this.pos++] < 128)
          return h;
      }
      return h.lo = (h.lo | (this.buf[this.pos++] & 127) << f * 7) >>> 0, h;
    }
    if (this.len - this.pos > 4) {
      for (; f < 5; ++f)
        if (h.hi = (h.hi | (this.buf[this.pos] & 127) << f * 7 + 3) >>> 0, this.buf[this.pos++] < 128)
          return h;
    } else
      for (; f < 5; ++f) {
        if (this.pos >= this.len)
          throw r(this);
        if (h.hi = (h.hi | (this.buf[this.pos] & 127) << f * 7 + 3) >>> 0, this.buf[this.pos++] < 128)
          return h;
      }
    throw Error("invalid varint encoding");
  }
  i.prototype.bool = function() {
    return this.uint32() !== 0;
  };
  function d(h, f) {
    return (h[f - 4] | h[f - 3] << 8 | h[f - 2] << 16 | h[f - 1] << 24) >>> 0;
  }
  i.prototype.fixed32 = function() {
    if (this.pos + 4 > this.len)
      throw r(this, 4);
    return d(this.buf, this.pos += 4);
  }, i.prototype.sfixed32 = function() {
    if (this.pos + 4 > this.len)
      throw r(this, 4);
    return d(this.buf, this.pos += 4) | 0;
  };
  function I() {
    if (this.pos + 8 > this.len)
      throw r(this, 8);
    return new n(d(this.buf, this.pos += 4), d(this.buf, this.pos += 4));
  }
  return i.prototype.float = function() {
    if (this.pos + 4 > this.len)
      throw r(this, 4);
    var f = t.float.readFloatLE(this.buf, this.pos);
    return this.pos += 4, f;
  }, i.prototype.double = function() {
    if (this.pos + 8 > this.len)
      throw r(this, 4);
    var f = t.float.readDoubleLE(this.buf, this.pos);
    return this.pos += 8, f;
  }, i.prototype.bytes = function() {
    var f = this.uint32(), c = this.pos, l = this.pos + f;
    if (l > this.len)
      throw r(this, f);
    if (this.pos += f, Array.isArray(this.buf))
      return this.buf.slice(c, l);
    if (c === l) {
      var b = t.Buffer;
      return b ? b.alloc(0) : new this.buf.constructor(0);
    }
    return this._slice.call(this.buf, c, l);
  }, i.prototype.string = function() {
    var f = this.bytes();
    return o.read(f, 0, f.length);
  }, i.prototype.skip = function(f) {
    if (typeof f == "number") {
      if (this.pos + f > this.len)
        throw r(this, f);
      this.pos += f;
    } else
      do
        if (this.pos >= this.len)
          throw r(this);
      while (this.buf[this.pos++] & 128);
    return this;
  }, i.recursionLimit = t.recursionLimit, i.prototype.skipType = function(h, f) {
    if (f === void 0 && (f = 0), f > i.recursionLimit)
      throw Error("maximum nesting depth exceeded");
    switch (h) {
      case 0:
        this.skip();
        break;
      case 1:
        this.skip(8);
        break;
      case 2:
        this.skip(this.uint32());
        break;
      case 3:
        for (; (h = this.uint32() & 7) !== 4; )
          this.skipType(h, f + 1);
        break;
      case 5:
        this.skip(4);
        break;
      /* istanbul ignore next */
      default:
        throw Error("invalid wire type " + h + " at offset " + this.pos);
    }
    return this;
  }, i._configure = function(h) {
    e = h, i.create = a(), e._configure();
    var f = t.Long ? "toLong" : (
      /* istanbul ignore next */
      "toNumber"
    );
    t.merge(i.prototype, {
      int64: function() {
        return u.call(this)[f](!1);
      },
      uint64: function() {
        return u.call(this)[f](!0);
      },
      sint64: function() {
        return u.call(this).zzDecode()[f](!1);
      },
      fixed64: function() {
        return I.call(this)[f](!0);
      },
      sfixed64: function() {
        return I.call(this)[f](!1);
      }
    });
  }, de;
}
var le, Ze;
function _n() {
  if (Ze) return le;
  Ze = 1, le = n;
  var t = Ht();
  (n.prototype = Object.create(t.prototype)).constructor = n;
  var e = q();
  function n(o) {
    t.call(this, o);
  }
  return n._configure = function() {
    e.Buffer && (n.prototype._slice = e.Buffer.prototype.slice);
  }, n.prototype.string = function() {
    var r = this.uint32();
    return this.buf.utf8Slice ? this.buf.utf8Slice(this.pos, this.pos = Math.min(this.pos + r, this.len)) : this.buf.toString("utf-8", this.pos, this.pos = Math.min(this.pos + r, this.len));
  }, n._configure(), le;
}
var ce = {}, ge, We;
function pn() {
  if (We) return ge;
  We = 1, ge = e;
  var t = q();
  (e.prototype = Object.create(t.EventEmitter.prototype)).constructor = e;
  function e(n, o, r) {
    if (typeof n != "function")
      throw TypeError("rpcImpl must be a function");
    t.EventEmitter.call(this), this.rpcImpl = n, this.requestDelimited = !!o, this.responseDelimited = !!r;
  }
  return e.prototype.rpcCall = function n(o, r, i, s, a) {
    if (!s)
      throw TypeError("request must be specified");
    var u = this;
    if (!a)
      return t.asPromise(n, u, o, r, i, s);
    if (!u.rpcImpl) {
      setTimeout(function() {
        a(Error("already ended"));
      }, 0);
      return;
    }
    try {
      return u.rpcImpl(
        o,
        r[u.requestDelimited ? "encodeDelimited" : "encode"](s).finish(),
        function(I, h) {
          if (I)
            return u.emit("error", I, o), a(I);
          if (h === null) {
            u.end(
              /* endedByRPC */
              !0
            );
            return;
          }
          if (!(h instanceof i))
            try {
              h = i[u.responseDelimited ? "decodeDelimited" : "decode"](h);
            } catch (f) {
              return u.emit("error", f, o), a(f);
            }
          return u.emit("data", h, o), a(null, h);
        }
      );
    } catch (d) {
      u.emit("error", d, o), setTimeout(function() {
        a(d);
      }, 0);
      return;
    }
  }, e.prototype.end = function(o) {
    return this.rpcImpl && (o || this.rpcImpl(null, null, null), this.rpcImpl = null, this.emit("end").off()), this;
  }, ge;
}
var He;
function wn() {
  return He || (He = 1, (function(t) {
    var e = t;
    e.Service = pn();
  })(ce)), ce;
}
var ye, $e;
function In() {
  return $e || ($e = 1, ye = {}), ye;
}
var Je;
function En() {
  return Je || (Je = 1, (function(t) {
    var e = t;
    e.build = "minimal", e.Writer = Wt(), e.BufferWriter = yn(), e.Reader = Ht(), e.BufferReader = _n(), e.util = q(), e.rpc = wn(), e.roots = In(), e.configure = n;
    function n() {
      e.util._configure(), e.Writer._configure(e.BufferWriter), e.Reader._configure(e.BufferReader);
    }
    n();
  })(ee)), ee;
}
var _e, Ke;
function bn() {
  return Ke || (Ke = 1, _e = En()), _e;
}
var mn = bn();
const g = /* @__PURE__ */ on(mn);
var Xe = (() => {
  if (typeof Xe < "u")
    return Xe;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var Qe = (() => {
  if (typeof Qe < "u")
    return Qe;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var et = (() => {
  if (typeof et < "u")
    return et;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var tt = (() => {
  if (typeof tt < "u")
    return tt;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var nt;
(function(t) {
  t[t.CONSENT_PROOF_PAYLOAD_VERSION_UNSPECIFIED = 0] = "CONSENT_PROOF_PAYLOAD_VERSION_UNSPECIFIED", t[t.CONSENT_PROOF_PAYLOAD_VERSION_1 = 1] = "CONSENT_PROOF_PAYLOAD_VERSION_1", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(nt || (nt = {}));
var it = (() => {
  if (typeof it < "u")
    return it;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
g.util.Long !== p && (g.util.Long = p, g.configure());
var rt = (() => {
  if (typeof rt < "u")
    return rt;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var st;
(function(t) {
  t[t.COMPRESSION_DEFLATE = 0] = "COMPRESSION_DEFLATE", t[t.COMPRESSION_GZIP = 1] = "COMPRESSION_GZIP", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(st || (st = {}));
var ot = (() => {
  if (typeof ot < "u")
    return ot;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var at = (() => {
  if (typeof at < "u")
    return at;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
g.util.Long !== p && (g.util.Long = p, g.configure());
var ut = (() => {
  if (typeof ut < "u")
    return ut;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
g.util.Long !== p && (g.util.Long = p, g.configure());
g.util.Long !== p && (g.util.Long = p, g.configure());
var ft;
(function(t) {
  t[t.ERROR_CODE_UNSPECIFIED = 0] = "ERROR_CODE_UNSPECIFIED", t[t.ERROR_CODE_INVALID_INPUT = 1] = "ERROR_CODE_INVALID_INPUT", t[t.ERROR_CODE_NO_MATCHING_PREKEY = 2] = "ERROR_CODE_NO_MATCHING_PREKEY", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(ft || (ft = {}));
var ht;
(function(t) {
  t[t.JOB_TYPE_UNSPECIFIED = 0] = "JOB_TYPE_UNSPECIFIED", t[t.JOB_TYPE_REFRESH_V1 = 1] = "JOB_TYPE_REFRESH_V1", t[t.JOB_TYPE_REFRESH_V2 = 2] = "JOB_TYPE_REFRESH_V2", t[t.JOB_TYPE_REFRESH_PPPP = 3] = "JOB_TYPE_REFRESH_PPPP", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(ht || (ht = {}));
var dt;
(function(t) {
  t[t.KEYSTORE_STATUS_UNSPECIFIED = 0] = "KEYSTORE_STATUS_UNSPECIFIED", t[t.KEYSTORE_STATUS_UNINITIALIZED = 1] = "KEYSTORE_STATUS_UNINITIALIZED", t[t.KEYSTORE_STATUS_INITIALIZED = 2] = "KEYSTORE_STATUS_INITIALIZED", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(dt || (dt = {}));
var lt = (() => {
  if (typeof lt < "u")
    return lt;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var ct = (() => {
  if (typeof ct < "u")
    return ct;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var gt = (() => {
  if (typeof gt < "u")
    return gt;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
g.util.Long !== p && (g.util.Long = p, g.configure());
var yt;
(function(t) {
  t[t.SORT_DIRECTION_UNSPECIFIED = 0] = "SORT_DIRECTION_UNSPECIFIED", t[t.SORT_DIRECTION_ASCENDING = 1] = "SORT_DIRECTION_ASCENDING", t[t.SORT_DIRECTION_DESCENDING = 2] = "SORT_DIRECTION_DESCENDING", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(yt || (yt = {}));
var _t = (() => {
  if (typeof _t < "u")
    return _t;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var pt;
(function(t) {
  t[t.ADMIN_LIST_UPDATE_TYPE_UNSPECIFIED = 0] = "ADMIN_LIST_UPDATE_TYPE_UNSPECIFIED", t[t.ADMIN_LIST_UPDATE_TYPE_ADD_ADMIN = 1] = "ADMIN_LIST_UPDATE_TYPE_ADD_ADMIN", t[t.ADMIN_LIST_UPDATE_TYPE_REMOVE_ADMIN = 2] = "ADMIN_LIST_UPDATE_TYPE_REMOVE_ADMIN", t[t.ADMIN_LIST_UPDATE_TYPE_ADD_SUPER_ADMIN = 3] = "ADMIN_LIST_UPDATE_TYPE_ADD_SUPER_ADMIN", t[t.ADMIN_LIST_UPDATE_TYPE_REMOVE_SUPER_ADMIN = 4] = "ADMIN_LIST_UPDATE_TYPE_REMOVE_SUPER_ADMIN", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(pt || (pt = {}));
var wt;
(function(t) {
  t[t.PERMISSION_UPDATE_TYPE_UNSPECIFIED = 0] = "PERMISSION_UPDATE_TYPE_UNSPECIFIED", t[t.PERMISSION_UPDATE_TYPE_ADD_MEMBER = 1] = "PERMISSION_UPDATE_TYPE_ADD_MEMBER", t[t.PERMISSION_UPDATE_TYPE_REMOVE_MEMBER = 2] = "PERMISSION_UPDATE_TYPE_REMOVE_MEMBER", t[t.PERMISSION_UPDATE_TYPE_ADD_ADMIN = 3] = "PERMISSION_UPDATE_TYPE_ADD_ADMIN", t[t.PERMISSION_UPDATE_TYPE_REMOVE_ADMIN = 4] = "PERMISSION_UPDATE_TYPE_REMOVE_ADMIN", t[t.PERMISSION_UPDATE_TYPE_UPDATE_METADATA = 5] = "PERMISSION_UPDATE_TYPE_UPDATE_METADATA", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(wt || (wt = {}));
var It;
(function(t) {
  t[t.PERMISSION_POLICY_OPTION_UNSPECIFIED = 0] = "PERMISSION_POLICY_OPTION_UNSPECIFIED", t[t.PERMISSION_POLICY_OPTION_ALLOW = 1] = "PERMISSION_POLICY_OPTION_ALLOW", t[t.PERMISSION_POLICY_OPTION_DENY = 2] = "PERMISSION_POLICY_OPTION_DENY", t[t.PERMISSION_POLICY_OPTION_ADMIN_ONLY = 3] = "PERMISSION_POLICY_OPTION_ADMIN_ONLY", t[t.PERMISSION_POLICY_OPTION_SUPER_ADMIN_ONLY = 4] = "PERMISSION_POLICY_OPTION_SUPER_ADMIN_ONLY", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(It || (It = {}));
var Et = (() => {
  if (typeof Et < "u")
    return Et;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var bt;
(function(t) {
  t[t.COMPRESSION_DEFLATE = 0] = "COMPRESSION_DEFLATE", t[t.COMPRESSION_GZIP = 1] = "COMPRESSION_GZIP", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(bt || (bt = {}));
var mt;
(function(t) {
  t[t.DEVICE_SYNC_KIND_UNSPECIFIED = 0] = "DEVICE_SYNC_KIND_UNSPECIFIED", t[t.DEVICE_SYNC_KIND_MESSAGE_HISTORY = 1] = "DEVICE_SYNC_KIND_MESSAGE_HISTORY", t[t.DEVICE_SYNC_KIND_CONSENT = 2] = "DEVICE_SYNC_KIND_CONSENT", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(mt || (mt = {}));
var vt = (() => {
  if (typeof vt < "u")
    return vt;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var Nt = (() => {
  if (typeof Nt < "u")
    return Nt;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var Rt;
(function(t) {
  t[t.CONVERSATION_TYPE_UNSPECIFIED = 0] = "CONVERSATION_TYPE_UNSPECIFIED", t[t.CONVERSATION_TYPE_GROUP = 1] = "CONVERSATION_TYPE_GROUP", t[t.CONVERSATION_TYPE_DM = 2] = "CONVERSATION_TYPE_DM", t[t.CONVERSATION_TYPE_SYNC = 3] = "CONVERSATION_TYPE_SYNC", t[t.UNRECOGNIZED = -1] = "UNRECOGNIZED";
})(Rt || (Rt = {}));
g.util.Long !== p && (g.util.Long = p, g.configure());
g.util.Long !== p && (g.util.Long = p, g.configure());
function St() {
  return {
    initiatedByInboxId: "",
    addedInboxes: [],
    removedInboxes: [],
    metadataFieldChanges: []
  };
}
const Mt = {
  encode(t, e = g.Writer.create()) {
    t.initiatedByInboxId !== "" && e.uint32(10).string(t.initiatedByInboxId);
    for (const n of t.addedInboxes)
      F.encode(n, e.uint32(18).fork()).ldelim();
    for (const n of t.removedInboxes)
      F.encode(n, e.uint32(26).fork()).ldelim();
    for (const n of t.metadataFieldChanges)
      j.encode(n, e.uint32(34).fork()).ldelim();
    return e;
  },
  decode(t, e) {
    const n = t instanceof g.Reader ? t : new g.Reader(t);
    let o = e === void 0 ? n.len : n.pos + e;
    const r = St();
    for (; n.pos < o; ) {
      const i = n.uint32();
      switch (i >>> 3) {
        case 1:
          r.initiatedByInboxId = n.string();
          break;
        case 2:
          r.addedInboxes.push(F.decode(n, n.uint32()));
          break;
        case 3:
          r.removedInboxes.push(F.decode(n, n.uint32()));
          break;
        case 4:
          r.metadataFieldChanges.push(j.decode(n, n.uint32()));
          break;
        default:
          n.skipType(i & 7);
          break;
      }
    }
    return r;
  },
  fromJSON(t) {
    return {
      initiatedByInboxId: G(t.initiatedByInboxId) ? String(t.initiatedByInboxId) : "",
      addedInboxes: Array.isArray(t?.addedInboxes) ? t.addedInboxes.map((e) => F.fromJSON(e)) : [],
      removedInboxes: Array.isArray(t?.removedInboxes) ? t.removedInboxes.map((e) => F.fromJSON(e)) : [],
      metadataFieldChanges: Array.isArray(t?.metadataFieldChanges) ? t.metadataFieldChanges.map((e) => j.fromJSON(e)) : []
    };
  },
  toJSON(t) {
    const e = {};
    return t.initiatedByInboxId !== void 0 && (e.initiatedByInboxId = t.initiatedByInboxId), t.addedInboxes ? e.addedInboxes = t.addedInboxes.map((n) => n ? F.toJSON(n) : void 0) : e.addedInboxes = [], t.removedInboxes ? e.removedInboxes = t.removedInboxes.map((n) => n ? F.toJSON(n) : void 0) : e.removedInboxes = [], t.metadataFieldChanges ? e.metadataFieldChanges = t.metadataFieldChanges.map((n) => n ? j.toJSON(n) : void 0) : e.metadataFieldChanges = [], e;
  },
  fromPartial(t) {
    var e, n, o, r;
    const i = St();
    return i.initiatedByInboxId = (e = t.initiatedByInboxId) !== null && e !== void 0 ? e : "", i.addedInboxes = ((n = t.addedInboxes) === null || n === void 0 ? void 0 : n.map((s) => F.fromPartial(s))) || [], i.removedInboxes = ((o = t.removedInboxes) === null || o === void 0 ? void 0 : o.map((s) => F.fromPartial(s))) || [], i.metadataFieldChanges = ((r = t.metadataFieldChanges) === null || r === void 0 ? void 0 : r.map((s) => j.fromPartial(s))) || [], i;
  }
};
function Ot() {
  return { inboxId: "" };
}
const F = {
  encode(t, e = g.Writer.create()) {
    return t.inboxId !== "" && e.uint32(10).string(t.inboxId), e;
  },
  decode(t, e) {
    const n = t instanceof g.Reader ? t : new g.Reader(t);
    let o = e === void 0 ? n.len : n.pos + e;
    const r = Ot();
    for (; n.pos < o; ) {
      const i = n.uint32();
      i >>> 3 === 1 ? r.inboxId = n.string() : n.skipType(i & 7);
    }
    return r;
  },
  fromJSON(t) {
    return {
      inboxId: G(t.inboxId) ? String(t.inboxId) : ""
    };
  },
  toJSON(t) {
    const e = {};
    return t.inboxId !== void 0 && (e.inboxId = t.inboxId), e;
  },
  fromPartial(t) {
    var e;
    const n = Ot();
    return n.inboxId = (e = t.inboxId) !== null && e !== void 0 ? e : "", n;
  }
};
function Dt() {
  return { fieldName: "", oldValue: void 0, newValue: void 0 };
}
const j = {
  encode(t, e = g.Writer.create()) {
    return t.fieldName !== "" && e.uint32(10).string(t.fieldName), t.oldValue !== void 0 && e.uint32(18).string(t.oldValue), t.newValue !== void 0 && e.uint32(26).string(t.newValue), e;
  },
  decode(t, e) {
    const n = t instanceof g.Reader ? t : new g.Reader(t);
    let o = e === void 0 ? n.len : n.pos + e;
    const r = Dt();
    for (; n.pos < o; ) {
      const i = n.uint32();
      switch (i >>> 3) {
        case 1:
          r.fieldName = n.string();
          break;
        case 2:
          r.oldValue = n.string();
          break;
        case 3:
          r.newValue = n.string();
          break;
        default:
          n.skipType(i & 7);
          break;
      }
    }
    return r;
  },
  fromJSON(t) {
    return {
      fieldName: G(t.fieldName) ? String(t.fieldName) : "",
      oldValue: G(t.oldValue) ? String(t.oldValue) : void 0,
      newValue: G(t.newValue) ? String(t.newValue) : void 0
    };
  },
  toJSON(t) {
    const e = {};
    return t.fieldName !== void 0 && (e.fieldName = t.fieldName), t.oldValue !== void 0 && (e.oldValue = t.oldValue), t.newValue !== void 0 && (e.newValue = t.newValue), e;
  },
  fromPartial(t) {
    var e, n, o;
    const r = Dt();
    return r.fieldName = (e = t.fieldName) !== null && e !== void 0 ? e : "", r.oldValue = (n = t.oldValue) !== null && n !== void 0 ? n : void 0, r.newValue = (o = t.newValue) !== null && o !== void 0 ? o : void 0, r;
  }
};
var xt = (() => {
  if (typeof xt < "u")
    return xt;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
function G(t) {
  return t != null;
}
g.util.Long !== p && (g.util.Long = p, g.configure());
var Tt = (() => {
  if (typeof Tt < "u")
    return Tt;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var At = (() => {
  if (typeof At < "u")
    return At;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var Ft = (() => {
  if (typeof Ft < "u")
    return Ft;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
var Lt = (() => {
  if (typeof Lt < "u")
    return Lt;
  if (typeof self < "u")
    return self;
  if (typeof window < "u")
    return window;
  if (typeof global < "u")
    return global;
  throw "Unable to locate global object";
})();
g.util.Long !== p && (g.util.Long = p, g.configure());
const $t = new tn({ authorityId: "xmtp.org", typeId: "group_updated", versionMajor: 1, versionMinor: 0 });
let vn = class {
  get contentType() {
    return $t;
  }
  encode(e) {
    return { type: this.contentType, parameters: {}, content: Mt.encode(e).finish() };
  }
  decode(e) {
    return Mt.decode(e.content);
  }
  fallback() {
  }
  shouldPush() {
    return !1;
  }
}, Jt = class Kt {
  authorityId;
  typeId;
  versionMajor;
  versionMinor;
  constructor(e) {
    this.authorityId = e.authorityId, this.typeId = e.typeId, this.versionMajor = e.versionMajor, this.versionMinor = e.versionMinor;
  }
  toString() {
    return `${this.authorityId}/${this.typeId}:${this.versionMajor}.${this.versionMinor}`;
  }
  static fromString(e) {
    const [n, o] = e.split(":"), [r, i] = n.split("/"), [s, a] = o.split(".");
    return new Kt({ authorityId: r, typeId: i, versionMajor: Number(s), versionMinor: Number(a) });
  }
  sameAs(e) {
    return this.authorityId === e.authorityId && this.typeId === e.typeId;
  }
};
const X = new Jt({ authorityId: "xmtp.org", typeId: "text", versionMajor: 1, versionMinor: 0 });
var Q;
(function(t) {
  t.utf8 = "UTF-8", t.unknown = "unknown";
})(Q || (Q = {}));
class Nn {
  get contentType() {
    return X;
  }
  encode(e) {
    return { type: X, parameters: { encoding: Q.utf8 }, content: new TextEncoder().encode(e) };
  }
  decode(e) {
    if (e.parameters.encoding !== Q.utf8) throw new Error(`unrecognized encoding ${e.parameters.encoding}`);
    return new TextDecoder().decode(e.content);
  }
  fallback() {
  }
  shouldPush() {
    return !0;
  }
}
let m, Rn = typeof TextDecoder < "u" ? new TextDecoder("utf-8", { ignoreBOM: !0, fatal: !0 }) : { decode: () => {
  throw Error("TextDecoder not available");
} };
typeof TextDecoder < "u" && Rn.decode();
const pe = typeof TextEncoder < "u" ? new TextEncoder("utf-8") : { encode: () => {
  throw Error("TextEncoder not available");
} };
pe.encodeInto;
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => {
  m.__wbindgen_export_7.get(t.dtor)(t.a, t.b);
});
const J = Object.freeze({
  Dm: 0,
  0: "Dm",
  Group: 1,
  1: "Group",
  Sync: 2,
  2: "Sync",
  Oneshot: 3,
  3: "Oneshot"
}), we = Object.freeze({
  Unpublished: 0,
  0: "Unpublished",
  Published: 1,
  1: "Published",
  Failed: 2,
  2: "Failed"
}), ve = Object.freeze({
  Application: 0,
  0: "Application",
  MembershipChange: 1,
  1: "MembershipChange"
});
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_apistats_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_client_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_consent_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_contenttypeid_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_conversation_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_conversationdebuginfo_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_conversationlistitem_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_conversations_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_createdmoptions_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_creategroupoptions_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_encodedcontent_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_groupmember_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_groupmetadata_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_grouppermissions_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_hmackey_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_identitystats_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_inboxstate_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_installation_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_intounderlyingbytesource_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_intounderlyingsink_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_intounderlyingsource_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_keypackagestatus_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_lifetime_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_listconversationsoptions_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_listmessagesoptions_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_logoptions_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_message_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_messagedisappearingsettings_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_messagewithreactions_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_multiremoteattachment_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_opfs_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_passkeysignature_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_permissionpolicyset_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_reaction_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_remoteattachmentinfo_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_signaturerequesthandle_free(t >>> 0, 1));
typeof FinalizationRegistry > "u" || new FinalizationRegistry((t) => m.__wbg_streamcloser_free(t >>> 0, 1));
const R = [];
for (let t = 0; t < 256; ++t)
  R.push((t + 256).toString(16).slice(1));
function Sn(t, e = 0) {
  return (R[t[e + 0]] + R[t[e + 1]] + R[t[e + 2]] + R[t[e + 3]] + "-" + R[t[e + 4]] + R[t[e + 5]] + "-" + R[t[e + 6]] + R[t[e + 7]] + "-" + R[t[e + 8]] + R[t[e + 9]] + "-" + R[t[e + 10]] + R[t[e + 11]] + R[t[e + 12]] + R[t[e + 13]] + R[t[e + 14]] + R[t[e + 15]]).toLowerCase();
}
let Ie;
const Mn = new Uint8Array(16);
function On() {
  if (!Ie) {
    if (typeof crypto > "u" || !crypto.getRandomValues)
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    Ie = crypto.getRandomValues.bind(crypto);
  }
  return Ie(Mn);
}
const Dn = typeof crypto < "u" && crypto.randomUUID && crypto.randomUUID.bind(crypto), Ct = { randomUUID: Dn };
function M(t, e, n) {
  if (Ct.randomUUID && !t)
    return Ct.randomUUID();
  t = t || {};
  const o = t.random ?? t.rng?.() ?? On();
  if (o.length < 16)
    throw new Error("Random bytes length must be >= 16");
  return o[6] = o[6] & 15 | 64, o[8] = o[8] & 63 | 128, Sn(o);
}
const Pt = (t) => {
  console.error(t.message);
};
class xn {
  #e;
  #t;
  #i = /* @__PURE__ */ new Map();
  constructor(e, n) {
    this.#e = e, this.#e.addEventListener("message", this.handleMessage), n && this.#e.addEventListener("error", Pt), this.#t = n;
  }
  sendMessage(e, n) {
    const o = M();
    return this.#e.postMessage({ action: e, id: o, data: n }), new Promise(((r, i) => {
      this.#i.set(o, { resolve: r, reject: i });
    }));
  }
  handleMessage = (e) => {
    const n = e.data;
    this.#t && console.log("client received event data", n);
    const o = this.#i.get(n.id);
    o && (this.#i.delete(n.id), "error" in n ? o.reject(n.error) : o.resolve(n.result));
  };
  handleStreamMessage = (e, n, o) => {
    const r = (i) => {
      const s = i.data;
      if (s.streamId === e) {
        if (s.action === "stream.fail") return void o?.onFail?.();
        "error" in s ? n(s.error, void 0) : n(null, s.result);
      }
    };
    return this.#e.addEventListener("message", r), async () => {
      await this.sendMessage("endStream", { streamId: e }), this.#e.removeEventListener("message", r);
    };
  };
  close() {
    this.#e.removeEventListener("message", this.handleMessage), this.#t && this.#e.removeEventListener("error", Pt), this.#e.terminate();
  }
}
const Tn = (t) => ({ authorityId: t.authorityId, typeId: t.typeId, versionMajor: t.versionMajor, versionMinor: t.versionMinor }), Xt = (t) => new Jt({ authorityId: t.authorityId, typeId: t.typeId, versionMajor: t.versionMajor, versionMinor: t.versionMinor }), An = (t) => ({ type: Tn(t.type), parameters: t.parameters, fallback: t.fallback, compression: t.compression, content: t.content }), Fn = (t) => ({ type: Xt(t.type), parameters: t.parameters, fallback: t.fallback, compression: t.compression, content: t.content });
class Z {
  #e;
  content;
  contentType;
  conversationId;
  deliveryStatus;
  fallback;
  compression;
  id;
  kind;
  parameters;
  encodedContent;
  senderInboxId;
  sentAtNs;
  constructor(e, n) {
    switch (this.#e = e, this.id = n.id, this.sentAtNs = n.sentAtNs, this.conversationId = n.convoId, this.senderInboxId = n.senderInboxId, this.encodedContent = n.content, n.kind) {
      case ve.Application:
        this.kind = "application";
        break;
      case ve.MembershipChange:
        this.kind = "membership_change";
    }
    switch (n.deliveryStatus) {
      case we.Unpublished:
        this.deliveryStatus = "unpublished";
        break;
      case we.Published:
        this.deliveryStatus = "published";
        break;
      case we.Failed:
        this.deliveryStatus = "failed";
    }
    this.contentType = Xt(n.content.type), this.parameters = new Map(Object.entries(n.content.parameters)), this.fallback = n.content.fallback, this.compression = n.content.compression;
    try {
      this.content = this.#e.decodeContent(n, this.contentType);
    } catch {
      this.content = void 0;
    }
  }
}
class k extends Error {
  constructor() {
    super("Signer unavailable, use Client.create to create a client with a signer");
  }
}
class Ut extends Error {
  constructor(e) {
    super(`Codec not found for "${e.toString()}" content type`);
  }
}
class Bt extends Error {
  constructor() {
    super("Unable to create add account signature text, `allowInboxReassign` must be true");
  }
}
class Ln extends Error {
  constructor(e) {
    super(`Account already associated with inbox ${e}`);
  }
}
class Cn extends Error {
  constructor(e) {
    super(`Invalid group membership change for message ${e}`);
  }
}
class qt extends Error {
  constructor() {
    super("Content type is required when sending content other than text");
  }
}
class zt extends Error {
  constructor(e) {
    super(`Stream failed, retried ${e} ${"time" + (e !== 1 ? "s" : "")}`);
  }
}
class Pn extends Error {
  constructor() {
    super("Stream retry attempts must be greater than 0");
  }
}
class Un {
  isDone = !1;
  #e = [];
  #t;
  onDone;
  onReturn;
  constructor() {
    this.#t = [], this.isDone = !1;
  }
  flush() {
    for (; this.#e.length > 0; ) {
      const e = this.#e.shift();
      e && e({ done: !0, value: void 0 });
    }
  }
  done() {
    this.flush(), this.#t = [], this.#e = [], this.isDone = !0, this.onDone?.();
  }
  push = (e) => {
    if (this.isDone) return;
    const n = this.#e.shift();
    n ? n({ done: !1, value: e }) : this.#t.push(e);
  };
  next = () => this.isDone ? Promise.resolve({ done: !0, value: void 0 }) : this.#t.length > 0 ? Promise.resolve({ done: !1, value: this.#t.shift() }) : new Promise(((e) => {
    this.#e.push(e);
  }));
  return = () => (this.onReturn?.(), this.done(), Promise.resolve({ done: !0, value: void 0 }));
  end = () => this.return();
  [Symbol.asyncIterator]() {
    return this;
  }
}
const Qt = ["end", "isDone", "next", "return", Symbol.asyncIterator], Ee = (t) => Qt.includes(t), Bn = 1e4, qn = 6, W = async (t, e, n) => {
  const { onEnd: o, onError: r, onFail: i, onRestart: s, onRetry: a, onValue: u, retryAttempts: d = qn, retryDelay: I = Bn, retryOnFail: h = !0 } = n ?? {};
  if (h && d < 0) throw new Pn();
  const f = new Un(), c = (w, y) => {
    if (w) r?.(w);
    else if (y !== void 0) try {
      if (e) {
        const E = e(y);
        ((N) => !!N && (typeof N == "object" || typeof N == "function") && "then" in N && typeof N.then == "function")(E) ? E.then(((N) => {
          f.push(N), u?.(N);
        })).catch(((N) => {
          r?.(N);
        })) : (f.push(E), u?.(E));
      } else f.push(y), u?.(y);
    } catch (E) {
      r?.(E);
    }
  }, l = async (w = d) => {
    try {
      if (w === 0) throw f.end(), new zt(d);
      await (y = I, new Promise(((N) => setTimeout(N, y)))), a?.(d - w + 1, d);
      const E = await t(c, (() => {
        i?.(), l();
      }));
      f.onDone = () => {
        E(), o?.();
      }, s?.();
    } catch (E) {
      r?.(E), l(w - 1);
    }
    var y;
  }, b = () => {
    if (!h) throw f.end(), new zt(0);
    l();
  };
  try {
    const w = await t(c, (() => {
      i?.(), b();
    }));
    f.onDone = () => {
      w(), o?.();
    };
  } catch (w) {
    r?.(w), b();
  }
  return new Proxy(f, { get(w, y, E) {
    if (Ee(y)) return Reflect.get(w, y, E);
  }, set: () => !0, has: (w, y) => Ee(y), ownKeys: () => Qt, getOwnPropertyDescriptor(w, y) {
    if (Ee(y)) return { enumerable: !0, configurable: !0, value: Reflect.get(w, y) };
  } });
};
class en {
  #e;
  #t;
  #i;
  #n;
  #s;
  #o;
  constructor(e, n, o) {
    this.#t = e, this.#n = n, this.#a(o);
  }
  #a(e) {
    this.#e = e?.addedByInboxId, this.#s = e?.metadata, this.#i = e?.createdAtNs, this.#o = e?.isCommitLogForked;
  }
  get id() {
    return this.#n;
  }
  get isCommitLogForked() {
    return this.#o;
  }
  get addedByInboxId() {
    return this.#e;
  }
  get createdAtNs() {
    return this.#i;
  }
  get createdAt() {
    return this.#i ? (e = this.#i, new Date(Number(e / 1000000n))) : void 0;
    var e;
  }
  get metadata() {
    return this.#s;
  }
  async lastMessage() {
    const e = await this.#t.sendMessage("conversation.lastMessage", { id: this.#n });
    return e ? new Z(this.#t, e) : void 0;
  }
  async isActive() {
    return this.#t.sendMessage("conversation.isActive", { id: this.#n });
  }
  async members() {
    return this.#t.sendMessage("conversation.members", { id: this.#n });
  }
  async sync() {
    const e = await this.#t.sendMessage("conversation.sync", { id: this.#n });
    return this.#a(e), e;
  }
  async publishMessages() {
    return this.#t.sendMessage("conversation.publishMessages", { id: this.#n });
  }
  async sendOptimistic(e, n) {
    if (typeof e != "string" && !n) throw new qt();
    const o = typeof e == "string" ? this.#t.encodeContent(e, n ?? X) : this.#t.encodeContent(e, n);
    return this.#t.sendMessage("conversation.sendOptimistic", { id: this.#n, content: o });
  }
  async send(e, n) {
    if (typeof e != "string" && !n) throw new qt();
    const o = typeof e == "string" ? this.#t.encodeContent(e, n ?? X) : this.#t.encodeContent(e, n);
    return this.#t.sendMessage("conversation.send", { id: this.#n, content: o });
  }
  async messages(e) {
    return (await this.#t.sendMessage("conversation.messages", { id: this.#n, options: e })).map(((n) => new Z(this.#t, n)));
  }
  async consentState() {
    return this.#t.sendMessage("conversation.consentState", { id: this.#n });
  }
  async updateConsentState(e) {
    return this.#t.sendMessage("conversation.updateConsentState", { id: this.#n, state: e });
  }
  async messageDisappearingSettings() {
    return this.#t.sendMessage("conversation.messageDisappearingSettings", { id: this.#n });
  }
  async updateMessageDisappearingSettings(e, n) {
    return this.#t.sendMessage("conversation.updateMessageDisappearingSettings", { id: this.#n, fromNs: e, inNs: n });
  }
  async removeMessageDisappearingSettings() {
    return this.#t.sendMessage("conversation.removeMessageDisappearingSettings", { id: this.#n });
  }
  async isMessageDisappearingEnabled() {
    return this.#t.sendMessage("conversation.isMessageDisappearingEnabled", { id: this.#n });
  }
  async stream(e) {
    return W((async (n, o) => {
      const r = M();
      return await this.sync(), await this.#t.sendMessage("conversation.stream", { groupId: this.#n, streamId: r }), this.#t.handleStreamMessage(r, n, { ...e, onFail: o });
    }), ((n) => new Z(this.#t, n)), e);
  }
  async pausedForVersion() {
    return this.#t.sendMessage("conversation.pausedForVersion", { id: this.#n });
  }
  async getHmacKeys() {
    return this.#t.sendMessage("conversation.getHmacKeys", { id: this.#n });
  }
  async debugInfo() {
    return this.#t.sendMessage("conversation.debugInfo", { id: this.#n });
  }
}
class C extends en {
  #e;
  #t;
  constructor(e, n, o) {
    super(e, n, o), this.#e = e, this.#t = n;
  }
  async peerInboxId() {
    return this.#e.sendMessage("dm.peerInboxId", { id: this.#t });
  }
  async getDuplicateDms() {
    return this.#e.sendMessage("dm.getDuplicateDms", { id: this.#t });
  }
}
class P extends en {
  #e = [];
  #t;
  #i;
  #n;
  #s;
  #o;
  #a = [];
  #u(e) {
    this.#o = e?.name ?? "", this.#s = e?.imageUrl ?? "", this.#i = e?.description ?? "", this.#e = e?.admins ?? [], this.#a = e?.superAdmins ?? [];
  }
  constructor(e, n, o) {
    super(e, n, o), this.#t = e, this.#n = n, this.#u(o);
  }
  async sync() {
    const e = await super.sync();
    return this.#u(e), e;
  }
  get name() {
    return this.#o;
  }
  async updateName(e) {
    await this.#t.sendMessage("group.updateName", { id: this.#n, name: e }), this.#o = e;
  }
  get imageUrl() {
    return this.#s;
  }
  async updateImageUrl(e) {
    await this.#t.sendMessage("group.updateImageUrl", { id: this.#n, imageUrl: e }), this.#s = e;
  }
  get description() {
    return this.#i;
  }
  async updateDescription(e) {
    await this.#t.sendMessage("group.updateDescription", { id: this.#n, description: e }), this.#i = e;
  }
  get admins() {
    return this.#e;
  }
  get superAdmins() {
    return this.#a;
  }
  async listAdmins() {
    const e = await this.#t.sendMessage("group.listAdmins", { id: this.#n });
    return this.#e = e, e;
  }
  async listSuperAdmins() {
    const e = await this.#t.sendMessage("group.listSuperAdmins", { id: this.#n });
    return this.#a = e, e;
  }
  async permissions() {
    return this.#t.sendMessage("group.permissions", { id: this.#n });
  }
  async updatePermission(e, n, o) {
    return this.#t.sendMessage("group.updatePermission", { id: this.#n, permissionType: e, policy: n, metadataField: o });
  }
  async isAdmin(e) {
    return (await this.listAdmins()).includes(e);
  }
  async isSuperAdmin(e) {
    return (await this.listSuperAdmins()).includes(e);
  }
  async addMembersByIdentifiers(e) {
    return this.#t.sendMessage("group.addMembersByIdentifiers", { id: this.#n, identifiers: e });
  }
  async addMembers(e) {
    return this.#t.sendMessage("group.addMembers", { id: this.#n, inboxIds: e });
  }
  async removeMembersByIdentifiers(e) {
    return this.#t.sendMessage("group.removeMembersByIdentifiers", { id: this.#n, identifiers: e });
  }
  async removeMembers(e) {
    return this.#t.sendMessage("group.removeMembers", { id: this.#n, inboxIds: e });
  }
  async addAdmin(e) {
    return this.#t.sendMessage("group.addAdmin", { id: this.#n, inboxId: e });
  }
  async removeAdmin(e) {
    return this.#t.sendMessage("group.removeAdmin", { id: this.#n, inboxId: e });
  }
  async addSuperAdmin(e) {
    return this.#t.sendMessage("group.addSuperAdmin", { id: this.#n, inboxId: e });
  }
  async removeSuperAdmin(e) {
    return this.#t.sendMessage("group.removeSuperAdmin", { id: this.#n, inboxId: e });
  }
}
class zn {
  #e;
  constructor(e) {
    this.#e = e;
  }
  async sync() {
    return this.#e.sendMessage("conversations.sync", void 0);
  }
  async syncAll(e) {
    return this.#e.sendMessage("conversations.syncAll", { consentStates: e });
  }
  async getConversationById(e) {
    const n = await this.#e.sendMessage("conversations.getConversationById", { id: e });
    if (n) return n.metadata.conversationType === "group" ? new P(this.#e, n.id, n) : new C(this.#e, n.id, n);
  }
  async getMessageById(e) {
    const n = await this.#e.sendMessage("conversations.getMessageById", { id: e });
    return n ? new Z(this.#e, n) : void 0;
  }
  async getDmByInboxId(e) {
    const n = await this.#e.sendMessage("conversations.getDmByInboxId", { inboxId: e });
    return n ? new C(this.#e, n.id, n) : void 0;
  }
  async getDmByIdentifier(e) {
    const n = await this.#e.findInboxIdByIdentifier(e);
    if (n) return this.getDmByInboxId(n);
  }
  async list(e) {
    return (await this.#e.sendMessage("conversations.list", { options: e })).map(((n) => {
      switch (n.metadata.conversationType) {
        case "dm":
          return new C(this.#e, n.id, n);
        case "group":
          return new P(this.#e, n.id, n);
        default:
          return;
      }
    })).filter(((n) => n !== void 0));
  }
  async listGroups(e) {
    return (await this.#e.sendMessage("conversations.listGroups", { options: e })).map(((n) => new P(this.#e, n.id, n)));
  }
  async listDms(e) {
    return (await this.#e.sendMessage("conversations.listDms", { options: e })).map(((n) => new C(this.#e, n.id, n)));
  }
  async newGroupOptimistic(e) {
    const n = await this.#e.sendMessage("conversations.newGroupOptimistic", { options: e });
    return new P(this.#e, n.id, n);
  }
  async newGroupWithIdentifiers(e, n) {
    const o = await this.#e.sendMessage("conversations.newGroupWithIdentifiers", { identifiers: e, options: n });
    return new P(this.#e, o.id, o);
  }
  async newGroup(e, n) {
    const o = await this.#e.sendMessage("conversations.newGroup", { inboxIds: e, options: n });
    return new P(this.#e, o.id, o);
  }
  async newDmWithIdentifier(e, n) {
    const o = await this.#e.sendMessage("conversations.newDmWithIdentifier", { identifier: e, options: n });
    return new C(this.#e, o.id, o);
  }
  async newDm(e, n) {
    const o = await this.#e.sendMessage("conversations.newDm", { inboxId: e, options: n });
    return new C(this.#e, o.id, o);
  }
  async getHmacKeys() {
    return this.#e.sendMessage("conversations.getHmacKeys", void 0);
  }
  async stream(e) {
    return W((async (n, o) => {
      const r = M();
      return await this.sync(), await this.#e.sendMessage("conversations.stream", { streamId: r, conversationType: e?.conversationType }), this.#e.handleStreamMessage(r, n, { ...e, onFail: o });
    }), ((n) => n.metadata.conversationType === "group" ? new P(this.#e, n.id, n) : new C(this.#e, n.id, n)), e);
  }
  async streamGroups(e) {
    return this.stream({ ...e, conversationType: J.Group });
  }
  async streamDms(e) {
    return this.stream({ ...e, conversationType: J.Dm });
  }
  async streamAllMessages(e) {
    return W((async (n, o) => {
      const r = M();
      return await this.sync(), await this.#e.sendMessage("conversations.streamAllMessages", { streamId: r, conversationType: e?.conversationType, consentStates: e?.consentStates }), this.#e.handleStreamMessage(r, n, { ...e, onFail: o });
    }), ((n) => new Z(this.#e, n)), e);
  }
  async streamAllGroupMessages(e) {
    return this.streamAllMessages({ ...e, conversationType: J.Group });
  }
  async streamAllDmMessages(e) {
    return this.streamAllMessages({ ...e, conversationType: J.Dm });
  }
}
class kn {
  #e;
  constructor(e) {
    this.#e = e;
  }
  apiStatistics() {
    return this.#e.sendMessage("debugInformation.apiStatistics", void 0);
  }
  apiIdentityStatistics() {
    return this.#e.sendMessage("debugInformation.apiIdentityStatistics", void 0);
  }
  apiAggregateStatistics() {
    return this.#e.sendMessage("debugInformation.apiAggregateStatistics", void 0);
  }
  clearAllStatistics() {
    return this.#e.sendMessage("debugInformation.clearAllStatistics", void 0);
  }
  uploadDebugArchive(e) {
    return this.#e.sendMessage("debugInformation.uploadDebugArchive", { serverUrl: e });
  }
}
class Yn {
  #e;
  constructor(e) {
    this.#e = e;
  }
  sync() {
    return this.#e.sendMessage("preferences.sync", void 0);
  }
  async inboxState(e) {
    return this.#e.sendMessage("preferences.inboxState", { refreshFromNetwork: e ?? !1 });
  }
  async inboxStateFromInboxIds(e, n) {
    return this.#e.sendMessage("preferences.inboxStateFromInboxIds", { inboxIds: e, refreshFromNetwork: n ?? !1 });
  }
  async getLatestInboxState(e) {
    return this.#e.sendMessage("preferences.getLatestInboxState", { inboxId: e });
  }
  async setConsentStates(e) {
    return this.#e.sendMessage("preferences.setConsentStates", { records: e });
  }
  async getConsentState(e, n) {
    return this.#e.sendMessage("preferences.getConsentState", { entityType: e, entity: n });
  }
  async streamConsent(e) {
    return W((async (n, o) => {
      const r = M();
      return await this.sync(), await this.#e.sendMessage("preferences.streamConsent", { streamId: r }), this.#e.handleStreamMessage(r, n, { ...e, onFail: o });
    }), void 0, e);
  }
  async streamPreferences(e) {
    return W((async (n, o) => {
      const r = M();
      return await this.sync(), await this.#e.sendMessage("preferences.streamPreferences", { streamId: r }), this.#e.handleStreamMessage(r, n, { ...e, onFail: o });
    }), void 0, e);
  }
}
const U = async (t, e) => {
  switch (t.type) {
    case "EOA":
      return { type: "EOA", identifier: await t.getIdentifier(), signature: e };
    case "SCW":
      return { type: "SCW", identifier: await t.getIdentifier(), signature: e, chainId: t.getChainId(), blockNumber: t.getBlockNumber?.() };
  }
}, kt = (t) => {
  console.error(t.message);
};
class Vn {
  #e;
  #t;
  #i = /* @__PURE__ */ new Map();
  constructor(e, n) {
    this.#e = e, this.#e.addEventListener("message", this.handleMessage), n && this.#e.addEventListener("error", kt), this.#t = n;
  }
  async init() {
    return this.sendMessage("utils.init", { enableLogging: this.#t });
  }
  sendMessage(e, n) {
    const o = M();
    return this.#e.postMessage({ action: e, id: o, data: n }), new Promise(((r, i) => {
      this.#i.set(o, { resolve: r, reject: i });
    }));
  }
  handleMessage = (e) => {
    const n = e.data;
    this.#t && console.log("utils received event data", n);
    const o = this.#i.get(n.id);
    o && (this.#i.delete(n.id), "error" in n ? o.reject(n.error) : o.resolve(n.result));
  };
  close() {
    this.#e.removeEventListener("message", this.handleMessage), this.#t && this.#e.removeEventListener("error", kt), this.#e.terminate();
  }
}
class be extends Vn {
  constructor(e) {
    super(new Worker(new URL(
      /* @vite-ignore */
      "/js/assets/utils-D10RyjbE.js",
      import.meta.url
    ), { type: "module" }), e ?? !1);
  }
  async generateInboxId(e) {
    return this.sendMessage("utils.generateInboxId", { identifier: e });
  }
  async getInboxIdForIdentifier(e, n) {
    return this.sendMessage("utils.getInboxIdForIdentifier", { identifier: e, env: n });
  }
  async revokeInstallationsSignatureText(e, n, o, r) {
    return this.sendMessage("utils.revokeInstallationsSignatureText", { env: r, identifier: e, inboxId: n, installationIds: o, signatureRequestId: M() });
  }
  async revokeInstallations(e, n, o, r) {
    const i = await e.getIdentifier(), { signatureText: s, signatureRequestId: a } = await this.revokeInstallationsSignatureText(i, n, o, r), u = await e.signMessage(s), d = await U(e, u);
    return this.sendMessage("utils.revokeInstallations", { signer: d, signatureRequestId: a, env: r });
  }
  async inboxStateFromInboxIds(e, n) {
    return this.sendMessage("utils.inboxStateFromInboxIds", { inboxIds: e, env: n });
  }
}
class Ne extends xn {
  #e;
  #t;
  #i;
  #n;
  #s;
  #o;
  #a;
  #u = !1;
  #h;
  #r;
  #f;
  constructor(e) {
    super(new Worker(new URL(
      /* @vite-ignore */
      "/js/assets/client-BTmCTYKi.js",
      import.meta.url
    ), { type: "module" }), e?.loggingLevel !== void 0 && e.loggingLevel !== "off"), this.#f = e, this.#t = new zn(this), this.#i = new kn(this), this.#h = new Yn(this);
    const n = [new vn(), new Nn(), ...e?.codecs ?? []];
    this.#e = new Map(n.map(((o) => [o.contentType.toString(), o])));
  }
  async init(e) {
    const n = await this.sendMessage("client.init", { identifier: e, options: this.#f });
    this.#n = e, this.#s = n.inboxId, this.#o = n.installationId, this.#a = n.installationIdBytes, this.#u = !0;
  }
  static async create(e, n) {
    const o = new Ne(n);
    return o.#r = e, await o.init(await e.getIdentifier()), n?.disableAutoRegister || await o.register(), o;
  }
  static async build(e, n) {
    const o = new Ne({ ...n, disableAutoRegister: !0 });
    return await o.init(e), o;
  }
  get options() {
    return this.#f;
  }
  get signer() {
    return this.#r;
  }
  get isReady() {
    return this.#u;
  }
  get inboxId() {
    return this.#s;
  }
  get accountIdentifier() {
    return this.#n;
  }
  get installationId() {
    return this.#o;
  }
  get installationIdBytes() {
    return this.#a;
  }
  get conversations() {
    return this.#t;
  }
  get debugInformation() {
    return this.#i;
  }
  get preferences() {
    return this.#h;
  }
  async unsafe_createInboxSignatureText() {
    return this.sendMessage("client.createInboxSignatureText", { signatureRequestId: M() });
  }
  async unsafe_addAccountSignatureText(e, n = !1) {
    if (!n) throw new Bt();
    return this.sendMessage("client.addAccountSignatureText", { newIdentifier: e, signatureRequestId: M() });
  }
  async unsafe_removeAccountSignatureText(e) {
    return this.sendMessage("client.removeAccountSignatureText", { identifier: e, signatureRequestId: M() });
  }
  async unsafe_revokeAllOtherInstallationsSignatureText() {
    return this.sendMessage("client.revokeAllOtherInstallationsSignatureText", { signatureRequestId: M() });
  }
  async unsafe_revokeInstallationsSignatureText(e) {
    return this.sendMessage("client.revokeInstallationsSignatureText", { installationIds: e, signatureRequestId: M() });
  }
  async unsafe_changeRecoveryIdentifierSignatureText(e) {
    return this.sendMessage("client.changeRecoveryIdentifierSignatureText", { identifier: e, signatureRequestId: M() });
  }
  async unsafe_applySignatureRequest(e, n) {
    return this.sendMessage("client.applySignatureRequest", { signer: e, signatureRequestId: n });
  }
  async register() {
    if (!this.#r) throw new k();
    const { signatureText: e, signatureRequestId: n } = await this.unsafe_createInboxSignatureText();
    if (!e || !n) return;
    const o = await this.#r.signMessage(e), r = await U(this.#r, o);
    return this.sendMessage("client.registerIdentity", { signer: r, signatureRequestId: n });
  }
  async unsafe_addAccount(e, n = !1) {
    if (!this.#r) throw new k();
    if (!n) throw new Bt();
    const o = await this.findInboxIdByIdentifier(await e.getIdentifier());
    if (o) throw new Ln(o);
    const { signatureText: r, signatureRequestId: i } = await this.unsafe_addAccountSignatureText(await e.getIdentifier(), !0), s = await e.signMessage(r), a = await U(e, s);
    return this.sendMessage("client.addAccount", { identifier: a.identifier, signer: a, signatureRequestId: i });
  }
  async removeAccount(e) {
    if (!this.#r) throw new k();
    const { signatureText: n, signatureRequestId: o } = await this.unsafe_removeAccountSignatureText(e), r = await this.#r.signMessage(n), i = await U(this.#r, r);
    return this.sendMessage("client.removeAccount", { identifier: e, signer: i, signatureRequestId: o });
  }
  async revokeAllOtherInstallations() {
    if (!this.#r) throw new k();
    const { signatureText: e, signatureRequestId: n } = await this.unsafe_revokeAllOtherInstallationsSignatureText(), o = await this.#r.signMessage(e), r = await U(this.#r, o);
    return this.sendMessage("client.revokeAllOtherInstallations", { signer: r, signatureRequestId: n });
  }
  async revokeInstallations(e) {
    if (!this.#r) throw new k();
    const { signatureText: n, signatureRequestId: o } = await this.unsafe_revokeInstallationsSignatureText(e), r = await this.#r.signMessage(n), i = await U(this.#r, r);
    return this.sendMessage("client.revokeInstallations", { installationIds: e, signer: i, signatureRequestId: o });
  }
  static async revokeInstallations(e, n, o, r, i) {
    const s = new be(i);
    await s.init(), await s.revokeInstallations(e, n, o, r), s.close();
  }
  static async inboxStateFromInboxIds(e, n, o) {
    const r = new be(o);
    await r.init();
    const i = await r.inboxStateFromInboxIds(e, n);
    return r.close(), i;
  }
  async changeRecoveryIdentifier(e) {
    if (!this.#r) throw new k();
    const { signatureText: n, signatureRequestId: o } = await this.unsafe_changeRecoveryIdentifierSignatureText(e), r = await this.#r.signMessage(n), i = await U(this.#r, r);
    return this.sendMessage("client.changeRecoveryIdentifier", { identifier: e, signer: i, signatureRequestId: o });
  }
  async isRegistered() {
    return this.sendMessage("client.isRegistered", void 0);
  }
  async canMessage(e) {
    return this.sendMessage("client.canMessage", { identifiers: e });
  }
  static async canMessage(e, n) {
    const o = /* @__PURE__ */ new Map(), r = new be();
    for (const i of e) {
      const s = await r.getInboxIdForIdentifier(i, n);
      o.set(i.identifier.toLowerCase(), s !== void 0);
    }
    return r.close(), o;
  }
  async findInboxIdByIdentifier(e) {
    return this.sendMessage("client.findInboxIdByIdentifier", { identifier: e });
  }
  codecFor(e) {
    return this.#e.get(e.toString());
  }
  encodeContent(e, n) {
    const o = this.codecFor(n);
    if (!o) throw new Ut(n);
    const r = o.encode(e, this), i = o.fallback(e);
    return i && (r.fallback = i), An(r);
  }
  decodeContent(e, n) {
    const o = this.codecFor(n);
    if (!o) throw new Ut(n);
    if (n.sameAs($t) && e.kind !== ve.MembershipChange) throw new Cn(e.id);
    const r = Fn(e.content);
    return o.decode(r, this);
  }
  signWithInstallationKey(e) {
    return this.sendMessage("client.signWithInstallationKey", { signatureText: e });
  }
  verifySignedWithInstallationKey(e, n) {
    return this.sendMessage("client.verifySignedWithInstallationKey", { signatureText: e, signatureBytes: n });
  }
  verifySignedWithPublicKey(e, n, o) {
    return this.sendMessage("client.verifySignedWithPublicKey", { signatureText: e, signatureBytes: n, publicKey: o });
  }
  async getKeyPackageStatusesForInstallationIds(e) {
    return this.sendMessage("client.getKeyPackageStatusesForInstallationIds", { installationIds: e });
  }
}
export {
  Ne as Client
};
