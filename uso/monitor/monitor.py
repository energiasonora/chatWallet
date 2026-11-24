#!/usr/bin/env python3
"""
Monitor de la caja: vigila los servicios, reinicia los que se caen y avisa por ChatWallet.

Qué cambió respecto del monitor viejo (19/11/2026):
  · Los avisos van a XMTP de PRODUCCIÓN, a la wallet de ChatWallet que se usa de verdad.
    El viejo mandaba a la red dev, donde no lee nadie: el corte del 19/11 03:57–05:12 pasó sin aviso.
  · Un aviso por caída y uno cuando vuelve, no uno por hora. Si sigue caído, recuerda cada 6 h.
  · Se mira desde afuera: las URL públicas a través del túnel, no sólo el proceso y el puerto.
  · Datos de la máquina (temperatura, carga, memoria, disco, corriente) con historia de 8 días,
    para el panel de uso.chatwallet.org.
  · Al volver de un apagón avisa cuánto tiempo estuvo sin señales.
  · Un resumen por día a las 9: si no llega, el silencio mismo es la señal de que la caja no está.
  · El registro sólo anota cambios y se rota a 5 MB (el viejo llegó a 15 MB con una línea cada 30 s).

Destino de los avisos: .env junto a este archivo (NOTIFY_TO, XMTP_ENV), lo lee xmtp-alert.js.
"""

import io
import json
import os
import queue
import shutil
import socket
import subprocess
import threading
import time
import urllib.request
from datetime import datetime, timezone
from http.server import HTTPServer, SimpleHTTPRequestHandler

HOME = os.path.expanduser("~")
AQUI = os.path.dirname(os.path.abspath(__file__))
MONITOR_DIR = os.path.join(HOME, "www/monitor")
STATUS_FILE = os.path.join(MONITOR_DIR, "status.json")
MUESTRAS_FILE = os.path.join(MONITOR_DIR, "muestras.jsonl")
INCIDENTES_FILE = os.path.join(MONITOR_DIR, "incidentes.jsonl")
ESTADO_FILE = os.path.join(AQUI, "monitor-estado.json")
LOG_FILE = os.path.join(AQUI, "monitor.log")
XMTP_ALERT_JS = os.path.join(AQUI, "xmtp-alert.js")
IPFS_BIN = os.path.join(HOME, "bin/ipfs")

DASHBOARD_PORT = 8900
CHECK_INTERVAL = 30
EXTERNO_INTERVAL = 120        # las URL públicas, cada 2 min
MUESTRA_INTERVAL = 300        # una foto de la máquina cada 5 min
MUESTRAS_MAX = 8 * 24 * 12    # 8 días
PIN_PROBE_INTERVAL = 900      # la sonda escribe en el datastore: no abusar
RECORDAR_CADA = 6 * 3600      # si sigue caído, recordarlo cada 6 h
GRACIA_ARRANQUE = 240         # al prender, los servicios tardan: no avisar reinicios en estos 4 min
HORA_RESUMEN = 9              # hora local del resumen diario
LOG_MAX = 5 * 1024 * 1024

REPO_WARN_PCT = 80
DISK_WARN_PCT = 90
TEMP_WARN_C = 85
RAM_MIN_MB = 150
UMBRAL_OPERACIONES = 100

INICIO = time.time()

# ── Servicios (procesos que tienen que estar SIEMPRE corriendo) ─────────────
# Los patrones de pgrep llevan una clase de caracteres ([r], [y]...) para no matchear su propia
# línea de comando: esa trampa ya tiró el túnel abajo una vez. Los túneles se buscan con ^ para
# no confundir el proceso real con el bash -c del bucle que lo relanza.
SERVICES = [
    {"id": "ipfs", "name": "IPFS (nodo)", "pgrep": r"ipfs\s+daemo[n]", "check_port": 5001,
     "restart_cmd": ["/bin/bash", "-c", f"nohup {HOME}/bin/ipfs daemon > {HOME}/ipfs-daemon.log 2>&1 &"]},
    {"id": "upload_server", "name": "Respaldos (upload-server)", "pgrep": r"node .*upload-serve[r]\.mjs", "check_port": 3100,
     "restart_cmd": ["/bin/bash", "-c",
                     f"cd {HOME}/chatwallet-node && nohup node upload-server.mjs > {HOME}/chatwallet-node/upload-server.log 2>&1 &"]},
    {"id": "relayer", "name": "Relayer ERC-3009", "pgrep": r"node .*relay-serve[r]\.mjs", "check_port": 3200,
     "restart_cmd": [f"{HOME}/start-relay.sh"]},
    {"id": "uso", "name": "Panel de uso", "pgrep": r"node .*uso-serve[r]\.mjs", "check_port": 3300,
     "restart_cmd": [f"{HOME}/start-uso.sh"]},
    {"id": "sales_notifier", "name": "Notificador de ventas", "pgrep": r"node .*sales-notifie[r]\.mjs",
     "restart_cmd": [f"{HOME}/chatwallet-node/sales-notifier/start-sales-notifier.sh"]},
    {"id": "ntfy", "name": "ntfy (avisos de despertar)", "pgrep": r"bin/ntfy\s+serv[e]", "check_port": 2586,
     "restart_cmd": [f"{HOME}/start-ntfy.sh"]},
    {"id": "stealthpay", "name": "StealthPay (estático)", "pgrep": r"http\.server\s+889[9]", "check_port": 8899,
     "restart_cmd": ["/bin/bash", "-c",
                     f"cd {HOME}/www/stealthpay && nohup python3 -m http.server 8899 --bind 127.0.0.1 > {HOME}/static-server.log 2>&1 &"]},
    # Los túneles tienen su propio bucle que los relanza: acá sólo se mira.
    {"id": "cloudflare", "name": "Túnel principal", "pgrep": r"^cloudflared .*tunnel run stealthpa[y]", "no_restart": True},
    {"id": "tunel_gateway", "name": "Túnel del gateway", "pgrep": r"^cloudflared .*cloudflared-gatewa[y]/config", "no_restart": True},
    # OpenClaw: apagado a propósito el 16/11/2026 (liberar RAM para el robot). No se vigila.
]

