import { describe, expect, it } from 'vitest';
import {
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../../src/auth/validators';

describe('e-mail', () => {
  it.each(['ana@email.com', 'caio.yuri@senai.sp.gov.br', ' bia@x.io '])('aceita %s', (email) => {
    expect(validateEmail(email)).toBeNull();
  });

  it.each(['', 'ana', 'ana@', '@email.com', 'ana@email', 'ana @email.com', 'ana@email.c'])('recusa "%s"', (email) => {
    expect(validateEmail(email)).not.toBeNull();
  });
});

describe('senha', () => {
  it('aceita 6+ caracteres com letra e número', () => {
    expect(validatePassword('truco1')).toBeNull();
  });

  it.each(['', 'abc1', 'abcdefgh', '12345678'])('recusa "%s"', (password) => {
    expect(validatePassword(password)).not.toBeNull();
  });

  it('confirmação precisa ser igual', () => {
    expect(validatePasswordConfirmation('truco1', 'truco1')).toBeNull();
    expect(validatePasswordConfirmation('truco1', 'truco2')).not.toBeNull();
  });
});

describe('nome', () => {
  it.each(['Caio', 'João Pedro', 'Bia 2'])('aceita %s', (name) => {
    expect(validateDisplayName(name)).toBeNull();
  });

  it.each(['', 'A', 'nome-com-traço', 'um nome muito comprido demais'])('recusa "%s"', (name) => {
    expect(validateDisplayName(name)).not.toBeNull();
  });
});
