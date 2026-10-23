# InMoov Hub — Frontend

Dashboard React + Vite do InMoov Hub. A interface recebe o vídeo e o estado biométrico pelo WebSocket do backend e permite controlar os modos de movimento:

- **Ao vivo:** envia as poses detectadas pela câmera.
- **Gravado:** reproduz em loop a sequência selecionada na biblioteca de arquivos `.txt`.
- **Gravação:** salva novas sequências nomeadas na pasta `../movimentos/` através da API FastAPI.
- **Biblioteca:** seleciona comandos em um dropdown e permite renomear ou excluir a sequência escolhida.

## Executar

Na raiz do projeto, inicie primeiro o backend:

```bash
python app.py
```

Depois, em `frontend/`:

```bash
npm install
npm run dev
```

Abra o endereço informado pelo Vite, normalmente `http://localhost:5173`.

Consulte o [README principal](../README.md) para os pré-requisitos, configuração do BLE e detalhes da API de movimentos.