# ── Desde afuera: lo que ve un usuario, pasando por Cloudflare y el túnel ──
INTERNET = "https://1.1.1.1/cdn-cgi/trace"
EXTERNOS = [
    {"id": "web_ntfy", "name": "ntfy.chatwallet.org", "url": "https://ntfy.chatwallet.org/v1/health"},
    {"id": "web_relay", "name": "relay.chatwallet.org", "url": "https://relay.chatwallet.org/api/relay/salud"},
    {"id": "web_backup", "name": "backup.chatwallet.org", "url": "https://backup.chatwallet.org/health"},
    {"id": "web_gateway", "name": "gateway.chatwallet.org", "url": "https://gateway.chatwallet.org/ipfs/bafkqaaa"},
    {"id": "web_stealthpay", "name": "stealthpay.chatwallet.org", "url": "https://stealthpay.chatwallet.org/"},
    {"id": "web_uso", "name": "uso.chatwallet.org", "url": "https://uso.chatwallet.org/api/uso/salud"},
]
FALLAS_EXTERNO = 3   # 3 seguidas = 6 min: recargar el túnel corta ~40 s y no tiene que sonar

# ── Utilidades ──────────────────────────────────────────────────────────────

def ahora_local():
    return datetime.now().astimezone()

def hora(ts):
    return datetime.fromtimestamp(ts).astimezone().strftime("%H:%M")

def fecha_hora(ts):
    d = datetime.fromtimestamp(ts).astimezone()
    return d.strftime("%H:%M") if d.date() == ahora_local().date() else d.strftime("%d/%m %H:%M")

def duracion(seg):
    seg = int(max(0, seg))
    if seg < 90:
        return f"{seg} s"
    m = round(seg / 60)
    if m < 60:
        return f"{m} min"
    h, m = divmod(m, 60)
    if h < 48:
        return f"{h} h {m:02d} min" if m else f"{h} h"
    return f"{h // 24} días {h % 24} h"

def logline(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > LOG_MAX:
            os.replace(LOG_FILE, LOG_FILE + ".1")
        with open(LOG_FILE, "a") as f:
            f.write(f"[{ts}] {msg}\n")
    except OSError:
        pass

def leer_json(ruta, defecto):
    try:
        with open(ruta) as f:
            return json.load(f)
    except Exception:
        return defecto

def escribir_json(ruta, datos):
    tmp = ruta + ".tmp"
    with open(tmp, "w") as f:
        json.dump(datos, f, indent=2, ensure_ascii=False)
    os.replace(tmp, ruta)

def anexar_jsonl(ruta, fila, maximo):
    try:
        with open(ruta, "a") as f:
            f.write(json.dumps(fila, ensure_ascii=False) + "\n")
        # Recortar de vez en cuando, no en cada escritura.
        if os.path.getsize(ruta) > maximo * 400:
            with open(ruta) as f:
                filas = f.readlines()[-maximo:]
            with open(ruta + ".tmp", "w") as f:
                f.writelines(filas)
            os.replace(ruta + ".tmp", ruta)
    except OSError as e:
        logline(f"⚠️ no pude escribir {os.path.basename(ruta)}: {e}")

def leer_env(ruta):
    env = {}
    try:
        for linea in io.open(ruta):
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                env[k.strip()] = v.strip()
    except OSError:
        pass
    return env

def pgrep(pat):
    r = subprocess.run(["pgrep", "-f", pat], capture_output=True, text=True, timeout=5)
    if r.returncode == 0 and r.stdout.strip():
        return r.stdout.strip().split()[0]
    return None

def port_open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=2):
            return True
    except OSError:
        return False

