#!/usr/bin/env python3
"""
Monitor daemon — chequea servicios, reinicia caídos, alerta por XMTP (ChatWallet),
y sirve el dashboard web embebido en un thread HTTP liviano.
"""

import json
import os
import shutil
import subprocess
import sys
import time
import socket
import threading
from datetime import datetime, timezone
from http.server import HTTPServer, SimpleHTTPRequestHandler

HOME = os.path.expanduser("~")
MONITOR_DIR = os.path.join(HOME, "www/monitor")
STATUS_FILE = os.path.join(MONITOR_DIR, "status.json")
DASHBOARD_PORT = 8900
CHECK_INTERVAL = 30
LOG_FILE = os.path.join(HOME, "chatwallet-node/monitor/monitor.log")
XMTP_ALERT_JS = os.path.join(HOME, "chatwallet-node/monitor/xmtp-alert.js")

IPFS_BIN = os.path.join(HOME, "bin/ipfs")
PIN_PROBE_INTERVAL = 900   # 15 min: la sonda escribe en el datastore, no conviene abusar
REPO_WARN_PCT = 80         # RepoSize sobre StorageMax
DISK_WARN_PCT = 90

# ── Definición de servicios ──────────────────────────────────────────────

SERVICES = [
    {
        "id": "ipfs",
        "name": "IPFS Daemon",
        "pgrep": r"ipfs\s+daemon",
        "check_port": 5001,
        "restart_cmd": ["/bin/bash", "-c",
            f"nohup {HOME}/bin/ipfs daemon > {HOME}/ipfs-daemon.log 2>&1 &"],
    },
    {
        "id": "upload_server",
        "name": "Upload Server",
        "pgrep": r"node .*upload-server\.mjs",
        "check_port": 3100,
        "restart_cmd": ["/bin/bash", "-c",
            f"cd {HOME}/chatwallet-node && nohup node upload-server.mjs > {HOME}/chatwallet-node/upload-server.log 2>&1 &"],
    },
    {
        "id": "sales_notifier",
        "name": "Sales Notifier",
        "pgrep": r"node .*sales-notifie[r]\.mjs",
        "restart_cmd": [f"{HOME}/chatwallet-node/sales-notifier/start-sales-notifier.sh"],
    },
    {
        "id": "cloudflare",
        "name": "Cloudflare Tunnel",
        "pgrep": r"tunnel\s+run\s+stealthpay",
        "no_restart": True,  # loop propio en start-cloudflared.sh
    },
    {
        "id": "stealthpay",
        "name": "StealthPay Static",
        "pgrep": r"http\.server\s+8899",
        "check_port": 8899,
        "restart_cmd": ["/bin/bash", "-c",
            f"cd {HOME}/www/stealthpay && nohup python3 -m http.server 8899 --bind 127.0.0.1 > {HOME}/static-server.log 2>&1 &"],
    },
    {
        "id": "ntfy",
        "name": "ntfy Server",
        "pgrep": r"bin/ntfy\s+serve",
        "check_port": 2586,
        "restart_cmd": [f"{HOME}/start-ntfy.sh"],
    },
    {
        "id": "openclaw",
        "name": "OpenClaw Gateway",
        "pgrep": r"openclaw.*gateway",
        "check_port": 18789,
        "no_restart": True,
    },
]

# ── Helpers ──────────────────────────────────────────────────────────────

def pgrep(pat):
    r = subprocess.run(["pgrep", "-f", pat], capture_output=True, text=True, timeout=5)
    if r.returncode == 0 and r.stdout.strip():
        return r.stdout.strip().split()[0]
    return None

def port_open(port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=2):
            return True
    except (ConnectionRefusedError, OSError, TimeoutError):
        return False

