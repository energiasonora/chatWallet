# Privacy Pools (0xbow): prueba de retiro medida en el S9 (4/9/2026)

- **Equipo:** Samsung S9 (SM-G960F, Exynos 9810, 2018, Android 10), Chrome por CDP.
- **Artefactos:** los reales de `0xbow-io/privacy-pools-website/public/artifacts`.

```
prueba de retiro   5,9 – 6,1 s   (Mac M-series: 2,3 s)   siempre VÁLIDA contra la vkey
pico de heap       22 MB de 954 MB de límite
artefactos         withdraw.zkey 16,97 MB + withdraw.wasm 2,49 MB
descarga 19,5 MB   4G rápido 51 s  ·  4G flojo 157 s
```

- **El cuello no es probar, es bajar los 19,5 MB.** Empaquetarlos en el APK lo elimina: el APK pasa de unos 23 a unos 43 MB.
- **Sin medir:** el flujo completo (SDK `@0xbow/privacy-pools-core-sdk` + contratos + relayer). Esto midió sólo la prueba.
- **Para el paper:** es la cota de "salir del pool" en el mismo teléfono. Comparar con la JoinSplit 1x2 de Railgun (11,5 s) y su POI (22,5 s): ver `../mediciones/railgun/RESULTADOS.md`.
- **Ojo con el heap:** el banco de Railgun del 5/10 leyó `performance.memory` sin `--enable-precise-memory-info`, y en Android ese valor sale cuantizado (marcó 10 MB). **No usar ese número.** El de 22 MB de esta medición salió de otra configuración, que habría que volver a documentar si se cita.
