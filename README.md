# Sistema de ovitrampas — Prefeitura de Ponta Porã/MS

Dois sistemas que leem os mesmos arquivos de dados:

| Página | Para quem | O que faz |
|---|---|---|
| `index.html` | coordenação e agentes | mapa de campo: agentes e equipes, relatórios (PNG/PDF), grid, rota com QR, importação de planilhas, registros de campo |
| `gestao.html` | gestores | painel somente leitura: indicadores, mapa, análise mensal, focos e alertas, impressão em PDF |

## Estrutura

```
index.html  gestao.html  sw.js
assets/   css/ (tokens, base, app, gestao) · js/ (boot, ui, app, gestao) · vendor/ (bibliotecas) · fonts/ · img/ (logo)
data/     manifest.json · enderecos.json · agentes.json · 2026.json (um arquivo por ano)
tools/    atualizar_dados.py
```

**Dados (`data/`)** — cada informação existe em um único lugar:
- `enderecos.json`: rua, número e coordenadas das ovitrampas (+ pontos extras e o registro de correções). Não muda com as planilhas de resultados.
- `agentes.json`: agentes, áreas, zonas e equipes.
- `AAAA.json`: resultados do ano (série mensal por ovitrampa, média histórica, registros de campo). Um arquivo por ano; os anos antigos não são recarregados.
- `manifest.json`: lista de arquivos e a versão (hash) de cada um. As páginas buscam o manifesto sempre e os demais arquivos só quando a versão muda (cache).

**Carregamento leve:** o HTML tem ~20 KB. As bibliotecas pesadas (PDF, ZIP, QR, mapa vetorial) só são baixadas quando você usa o recurso. O service worker guarda o sistema e os dados para uso sem internet.

## Publicar no GitHub Pages (uma vez)
1. Crie um repositório e envie **todo o conteúdo desta pasta** (mantendo as subpastas).
2. Settings → Pages → Deploy from a branch → `main` / `(root)`.
3. Endereços: `https://SEU-USUARIO.github.io/REPO/` (mapa de campo) e `.../gestao.html` (painel).

> O sistema precisa ser aberto pelo endereço do site (ou por um servidor local, ex.: `python -m http.server`). Abrir o arquivo direto do disco não permite ler os dados.

## Atualizar os dados (sem perder o histórico)

**Opção A — pelo mapa de campo:** Dados e conferência → Importar planilha (CSV mensal "contaovos-contagens") → Aplicar → **Publicar dados para a gestão** → baixa `dados-publicacao-AAAA-MM-DD.zip`. Extraia e envie a pasta `data/` ao GitHub (Add file → Upload files), substituindo os arquivos. O pacote parte dos dados já publicados e acrescenta o que mudou; meses anteriores e registros de campo são preservados.

**Opção B — pelo script (computador com Python 3):**
```
python tools/atualizar_dados.py planilha.csv     # mescla a planilha mensal em data/AAAA.json
python tools/atualizar_dados.py --verificar      # confere integridade (IDs, coordenadas, séries, hashes)
```
O script **nunca altera** `enderecos.json` (só lista coordenadas que diferem mais de 50 m), usa a média das leituras quando um mês tem mais de uma, e é idempotente (rodar duas vezes não muda nada).

## Regras mantidas
- Faixas de ovos: 0 · 1–20 · 21–50 · 51–100 · 101+ · sem informação (cores e limites inalterados).
- IPO = positivas ÷ ovitrampas com contagem · IDO = ovos ÷ positivas · IDV = ovos ÷ ovitrampas com contagem.
- Coordenadas e IDs (1–242) preservados; nenhum endereço ou coordenada foi inventado.

## Privacidade
Em repositório **público**, qualquer pessoa com o link vê as páginas e baixa os arquivos de `data/`. Ao publicar pelo mapa de campo dá para desmarcar "nomes dos agentes" e "ruas, números e coordenadas exatas".