def logline(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass

def send_xmtp(message):
    """Envía un DM por XMTP al jefe vía el script Node.js."""
    try:
        r = subprocess.run(
            ["node", XMTP_ALERT_JS, message],
            capture_output=True, text=True, timeout=90,  # XMTP en frío tarda >15s: con 15 el aviso se perdía justo cuando más importaba (3/8/2026)
            cwd=os.path.dirname(XMTP_ALERT_JS),
        )
        if r.returncode != 0:
            logline(f"⚠️ XMTP alert falló (exit {r.returncode}): {r.stderr.strip()}")
        else:
            logline(f"📨 Alerta enviada por XMTP")
        return r.returncode == 0
    except subprocess.TimeoutExpired:
        logline("⚠️ XMTP alert timeout (15s)")
        return False
    except Exception as e:
        logline(f"⚠️ XMTP alert error: {e}")
        return False

def ipfs(*args, timeout=25):
    return subprocess.run([IPFS_BIN, *args], capture_output=True, text=True, timeout=timeout)

def check_pin_persistence():
    """Sonda ACTIVA del pinset: sube un blob minúsculo, verifica que el pin QUEDÓ y lo borra.

    POR QUÉ existe: del 11 al 13/8/2026 el LevelDB del datastore quedó latcheado en error
    tras un ENOSPC y `ipfs add --pin` seguía devolviendo CID sin persistir el pin. El puerto
    5001 contestaba perfecto todo ese tiempo, así que el chequeo de proceso+puerto lo dio
    por sano dos días mientras los respaldos de los usuarios quedaban a merced de un gc.
    Un pin que no persiste solo se detecta intentando pinear de verdad.
    """
    cid = None
    try:
        blob = os.urandom(32)
        r = subprocess.run([IPFS_BIN, "add", "-Q", "--pin", "--cid-version=1"],
                           input=blob, capture_output=True, timeout=25)
        if r.returncode != 0:
            return "down", {"error": f"add falló: {r.stderr.decode(errors='replace').strip()[:200]}"}
        cid = r.stdout.decode().strip()
        if not cid:
            return "down", {"error": "add no devolvió CID"}

        # El chequeo que importa: ¿el pin quedó realmente escrito en el datastore?
        chk = ipfs("pin", "ls", "--type=recursive", cid)
        if chk.returncode != 0:
            return "down", {"cid": cid, "error": "el pin NO persistió (datastore latcheado)"}
        return "ok", {"cid": cid}
    except subprocess.TimeoutExpired:
        return "down", {"error": "timeout en la sonda de pin"}
    except Exception as e:
        return "down", {"error": f"sonda de pin falló: {e}"}
    finally:
        # Limpiar siempre: la sonda no debe dejar basura acumulándose en el repo.
        if cid:
            try: ipfs("pin", "rm", cid, timeout=15)
            except Exception: pass

def check_capacity():
    """Espacio del repo IPFS y del disco. El ENOSPC de agosto empezó por acá."""
    info = {}
    status = "ok"
    try:
        r = ipfs("repo", "stat", "-s", timeout=20)
        if r.returncode == 0:
            stats = {}
            for line in r.stdout.splitlines():
                parts = line.split()
                if len(parts) >= 2:
                    stats[parts[0].rstrip(":")] = parts[1]
            size, cap = int(stats.get("RepoSize", 0)), int(stats.get("StorageMax", 0))
            if cap:
                pct = round(size * 100 / cap, 1)
                info["repo_pct"] = pct
                info["repo"] = f"{round(size/1e6)} MB de {round(cap/1e9, 1)} GB"
                if pct >= REPO_WARN_PCT:
                    status = "degraded"
                    info["error"] = f"repo IPFS al {pct}% de StorageMax"
    except Exception as e:
        info["repo_error"] = str(e)

    try:
        du = shutil.disk_usage(HOME)
        pct = round(du.used * 100 / du.total, 1)
        info["disk_pct"] = pct
        info["disk_free"] = f"{round(du.free/1e9, 1)} GB libres"
        if pct >= DISK_WARN_PCT:
            status = "degraded"
            info["error"] = f"disco al {pct}%"
    except Exception as e:
        info["disk_error"] = str(e)

    return status, info

def restart_service(svc):
    logline(f"🔄 Reiniciando {svc['name']}...")
    try:
        subprocess.run(svc["restart_cmd"], timeout=10)
    except subprocess.TimeoutExpired:
        pass
    time.sleep(3)
    pid = pgrep(svc["pgrep"])
    if pid:
        logline(f"✅ {svc['name']} reiniciado (PID {pid})")
        return True
    logline(f"❌ {svc['name']} NO arrancó")
    return False

# ── Check loop ───────────────────────────────────────────────────────────

last_alert = {}  # svc_id -> timestamp, para no spamear XMTP

# La sonda de pin corre cada PIN_PROBE_INTERVAL, no en cada ciclo de 30s: escribe en el
# datastore. Entre corridas se muestra el último resultado conocido.
_pin_probe_at = 0
_pin_probe = ("unknown", {"note": "todavía sin correr"})

def check_all():
    now = datetime.now(timezone.utc).isoformat()
    results = []
    any_down = False

    for svc in SERVICES:
        pid = pgrep(svc["pgrep"])
        p_ok = port_open(svc.get("check_port", 0)) if svc.get("check_port") else None

        status = "ok"
        info = {}
        if pid:
            info["pid"] = pid
            if p_ok is not None and not p_ok:
                status = "degraded"
                info["error"] = "PID vivo pero puerto no responde"
            else:
                info["port_ok"] = p_ok
        else:
            status = "down"
            info["error"] = "Proceso no encontrado"
            if svc.get("no_restart"):
                info["note"] = "Monitoreo pasivo (sin auto-restart)"

        results.append({"id": svc["id"], "name": svc["name"], "status": status, "info": info})

        if status != "ok":
            any_down = True
            sid = svc["id"]

            if not svc.get("no_restart"):
                ok = restart_service(svc)
                if ok:
                    results[-1]["status"] = "restarted"
                    results[-1]["info"] = {"pid": pgrep(svc["pgrep"]), "note": "Reiniciado automáticamente"}
                    send_xmtp(f"🔄 {svc['name']} se cayó y fue reiniciado.")
                else:
                    results[-1]["status"] = "down"
                    results[-1]["info"] = {"error": "No responde y no pudo reiniciarse"}
                    if sid not in last_alert or time.time() - last_alert[sid] > 3600:
                        send_xmtp(f"💀 {svc['name']} CAÍDO — no responde y el reinicio automático falló. Revisá la máquina.")
                        last_alert[sid] = time.time()
            else:
                if sid not in last_alert or time.time() - last_alert[sid] > 3600:
                    send_xmtp(f"⚠️ {svc['name']} CAÍDO — servicio sin auto-restart. Revisá manualmente.")
                    last_alert[sid] = time.time()

    # ── Salud del almacenamiento (no es un proceso: no se reinicia, se avisa) ──
    global _pin_probe_at, _pin_probe
    if time.time() - _pin_probe_at >= PIN_PROBE_INTERVAL:
        _pin_probe = check_pin_persistence()
        _pin_probe_at = time.time()
    pin_status, pin_info = _pin_probe
    results.append({"id": "pin_probe", "name": "Persistencia de pins", "status": pin_status, "info": pin_info})
    if pin_status == "down":
        any_down = True
        if "pin_probe" not in last_alert or time.time() - last_alert["pin_probe"] > 3600:
            send_xmtp("💀 Los pins NO están persistiendo: el datastore de Kubo quedó latcheado "
                      "(pasó del 11 al 13/8). Los respaldos nuevos están a merced de un gc. "
                      "Fix: reiniciar el daemon y re-pinear.")
            last_alert["pin_probe"] = time.time()

    cap_status, cap_info = check_capacity()
    results.append({"id": "capacity", "name": "Espacio (repo/disco)", "status": cap_status, "info": cap_info})
    if cap_status != "ok":
        any_down = True
        if "capacity" not in last_alert or time.time() - last_alert["capacity"] > 3600:
            send_xmtp(f"⚠️ Almacenamiento apretado: {cap_info.get('error', '')}. "
                      f"{cap_info.get('repo', '')} · {cap_info.get('disk_free', '')}")
            last_alert["capacity"] = time.time()

    report = {"timestamp": now, "all_ok": not any_down, "services": results}

    os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
    with open(STATUS_FILE, "w") as f:
        json.dump(report, f, indent=2)

    ok_c = sum(1 for s in results if s["status"] == "ok")
    logline(f"Check — {'⚠️ ' if any_down else '✅ '}{ok_c}/{len(results)} OK")
    return report

# ── HTTP Server (dashboard) ──────────────────────────────────────────────

class MonitorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=MONITOR_DIR, **kwargs)

    def log_message(self, fmt, *args):
        pass

def start_http_server():
    port = DASHBOARD_PORT
    while True:
        try:
            server = HTTPServer(("0.0.0.0", port), MonitorHandler)
            logline(f"📊 Dashboard HTTP en http://0.0.0.0:{port}")
            server.serve_forever()
        except OSError as e:
            if "Address already in use" in str(e):
                port += 1
                continue
            logline(f"🔥 HTTP server error: {e}")
            time.sleep(10)

# ── Main ──────────────────────────────────────────────────────────────────

def main():
    logline("🟢 Monitor daemon iniciado")
    send_xmtp("🟢 Monitor de servicios iniciado — todas las alertas llegarán por este canal.")

    t = threading.Thread(target=start_http_server, daemon=True)
    t.start()

    while True:
        try:
            check_all()
        except Exception as e:
            logline(f"🔥 Error en check_all: {e}")
        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main()
