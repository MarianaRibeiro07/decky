let sequence = 0;

/**
 * Nome de canal Realtime único para cada assinatura.
 * `supabase.channel(nome)` devolve o canal que já existe com o mesmo nome, e `removeChannel` é
 * assíncrono: ao sair e voltar rápido para a mesma tela, o efeito novo recebia o canal antigo, já
 * inscrito, e `.on('postgres_changes')` lançava "cannot add postgres_changes callbacks after subscribe()".
 */
export function channelTopic(key: string): string {
  sequence += 1;
  return `live:${key}:${sequence}`;
}
