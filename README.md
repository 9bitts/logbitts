# Logbitts — Fase 5 (DMS + WMS + TMS + Fiscal + YMS)

Gestão de entregas, armazém, frete, emissão fiscal e **pátio (YMS)** — docks, agenda e gate.

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
| 5 YMS + Open Platform | Docks, agenda, gate; catálogo de integrações (stubs) |

## Fluxo pátio (Fase 5)

1. **Pátio → Docks** — cadastro (seed cria D01–D03)  
2. **Agenda** — janela inbound/outbound + placa/transportadora  
3. **Gate** — check-in → atribuir dock → checkout (mede espera)  
4. **Torre** — docks livres, veículos no pátio, espera média  
5. **Integrações** (`/integracoes`) — Winthor/SAP/REST/fiscal (stubs)

## Fora de escopo (ainda)

Multi-CD / 3PL completo, BI enterprise, marketplace de cargas real, Winthor nativo (além do stub), slotting IA, certificado A1/A3 na SEFAZ.
