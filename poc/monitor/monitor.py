#!/usr/bin/env python3
"""
Monitor daemon — chequea servicios, reinicia caídos, alerta por XMTP (ChatWallet),
y sirve el dashboard web embebido en un thread HTTP liviano.
"""

import json
import os
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
