# Como contribuir

Equipe de 6 pessoas em um dia. O objetivo destas regras é que ninguém sobrescreva o trabalho de outra pessoa e que o histórico mostre quem fez o quê.

## Branches

- `main` é a base estável. Ninguém faz push direto de código na `main` depois do scaffold; documentação pode ir direto se a Isabela concordar.
- Uma branch por área: `feat/ui-auth` (Nicoly), `feat/rooms` (Caio), `feat/engine` (Eduardo), `feat/backend` (Rafael), `docs/<assunto>` (Mariana, Isabela).
- Nunca `git push --force` em `main`. Em branch própria, só com aviso ao time.

## Pull requests

- Curtos e focados em uma tarefa do [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md); citar o ID (ex.: `T-EDU-02`) no título.
- Revisão por pelo menos uma pessoa que **não** seja a autora. Mudança em contrato (`src/contracts/`) exige as três aprovações de T-00.
- Conflito: quem abre o PR resolve, preservando o código dos outros.
- Fazer `git pull --rebase` ou merge de `main` na branch antes de abrir o PR.

## Commits

- Cada pessoa commita a **própria** parte, com a **própria** identidade Git. Não commitar em nome de colega.
- Mensagem: `tipo(área): resumo curto`, com tipos `feat`, `fix`, `docs`, `test`, `chore`, `refactor`. Exemplo: `feat(engine): calcula manilha pela vira`.
- Um commit por unidade que faz sentido sozinha; teste vai no mesmo commit da função.
- Nunca usar `--no-verify`.

## Segredos

- Nunca commitar `.env`, chaves, tokens ou senhas. O `.gitignore` já ignora `.env*`, exceto `.env.example`.
- `.env.example` só com placeholders (`EXPO_PUBLIC_SUPABASE_URL=`).
- Segredos de função e `service_role` ficam só no painel do Supabase.
- Se um segredo vazar no Git, avisar a Isabela e o Rafael na hora; trocar a chave no Supabase vale mais que apagar o commit.

## Registrar participação

- Toda entrega concreta (commit, PR, issue, ata) entra na tabela "Evidências de contribuição" de [SCRUM.md](SCRUM.md).
- PO e SM registram suas entregas lá também: critérios aceitos, issues criadas, Daily conduzida, ata de Review.

## Evitar conflito de área

Arquivos têm dono (ver caminhos em SPRINT_BACKLOG.md). Para mexer no arquivo de outra pessoa, combine antes e faça PR pequeno.
