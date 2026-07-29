# Logbitts — Fase 6 (DMS + WMS + TMS + Fiscal + YMS + ERP)

Gestão logística modular com **integração ERP** (Winthor mock/HTTP → entregas).

## Setup

```bash
npm install
cp .env.example .env
npm run icons
npm run db:seed
npm run dev
```

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Despacho | `despacho@logbitts.demo` | `demo1234` |
| Armazém | `armazem@logbitts.demo` | `demo1234` |
| Motorista | `motorista@logbitts.demo` | `demo1234` |

## Módulos

| Fase | Escopo |
|------|--------|
| 1 DMS | Rotas, torre, motorista PWA, POD |
| 2 WMS | Estoque, recebimento, picking, inventário |
| 3 TMS Embarcador | Cotação, embarques, auditoria CT-e, faturas |
| 4 Fiscal | Emissão CT-e / MDF-e / CIOT via adapter |
| 5 YMS | Docks, agenda, gate; catálogo de integrações |
| 6 ERP | Sync Winthor/REST → clientes + entregas + histórico |

## Fluxo ERP (Fase 6)

1. **ERP → Winthor** (`/integracoes/winthor`) — modo `mock` ou `http`  
2. **Sync agora** — importa pedidos idempotentes (por `orderNumber`)  
3. **Entregas** — pedidos aparecem prontos para WMS/DMS  
4. **Webhook** — `POST /api/integrations/webhook?org=...&key=winthor` + `X-Logbitts-Secret`  

## Fora de escopo (ainda)

Multi-CD / 3PL, BI enterprise, marketplace de cargas, slotting IA, certificado A1/A3 na SEFAZ, API Winthor proprietária oficial (usa middleware HTTP).
