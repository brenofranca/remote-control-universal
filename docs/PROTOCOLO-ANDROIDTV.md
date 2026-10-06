# Protocolo Android TV Remote v2

Protocolo não oficial, obtido por engenharia reversa. Referência de implementação: projeto `androidtvremote2` (Python, tronikos), arquivos `polo.proto`, `remotemessage.proto`, `pairing.py`, `remote.py` e `base.py`.

**Status:** o codec (`src/drivers/androidtv/protocol/`) foi conferido contra essa referência e coberto por testes, inclusive com um vetor de segredo de pareamento gerado pelo algoritmo Python original. **Ainda não foi validado contra uma TV real**; isso ocorre na etapa de integração no dispositivo.

## Portas e transporte

| Porta | Uso |
|---|---|
| 6467 | Pareamento |
| 6466 | Controle |

Ambas usam TLS com **certificado de cliente**. A TV aceita certificado autoassinado, e o cliente não valida a cadeia do certificado da TV (autoassinado); a proteção vem do pinning no primeiro pareamento.

Mensagens são protobuf com prefixo de tamanho em varint (`FrameDecoder`). Um único `read` do socket pode trazer parte de uma mensagem, várias, ou cortar no meio do varint; o decoder faz o buffer e impõe tamanho máximo. Tamanho corrompido encerra a conexão, pois o stream não ressincroniza.

## Descoberta

mDNS `_androidtvremote2._tcp.local`. O registro traz nome amigável, IP e porta 6466.

## Certificado de cliente

Gerado uma única vez no aparelho (RSA 2048, expoente 65537, autoassinado, CN igual a um nome do cliente, `basicConstraints CA:true`) e guardado no SecureStore. O mesmo certificado é reutilizado em todas as conexões. A referência usa validade de 10 anos.

## Pareamento (porta 6467)

Toda mensagem é um `OuterMessage` com `protocol_version = 2` e `status = 200`. Qualquer status diferente de 200 vindo da TV é falha.

Sequência:

1. TLS com certificado do cliente.
2. Cliente envia `PairingRequest` com `service_name = "atvremote"` e o nome do cliente (aparece na TV).
3. TV responde `PairingRequestAck`.
4. Cliente envia `Options` (codificação hexadecimal, comprimento 6, papel INPUT).
5. TV responde `Options`. Cliente envia `Configuration` e recebe `ConfigurationAck`.
6. A **TV exibe um código de 6 caracteres hexadecimais**.
7. Usuário digita o código no app.
8. Cliente calcula o segredo e envia como `Secret`:

   ```
   SHA-256( clientModulus || clientExponent || serverModulus || serverExponent || bytes(código[2:]) )
   ```

   Módulo e expoente são big-endian, sem zeros à esquerda e sem byte de sinal (equivalente a `bytes.fromhex(f"{n:X}")` da referência). O expoente 65537 vira `01 00 01`. Os dois primeiros caracteres do código não entram no hash.
9. **Verificação local antes de enviar:** o primeiro byte do hash deve ser igual aos dois primeiros caracteres do código. Se não for, o usuário digitou errado, e o app avisa sem gastar uma tentativa na TV.
10. TV responde `SecretAck`.

O código tem exatamente 6 caracteres hexadecimais. O certificado da TV é obtido do socket TLS (`getPeerCertificate`); módulo e expoente dele entram no hash. O app aplica limite de tentativas.

## Controle (porta 6466)

- A TV envia `remote_configure` com as features que suporta (`code1`). O cliente responde com `remote_configure` contendo `code1 = features_desejadas & features_suportadas` e a identificação do app (`package_name = "atvremote"`, `app_version = "1.0.0"`).
- A TV envia `remote_set_active`; o cliente responde com as features ativas.
- A TV envia `remote_start { started }` quando está pronta para receber teclas. `started` indica se está ligada.
- Features (bitmask): PING 1, KEY 2, IME 4, VOICE 8, POWER 32, VOLUME 64, APP_LINK 512. O app ativa PING, KEY, POWER, VOLUME e APP_LINK.
- Keep-alive: TV envia `remote_ping_request { val1 }`, cliente responde `remote_ping_response { val1 }` com o mesmo valor. Sem resposta, a TV derruba a conexão.
- Tecla: `remote_key_inject { key_code, direction }`, onde `direction` é `SHORT` para toque, ou `START_LONG`/`END_LONG` para pressionar e segurar.
- Abrir app: `remote_app_link_launch_request { app_link }` (campo 90 do `RemoteMessage`), exige a feature APP_LINK. O app usa `market://launch?id=<pacote>`, que pede à Play Store da TV para abrir o app instalado; o mapa `TvApp` → pacote fica em `app-links.ts`.
- Mensagens recebidas úteis: volume atual, app em foco, estado de energia.

## Mapeamento inicial de teclas

| RemoteKey | KeyCode Android |
|---|---|
| DPAD_UP/DOWN/LEFT/RIGHT | 19/20/21/22 |
| OK | 23 (DPAD_CENTER) |
| BACK | 4 |
| HOME | 3 |
| POWER | 26 |
| VOLUME_UP/DOWN | 24/25 |
| MUTE | 164 (`KEYCODE_VOLUME_MUTE`; o 91 `KEYCODE_MUTE` é o mudo do microfone) |
| CHANNEL_UP/DOWN | 166/167 |
| 0–9 | 7–16 |
| PLAY_PAUSE / REWIND / FAST_FORWARD | 85 / 89 / 90 |

## Bibliotecas planejadas

- `react-native-tcp-socket`: TLS com certificado de cliente.
- Codec protobuf próprio e mínimo (`wire.ts`): as mensagens usadas são poucas, e isso evita uma dependência com parsing dinâmico. Cobre varint e length-delimited; ignora fixed32/fixed64; rejeita grupos.
- `react-native-zeroconf`: mDNS.
- `node-forge`: geração do certificado RSA e SHA-256 (JS puro, sem módulo nativo adicional).
- `expo-secure-store`: armazenamento do certificado.

Todas exigem development build.

## Tratamento de erros

- Timeout de conexão e de resposta.
- Reconexão com backoff limitado.
- Mensagens acima do tamanho máximo são descartadas e a conexão é encerrada.
- Erros expostos à UI como tipos do domínio, sem detalhes internos.
