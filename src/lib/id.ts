/** Identificador de ação para idempotência. Não precisa ser criptográfico, só único por jogada. */
export function newClientActionId(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random()}-${random()}`;
}