def http_ok(url, timeout=15):
    try:
        req = urllib.request.Request(url, headers={"user-agent": "caja-monitor"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return 200 <= r.status < 400, f"HTTP {r.status}"
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except Exception as e:
        return False, str(getattr(e, "reason", e))[:80]

def ipfs(*args, timeout=25):
    return subprocess.run([IPFS_BIN, *args], capture_output=True, text=True, timeout=timeout)

# ── Avisos por ChatWallet ───────────────────────────────────────────────────
# Salen por una cola en otro hilo: XMTP en frío tarda hasta un minuto, y sin internet no sale
# nada. El bucle de chequeo no puede quedarse esperando. Lo que no sale se reintenta, y si salió
# tarde se dice desde cuándo es.
_cola = queue.Queue()

def avisar(texto):
    logline(f"📝 aviso: {texto.splitlines()[0]}")
    _cola.put((time.time(), texto))

def _mandar(texto):
    env = dict(os.environ)
    env.update(leer_env(os.path.join(AQUI, ".env")))
    env["PATH"] = f"{HOME}/bin:" + env.get("PATH", "")
    try:
        r = subprocess.run(["node", XMTP_ALERT_JS, texto], capture_output=True, text=True,
                           timeout=120, cwd=AQUI, env=env)
        if r.returncode == 0:
            return True
        logline(f"⚠️ XMTP falló (exit {r.returncode}): {r.stderr.strip()[-200:]}")
    except subprocess.TimeoutExpired:
        logline("⚠️ XMTP: timeout")
    except Exception as e:
        logline(f"⚠️ XMTP: {e}")
    return False

def hilo_avisos():
    pendientes = []
    while True:
        try:
            pendientes.append(_cola.get(timeout=5))
        except queue.Empty:
            if not pendientes:
                continue
        # Juntar lo que llegó casi a la vez (un apagón dispara varios) en un solo mensaje.
        time.sleep(3)
        while not _cola.empty():
            pendientes.append(_cola.get_nowait())
        vivos = [p for p in pendientes if time.time() - p[0] < 24 * 3600]
        if not vivos:
            pendientes = []
            continue
        partes = []
        for creado, texto in vivos:
            tarde = time.time() - creado
            partes.append(texto + (f"\n(aviso de las {fecha_hora(creado)}, salió con demora)" if tarde > 600 else ""))
        if _mandar("\n\n".join(partes)):
            logline(f"📨 enviado ({len(vivos)} aviso{'s' if len(vivos) > 1 else ''})")
            pendientes = []
        else:
            pendientes = vivos
            time.sleep(60)

# ── Estado de alertas (sobrevive a reinicios del monitor) ────────────────────
estado = leer_json(ESTADO_FILE, {})
estado.setdefault("alertas", {})       # id -> {desde, fallas, avisado, ultimo_aviso, detalle, nombre}
estado.setdefault("resumen_dia", "")

def guardar_estado():
    try:
        escribir_json(ESTADO_FILE, estado)
    except OSError as e:
        logline(f"⚠️ no pude guardar el estado: {e}")

def evaluar(cid, nombre, status, detalle="", umbral=1, mensaje=None, silencioso=False):
    """Una caída = un aviso (después de `umbral` fallas seguidas); al volver, otro."""
    al = estado["alertas"].get(cid)
    ahora = time.time()
    if status in ("ok", "restarted"):
        if al:
            if al.get("avisado") and not silencioso:
                avisar(f"✅ {nombre} volvió (estuvo con problemas {duracion(ahora - al['desde'])}).")
            if al.get("avisado") or al.get("fallas", 0) >= umbral:
                anexar_jsonl(INCIDENTES_FILE, {"id": cid, "nombre": nombre, "desde": al["desde"], "hasta": ahora,
                                               "detalle": al.get("detalle", "")}, 500)
            del estado["alertas"][cid]
            guardar_estado()
        return
    if status == "unknown":
        return
    if not al:
        al = estado["alertas"][cid] = {"desde": ahora, "fallas": 0, "avisado": False, "ultimo_aviso": 0, "nombre": nombre}
        logline(f"🔻 {nombre}: {detalle}")
    al["fallas"] += 1
    al["detalle"] = detalle
    if ahora - INICIO < GRACIA_ARRANQUE:
        return   # recién prendida: los servicios todavía están arrancando; si sigue mal, se avisa después
    if not al["avisado"] and al["fallas"] >= umbral:
        al["avisado"] = True
        al["ultimo_aviso"] = ahora
        if not silencioso:
            avisar(mensaje or f"⚠️ {nombre}: {detalle}")
        guardar_estado()
    elif al["avisado"] and ahora - al["ultimo_aviso"] > RECORDAR_CADA:
        al["ultimo_aviso"] = ahora
        if not silencioso:
            avisar(f"⏳ {nombre} sigue con problemas desde las {fecha_hora(al['desde'])}: {detalle}")
        guardar_estado()

# ── Chequeos ────────────────────────────────────────────────────────────────

def restart_service(svc):
    logline(f"🔄 reiniciando {svc['name']}")
    try:
        subprocess.run(svc["restart_cmd"], timeout=15)
    except subprocess.TimeoutExpired:
        pass
    except Exception as e:   # p. ej. falta el script de arranque: que no tire abajo el bucle entero
        logline(f"❌ {svc['name']}: no se pudo lanzar el reinicio ({e})")
        return False
    for _ in range(10):
        time.sleep(1)
        if pgrep(svc["pgrep"]) and (not svc.get("check_port") or port_open(svc["check_port"])):
            logline(f"✅ {svc['name']} arriba otra vez")
            return True
    logline(f"❌ {svc['name']} no arrancó")
    return False

def check_servicios():
    resultados = []
    for svc in SERVICES:
        pid = pgrep(svc["pgrep"])
        p_ok = port_open(svc["check_port"]) if svc.get("check_port") else None
        info, status = {}, "ok"
        if pid:
            info["pid"] = pid
            info["port_ok"] = p_ok
            if p_ok is False:
                status, info["error"] = "degraded", "el proceso vive pero el puerto no contesta"
        else:
            status, info["error"] = "down", "proceso no encontrado"

        if status != "ok" and not svc.get("no_restart"):
            if restart_service(svc):
                status, info = "restarted", {"pid": pgrep(svc["pgrep"]), "note": "reiniciado solo"}
                # Al prender la caja los servicios tardan y el monitor los "revive": no es noticia.
                if time.time() - INICIO > GRACIA_ARRANQUE:
                    avisar(f"🔄 {svc['name']} se había caído y lo reinicié solo.")
                    anexar_jsonl(INCIDENTES_FILE, {"id": svc["id"], "nombre": svc["name"], "desde": time.time(),
                                                   "hasta": time.time(), "detalle": "caído, reiniciado solo"}, 500)
            else:
                info = {"error": "caído y el reinicio automático falló"}
        if svc.get("no_restart") and status != "ok":
            info["note"] = "sin reinicio automático"

        evaluar(svc["id"], svc["name"], status, info.get("error", ""),
                umbral=2,   # dos chequeos (1 min): el bucle de los túneles relanza en ~35 s
                mensaje=(f"💀 {svc['name']} caído ({info.get('error', '')}). No se reinicia solo: hay que mirarlo."
                         if svc.get("no_restart") else
                         f"💀 {svc['name']} se cayó y no pude reiniciarlo solo. Hay que mirarlo."))
        resultados.append({"id": svc["id"], "name": svc["name"], "status": status, "info": info, "grupo": "servicios"})
    return resultados

_externo_at = 0
_externo = []

def check_externos():
    global _externo_at, _externo
    if time.time() - _externo_at < EXTERNO_INTERVAL and _externo:
        return _externo
    _externo_at = time.time()
    net_ok, net_info = http_ok(INTERNET, timeout=10)
    res = [{"id": "internet", "name": "Salida a internet", "status": "ok" if net_ok else "down",
            "info": {} if net_ok else {"error": net_info}, "grupo": "afuera"}]
    evaluar("internet", "La salida a internet de la caja", "ok" if net_ok else "down", net_info, umbral=FALLAS_EXTERNO,
            mensaje="🌐 La caja se quedó sin internet: los servicios públicos no llegan a nadie.")
    for e in EXTERNOS:
        if not net_ok:
            # Sin internet, que falle cada URL no es noticia: ya lo cuenta el aviso de arriba.
            res.append({"id": e["id"], "name": e["name"], "status": "unknown",
                        "info": {"note": "sin internet, no se puede probar"}, "grupo": "afuera"})
            continue
        ok, info = http_ok(e["url"])
        res.append({"id": e["id"], "name": e["name"], "status": "ok" if ok else "down",
                    "info": {"url": e["url"]} if ok else {"url": e["url"], "error": info}, "grupo": "afuera"})
        evaluar(e["id"], e["name"], "ok" if ok else "down", info, umbral=FALLAS_EXTERNO,
                mensaje=f"🌍 {e['name']} no contesta desde afuera ({info}). Por adentro puede estar vivo: mirar el túnel.")
    _externo = res
    return res

_pin_at = 0
_pin = ("unknown", {"note": "todavía sin correr"})

def check_pin_persistence():
    """Sube un blob minúsculo, verifica que el pin QUEDÓ y lo borra.

    Del 11 al 13/8/2026 el datastore quedó latcheado tras un ENOSPC y `ipfs add --pin` devolvía
    CID sin persistir el pin, con el puerto 5001 contestando perfecto. Sólo se detecta pineando.
    """
    cid = None
    try:
        r = subprocess.run([IPFS_BIN, "add", "-Q", "--pin", "--cid-version=1"],
                           input=os.urandom(32), capture_output=True, timeout=25)
        if r.returncode != 0:
            return "down", {"error": f"add falló: {r.stderr.decode(errors='replace').strip()[:200]}"}
        cid = r.stdout.decode().strip()
        if not cid:
            return "down", {"error": "add no devolvió CID"}
        if ipfs("pin", "ls", "--type=recursive", cid).returncode != 0:
            return "down", {"cid": cid, "error": "el pin NO persistió (datastore latcheado)"}
        return "ok", {"cid": cid}
    except subprocess.TimeoutExpired:
        return "down", {"error": "timeout en la sonda de pin"}
    except Exception as e:
        return "down", {"error": f"sonda de pin falló: {e}"}
    finally:
        if cid:
            try: ipfs("pin", "rm", cid, timeout=15)
            except Exception: pass

def check_relayer_gas():
    """Cuántas operaciones le quedan al relayer en Base. El proceso puede vivir sin gas."""
    try:
        tok = leer_env(f"{HOME}/chatwallet-node/relay/.env").get("RELAY_ADMIN_TOKEN", "")
        req = urllib.request.Request("http://127.0.0.1:3200/api/relay/metricas",
                                     headers={"x-relay-token": tok} if tok else {})
        with urllib.request.urlopen(req, timeout=25) as r:
            d = json.load(r)
        peor, resumen = None, []
        for cid, info in d.get("redes", {}).items():
            if "error" in info:
                continue
            ops = info.get("operacionesRestantes", 0)
            red = {"1": "Ethereum", "8453": "Base"}.get(str(cid), str(cid))
            resumen.append(f"{red}: {ops} op ({info.get('saldo', '?')} ETH)")
            if str(cid) == "8453" and (peor is None or ops < peor):   # Ethereum sin fondear es a propósito
                peor = ops
        if peor is None:
            return "unknown", {"resumen": " · ".join(resumen) or "sin datos"}
        return ("down" if peor < UMBRAL_OPERACIONES else "ok"), {
            "resumen": " · ".join(resumen), "operaciones": peor, "direccion": d.get("relayer", "")}
    except Exception as e:
        return "unknown", {"error": str(e)[:80]}

def leer_temp():
    """La más alta de los sensores (núcleos, placa). En °C."""
    mx = None
    for base in ("/sys/class/hwmon", "/sys/class/thermal"):
        try:
            for d in os.listdir(base):
                ruta = os.path.join(base, d)
                for f in os.listdir(ruta):
                    if (f.startswith("temp") and f.endswith("_input")) or f == "temp":
                        try:
                            v = int(open(os.path.join(ruta, f)).read().strip()) / 1000
                            if 0 < v < 130:
                                mx = v if mx is None else max(mx, v)
                        except (OSError, ValueError):
                            pass
        except OSError:
            pass
    return round(mx, 1) if mx is not None else None

def leer_energia():
    out = {}
    base = "/sys/class/power_supply"
    try:
        for d in os.listdir(base):
            ruta = os.path.join(base, d)
            tipo = open(os.path.join(ruta, "type")).read().strip()
            if tipo == "Mains":
                out["corriente"] = open(os.path.join(ruta, "online")).read().strip() == "1"
            elif tipo == "Battery":
                try: out["bateria_pct"] = int(open(os.path.join(ruta, "capacity")).read().strip())
                except (OSError, ValueError): pass
                try: out["bateria_estado"] = open(os.path.join(ruta, "status")).read().strip()
                except OSError: pass
    except OSError:
        pass
    return out

def leer_sistema():
    s = {}
    try:
        s["arriba_seg"] = int(float(open("/proc/uptime").read().split()[0]))
    except (OSError, ValueError):
        pass
    try:
        c1, c5, c15 = os.getloadavg()
        s["carga"] = [round(c1, 2), round(c5, 2), round(c15, 2)]
    except OSError:
        pass
    s["nucleos"] = os.cpu_count() or 1
    try:
        mem = {}
        for linea in open("/proc/meminfo"):
            k, v = linea.split(":", 1)
            mem[k] = int(v.split()[0]) // 1024
        s["ram_total_mb"] = mem.get("MemTotal")
        s["ram_libre_mb"] = mem.get("MemAvailable")
        s["swap_usada_mb"] = mem.get("SwapTotal", 0) - mem.get("SwapFree", 0)
    except (OSError, ValueError):
        pass
    try:
        du = shutil.disk_usage(HOME)
        s["disco_pct"] = round(du.used * 100 / du.total, 1)
        s["disco_libre_gb"] = round(du.free / 1e9, 1)
    except OSError:
        pass
    s["discos"] = []
    for mount, nombre in DISCOS:
        if mount != "/" and not os.path.ismount(mount):
            continue
        try:
            du = shutil.disk_usage(mount)
            s["discos"].append({"mount": mount, "nombre": nombre, "pct": round(du.used * 100 / du.total, 1),
                                "libre_gb": round(du.free / 1e9, 1)})
        except OSError:
            pass
    s["temp_c"] = leer_temp()
    s.update(leer_energia())
    return s

_repo_at = 0
_repo = {}

# Particiones a vigilar: "punto de montaje:nombre". En la caja, el sistema y /mnt/backups (los backups
# de RHM, que llegó al 90 % el 21/11/2026 sin que nadie lo viera: el monitor sólo miraba /).
DISCOS = [tuple(x.split(":", 1)) for x in os.environ.get(
    "MONITOR_DISCOS", "/:Disco del sistema,/mnt/backups:Disco de backups").split(",") if ":" in x]
DISCO_AVISO_PCT = 85
DISCO_ALARMA_PCT = 95
DISCO_DIAS_AVISO = 14        # avisar si a este ritmo se llena en menos de 2 semanas
DISCO_HIST_CADA = 6 * 3600   # una foto del uso cada 6 h para calcular el ritmo

def _ritmo_disco(mount, usado, ahora):
    """Bytes por día que viene creciendo, sobre lo que se vio en las últimas 2 semanas (None si no hay datos)."""
    hist = estado.setdefault("discos_hist", {}).setdefault(mount, [])
    if not hist or ahora - hist[-1][0] >= DISCO_HIST_CADA:
        hist.append([int(ahora), int(usado)])
        del hist[:-120]                         # 30 días
        guardar_estado()
    ventana = [h for h in hist if ahora - h[0] <= 14 * 86400]
    if not ventana or ahora - ventana[0][0] < 3 * 86400:
        return None                             # menos de 3 días de historia: no se predice
    return (usado - ventana[0][1]) / ((ahora - ventana[0][0]) / 86400)

def check_discos():
    res, ahora = [], time.time()
    for mount, nombre in DISCOS:
        if mount != "/" and not os.path.ismount(mount):
            continue                            # en otra máquina, o la partición no está montada
        cid = "disco:" + mount
        try:
            du = shutil.disk_usage(mount)
        except OSError as e:
            res.append({"id": cid, "name": nombre, "status": "unknown", "info": {"error": str(e)}, "grupo": "maquina"})
            continue
        pct = round(du.used * 100 / du.total, 1)
        libre_gb = round(du.free / 1e9, 1)
        ritmo = _ritmo_disco(mount, du.used, ahora)
        dias = round(du.free / ritmo, 1) if ritmo and ritmo > 0 else None
        info = {"mount": mount, "pct": pct, "libre_gb": libre_gb, "total_gb": round(du.total / 1e9),
                "ritmo_mb_dia": round(ritmo / 1e6) if ritmo is not None else None, "dias_para_llenarse": dias}
        if pct >= DISCO_ALARMA_PCT:
            st, motivo = "down", f"al {pct}%, quedan {libre_gb} GB"
        elif pct >= DISCO_AVISO_PCT:
            st, motivo = "degraded", f"al {pct}%, quedan {libre_gb} GB"
        elif dias is not None and dias < DISCO_DIAS_AVISO:
            st, motivo = "degraded", f"al ritmo de {info['ritmo_mb_dia']} MB por día se llena en {dias:.0f} días"
        else:
            st, motivo = "ok", ""
        if motivo:
            info["error"] = motivo
        res.append({"id": cid, "name": nombre, "status": st, "info": info, "grupo": "maquina"})
        evaluar(cid, f"El {nombre[0].lower() + nombre[1:]} ({mount})", st, motivo, umbral=1,
                mensaje=f"💾 {nombre} ({mount}): {motivo}." +
                        (f" Viene creciendo {info['ritmo_mb_dia']} MB por día." if info["ritmo_mb_dia"] and "ritmo" not in motivo else "") +
                        " Se puede liberar con la limpieza semanal o revisando qué crece.")
    return res

def check_sistema(s):
    """Chequeos de la máquina. Ninguno se reinicia: se avisa."""
    global _repo_at, _repo
    res = []
    t = s.get("temp_c")
    st = "unknown" if t is None else ("down" if t >= TEMP_WARN_C else "ok")
    res.append({"id": "temp", "name": "Temperatura", "status": st, "info": {"valor": t}, "grupo": "maquina"})
    evaluar("temp", "La temperatura de la caja", st, f"{t} °C", umbral=2,
            mensaje=f"🔥 La caja está a {t} °C. Revisar ventilación o qué está consumiendo.")

    libre = s.get("ram_libre_mb")
    st = "unknown" if libre is None else ("down" if libre < RAM_MIN_MB else "ok")
    res.append({"id": "ram", "name": "Memoria", "status": st, "info": {"libre_mb": libre}, "grupo": "maquina"})
    evaluar("ram", "La memoria de la caja", st, f"quedan {libre} MB libres", umbral=4)

    carga = (s.get("carga") or [0])[0]
    st = "down" if carga > 3 * s["nucleos"] else "ok"
    res.append({"id": "carga", "name": "Carga", "status": st, "info": {"carga": s.get("carga")}, "grupo": "maquina"})
    evaluar("carga", "La carga de la caja", st, f"carga {carga} con {s['nucleos']} núcleos", umbral=10)

    if "corriente" in s:
        st = "ok" if s["corriente"] else "down"
        bat = s.get("bateria_pct")
        res.append({"id": "corriente", "name": "Corriente", "status": st,
                    "info": {"bateria_pct": bat, "bateria_estado": s.get("bateria_estado")}, "grupo": "maquina"})
        evaluar("corriente", "La corriente de la caja", st, f"a batería ({bat}%)", umbral=1,
                mensaje=f"⚡ La caja se quedó sin corriente y anda a batería ({bat}%)." +
                        (" Con la batería en 0 se va a apagar enseguida." if bat == 0 else ""))

    res += check_discos()

    if time.time() - _repo_at > 600:
        _repo_at = time.time()
        try:
            r = ipfs("repo", "stat", "-s", timeout=20)
            stats = dict(l.split()[:2] for l in r.stdout.splitlines() if len(l.split()) >= 2)
            size, cap = int(stats.get("RepoSize:", 0)), int(stats.get("StorageMax:", 0))
            _repo = {"repo_pct": round(size * 100 / cap, 1), "repo": f"{round(size / 1e6)} MB de {round(cap / 1e9, 1)} GB"} if cap else {}
        except Exception:
            _repo = {}
    st = "unknown" if not _repo else ("degraded" if _repo.get("repo_pct", 0) >= REPO_WARN_PCT else "ok")
    res.append({"id": "ipfs_repo", "name": "Repo IPFS", "status": st, "info": dict(_repo), "grupo": "maquina"})
    evaluar("ipfs_repo", "El repo de IPFS", st, f"{_repo.get('repo', '?')} ({_repo.get('repo_pct', '?')}%)", umbral=1,
            mensaje=f"💾 El repo de IPFS está al {_repo.get('repo_pct')}% de su tope ({_repo.get('repo')}). "
                    "El ENOSPC de agosto rompió los pins.")
    return res

def check_almacenamiento():
    global _pin_at, _pin
    if time.time() - _pin_at >= PIN_PROBE_INTERVAL:
        _pin, _pin_at = check_pin_persistence(), time.time()
    st, info = _pin
    evaluar("pin_probe", "La persistencia de pins de IPFS", st, info.get("error", ""), umbral=1,
            mensaje="💀 Los pins de IPFS NO están quedando: el datastore está latcheado (como del 11 al 13/8). "
                    "Los respaldos nuevos quedan a merced de un gc. Reiniciar el daemon y re-pinear.")
    rst, rinfo = check_relayer_gas()
    evaluar("relayer_gas", "El gas del relayer", rst, rinfo.get("resumen", ""), umbral=1,
            mensaje=f"⛽ Al relayer le queda poco gas: {rinfo.get('resumen', '')}. Fondear {rinfo.get('direccion', '')} con ETH en Base.")
    cst, cinfo = check_copia()
    evaluar("copia", "La copia de respaldos en la Samsung", cst, cinfo.get("error", ""), umbral=1,
            mensaje=f"🗄️ La copia de los respaldos de chat a la Samsung no se hace desde {cinfo.get('desde', '?')}: "
                    f"{cinfo.get('error', '')}. Hoy los respaldos tienen una sola copia (la de la caja).")
    return [{"id": "pin_probe", "name": "Persistencia de pins", "status": st, "info": info, "grupo": "almacenamiento"},
            {"id": "relayer_gas", "name": "Gas del relayer", "status": rst, "info": rinfo, "grupo": "almacenamiento"},
            {"id": "copia", "name": "Copia de respaldos (Samsung)", "status": cst, "info": cinfo, "grupo": "almacenamiento"}]

# ── Nodo Ğ1 (poc/g1-nodo): que no se coma el disco de la caja ──────────────
# El nodo espejo sincroniza días y su tamaño final no se conoce todavía. A G1_AVISO_MB se avisa;
# a G1_FRENO_MB se frena y se deja una marca para que el @reboot no lo vuelva a arrancar
# (start-g1-nodo.sh la respeta). Para seguir: borrar la marca y correr ~/start-g1-nodo.sh.
G1_CONTENEDOR = "g1-nodo"
G1_VOLUMEN = "g1-datos"
G1_MARCA_FRENO = os.path.join(HOME, "g1-nodo-FRENADO")
G1_AVISO_MB = int(os.environ.get("G1_AVISO_MB", 7 * 1024))
G1_FRENO_MB = int(os.environ.get("G1_FRENO_MB", 10 * 1024))
G1_INTERVAL = 600
G1_TRABADO_SEG = 3600
_g1_at, _g1 = 0, ("unknown", {"note": "sin medir"})
_g1_avance = {"bloque": None, "desde": 0}   # último bloque visto y desde cuándo no cambia

def _podman(*args, timeout=60):
    return subprocess.run(["podman", *args], capture_output=True, text=True, timeout=timeout)

def g1_sync():
    req = urllib.request.Request("http://127.0.0.1:9944", method="POST",
                                 data=b'{"jsonrpc":"2.0","id":1,"method":"system_syncState","params":[]}',
                                 headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r).get("result") or {}

def check_g1_nodo():
    """→ (status, info). unknown si el nodo no está instalado: no es una falla."""
    if os.path.exists(G1_MARCA_FRENO):
        return "degraded", {"resumen": "frenado por tamaño (borrar ~/g1-nodo-FRENADO para seguir)", "frenado": True}
    try:
        ins = _podman("inspect", "--format", "{{.State.Running}}", G1_CONTENEDOR, timeout=30)
    except Exception as e:
        return "unknown", {"error": f"podman: {e}"[:80]}
    if ins.returncode != 0:
        return "unknown", {"note": "no instalado"}
    info = {"corriendo": ins.stdout.strip() == "true"}
    try:
        punto = _podman("volume", "inspect", G1_VOLUMEN, "--format", "{{.Mountpoint}}", timeout=30).stdout.strip()
        du = _podman("unshare", "du", "-sm", punto, timeout=300)
        info["mb"] = int(du.stdout.split()[0])
    except Exception as e:
        info["error"] = f"no pude medir el disco: {e}"[:80]
    try:
        st = g1_sync()
        info["bloque"], info["meta"] = st.get("currentBlock"), st.get("highestBlock")
        if info["bloque"] and info["meta"]:
            info["pct"] = round(100 * info["bloque"] / info["meta"], 1)
    except Exception as e:
        info.setdefault("error", f"RPC: {e}"[:80])
    if info.get("bloque") is not None:
        if info["bloque"] != _g1_avance["bloque"]:
            _g1_avance.update(bloque=info["bloque"], desde=time.time())
        info["quieto_seg"] = int(time.time() - _g1_avance["desde"])
    gb = f"{info['mb'] / 1024:.1f} GB" if "mb" in info else "? GB"
    miles = lambda n: f"{n:,}".replace(",", ".") if isinstance(n, int) else "?"
    info["resumen"] = f"bloque {miles(info.get('bloque'))} de {miles(info.get('meta'))} ({info.get('pct', '?')} %), {gb}"
    if info.get("mb", 0) >= G1_FRENO_MB:
        try:
            _podman("stop", "-t", "30", G1_CONTENEDOR, timeout=90)
            open(G1_MARCA_FRENO, "w").write(f"{fecha_hora(time.time())}: {info['resumen']}\n")
            info["frenado"] = True
        except Exception as e:
            info["error"] = f"no pude frenarlo: {e}"[:80]
        return "down", info
    if not info["corriendo"]:
        return "down", dict(info, error="el contenedor está parado")
    if info.get("quieto_seg", 0) >= G1_TRABADO_SEG and info.get("pct", 0) < 99.9:
        return "down", dict(info, error=f"sin avanzar hace {duracion(info['quieto_seg'])}")
    if info.get("mb", 0) >= G1_AVISO_MB:
        return "degraded", info
    return "ok", info

def check_g1():
    global _g1_at, _g1
    if time.time() - _g1_at >= G1_INTERVAL:
        _g1, _g1_at = check_g1_nodo(), time.time()
    st, info = _g1
    if info.get("frenado") and st == "down":
        msg = (f"🛑 Frené el nodo Ğ1: llegó a {info.get('mb', 0) / 1024:.1f} GB (tope {G1_FRENO_MB // 1024} GB) en "
               f"{info.get('resumen', '')}. No vuelve a arrancar solo; para seguir: rm ~/g1-nodo-FRENADO && ~/start-g1-nodo.sh")
    elif st == "degraded" and not info.get("frenado"):
        msg = f"💾 El nodo Ğ1 ya ocupa {info.get('mb', 0) / 1024:.1f} GB ({info.get('resumen', '')}). A los {G1_FRENO_MB // 1024} GB lo freno."
    else:
        msg = f"⚠️ El nodo Ğ1: {info.get('error', '')} ({info.get('resumen', '')})."
    evaluar("g1_nodo", "El nodo Ğ1", st, info.get("error") or info.get("resumen", ""), umbral=1, mensaje=msg)
    return [{"id": "g1_nodo", "name": "Nodo Ğ1", "status": st, "info": info, "grupo": "almacenamiento"}]

COPIA_FILE = os.path.join(MONITOR_DIR, "copia.json")
COPIA_MAX_SEG = 36 * 3600   # corre de madrugada y reintenta hasta las 5:30: 36 h sin copia = algo anda mal

def check_copia():
    """La segunda copia la hace copia-respaldos.sh por cron. Acá sólo se mira cuándo salió bien."""
    e = leer_json(COPIA_FILE, None)
    if not e:
        return "unknown", {"note": "todavía no corrió"}
    info = {k: e.get(k) for k in ("ultimo_ok", "ultimo_intento", "resultado", "detalle", "cids", "mb", "fallas_seguidas")}
    ok_at = e.get("ultimo_ok") or 0
    if time.time() - ok_at <= COPIA_MAX_SEG:
        return "ok", info
    info["desde"] = fecha_hora(ok_at) if ok_at else "nunca"
    info["error"] = e.get("detalle") or "sin copia reciente"
    return "down", info

# ── Bucle ───────────────────────────────────────────────────────────────────
_muestra_at = 0
_latido_log = 0

PLANES_FILE = os.path.join(HOME, "chatwallet-node/espacio-planes.json")
GRACIA_PLAN_DIAS = 30   # después de vencer, los archivos esperan esto antes de que convenga liberarlos

def lineas_espacio():
    """Planes de espacio (espacio.mjs) que piden atención: vencen en ≤ 7 días, vencieron, o casi llenos.
    Va en el resumen de las 9, una vez por día: no es una urgencia, es para acordarse de cobrar."""
    planes = leer_json(PLANES_FILE, {}) or {}
    hoy = ahora_local().date()
    out = []
    for addr, p in planes.items():
        corta = f"{addr[:6]}…{addr[-4:]}"
        nota = f" ({p['nota']})" if p.get("nota") else ""
        try:
            dias = (datetime.strptime(p.get("until", ""), "%Y-%m-%d").date() - hoy).days
        except ValueError:
            dias = None
        uso = (100 * p.get("used", 0) / p["bytes"]) if p.get("bytes") else 0
        if dias is not None and 0 <= dias <= 7:
            out.append(f"• {corta}{nota} vence {'hoy' if dias == 0 else f'en {dias} día' + ('s' if dias > 1 else '')}")
        elif dias is not None and -GRACIA_PLAN_DIAS <= dias < 0:
            out.append(f"• {corta}{nota} venció hace {-dias} día{'s' if dias < -1 else ''}")
        elif dias is not None and dias < -GRACIA_PLAN_DIAS:
            out.append(f"• {corta}{nota} venció hace {-dias} días: ya pasó la gracia, se pueden liberar sus archivos")
        if uso >= 90 and (dias is None or dias >= 0):
            out.append(f"• {corta}{nota} usó el {uso:.0f} % de su espacio")
    return out

def resumen_diario(report, s):
    hoy = ahora_local().strftime("%Y-%m-%d")
    if ahora_local().hour < HORA_RESUMEN or estado.get("resumen_dia") == hoy:
        return
    estado["resumen_dia"] = hoy
    guardar_estado()
    malos = [x for x in report["services"] if x["status"] not in ("ok", "restarted", "unknown")]
    desde = time.time() - 86400
    inc = []
    try:
        for l in open(INCIDENTES_FILE):
            f = json.loads(l)
            if f.get("hasta", 0) >= desde:
                inc.append(f)
    except (OSError, ValueError):
        pass
    linea = f"☀️ Caja: {'todo bien' if not malos else str(len(malos)) + ' con problemas'}"
    if s.get("temp_c") is not None:
        linea += f" · {s['temp_c']} °C"
    for d in s.get("discos") or []:
        linea += f" · {d['mount']} {d['pct']}%"
    if s.get("arriba_seg"):
        linea += f" · prendida hace {duracion(s['arriba_seg'])}"
    if s.get("corriente") is False:
        linea += " · ⚡ a batería"
    if malos:
        linea += "\nAhora: " + ", ".join(m["name"] for m in malos)
    if inc:
        linea += f"\nÚltimas 24 h: {len(inc)} incidente{'s' if len(inc) > 1 else ''} (" + \
                 ", ".join(f"{i['nombre']} {duracion(i['hasta'] - i['desde'])}" for i in inc[-4:]) + ")"
    try:
        esp = lineas_espacio()
    except Exception as e:   # un padrón roto no puede tumbar el resumen
        esp = [f"• no pude leer espacio-planes.json: {e}"]
    if esp:
        linea += "\n💾 Planes de espacio:\n" + "\n".join(esp)
    g1st, g1info = _g1
    if g1st != "unknown" or g1info.get("resumen"):
        if g1info.get("resumen"):
            linea += f"\n🌐 Nodo Ğ1: {g1info['resumen']}"
    avisar(linea)

def check_all():
    global _muestra_at, _latido_log
    s = leer_sistema()
    results = check_servicios() + check_sistema(s) + check_almacenamiento() + check_g1() + check_externos()
    malos = [x for x in results if x["status"] not in ("ok", "restarted", "unknown")]
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "all_ok": not malos,
        "sistema": s,
        "services": results,
        "abiertos": [{"id": k, **v} for k, v in estado["alertas"].items()],
        "arranque_monitor": INICIO,
    }
    os.makedirs(MONITOR_DIR, exist_ok=True)
    escribir_json(STATUS_FILE, report)

    if time.time() - _muestra_at >= MUESTRA_INTERVAL:
        _muestra_at = time.time()
        anexar_jsonl(MUESTRAS_FILE, {
            "t": int(time.time()), "temp": s.get("temp_c"), "carga": (s.get("carga") or [None])[0],
            "ram": s.get("ram_libre_mb"), "disco": s.get("disco_pct"), "corriente": s.get("corriente"),
            "ok": len(results) - len(malos), "total": len(results),
        }, MUESTRAS_MAX)

    resumen_diario(report, s)

    if time.time() - _latido_log > 1800:   # una línea cada media hora, no cada 30 s
        _latido_log = time.time()
        logline(f"latido — {len(results) - len(malos)}/{len(results)} OK, {s.get('temp_c')} °C, carga {(s.get('carga') or ['?'])[0]}")
    return report

def al_arrancar():
    """Si la última foto es vieja, la caja (o el monitor) estuvo sin señales: contarlo."""
    previo = leer_json(STATUS_FILE, {})
    try:
        ultima = datetime.fromisoformat(previo["timestamp"]).timestamp()
    except Exception:
        ultima = None
    try:
        arriba = float(open("/proc/uptime").read().split()[0])
    except (OSError, ValueError):
        arriba = None
    prendio = time.time() - arriba if arriba is not None else None
    if ultima and time.time() - ultima > 180:
        if prendio and prendio > ultima:
            avisar(f"🔌 La caja volvió. Última señal a las {fecha_hora(ultima)}, se prendió a las {fecha_hora(prendio)}: "
                   f"{duracion(prendio - ultima)} sin servicio (respaldos, avisos, relayer y páginas).")
            anexar_jsonl(INCIDENTES_FILE, {"id": "caja", "nombre": "La caja entera", "desde": ultima, "hasta": prendio,
                                           "detalle": "apagada o colgada"}, 500)
        else:
            avisar(f"🟡 El monitor estuvo parado desde las {fecha_hora(ultima)} ({duracion(time.time() - ultima)}); "
                   "la caja siguió prendida.")
    elif not ultima:
        avisar("🟢 Monitor de la caja en marcha: los avisos van a llegar por este chat.")

class MonitorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=MONITOR_DIR, **kwargs)
    def log_message(self, fmt, *args):
        pass

