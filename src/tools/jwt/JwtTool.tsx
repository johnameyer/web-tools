import { Alert, Badge, Button, Code, CopyButton, Group, Paper, SimpleGrid, Stack, Switch, Text, Textarea, Title } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { ResultList } from '../../components/ResultList';
import type { ResultRow } from '../../components/ResultList';
import { formatIso, formatRelative } from '../timestamp/timestamp';

import { decodeJwt, keyKindFor, timeClaims, tokenStatus, verifyJwt } from './jwt';
import type { DecodedJwt, TokenStatus, VerifyOutcome } from './jwt';

const CLAIM_DESCRIPTIONS: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject',
  aud: 'Audience',
  exp: 'Expires',
  nbf: 'Not valid before',
  iat: 'Issued at',
  jti: 'Token ID',
};

const STATUS_BADGES: Record<TokenStatus, { color: string; label: string }> = {
  expired: { color: 'red', label: 'Expired' },
  'not-yet-valid': { color: 'orange', label: 'Not yet valid' },
  valid: { color: 'green', label: 'Not expired' },
  'no-expiry': { color: 'gray', label: 'No expiry claim' },
};

function JsonBlock({ title, value }: { title: string; value: unknown }): ReactElement {
  const text = JSON.stringify(value, null, 2);
  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="xs">
        <Title order={4}>{title}</Title>
        <CopyButton value={text}>
          {({ copied, copy }) => (
            <Button size="compact-sm" variant="subtle" onClick={copy} aria-label={`Copy ${title}`}>{copied ? 'Copied' : 'Copy'}</Button>
          )}
        </CopyButton>
      </Group>
      <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</Code>
    </Paper>
  );
}

function SignatureSection({ jwt }: { jwt: DecodedJwt }): ReactElement {
  const [ keyInput, setKeyInput ] = useState('');
  const [ secretIsBase64, setSecretIsBase64 ] = useState(false);
  const [ verification, setVerification ] = useState<{ id: string; outcome: VerifyOutcome }>();

  const kind = keyKindFor(jwt.header.alg);
  // Identifies the inputs a result belongs to, so a stale result is never shown for new inputs
  const requestId = `${jwt.signingInput}.${jwt.signature}|${keyInput}|${secretIsBase64}`;

  useEffect(() => {
    if (kind === 'none' || !keyInput.trim()) {
      return;
    }
    let cancelled = false;
    verifyJwt(jwt, keyInput, secretIsBase64).then(outcome => {
      if (!cancelled) {
        setVerification({ id: requestId, outcome });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ jwt, keyInput, secretIsBase64, kind, requestId ]);

  const outcome = verification?.id === requestId ? verification.outcome : undefined;

  return (
    <Paper withBorder p="md">
      <Stack>
        <Title order={4}>Signature</Title>
        <Code block style={{ wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{jwt.signature || '(empty)'}</Code>
        {jwt.header.alg === 'none' && (
          <Alert color="orange" title="Unsigned token">This token uses alg "none", so anyone could have created it. Never trust one for authentication.</Alert>
        )}
        {kind === 'none' && jwt.header.alg !== 'none' && (
          <Text size="sm" c="dimmed">Signature verification is not supported for the algorithm {JSON.stringify(jwt.header.alg)}.</Text>
        )}
        {kind !== 'none' && (
          <>
            <Textarea
              label={kind === 'secret' ? 'Secret' : 'Public key'}
              description={kind === 'secret' ? 'The shared HMAC secret' : 'PEM ("BEGIN PUBLIC KEY") or JWK. Nothing leaves your browser.'}
              autosize
              minRows={kind === 'secret' ? 1 : 5}
              value={keyInput}
              onChange={e => setKeyInput(e.currentTarget.value)}
              styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' }}}
              spellCheck={false}
            />
            {kind === 'secret' && (
              <Switch label="Secret is Base64 encoded" checked={secretIsBase64} onChange={e => setSecretIsBase64(e.currentTarget.checked)} />
            )}
            {outcome?.ok && outcome.valid && <Alert color="green" title="Signature verified">The signature matches this key.</Alert>}
            {outcome?.ok && !outcome.valid && <Alert color="red" title="Invalid signature">The signature does not match this key and token.</Alert>}
            {outcome && !outcome.ok && <Alert color="red" title="Can't verify">{outcome.message}</Alert>}
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function JwtTool(): ReactElement {
  const [ input, setInput ] = useState('');
  const [ now, setNow ] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const decoded = useMemo(() => {
    if (!input.trim()) {
      return undefined;
    }
    try {
      return { jwt: decodeJwt(input) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Could not decode this token' };
    }
  }, [ input ]);

  const jwt = decoded?.jwt;
  const claims = jwt ? timeClaims(jwt.payload) : [];
  const status = jwt ? STATUS_BADGES[tokenStatus(jwt.payload, now)] : undefined;
  const otherClaims = jwt ? Object.keys(jwt.payload).filter(name => name in CLAIM_DESCRIPTIONS && !claims.some(c => c.name === name)) : [];

  const claimRows: ResultRow[] = jwt
    ? [
      ...claims.map(claim => ({
        label: `${CLAIM_DESCRIPTIONS[claim.name]} (${claim.name})`,
        value: formatIso(claim.date, 'UTC'),
        note: formatRelative(claim.date, now),
      })),
      ...otherClaims.map(name => ({ label: `${CLAIM_DESCRIPTIONS[name]} (${name})`, value: JSON.stringify(jwt.payload[name]) })),
    ]
    : [];

  return (
    <Stack>
      <Textarea
        label="Token"
        description="Decoded in your browser; the token is never sent anywhere"
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        autosize
        minRows={5}
        maxRows={14}
        value={input}
        onChange={e => setInput(e.currentTarget.value)}
        styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', wordBreak: 'break-all' }}}
        spellCheck={false}
      />
      <Group>
        <Button variant="default" onClick={() => setInput('')} disabled={!input}>Clear</Button>
      </Group>
      {decoded?.error && <Alert color="red" title="Can't decode">{decoded.error}</Alert>}
      {jwt && status && (
        <>
          <Group>
            <Badge color={status.color} size="lg">{status.label}</Badge>
            {typeof jwt.header.alg === 'string' && <Badge variant="outline" size="lg">{jwt.header.alg}</Badge>}
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <JsonBlock title="Header" value={jwt.header} />
            <JsonBlock title="Payload" value={jwt.payload} />
          </SimpleGrid>
          {claimRows.length > 0 && <ResultList rows={claimRows} />}
          <SignatureSection jwt={jwt} key={jwt.signingInput} />
        </>
      )}
    </Stack>
  );
}
