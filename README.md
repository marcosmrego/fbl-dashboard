# Focus Blues Lab Analytics Dashboard

Painel web para monitoramento do canal do YouTube Focus Blues Lab.

## Estrutura inicial

- `backend/`
  - `server.js` - servidor Express e API local
  - `youtube.js` - cliente para YouTube Data API
  - `database.js` - inicialização e consultas SQLite
  - `scheduler.js` - coleta automática a cada 6 horas
  - `.env` - variáveis de ambiente
- `frontend/`
  - `index.html` - dashboard HTML
  - `style.css` - estilo escuro com identidade visual
  - `app.js` - lógica de chamada de API e renderização
  - `assets/` - recursos estáticos
- `database/analytics.db` - banco SQLite inicial
- `package.json` - dependências do Node.js

## Como iniciar

1. Instale as dependências:

```bash
npm install
```

2. Configure as variáveis no arquivo `backend/.env`:

```ini
YOUTUBE_API_KEY=
CHANNEL_ID=
PORT=3000
DATABASE_CLIENT=postgres
DATABASE_URL=postgres://username:password@host:5432/database_name
DATABASE_PATH=./database/analytics.db

# Notion Integration (opcional)
NOTION_API_KEY=
NOTION_DATABASE_ID=
```

> Use `DATABASE_CLIENT=postgres` e `DATABASE_URL` quando estiver rodando na VPS/Coolify. `DATABASE_PATH` é usado apenas para SQLite local.

### Configuração do Notion (opcional)

Para usar o pipeline de produção:

1. Crie uma nova base de dados no Notion
2. Adicione as seguintes propriedades:
   - `Nome do Vídeo` (Title)
   - `Status` (Select): Ideia, Roteiro, Gravação, Edição, Thumbnail, Publicado
   - `Data de Publicação` (Date)
   - `Descrição` (Text)
   - `Tags` (Multi-select)
   - `Prioridade` (Select): Baixa, Média, Alta, Urgente
   - `Duração Estimada` (Number)
   - `Roteiro` (Select): Pendente, Em andamento, Concluído
   - `Gravação` (Select): Pendente, Em andamento, Concluído
   - `Edição` (Select): Pendente, Em andamento, Concluído
   - `Thumbnail` (Select): Pendente, Em andamento, Concluído

3. Obtenha o API Key do Notion em https://www.notion.com/my-integrations
4. Compartilhe a base com a integração
5. Configure `NOTION_API_KEY` e `NOTION_DATABASE_ID` no `.env`

3. Execute o servidor:

```bash
npm start
```

4. Abra `http://localhost:3000` no navegador.

O dashboard possui **auto-refresh automático** que atualiza os dados a cada 5 segundos. Você pode controlar isso através do botão "🔄 Auto" no header.

## Deploy para VPS

### Deploy com Docker

1. Instale Docker e Docker Compose na VPS.
2. Copie o projeto para a VPS via `scp`, `git clone` ou outro método.
3. Crie ou atualize `backend/.env` na VPS com as credenciais reais.
4. Configure o Postgres no Coolify ou na sua VPS via `DATABASE_URL`.
5. Execute:

```bash
docker compose up -d --build
```

6. Acesse `http://<IP-da-VPS>:3000`.

### Deploy via GitHub + Coolify

1. Crie um repositório privado ou público no GitHub.
2. No projeto local, inicialize git se ainda não estiver inicializado:

```bash
git init
git add .
git commit -m "Inicial commit do Focus Blues Lab Dashboard"
git branch -M main
git remote add origin https://github.com/<seu-usuario>/<seu-repo>.git
git push -u origin main
```

3. No GitHub, verifique se `Dockerfile`, `docker-compose.yml` e `.env.example` estão no repositório.
4. No Coolify, abra o projeto `expansao AI` e selecione o recurso `fbl dashboard`.
5. Configure o recurso para usar o GitHub repo e branch `main`.
6. Escolha deploy via Dockerfile. Se preferir, use `docker-compose.yml` se o Coolify oferecer suporte a stacks.
7. Adicione variáveis de ambiente no painel do Coolify (não suba `backend/.env` para o repositório):
   - `YOUTUBE_API_KEY`
   - `CHANNEL_ID`
   - `PORT=3000`
   - `DATABASE_PATH=./database/analytics.db`
   - `NOTION_API_KEY` (opcional)
   - `NOTION_DATABASE_ID` (opcional)
8. Inicie o deploy no Coolify.
9. O serviço deve construir a imagem a partir do `Dockerfile` e expor a porta 3000.

### Observações para Coolify

- Use o recurso Docker do Coolify para apontar ao repositório GitHub.
- Deixe `backend/.env` no `.gitignore` e mantenha as credenciais apenas no painel do Coolify.
- Se quiser persistência de banco, monte o volume `/app/database` no Coolify ou use um serviço de volume próprio.
- Se o Coolify suportar `docker-compose`, ele pode usar `docker-compose.yml` diretamente; caso contrário, use apenas `Dockerfile`.

### Deploy direto em Node + PM2

1. Instale Node.js e npm na VPS.
2. Copie o projeto para a VPS.
3. No diretório do projeto, instale dependências:

```bash
npm install --production
```

4. Crie `backend/.env` com as variáveis necessárias.
5. Inicie com PM2:

```bash
npx pm2 start ecosystem.config.js
```

6. Para visualizar logs:

```bash
npx pm2 logs focus-blues-dashboard
```

### Observações importantes

- Nunca comite o arquivo `backend/.env` no repositório.
- O SQLite será mantido em `./database/analytics.db` e é montado como volume no Docker.
- Se quiser usar HTTPS, coloque um proxy reverso como Nginx na VPS.

## Funcionalidades avançadas

### Auto-refresh
- **Atualização automática**: dados são atualizados a cada 5 segundos
- **Controle manual**: botão no header para pausar/retomar
- **Indicador visual**: mostra status ativo/inativo com indicador verde/vermelho
- **Última atualização**: timestamp da última atualização bem-sucedida
- **Otimização**: apenas dados dinâmicos são recarregados (canal e histórico)
## Funcionalidades implementadas

### Dashboard principal
- **Visão geral do canal**: inscritos, views totais, vídeos publicados, crescimento diário
- **Histórico**: gráficos de evolução de inscritos e views
- **Top vídeos**: rankings por views, engajamento, recência e crescimento rápido
- **Lista de vídeos**: tabela completa com thumbnail, título, data, métricas e duração

### Funcionalidades interativas
- **Busca em tempo real**: filtrar vídeos por título
- **Filtro por status**: todos, publicado, rascunho, agendado
- **Ordenação de colunas**: clique nos cabeçalhos para ordenar ascendente/descendente
- **Estatísticas dinâmicas**: contadores atualizados conforme filtros aplicados
- **Auto-refresh**: atualização automática a cada 5 segundos com controle manual

## Endpoints de API

- `GET /api/channel` — visão geral do canal
- `GET /api/videos` — lista de vídeos
- `GET /api/history` — histórico diário
- `GET /api/top-videos` — rankings de vídeos por desempenho

## Banco de dados Postgres

No Coolify, configure o serviço Postgres e adicione a connection string em `DATABASE_URL`. Use `DATABASE_CLIENT=postgres` para o backend.

O backend criará as tabelas automaticamente se elas não existirem.

## Próximos passos

- implementar modais para CRUD completo do pipeline
- adicionar drag & drop entre colunas do kanban
- implementar notificações e lembretes
- criar dashboard móvel responsivo
- adicionar autenticação e controle de acesso
- implementar exportação de dados CSV/Excel
- adicionar automações n8n para publicação
