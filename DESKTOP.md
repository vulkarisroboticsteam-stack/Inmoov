# Aplicativo desktop InMoov Hub

O aplicativo desktop usa Electron para abrir o painel em uma janela própria. O backend Python e suas bibliotecas são empacotados junto com a interface; a pessoa que instala não precisa instalar Python ou Node.js.

A versão aparece ao lado do nome do aplicativo e vem de `frontend/package.json`. Em builds de tag, o workflow aplica a versão da própria tag antes de compilar.

## Plataformas geradas

- Windows x64: instalador `.exe`.
- Linux x64 e ARM64: `.AppImage` e pacote `.deb`.
- macOS Intel e Apple Silicon: `.dmg` e `.zip`.

O Windows ARM64 não está incluído porque a versão do MediaPipe usada pelo projeto não oferece wheel para essa plataforma. O firmware da ESP32 continua sendo carregado separadamente pela Arduino IDE.

Os pacotes de macOS serão gerados sem assinatura/notarização. Para distribuição pública no macOS, será necessário configurar as credenciais de assinatura da Apple no GitHub.

## Desenvolvimento local

Instale Python 3.10 e Node.js 22.13 ou mais recente. Em um terminal, instale os pacotes Python e inicie o backend:

```powershell
python -m pip install -r requirements.txt
python app.py
```

Em outro terminal, inicie a interface e a janela Electron:

```powershell
cd frontend
npm ci
npm run desktop:dev
```

O modo de desenvolvimento usa o servidor Python iniciado no primeiro terminal e encaminha as chamadas do painel para ele.

## Gerar um pacote na máquina local

```powershell
cd frontend
npm ci
npm run build
cd ..
python -m pip install -r requirements.txt -r requirements-build.txt
python scripts/build_backend.py
cd frontend
npm run desktop:dist -- --win nsis
```

O empacotamento deve ser executado no sistema de destino. Para Linux e macOS, use os argumentos da plataforma correspondente; o GitHub Actions faz esses builds em runners nativos.

## Builds automáticos no GitHub

- Cada push para `main` gera instaladores como artefatos do workflow **Build desktop installers**. Eles ficam disponíveis por 30 dias na página da execução.
- Criar uma tag `v*` executa a matriz e publica os instaladores em uma GitHub Release. A versão dos instaladores vem da tag, por exemplo `v0.1.1`.
- Os binários ficam nos artefatos e releases, não no histórico Git. Assim, o repositório não acumula executáveis grandes e distintos para cada sistema.

## Dependências no computador de destino

Python, Node, Electron, MediaPipe, OpenCV e as outras bibliotecas Python ficam dentro do instalador. O pacote `.deb` declara BlueZ e as bibliotecas nativas de Electron/OpenCV para que o gerenciador Linux as instale. O `.AppImage` não instala pacotes no sistema: nesse formato, BlueZ e as bibliotecas gráficas precisam existir no Linux. Em ambos os formatos, o usuário ainda precisa ter permissão para acessar a câmera e o Bluetooth.
