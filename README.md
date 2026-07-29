# Logbitts — Fase 3 (DMS + WMS + TMS Embarcador)

Gestão de entregas, armazém e **frete embarcador** (cotação, contratação, auditoria CT-e, conciliação).

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
| 2 WMS | Estoque, recebimento, picking, inventário, gate `ready_to_ship` |
| 3 TMS Embarcador | Transportadoras, tabelas, cotação, embarques, auditoria CT-e, faturas, KPIs torre |

## Fluxo frete (Fase 3)

1. **Frete → Transportadoras / Tabelas** (seed já cria 2 carriers + faixas SP)  
2. **Cotação** a partir de uma entrega → comparar valores  
3. **Contratar** → embarque com tracking  
4. **Auditoria CT-e** → importar valor e casar com esperado (±5%)  
5. **Faturas** → agrupar CT-es e conciliar  
6. **Torre** → OTIF, custo/km, frete, divergências  

## Fora de escopo (ainda)

Emissão CT-e/MDF-e/CIOT (Fase 4), marketplace, Winthor nativo, slotting IA.
