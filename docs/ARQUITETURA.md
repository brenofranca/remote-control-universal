# Arquitetura — Controle Remoto Universal

## Objetivo

Aplicativo de controle remoto que localiza a TV automaticamente na rede local e a controla com uma interface neutra, independente de marca. MVP: TCL com Google TV / Android TV.

## Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Plataforma | Expo (development build) + React Native | Um código para iOS e Android |
| Estilo | NativeWind v4 | Tema claro/escuro e design system por classes |
| Roteamento | Expo Router | Convenção do ecossistema Expo |
| Linguagem | TypeScript strict | Segurança de tipos nos protocolos |
| Estado | Zustand | Simples, sem boilerplate |
| Marca inicial | Google TV / Android TV (TCL) | Sistema mais comum nas TCL do Brasil |
| Expo Go | **Não suportado** | Sockets TCP/TLS e mDNS exigem módulos nativos |

## Estrutura

```
app/                  rotas (Expo Router)
src/
  domain/             TvDevice, RemoteKey, TvDriver (sem dependência de framework)
  drivers/
    androidtv/        pareamento, controle, protobuf, certificado
    roku/             (fase futura)
  discovery/          MdnsScanner, DiscoveryService
  state/              stores Zustand
  ui/                 componentes NativeWind
  security/           validação de IP privado, cofre de certificado, rate limit
docs/
```

## Princípios

- **Ports & adapters.** A UI conhece apenas `RemoteKey` e `TvDriver`. Cada marca é um adapter que traduz `RemoteKey` para seu protocolo (Open/Closed, Dependency Inversion).
- **Factory** escolhe o driver a partir do serviço anunciado na descoberta.
- **Strategy** para variação de protocolo por marca.
- Domínio em TS puro, testável sem React Native.

## Contrato do domínio

```ts
interface TvDriver {
  connect(device: TvDevice): Promise<Result<void>>;
  disconnect(): Promise<void>;
  sendKey(key: RemoteKey): Promise<Result<void>>;
  readonly status: ConnectionStatus;
}
```

`RemoteKey` é um enum universal (DPAD_*, OK, BACK, HOME, POWER, VOLUME_*, MUTE, CHANNEL_*, dígitos, mídia).

## Descoberta

1. mDNS `_androidtvremote2._tcp` retorna nome, IP e porta.
2. Fallback: IP manual, validado contra faixas privadas.
3. Última TV pareada é persistida.
4. Roteadores com isolamento de clientes bloqueiam mDNS, e o fallback cobre esse caso.

## Fluxo de pareamento

```
Descobrir TV → escolher → TV exibe código de 6 dígitos → usuário digita
→ app envia segredo → TV confirma → certificado da TV fixado (TOFU) → conectado
```

## Segurança

- Só IPs privados (RFC1918, link-local) são aceitos como destino.
- Certificado de cliente e chave privada no `expo-secure-store` (Keychain/Keystore). Nunca em log.
- Certificado da TV fixado no primeiro pareamento (trust-on-first-use).
- Código de pareamento nunca é logado.
- Rate limit de teclas e de tentativas de pareamento.
- Parsing de mensagens com limite de tamanho e erros tratados explicitamente.
- Permissões: `NSLocalNetworkUsageDescription` e `NSBonjourServices` (iOS); multicast (Android).
- Nenhum secret no código.

## Design universal

- D-pad circular com OK central, Voltar/Home, volume/mudo, canais, mídia, power.
- Teclado numérico em bottom-sheet.
- Tema claro/escuro automático (`dark:`).
- Alvos de toque de no mínimo 48dp, `expo-haptics`, labels de acessibilidade, contraste AA.
- i18n pt-BR e en.
- Ícones neutros, sem marca.

## Testes

- Unitários: domínio, mapeamento de teclas, codec protobuf, validação de IP.
- Integração: servidor TLS falso simulando pareamento e controle.
- Segurança: IPs públicos rejeitados, mensagens malformadas, rate limit.

## Riscos

- Protocolo não oficial; pode mudar com atualização da TV.
- Teste exige dispositivo real na mesma Wi-Fi da TV.
- iOS com conta Apple gratuita: build instalado **expira em 7 dias**.
