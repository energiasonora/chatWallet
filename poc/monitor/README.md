# Monitor de servicios de la caja

Demonio que vigila los servicios soberanos de la caja (192.168.1.42): chequea cada 30s
por `pgrep` + puerto, **reinicia** lo que se cayó y **avisa por XMTP** al ChatWallet del
autor. Sirve además un dashboard HTTP en el `:8900`.

Es el guardián real de todo lo que corre en la caja: el `sales-notifier`, el upload-server
del backup, IPFS, ntfy, StealthPay. **No agregar crons `*/5` para revivir servicios** — ya
los revive este monitor y competirían entre sí.

## Archivos

| Archivo | Qué es |
|---|---|
| `monitor.py` | El demonio: `SERVICES` (qué vigilar y cómo reiniciarlo), loop de chequeo, dashboard |
| `start-monitor.sh` | Arranque idempotente. Cron: `@reboot sleep 30 && ~/start-monitor.sh` |
| `xmtp-alert.js` | Manda un DM XMTP. Identidad burner propia en `alert-state.json` (**no versionado**) |

En la caja viven en `~/chatwallet-node/monitor/`, salvo `start-monitor.sh` que está en `~/`.

## Desplegar un cambio

```bash
scp poc/monitor/monitor.py caja:~/chatwallet-node/monitor/monitor.py
scp poc/monitor/start-monitor.sh caja:~/start-monitor.sh
ssh caja 'pkill -f "python3 +monito[r]\.py"'   # en su PROPIA llamada ssh (ver gotchas)
ssh caja '~/start-monitor.sh'
```

## Gotchas que ya costaron caro

**El patrón de `pgrep` tiene que matchear el cmdline real.** El guardia original era
`monito[r].*monitor.py`, que **no** matchea `python3 monitor.py` (el regex exige un
"monitor" *antes* del "monitor.py"). Solo pegaba con el `bash -c` del lanzamiento, así que
cuando ese wrapper moría el guardia fallaba y arrancaba otro monitor: el 2026-08-03 había
**dos corriendo hacía 4 días**, duplicando alertas. Ahora es `python3 +monito[r]\.py` y se
lanza con `setsid` para no dejar wrapper colgado.

**Los corchetes del patrón son obligatorios** (`monito[r]`, `sales-notifie[r]`): sin ellos
el `pgrep`/`pkill` se matchea a sí mismo. Ojo también con el comando `ssh` que lo invoca —
si el string remoto menciona el nombre del proceso más abajo, el `pkill` mata su propio
shell (pasa con `ssh caja 'pkill ...; node sales-notifier.mjs'`). Solución: una llamada
`ssh` por cosa.

**No redirigir el stdout del demonio a `monitor.log`.** `monitor.py` ya escribe cada línea
ahí por su cuenta (`LOG_FILE`); si además le mandás el stdout al mismo archivo, cada línea
queda duplicada. stdout va a `/dev/null` y stderr a `monitor.boot.log` (para tracebacks que
no pasan por `logline`).

**El `timeout` de la alerta XMTP no puede ser corto.** Estaba en 15s y crear el cliente XMTP
en frío tarda más, así que las alertas se perdían **justo cuando había una caída** — el
2026-08-03 el `sales-notifier` estuvo en bucle de crash y no llegó ni un aviso. Ahora 90s.

## Deuda

Los otros `start-*.sh` de la caja (`start-ntfy.sh`, `start-cloudflared.sh`,
`start-chatwallet-node.sh`, `start-stealthpay.sh`) siguen sin versionar.
