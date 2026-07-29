# Logbitts — Fase 7 (Multi-CD + Analytics)

Plataforma logística modular com **múltiplos CDs** e **BI operacional**.

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
| 1–4 | DMS, WMS, TMS embarcador, fiscal |
| 5 YMS | Docks, agenda, gate |
| 6 ERP | Sync Winthor → entregas |
| 7 Multi-CD + BI | Vários warehouses, seletor, `/analytics` (OTIF, funil, CSV) |

## Fluxo Fase 7

1. **Estoque → CDs** — criar/listar warehouses (seed: CD-SP + CD-CP)  
2. Seletor de CD em **Estoque** e **Pátio**  
3. **Analytics** — período, OTIF diário, funil, estoque/docks por CD, export CSV  

## Fora de escopo (ainda)

3PL multi-cliente completo, data lake, marketplace de cargas, slotting IA, certificado A1/A3 na SEFAZ.
