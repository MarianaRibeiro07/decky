import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { signIn } from '../../src/auth/AuthProvider';
import { validateEmail } from '../../src/auth/validators';
import { errorMessage } from '../../src/lib/errors';
import { Button } from '../../src/ui/Button';
import { Logo } from '../../src/ui/Logo';
import { Notice } from '../../src/ui/Notice';
import { Screen } from '../../src/ui/Screen';
import { TextField } from '../../src/ui/TextField';
import { colors, font } from '../../src/ui/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    // REGEX antes de qualquer chamada ao servidor. No login a senha só precisa estar preenchida:
    // a regra de formato vale no cadastro, e a mensagem de erro não revela qual campo falhou.
    const next = { email: validateEmail(email), password: password ? null : 'Informe a senha.' };
    setErrors(next);
    setServerError(null);
    if (next.email || next.password) return;

    setLoading(true);
    try {
      await signIn(email, password);
      // A guarda de sessão do layout leva para a tela inicial.
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Logo size={180} />
      <Text style={styles.subtitle}>Truco Paulista sem baralho na mesa</Text>
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="nome@email.com"
      />
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={submit}
      />
      <Notice kind="error" message={serverError} />
      <Button label="Entrar" onPress={submit} loading={loading} />
      <Button label="Criar conta" variant="secondary" onPress={() => router.push('/register')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: font.body, color: colors.muted, textAlign: 'center', marginTop: -8 },
});
