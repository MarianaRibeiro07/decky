// Validação local do cadastro e do login. Roda antes de chamar o servidor.

/** Algo antes do @, domínio com pelo menos um ponto, sem espaços. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mínimo de 6 caracteres (exigência do Supabase Auth), com pelo menos uma letra e um número. */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

/** Nome exibido na mesa: 2 a 20 caracteres, letras (com acento), números e espaço. */
export const DISPLAY_NAME_REGEX = /^[\p{L}\d ]{2,20}$/u;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Informe o e-mail.';
  if (!EMAIL_REGEX.test(email.trim())) return 'E-mail inválido. Exemplo: nome@email.com';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Informe a senha.';
  if (!PASSWORD_REGEX.test(password)) return 'A senha precisa de 6 caracteres ou mais, com letras e números.';
  return null;
}

export function validateDisplayName(name: string): string | null {
  if (!name.trim()) return 'Informe seu nome.';
  if (!DISPLAY_NAME_REGEX.test(name.trim())) return 'Use de 2 a 20 letras ou números.';
  return null;
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  return password === confirmation ? null : 'As senhas não conferem.';
}
