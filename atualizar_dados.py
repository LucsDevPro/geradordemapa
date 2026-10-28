#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Atualiza os arquivos de dados do sistema de ovitrampas (pasta data/) sem perder o histórico.

Uso:
  python tools/atualizar_dados.py planilha-contaovos.csv     # mescla a planilha mensal nos arquivos por ano
  python tools/atualizar_dados.py --verificar                # confere a integridade dos arquivos
  python tools/atualizar_dados.py --manifest                 # só recalcula manifest.json (versões)

Regras (para preservar a integridade dos dados):
  * data/enderecos.json (ruas, números e coordenadas das ovitrampas) NUNCA é alterado pela planilha.
    Diferenças de coordenada maiores que 50 m são apenas listadas, para decisão humana.
    Só são acrescentados ali pontos extras novos (ex.: pontos estratégicos), com a coordenada da planilha.
  * data/AAAA.json recebe os meses da planilha. Meses que já existiam e não vêm na planilha são mantidos;
    meses que vêm na planilha substituem os de mesmo mês. Registros de campo ("campo") nunca são tocados.
  * Mês com mais de uma leitura por ovitrampa: usa-se a MÉDIA das leituras (somar dobraria os ovos).
Sem dependências além do Python 3.8+.
"""
import argparse, csv, io, json, math, os, re, sys, unicodedata
from datetime import datetime, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(RAIZ, 'data')
ESQUEMA = 2

def fnv1a(b: bytes) -> str:
    h = 0x811c9dc5
    for x in b:
        h ^= x
        h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h

def caminho(nome): return os.path.join(DATA, nome)

def ler_json(nome, padrao=None):
    p = caminho(nome)
    if not os.path.exists(p): return padrao
    with open(p, encoding='utf-8') as f: return json.load(f)

def texto_json(obj): return json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '\n'

def salvar_json(nome, obj):
    """Grava só se mudou. Retorna True se alterou."""
    novo = texto_json(obj)
    p = caminho(nome)
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            if f.read() == novo: return False
    os.makedirs(DATA, exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='\n') as f: f.write(novo)
    return True

def norm(t):
    t = unicodedata.normalize('NFD', str(t or ''))
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9º° ]+', ' ', t)).strip()

def num(t):
    t = str(t or '').replace('*', '').strip().replace(',', '.')
    return float(t) if re.fullmatch(r'-?\d+(\.\d+)?', t) else None

def coord(t):
    t = str(t or '').strip().replace(',', '.')
    return t if re.fullmatch(r'-?\d{1,3}\.\d+', t) else None

def dist_m(la1, lo1, la2, lo2): return math.hypot((la2 - la1) * 110574, (lo2 - lo1) * 102500)

def ler_planilha(caminho_csv):
    with open(caminho_csv, encoding='utf-8-sig', newline='') as f: txt = f.read()
    am = '\n'.join(txt.split('\n')[:8])
    d = '\t' if '\t' in am else (';' if am.count(';') >= am.count(',') and ';' in am else ',')
    linhas = list(csv.reader(io.StringIO(txt), delimiter=d))
    cab = [norm(x) for x in linhas[0]]
    def col(rx):
        for i, c in enumerate(cab):
            if re.search(rx, c): return i
        return None
    C = dict(mes=col(r'^mes$'), id=col(r'^ovitrampa( numero.*)?$'), reg=col(r'^registros$'), soma=col(r'^soma de ovos$'),
             media=col(r'^media de ovos$'), base=col(r'^media de media historica'), lat=col(r'^latitude'), lon=col(r'^longitude'))
    if C['mes'] is None or C['id'] is None or (C['media'] is None and C['soma'] is None):
        sys.exit('Não reconheci as colunas da planilha (esperado: Mês, Ovitrampa, Registros, Média de ovos, ...). Cabeçalho lido: %s' % cab)
    return linhas[1:], C

def processar(linhas, C, ids_malha):
    v, base, ex, multi, geo = {}, {}, {}, {}, {}
    n_ok = 0
    usados = [x for x in C.values() if x is not None]
    for r in linhas:
        if not r or len(r) <= max(usados): continue
        mes, idt = r[C['mes']].strip(), r[C['id']].strip()
        if not re.fullmatch(r'\d{4}-\d{2}', mes) or not idt: continue
        reg = (num(r[C['reg']]) or 1) if C['reg'] is not None else 1
        val = num(r[C['media']]) if C['media'] is not None else None
        if val is None and C['soma'] is not None:
            s = num(r[C['soma']]); val = None if s is None else s / reg
        if val is None: continue
        n_ok += 1
        if reg > 1: multi[mes] = max(multi.get(mes, 0), int(reg))
        b = num(r[C['base']]) if C['base'] is not None else None
        la = coord(r[C['lat']]) if C['lat'] is not None else None
        lo = coord(r[C['lon']]) if C['lon'] is not None else None
        n = int(idt) if re.fullmatch(r'\d+', idt) else None
        if n in ids_malha:
            v.setdefault(n, {})[mes] = val
            if b is not None: base[n] = b
            if la and lo and (n not in geo or mes >= geo[n][0]): geo[n] = (mes, la, lo)
        else:
            e = ex.setdefault(idt, dict(v={}, base=None, lat=None, lon=None, mes=''))
            e['v'][mes] = val
            if b is not None: e['base'] = b
            if la and lo and mes >= e['mes']: e['lat'], e['lon'], e['mes'] = la, lo, mes
    return v, base, ex, multi, geo, n_ok

def arred(x):
    """Mantém inteiros como inteiros e metades como .5 (média de 2 leituras)."""
    return int(x) if float(x).is_integer() else round(x, 4)

def mesclar_ano(ano, meses_novos, v, base, ex, multi):
    nome = '%d.json' % ano
    atual = ler_json(nome) or dict(esquema=ESQUEMA, ano=ano, meses=[], multi={}, serie={}, base={}, extras={}, campo={}, atual={})
    def dic(meses, arr): return {m: x for m, x in zip(meses, arr) if x is not None}
    ant = atual['meses']
    S = {k: dic(ant, arr) for k, arr in atual['serie'].items()}
    X = {k: dict(base=e.get('base'), v=dic(ant, e['serie'])) for k, e in atual.get('extras', {}).items()}
    for n, mm in v.items():
        d = S.setdefault(str(n), {})
        for m, x in mm.items():
            if m.startswith(str(ano)) and m in meses_novos: d[m] = x
    for k, e in ex.items():
        d = X.setdefault(k, dict(base=None, v={}))
        for m, x in e['v'].items():
            if m.startswith(str(ano)): d['v'][m] = x
        if e['base'] is not None: d['base'] = e['base']
    meses = sorted(set(ant) | {m for m in meses_novos if m.startswith(str(ano))})
    atual['meses'] = meses
    atual['serie'] = {k: [arred(S[k][m]) if m in S[k] else None for m in meses] for k in sorted(S, key=int)}
    atual['extras'] = {k: dict(base=(arred(X[k]['base']) if X[k]['base'] is not None else None),
                              serie=[arred(X[k]['v'][m]) if m in X[k]['v'] else None for m in meses]) for k in sorted(X)}
    for n, b in base.items(): atual['base'][str(n)] = arred(b)
    atual['base'] = {k: atual['base'][k] for k in sorted(atual['base'], key=int)}
    for m, q in multi.items():
        if m.startswith(str(ano)): atual['multi'][m] = q
    atual['multi'] = dict(sorted(atual['multi'].items()))
    atual.setdefault('campo', {}); atual.setdefault('atual', {})
    return nome, atual

def atualizar_manifest(forcar=False):
    arquivos, anos = {}, []
    for nome in sorted(os.listdir(DATA)):
        if nome == 'manifest.json' or not nome.endswith('.json'): continue
        with open(caminho(nome), 'rb') as f: b = f.read()
        chave = nome[:-5]
        info = dict(url=nome, v=fnv1a(b))
        if re.fullmatch(r'\d{4}', chave):
            anos.append(int(chave)); info['meses'] = json.loads(b.decode('utf-8'))['meses']
        arquivos[chave] = info
    anos.sort()
    ant = ler_json('manifest.json') or {}
    novo = dict(esquema=ESQUEMA, atualizado=ant.get('atualizado'), anos=anos, ano_atual=anos[-1] if anos else None, arquivos=arquivos)
    comp = lambda m: {k: m.get(k) for k in ('esquema', 'anos', 'ano_atual', 'arquivos')}
    if forcar or comp(ant) != comp(novo) or not ant.get('atualizado'):
        novo['atualizado'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        salvar_json('manifest.json', novo); return True
    return False

def importar(csv_path):
    ender = ler_json('enderecos.json')
    if not ender: sys.exit('data/enderecos.json não encontrado.')
    ids = {o['id'] for o in ender['ovitrampas']}
    linhas, C = ler_planilha(csv_path)
    v, base, ex, multi, geo, n_ok = processar(linhas, C, ids)
    if not n_ok: sys.exit('Nenhuma linha válida na planilha.')
    meses = sorted({m for d in v.values() for m in d} | {m for e in ex.values() for m in e['v']})
    print('Planilha: %d linhas válidas · meses %s a %s · %d ovitrampas da malha · %d pontos extras' % (n_ok, meses[0], meses[-1], len(v), len(ex)))
    for ano in sorted({int(m[:4]) for m in meses}):
        nome, obj = mesclar_ano(ano, set(meses), v, base, ex, multi)
        alt = salvar_json(nome, obj)
        print('  %s: %s (%d meses no arquivo)' % (nome, 'atualizado' if alt else 'sem mudanças', len(obj['meses'])))
    ja = {e['id'] for e in ender.get('extras', [])}
    novos = [dict(id=k, lat=e['lat'], lon=e['lon']) for k, e in sorted(ex.items()) if k not in ja and e['lat'] and e['lon']]
    if novos:
        ender.setdefault('extras', []).extend(novos); salvar_json('enderecos.json', ender)
        print('  enderecos.json: +%d ponto(s) extra(s)' % len(novos))
    por_id = {o['id']: o for o in ender['ovitrampas']}
    div = [(n, round(dist_m(float(por_id[n]['lat']), float(por_id[n]['lon']), float(g[1]), float(g[2])))) for n, g in geo.items()]
    div = sorted([(n, d) for n, d in div if d > 50], key=lambda x: -x[1])
    if div:
        print('  ATENÇÃO: %d coordenada(s) da planilha diferem mais de 50 m de enderecos.json (NÃO alteradas): %s' %
              (len(div), ', '.join('%d (%d m)' % x for x in div[:12]) + (' …' if len(div) > 12 else '')))
    print('manifest.json:', 'atualizado' if atualizar_manifest() else 'sem mudanças')

def verificar():
    erros, avisos = [], []
    ender, ag, man = ler_json('enderecos.json'), ler_json('agentes.json'), ler_json('manifest.json')
    if not ender or not ag or not man: sys.exit('Faltam arquivos em data/ (enderecos.json, agentes.json, manifest.json).')
    ids = [o['id'] for o in ender['ovitrampas']]
    if len(ids) != len(set(ids)): erros.append('IDs repetidos em enderecos.json')
    for o in ender['ovitrampas']:
        la, lo = coord(o['lat']), coord(o['lon'])
        if not la or not lo or not (-23 <= float(la) <= -22.2 and -56 <= float(lo) <= -55.3): erros.append('coordenada inválida/fora da região: ovitrampa %s' % o['id'])
    cob = set()
    for a in ag['agentes']:
        for k in range(a['ini'], a['fim'] + 1):
            if k in cob: erros.append('ovitrampa %d em mais de um agente' % k)
            cob.add(k)
    if cob != set(ids): avisos.append('agentes não cobrem exatamente as ovitrampas (faltam %s)' % sorted(set(ids) - cob)[:10])
    for ano in man['anos']:
        d = ler_json('%d.json' % ano)
        if not d: erros.append('arquivo %d.json ausente' % ano); continue
        n = len(d['meses'])
        for k, arr in d['serie'].items():
            if int(k) not in set(ids): erros.append('%d.json: série de ID inexistente %s' % (ano, k))
            if len(arr) != n: erros.append('%d.json: série de %s com %d valores (esperado %d)' % (ano, k, len(arr), n))
        for k, e in d['extras'].items():
            if len(e['serie']) != n: erros.append('%d.json: extra %s desalinhado' % (ano, k))
        if d['meses'] != sorted(d['meses']): erros.append('%d.json: meses fora de ordem' % ano)
        with open(caminho('%d.json' % ano), 'rb') as f: h = fnv1a(f.read())
        if man['arquivos'][str(ano)]['v'] != h: erros.append('manifest.json desatualizado para %d.json (rode --manifest)' % ano)
    for k in ('enderecos', 'agentes'):
        with open(caminho(k + '.json'), 'rb') as f: h = fnv1a(f.read())
        if man['arquivos'][k]['v'] != h: erros.append('manifest.json desatualizado para %s.json (rode --manifest)' % k)
    for a in avisos: print('AVISO:', a)
    for e in erros: print('ERRO:', e)
    print('Verificação concluída: %d erro(s), %d aviso(s).' % (len(erros), len(avisos)))
    sys.exit(1 if erros else 0)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Atualiza data/*.json a partir da planilha mensal, preservando o histórico.')
    ap.add_argument('planilha', nargs='?', help='CSV "contaovos-contagens" (uma linha por ovitrampa e mês)')
    ap.add_argument('--verificar', action='store_true'); ap.add_argument('--manifest', action='store_true')
    a = ap.parse_args()
    if a.verificar: verificar()
    elif a.manifest: print('manifest.json:', 'atualizado' if atualizar_manifest() else 'sem mudanças')
    elif a.planilha: importar(a.planilha)
    else: ap.print_help()