def start_http_server():
    while True:
        try:
            HTTPServer(("0.0.0.0", DASHBOARD_PORT), MonitorHandler).serve_forever()
        except OSError as e:
            logline(f"🔥 tablero HTTP: {e}")
            time.sleep(30)

def limpiar_alertas_huerfanas():
    """Una alerta abierta de algo que ya no se vigila no se cerraría nunca: se descarta."""
    vigentes = {s["id"] for s in SERVICES} | {e["id"] for e in EXTERNOS} | {
        "internet", "temp", "ram", "carga", "corriente", "ipfs_repo", "pin_probe", "relayer_gas", "copia", "g1_nodo"} | {
        "disco:" + m for m, _ in DISCOS}
    for cid in [k for k in estado["alertas"] if k not in vigentes]:
        logline(f"🧹 alerta descartada: {cid} (ya no se vigila)")
        del estado["alertas"][cid]
    guardar_estado()

def main():
    logline("🟢 monitor iniciado")
    limpiar_alertas_huerfanas()
    threading.Thread(target=hilo_avisos, daemon=True).start()
    threading.Thread(target=start_http_server, daemon=True).start()
    al_arrancar()
    while True:
        try:
            check_all()
        except Exception as e:
            logline(f"🔥 error en check_all: {e!r}")
        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main()
