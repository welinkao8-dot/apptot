# Tot Driver - Estabilização

## Status da Depuração
Estamos isolando o erro `this._listeners.forEach` que ocorre ao mudar para o estado Online.

### Ações Realizadas:
1.  **Remoção de Animações de Layout**: Removi os efeitos `FadeInUp` e `FadeInRight` que podem entrar em conflito com componentes nativos.
2.  **Simplificação de Estilos**: Removi o uso de `interpolateColor` no botão Online, usando agora cores diretas baseadas no estado.
3.  **Desativação Temporária do Mapa Oculto**: Desativei o rastreador de localização oculto que usa o Mapbox para verificar se ele é a fonte do conflito com o sistema de animações.

### Próximos Passos:
- [ ] Testar se o app ainda trava ao ligar o "Online".
- [ ] Se não travar, reativar os componentes um a um para identificar o culpado.
- [ ] Implementar a solução final estável.
